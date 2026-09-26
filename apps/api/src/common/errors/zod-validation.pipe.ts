import { HttpStatus } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';
import { ApiException } from './api.exception';

/** ZodValidationPipe, що повертає помилку у форматі ApiErrorBody (code: VALIDATION_FAILED). */
export const AppZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) =>
    new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Validation failed', {
      errors:
        error instanceof ZodError
          ? error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
          : [],
    }),
});
