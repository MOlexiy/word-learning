import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorBody, ApiErrorCode } from '@wl/shared';

/**
 * Помилка з машиночитним `code`. Клієнт локалізує її сам (errors.<code> в i18n),
 * а `message` — англійський опис для логів та сторонніх клієнтів API.
 */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ApiErrorCode,
    message: string,
    extra: Pick<ApiErrorBody, 'errors' | 'meta'> = {},
  ) {
    super({ statusCode: status, code, message, ...extra } satisfies ApiErrorBody, status);
  }
}
