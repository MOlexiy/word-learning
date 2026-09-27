import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET має бути не коротше 32 символів'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET має бути не коротше 32 символів'),
  COOKIE_SECURE: z.stringbool().default(true),
  /** true за реверс-проксі (Render, Vercel rewrite): IP клієнта з X-Forwarded-For. */
  TRUST_PROXY: z.stringbool().default(false),
  /** Ключ Pexels API (https://www.pexels.com/api/). Без нього картинки до прикладів не показуються. */
  PEXELS_API_KEY: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
  WEB_ORIGIN: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type Env = z.infer<typeof envSchema>;

/** DI-токен конфігурації. */
export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Некоректні змінні оточення (див. apps/api/.env.example):\n${details}`);
  }
  if (result.data.JWT_ACCESS_SECRET === result.data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET і JWT_REFRESH_SECRET мають відрізнятися');
  }
  return result.data;
}
