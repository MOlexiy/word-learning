import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { RolesGuard } from '../../common/auth/roles.guard';
import { UsersModule } from '../users/users.module';
import { AuthService } from './application/auth.service';
import { TokenService } from './application/token.service';
import { RefreshTokenRepository } from './domain/refresh-token.repository';
import { AuthCookies } from './infrastructure/auth-cookies';
import { PasswordHasher } from './infrastructure/password-hasher';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard } from './presentation/jwt-auth.guard';

@Module({
  // 10 спроб входу/реєстрації на хвилину з одного IP (in-memory: один інстанс API).
  imports: [JwtModule.register({}), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]), UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthCookies,
    PasswordHasher,
    { provide: RefreshTokenRepository, useClass: PrismaRefreshTokenRepository },
    // Порядок важливий: спершу автентифікація, потім перевірка ролі.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
