import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import multer, { MulterError } from "multer";
import { config } from "../config";
import { supabase } from "../lib/supabase";
import { removeBackground } from "../lib/clipdrop";
import { flipHorizontal } from "../lib/image";
import type { ImageRow } from "../types";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
});

const router = Router();

// --------------- POST /api/images ---------------
router.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: {
            code: "FILE_TOO_LARGE",
            message: `File exceeds ${config.MAX_UPLOAD_MB} MB limit`,
          },
        });
        return;
      }
      if (err) {
        next(err);
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          error: { code: "NO_FILE", message: "No file provided" },
        });
        return;
      }

      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        res.status(400).json({
          error: {
            code: "INVALID_FILE_TYPE",
            message: "Only JPEG, PNG, and WebP images are accepted",
          },
        });
        return;
      }

      let noBgBuffer: Buffer;
      try {
        noBgBuffer = await removeBackground(file.buffer, file.mimetype);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Background removal failed";
        console.error("Clipdrop error:", message);
        res.status(502).json({
          error: { code: "CLIPDROP_ERROR", message },
        });
        return;
      }

      const processedBuffer = await flipHorizontal(noBgBuffer);

      const imageId = crypto.randomUUID();
      const userId = req.userId!;
      const storagePath = `${userId}/${imageId}.png`;
      const processedUrl = `${config.SUPABASE_URL}/storage/v1/object/public/images/${storagePath}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(storagePath, processedBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError.message);
        res.status(500).json({
          error: { code: "STORAGE_ERROR", message: "Failed to upload processed image" },
        });
        return;
      }

      const { data, error: dbError } = await supabase
        .from("images")
        .insert({
          id: imageId,
          user_id: userId,
          processed_path: storagePath,
          processed_url: processedUrl,
        })
        .select()
        .single<ImageRow>();

      if (dbError) {
        console.error("DB insert error:", dbError.message);
        await supabase.storage.from("images").remove([storagePath]);
        res.status(500).json({
          error: { code: "DB_ERROR", message: "Failed to save image record" },
        });
        return;
      }

      res.status(200).json({
        id: data.id,
        processedUrl: data.processed_url,
        createdAt: data.created_at,
      });
    } catch (err) {
      next(err);
    }
  },
);

// --------------- GET /api/images ---------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from("images")
      .select("*")
      .eq("user_id", req.userId!)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("DB select error:", error.message);
      res.status(500).json({
        error: { code: "DB_ERROR", message: "Failed to fetch images" },
      });
      return;
    }

    const rows = (data as ImageRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      processedUrl: row.processed_url,
      createdAt: row.created_at,
    }));

    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

// --------------- DELETE /api/images/:id ---------------
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: row, error: fetchError } = await supabase
      .from("images")
      .select("*")
      .eq("id", id)
      .single<ImageRow>();

    if (fetchError || !row) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Image not found" },
      });
      return;
    }

    if (row.user_id !== req.userId!) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not own this image" },
      });
      return;
    }

    const { error: storageError } = await supabase.storage
      .from("images")
      .remove([row.processed_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError.message);
    }

    const { error: dbError } = await supabase
      .from("images")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("DB delete error:", dbError.message);
      res.status(500).json({
        error: { code: "DB_ERROR", message: "Failed to delete image record" },
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
