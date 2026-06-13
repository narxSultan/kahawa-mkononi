import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("365d"),
  CORS_ORIGINS: z.string().default("http://localhost:4200"),
  APP_LATEST_VERSION: z.string().default("0.1.1"),
  APP_LATEST_BUILD_NUMBER: z.coerce.number().int().nonnegative().default(2),
  APP_MIN_SUPPORTED_BUILD_NUMBER: z.coerce.number().int().nonnegative().default(2),
  APP_UPDATE_REQUIRED: z.coerce.boolean().default(true),
  APP_DOWNLOAD_URL: z.string().url().default("https://kahawamkononi.feedbackchap.com/kahawa-mkonon.apk"),
  APP_RELEASE_NOTES: z.string().default("New version available. Please download the latest APK.")
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
