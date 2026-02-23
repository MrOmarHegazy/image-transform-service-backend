import type { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export interface ImageRow {
  id: string;
  user_id: string;
  processed_path: string;
  processed_url: string;
  created_at: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export type AuthRequest = Request & { userId: string };
