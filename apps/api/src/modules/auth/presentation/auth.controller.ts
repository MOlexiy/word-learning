import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE, type UserProfile } from '@wl/shared';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Public } from '../../../common/auth/decorators';
import { AuthThrottlerGuard } from '../../../common/security/auth-throttler.guard';
import { AuthService } from '../application/auth.service';
import { AuthCookies } from '../infrastructure/auth-cookies';
import { LoginDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  @Public()
  @Post('register')
  @UseGuards(AuthThrottlerGuard)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<UserProfile> {
    const { profile, tokens } = await this.auth.register(dto);
    this.cookies.set(res, tokens);
    return profile;
  }

  @Public()
  @Post('login')
  @UseGuards(AuthThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<UserProfile> {
    const { profile, tokens } = await this.auth.login(dto);
    this.cookies.set(res, tokens);
    return profile;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<UserProfile> {
    try {
      const { profile, tokens } = await this.auth.refresh(readRefreshCookie(req));
      this.cookies.set(res, tokens);
      return profile;
    } catch (error: unknown) {
      this.cookies.clear(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readRefreshCookie(req));
    this.cookies.clear(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    return this.auth.me(user.username);
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE];
}
