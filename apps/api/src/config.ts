import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().min(1),
  UPLOAD_DIR: z.string().min(1).default("./var/uploads"),
  WEB_ORIGIN: z.string().url(),
  DINGTALK_CLIENT_ID: z.string().min(1),
  DINGTALK_CLIENT_SECRET: z.string().min(1),
  DINGTALK_REDIRECT_URI: z.string().url(),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function readDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  return z.string().min(1).parse(environment.DATABASE_URL);
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return environmentSchema.parse(environment);
}
