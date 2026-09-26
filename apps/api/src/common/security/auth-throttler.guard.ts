import { type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { ApiException } from '../errors/api.exception';

/**
 * Обмеження частоти для входу/реєстрації (захист від перебору паролів).
 * Відповідь 429 у форматі ApiErrorBody з кодом TOO_MANY_REQUESTS — фронт її перекладає.
 * За проксі (Vercel → Render) IP клієнта береться з X-Forwarded-For, коли TRUST_PROXY=true.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    _context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new ApiException(
      HttpStatus.TOO_MANY_REQUESTS,
      'TOO_MANY_REQUESTS',
      'Too many requests, try again later',
    );
  }
}
