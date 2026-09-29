/** Порт сховища персональних посилань «додати в чернетку». Реалізація — infrastructure/prisma-draft-link.repository.ts */
export abstract class DraftLinkRepository {
  abstract findToken(userId: string): Promise<string | null>;
  /** Власник токена або null, якщо токен невідомий / перевипущений. */
  abstract findOwner(token: string): Promise<string | null>;
  /** Створює або замінює токен користувача (старий одразу перестає працювати). */
  abstract upsert(userId: string, token: string): Promise<void>;
}
