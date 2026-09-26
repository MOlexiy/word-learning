import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = app.get<Env>(ENV);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Відповіді API персональні (куки) — жодних кешів на проксі/CDN (Vercel, Render).
  app.use((_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  if (env.TRUST_PROXY) app.set('trust proxy', true);
  app.enableShutdownHooks();

  // У dev фронт ходить через proxy (той самий origin) — CORS не потрібен.
  if (env.WEB_ORIGIN) {
    app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  }

  await app.listen(env.PORT);
  Logger.log(`API: http://localhost:${env.PORT}/api`, 'Bootstrap');
}

void bootstrap();
