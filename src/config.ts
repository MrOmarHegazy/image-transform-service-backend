import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CLIPDROP_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  CORS_ORIGIN: z.string().default("*"),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);
