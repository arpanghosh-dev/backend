import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  AWS_REGION: z.string().min(1, "AWS_REGION is required"),
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required"),
  AWS_BUCKET_NAME: z.string().min(1, "AWS_BUCKET_NAME is required"),

  STORAGE_LIMIT_GB: z.coerce.number().positive().default(10),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().max(5120).default(5120),

  UPLOAD_URL_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(604800).default(900),
  DOWNLOAD_URL_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(604800).default(300),
  CLEANUP_INTERVAL_MINUTES: z.coerce.number().positive().default(5),

  FRONTEND_URL: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env: Env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
