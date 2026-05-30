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

  // Master (system owner) credentials. Consumed by the SeedMasterFromEnv
  // migration; required at boot too so the master-key is never silently
  // missing. MASTER_PASSWORD must be strong: min 12 chars with uppercase,
  // lowercase, number and symbol.
  MASTER_EMAIL: Joi.string().email().required(),
  MASTER_PASSWORD: Joi.string()
    .min(12)
    .pattern(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
    .required()
    .messages({
      'string.pattern.base':
        'MASTER_PASSWORD must contain an uppercase letter, a lowercase letter, a number and a symbol.',
    }),

  CORS_ORIGINS: Joi.string().required(),

  GEMINI_API_KEY: Joi.string().optional(),
  GEMINI_API_ENDPOINT: Joi.string().uri().optional(),
  GEMINI_MODEL: Joi.string().optional(),
  GEMINI_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(15000),

  RESEND_API_KEY: Joi.string().optional(),
  RESEND_FROM_EMAIL: Joi.string().email().optional(),
  RESEND_WEBHOOK_SECRET: Joi.string().optional(),

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
