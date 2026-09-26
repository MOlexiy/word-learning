/**
 * Стабільні коди помилок API. Бекенд повертає `{ statusCode, code, message }`,
 * фронт перекладає за ключем `errors.<code>` (message — англійський текст для логів/інтеграцій).
 */
export const API_ERROR_CODES = [
  'AUTH_REQUIRED',
  'ACCESS_TOKEN_INVALID',
  'REFRESH_TOKEN_MISSING',
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_REUSED',
  'INVALID_CREDENTIALS',
  'USERNAME_TAKEN',
  'EMAIL_TAKEN',
  'FORBIDDEN_ROLE',
  'TOO_MANY_REQUESTS',
  'VALIDATION_FAILED',
  'CARD_NOT_FOUND',
  'TEACHER_NOT_FOUND',
  'TEACHER_ALREADY_ACCEPTED',
  'REQUEST_NOT_FOUND',
  'STUDENT_NOT_ACCEPTED',
  'CONFLICT',
  'NOT_FOUND',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  /** Для VALIDATION_FAILED: повідомлення — i18n-ключі `validation.*` або тексти Zod. */
  errors?: { path: string; message: string }[];
}

/** Повідомлення Zod-схем, які є ключами перекладу (а не готовим текстом). */
export const VALIDATION_KEY_PREFIX = 'validation.';
