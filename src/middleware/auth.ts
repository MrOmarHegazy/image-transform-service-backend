import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Let CORS preflight pass (no auth header on OPTIONS)
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Missing or malformed Authorization header" },
    });
    return;
  }

  const token = header.slice(7).trim();

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    });
    return;
  }

  req.userId = data.user.id;
  next();
}