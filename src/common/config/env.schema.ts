import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().integer().min(1).max(65535).required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRATION: Joi.string().required(),

  CORS_ORIGINS: Joi.string().required(),

  GEMINI_API_KEY: Joi.string().optional(),
  GEMINI_API_ENDPOINT: Joi.string().uri().optional(),
  GEMINI_MODEL: Joi.string().optional(),
  GEMINI_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(15000),

  RESEND_API_KEY: Joi.string().optional(),
  RESEND_FROM_EMAIL: Joi.string().email().optional(),

  ZAPI_INSTANCE_ID: Joi.string().optional(),
  ZAPI_TOKEN: Joi.string().optional(),
  ZAPI_CLIENT_TOKEN: Joi.string().optional(),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .optional(),
}).unknown(true);

export const envValidationOptions = {
  abortEarly: false,
};
