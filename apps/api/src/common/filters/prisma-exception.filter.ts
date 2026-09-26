import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody, ApiErrorCode } from '@wl/shared';
import { Prisma } from '../../generated/prisma/client';

const KNOWN: Record<string, [HttpStatus, ApiErrorCode, string]> = {
  P2002: [HttpStatus.CONFLICT, 'CONFLICT', 'Record already exists'],
  P2025: [HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Record not found'],
  P2003: [HttpStatus.CONFLICT, 'CONFLICT', 'Foreign key constraint failed'],
};

/** Перетворює відомі помилки Prisma на коректні HTTP-статуси (з кодом) замість 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  readonly #logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const known = KNOWN[error.code];
    if (!known) this.#logger.error(error.message, error.stack);
    const [statusCode, code, message] = known ?? [
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL',
      'Internal server error',
    ];
    const body: ApiErrorBody = { statusCode, code, message };
    host.switchToHttp().getResponse<Response>().status(statusCode).json(body);
  }
}
