import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` (postinstall) не потребує БД, тож без .env не падаємо.
// Для migrate/studio DATABASE_URL має бути заданий в apps/api/.env.
const PLACEHOLDER_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? PLACEHOLDER_URL },
});
