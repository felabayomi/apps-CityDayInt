type VercelHandler = (req: any, res: any) => Promise<any> | any;

export default async function handler(req: any, res: any) {
	try {
		const mod = (await import("../dist/vercel-handler.js")) as {
			default: VercelHandler;
		};
		return mod.default(req, res);
	} catch (error: any) {
		console.error("[api/[...slug]] Failed to load dist/vercel-handler.js", error);
		return res.status(500).json({
			message: "API bootstrap failed",
			error: String(error?.message || error),
		});
	}
}
