// src/config/env.ts
import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT),

  mongoUri: process.env.MONGO_URI,
  mongoDbName: process.env.MONGO_DB_NAME ?? "decizhen",

  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  googleOauthRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  appleOauthClientId: process.env.APPLE_OAUTH_CLIENT_ID,
  appleOauthClientSecret: process.env.APPLE_OAUTH_CLIENT_SECRET,
  appleOauthRedirectUri: process.env.APPLE_OAUTH_REDIRECT_URI,

  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST,
  redisPort: Number(process.env.REDIS_PORT),
  redisPassword: process.env.REDIS_PASSWORD ?? "",
  redisDisabled: process.env.REDIS_DISABLED === "true",

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,

  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),

  geocodeBaseUrl: process.env.GEOCODE_BASE_URL,
  geocodeUserAgent: process.env.GEOCODE_USER_AGENT,
  geocodeAcceptLanguage: process.env.GEOCODE_ACCEPT_LANGUAGE,
  geocodeCacheTtlSeconds: Number(process.env.GEOCODE_CACHE_TTL_SECONDS ?? 3600),

  presenceTtlSeconds: Number(process.env.PRESENCE_TTL_SECONDS ?? 60),
}));
