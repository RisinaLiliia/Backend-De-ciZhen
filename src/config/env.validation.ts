// src/config/env.validation.ts
import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").required(),
  PORT: Joi.number().required(),
  SWAGGER_ENABLED: Joi.string().valid("true", "false").optional(),
  SWAGGER_PATH: Joi.string().trim().min(1).optional(),

  MONGO_URI: Joi.string().required(),
  MONGO_DB_NAME: Joi.string().default("decizhen"),
  MONGO_SERVER_SELECTION_TIMEOUT_MS: Joi.number().min(1000).default(30000),

  JWT_SECRET: Joi.string().min(32).required(),
  FRONTEND_URL: Joi.string().uri().optional(),
  TRUST_PROXY: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).optional(),
  GOOGLE_OAUTH_CLIENT_ID: Joi.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: Joi.string().uri().optional(),
  APPLE_OAUTH_CLIENT_ID: Joi.string().optional(),
  APPLE_OAUTH_CLIENT_SECRET: Joi.string().optional(),
  APPLE_OAUTH_REDIRECT_URI: Joi.string().uri().optional(),

  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().when("REDIS_DISABLED", {
    is: "true",
    then: Joi.optional(),
    otherwise: Joi.when("REDIS_URL", {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
  }),
  REDIS_PORT: Joi.number().when("REDIS_DISABLED", {
    is: "true",
    then: Joi.optional(),
    otherwise: Joi.when("REDIS_URL", {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
  }),

  REDIS_PASSWORD: Joi.string().allow("").optional(),
  REDIS_DISABLED: Joi.string().valid("true", "false").optional(),

  ALLOWED_ORIGINS: Joi.string().required(),

  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),

  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(100),

  GEOCODE_BASE_URL: Joi.string().uri().optional(),
  GEOCODE_USER_AGENT: Joi.string().optional(),
  GEOCODE_ACCEPT_LANGUAGE: Joi.string().optional(),
  GEOCODE_CACHE_TTL_SECONDS: Joi.number().min(0).optional(),

  PRESENCE_TTL_SECONDS: Joi.number().min(5).max(3600).optional(),
  GEONAMES_IMPORT_RETRY_ATTEMPTS: Joi.number().min(1).max(20).optional(),
  GEONAMES_IMPORT_RETRY_BASE_DELAY_MS: Joi.number().min(100).max(60000).optional(),

  SEARCH_ANALYTICS_BUCKET_SECONDS: Joi.number().min(60).max(86400).optional(),
  SEARCH_ANALYTICS_DEDUPE_TTL_SECONDS: Joi.number().min(60).max(172800).optional(),
  ANALYTICS_HASH_SALT: Joi.string().allow("").optional(),
}).unknown(true);
