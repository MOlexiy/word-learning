export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export abstract class RefreshTokenRepository {
  abstract create(token: { id: string; userId: string; expiresAt: Date }): Promise<void>;
  abstract findById(id: string): Promise<RefreshTokenRecord | null>;
  /** Атомарно відкликає токен; false — якщо його вже відкликав хтось інший (паралельний запит). */
  abstract revoke(id: string, at: Date, replacedById?: string): Promise<boolean>;
  abstract revokeAllForUser(userId: string, at: Date): Promise<void>;
  abstract deleteExpired(before: Date): Promise<void>;
}
