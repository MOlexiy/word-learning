import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ClockModule } from './common/time/clock';
import { ConfigModule } from './config/config.module';
import { HealthController } from './infrastructure/health/health.controller';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { UsersModule } from './modules/users/users.module';
import { AppZodValidationPipe } from './common/errors/zod-validation.pipe';

@Module({
  imports: [ConfigModule, PrismaModule, ClockModule, AuthModule, UsersModule, CardsModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: AppZodValidationPipe },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
