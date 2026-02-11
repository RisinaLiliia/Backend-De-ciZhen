// src/config/env.validation.ts
import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").required(),
  PORT: Joi.number().required(),

  MONGO_URI: Joi.string().required(),
  MONGO_DB_NAME: Joi.string().default("decizhen"),

  JWT_SECRET: Joi.string().min(32).required(),

  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().when(Joi.ref("REDIS_DISABLED"), {
  is: true,
  then: Joi.optional(),
  otherwise: Joi.when("REDIS_URL", { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
}),
REDIS_PORT: Joi.number().when(Joi.ref("REDIS_DISABLED"), {
  is: true,
  then: Joi.optional(),
  otherwise: Joi.when("REDIS_URL", { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
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
}).unknown(true);
