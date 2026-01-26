// src/config/env.validation.ts
import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").required(),
  PORT: Joi.number().required(),

  MONGO_URI: Joi.string().required(),
  MONGO_DB_NAME: Joi.string().default("decizhen"),

  JWT_SECRET: Joi.string().min(32).required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  REDIS_PASSWORD: Joi.string().allow("").optional(),

  ALLOWED_ORIGINS: Joi.string().required(),

  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(100),
}).unknown(true);
