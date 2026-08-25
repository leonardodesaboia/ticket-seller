import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  CORS_ORIGINS: z.string().default('*'),
  REDIS_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url(),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default('noreply@ticket-seller.local'),
  // Payout gateway secret — required in production, optional in development
  FAKE_PAYOUT_SECRET: z.string().optional(),
  // JWT authentication — JWT_SECRET required in production
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),
  // Email provider
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().email().default('noreply@ticket-seller.com'),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  // Object storage
  OBJECT_STORAGE_PROVIDER: z.enum(['minio', 's3']).default('minio'),
  MINIO_ENDPOINT: z.string().default('http://localhost:9000'),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('ticket-seller'),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  // Admin notification email — receives internal operational alerts (chargebacks, event cancellations)
  ADMIN_NOTIFICATION_EMAIL: z.string().email().default('admin@ticket-seller.local'),
  // Outbox polling interval (ms)
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(5000),
  // OpenTelemetry (opt-in)
  OTEL_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  OTEL_SERVICE_NAME: z.string().default('ticket-seller-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === 'production' && !parsed.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production (minimum 32 characters)');
}

if (parsed.NODE_ENV === 'production' && parsed.CORS_ORIGINS.includes('*')) {
  throw new Error(
    'CORS_ORIGINS cannot contain wildcard (*) in production. Set explicit allowed origins.',
  );
}

if (parsed.OBJECT_STORAGE_PROVIDER === 's3' && !parsed.AWS_S3_BUCKET) {
  throw new Error('AWS_S3_BUCKET is required when OBJECT_STORAGE_PROVIDER is s3');
}

export const env = parsed;
