// src/config/env.ts
import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT),

  mongoUri: process.env.MONGO_URI,
  mongoDbName: process.env.MONGO_DB_NAME ?? "decizhen",

  jwtSecret: process.env.JWT_SECRET,

  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST,
  redisPort: Number(process.env.REDIS_PORT),
  redisPassword: process.env.REDIS_PASSWORD ?? "",
  redisDisabled: process.env.REDIS_DISABLED === "true",

  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
}));
