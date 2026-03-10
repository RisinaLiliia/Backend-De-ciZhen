// src/config/env.ts
import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT),

  mongoUri: process.env.MONGO_URI,
  mongoDbName: process.env.MONGO_DB_NAME ?? "decizhen",

  jwtSecret: process.env.JWT_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
  trustProxy: process.env.TRUST_PROXY ?? "0",
  privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION ?? "2026-02-18",
  passwordResetTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30),
  passwordResetPath: process.env.PASSWORD_RESET_PATH ?? "/auth/reset-password",
  passwordResetReturnLink: process.env.PASSWORD_RESET_RETURN_LINK === "true",
  passwordResetEmailMode: process.env.PASSWORD_RESET_EMAIL_MODE ?? "disabled",
  passwordResetEmailWebhookUrl: process.env.PASSWORD_RESET_EMAIL_WEBHOOK_URL,
  passwordResetEmailWebhookBearer: process.env.PASSWORD_RESET_EMAIL_WEBHOOK_BEARER,
  passwordResetEmailFrom: process.env.PASSWORD_RESET_EMAIL_FROM,
  passwordResetEmailFromName: process.env.PASSWORD_RESET_EMAIL_FROM_NAME ?? "De'ciZhen",
  passwordResetEmailSubject:
    process.env.PASSWORD_RESET_EMAIL_SUBJECT ?? "Reset your De'ciZhen password",
  passwordResetBrevoApiUrl:
    process.env.PASSWORD_RESET_BREVO_API_URL ?? "https://api.brevo.com/v3/smtp/email",
  passwordResetBrevoApiKey: process.env.PASSWORD_RESET_BREVO_API_KEY,
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

  searchAnalyticsBucketSeconds: Number(process.env.SEARCH_ANALYTICS_BUCKET_SECONDS ?? 900),
  searchAnalyticsDedupeTtlSeconds: Number(process.env.SEARCH_ANALYTICS_DEDUPE_TTL_SECONDS ?? 1020),
  analyticsHashSalt: process.env.ANALYTICS_HASH_SALT ?? "",
}));
