import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { Resend } from "resend";
import crypto from "crypto";
import { pool } from "./db";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_RESEND_COOLDOWN_MS = 30 * 1000;
const sessionConnectionString = (
    process.env.CITYDAYINT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ""
).trim();

const parseAdminEmails = () => {
    const emails = new Set<string>();

    const fromList = String(process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

    fromList.forEach((email) => emails.add(email));

    const adminUsername = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
    if (adminUsername.includes("@")) {
        emails.add(adminUsername);
    }

    // Keep backward compatibility with existing seeded admin account.
    emails.add("wordofday2025@gmail.com");

    return emails;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

const getFromEmail = () =>
    process.env.RESEND_FROM_EMAIL || "Felix Platform <noreply@felixplatforms.com>";

function getResendClient() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return null;
    }

    return new Resend(apiKey);
}

type SessionAuthUser = {
    id: string;
    email: string;
    isAdmin: boolean;
    loggedInAt: number;
};

let ensureAuthCodesTablePromise: Promise<void> | null = null;

async function ensureAuthCodesTable() {
    if (!ensureAuthCodesTablePromise) {
        ensureAuthCodesTablePromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS auth_login_codes (
                    email text PRIMARY KEY,
                    code text NOT NULL,
                    expires_at timestamptz NOT NULL,
                    attempts integer NOT NULL DEFAULT 0,
                    is_admin boolean NOT NULL DEFAULT false,
                    updated_at timestamptz NOT NULL DEFAULT now()
                )
            `);
        })().catch((error) => {
            ensureAuthCodesTablePromise = null;
            throw error;
        });
    }

    return ensureAuthCodesTablePromise;
}

function getAuthSession(req: any) {
    return req.session as any;
}

function userIdFromEmail(email: string) {
    const hex = crypto.createHash("sha256").update(email).digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function isAdminUser(user: any): boolean {
    if (!user) {
        return false;
    }

    if (user.isAdmin === true) {
        return true;
    }

    const adminEmails = parseAdminEmails();
    const email = normalizeEmail(user.email);
    return adminEmails.has(email) || email.includes("admin");
}

export async function setupAuth(app: Express) {
    app.set("trust proxy", 1);

    const pgStore = connectPg(session);
    app.use(
        session({
            secret: process.env.SESSION_SECRET || "citydayint-auth-secret",
            store: new pgStore({
                conString: sessionConnectionString,
                createTableIfMissing: true,
                ttl: SESSION_TTL_MS,
                tableName: "sessions",
            }),
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                maxAge: SESSION_TTL_MS,
            },
        }),
    );

    app.post("/api/auth/request-code", async (req, res) => {
        try {
            await ensureAuthCodesTable();
            const email = normalizeEmail(req.body?.email);

            if (!isValidEmail(email)) {
                return res.status(400).json({ message: "A valid email is required." });
            }

            const now = Date.now();
            const existingCode = await pool.query(
                `SELECT updated_at
                 FROM auth_login_codes
                 WHERE email = $1`,
                [email],
            );

            const updatedAtRaw = existingCode.rows[0]?.updated_at;
            if (updatedAtRaw && now - new Date(updatedAtRaw).getTime() < LOGIN_CODE_RESEND_COOLDOWN_MS) {
                return res.status(429).json({ message: "Please wait a few seconds before requesting another code." });
            }

            const resend = getResendClient();
            if (!resend) {
                return res.status(503).json({ message: "Email sign-in is not configured." });
            }

            const adminEmails = parseAdminEmails();
            const code = generateCode();
            const isAdmin = adminEmails.has(email) || email.includes("admin");

            await pool.query(
                `INSERT INTO auth_login_codes (email, code, expires_at, attempts, is_admin, updated_at)
                 VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 millisecond'), 0, $4, NOW())
                 ON CONFLICT (email)
                 DO UPDATE SET
                    code = EXCLUDED.code,
                    expires_at = EXCLUDED.expires_at,
                    attempts = 0,
                    is_admin = EXCLUDED.is_admin,
                    updated_at = NOW()`,
                [email, code, LOGIN_CODE_TTL_MS, isAdmin],
            );

            await resend.emails.send({
                from: getFromEmail(),
                to: email,
                subject: "Your Daily Felix sign-in code",
                html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Daily Felix - City of the Day</h2>
            <p>Your sign-in code is:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
            <p>This code expires in 10 minutes.</p>
          </div>
        `,
            });

            res.json({ success: true, message: "A sign-in code was sent to your email." });
        } catch (error: any) {
            console.error("[Auth] request-code failed:", error);
            res.status(500).json({ message: "Unable to send sign-in code." });
        }
    });

    app.post("/api/auth/verify-code", async (req, res) => {
        try {
            await ensureAuthCodesTable();
            const email = normalizeEmail(req.body?.email);
            const code = String(req.body?.code || "").trim();
            const authSession = getAuthSession(req);
            const challengeResult = await pool.query(
                `SELECT email, code, expires_at, attempts, is_admin
                 FROM auth_login_codes
                 WHERE email = $1`,
                [email],
            );

            const challenge = challengeResult.rows[0];

            if (!challenge) {
                return res.status(400).json({ message: "Please request a new sign-in code." });
            }

            if (Date.now() > new Date(challenge.expires_at).getTime()) {
                await pool.query(`DELETE FROM auth_login_codes WHERE email = $1`, [email]);
                return res.status(400).json({ message: "Code expired. Please request a new one." });
            }

            if (Number(challenge.attempts) >= 5) {
                return res.status(429).json({ message: "Too many attempts. Request a new code." });
            }

            if (String(challenge.code) !== code) {
                await pool.query(
                    `UPDATE auth_login_codes
                     SET attempts = attempts + 1,
                         updated_at = NOW()
                     WHERE email = $1`,
                    [email],
                );
                return res.status(401).json({ message: "Invalid code." });
            }

            const id = userIdFromEmail(email);

            const authUser: SessionAuthUser = {
                id,
                email,
                isAdmin: Boolean(challenge.is_admin),
                loggedInAt: Date.now(),
            };

            authSession.authUser = authUser;
            await pool.query(`DELETE FROM auth_login_codes WHERE email = $1`, [email]);

            res.json({
                success: true,
                user: {
                    id,
                    email,
                    isAdmin: authUser.isAdmin,
                },
            });
        } catch (error: any) {
            console.error("[Auth] verify-code failed:", error);
            res.status(500).json({ message: "Unable to verify sign-in code." });
        }
    });

    // Compatibility path for old UI links.
    app.get("/api/login", (_req, res) => {
        res.redirect("/auth");
    });

    app.get("/api/callback", (_req, res) => {
        res.redirect("/auth");
    });

    app.get("/api/logout", (req, res) => {
        req.session.destroy(() => {
            res.redirect("/");
        });
    });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
    const authSession = getAuthSession(req);
    const authUser = authSession?.authUser as SessionAuthUser | undefined;

    if (!authUser?.id) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = {
        claims: { sub: authUser.id },
        email: authUser.email,
        isAdmin: authUser.isAdmin,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
    };

    return next();
};
