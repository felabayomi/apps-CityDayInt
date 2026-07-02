import express, { type NextFunction, type Request, type Response } from "express";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let startupError: any = null;

const ready = registerRoutes(app)
    .then(() => {
        app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
            const status = err.status || err.statusCode || 500;
            const message = err.message || "Internal Server Error";
            res.status(status).json({ message });
        });
    })
    .catch((error) => {
        startupError = error;
        console.error("[Vercel Handler] Startup failed:", error);
    });

export default async function handler(req: any, res: any) {
    await ready;

    if (startupError) {
        return res.status(500).json({
            message: "Server startup failed",
            error: String(startupError?.message || startupError),
        });
    }

    return app(req as any, res as any);
}
