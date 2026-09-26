export * from './spaced-repetition';
export * from './api-errors';
export * from './schemas/auth.schema';
export * from './schemas/card.schema';
export * from './schemas/mentorship.schema';

/** Назви кук та ендпоінтів, про які домовляються front і back. */
export const AUTH_COOKIE = 'auth';
export const REFRESH_COOKIE = 'refresh';
export const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 1 день
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 днів
