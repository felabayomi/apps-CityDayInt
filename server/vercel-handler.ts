import express, { type NextFunction, type Request, type Response } from "express";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const ready = registerRoutes(app).then(() => {
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
    });
});

export default async function handler(req: any, res: any) {
    await ready;
    return app(req as any, res as any);
}
