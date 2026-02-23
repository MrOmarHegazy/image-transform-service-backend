import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { config } from "./config";
import { authMiddleware } from "./middleware/auth";
import imagesRouter from "./routes/images";

import "./types";

const app = express();

app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use("/api/images", authMiddleware as express.RequestHandler, imagesRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
});

export default app;
