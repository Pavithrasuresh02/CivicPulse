import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',

  PORT: Number(process.env.PORT) || 5000,

  DATABASE_URL: process.env.DATABASE_URL || '',

  DATABASE_SSL: process.env.DATABASE_SSL === 'true',

  JWT_SECRET: process.env.JWT_SECRET || '',

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',

  FRONTEND_URLS: (process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // OpenRouter AI
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',

  OPENROUTER_MODEL:
    process.env.OPENROUTER_MODEL || 'openrouter/free',

  // Cloudinary
  CLOUDINARY_CLOUD_NAME:
    process.env.CLOUDINARY_CLOUD_NAME || '',

  CLOUDINARY_API_KEY:
    process.env.CLOUDINARY_API_KEY || '',

  CLOUDINARY_API_SECRET:
    process.env.CLOUDINARY_API_SECRET || '',
};

export function assertEnv({ requireAI = false } = {}) {
  const problems = [];

  if (!env.DATABASE_URL) {
    problems.push('DATABASE_URL is required');
  }

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    problems.push(
      'JWT_SECRET must be at least 32 characters'
    );
  }

  if (requireAI && !env.OPENROUTER_API_KEY) {
    problems.push(
      'OPENROUTER_API_KEY is required'
    );
  }

  if (problems.length) {
    throw new Error(
      `Invalid environment configuration: ${problems.join('; ')}`
    );
  }
}

export const cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);