import type { DraftInput } from '@wl/shared';

export interface DraftRecord {
  id: string;
  userId: string;
  word: string;
  meaning: string;
  addedBy: string | null;
  createdAt: Date;
}

/** Порт сховища чернеток (Inbox). Реалізація — infrastructure/prisma-drafts.repository.ts */
export abstract class DraftsRepository {
  /** Нові зверху. */
  abstract list(userId: string): Promise<DraftRecord[]>;
  abstract findById(id: string): Promise<DraftRecord | null>;
  /** Зберігає в заданому порядку (перший елемент — найстаріший). */
  abstract createMany(userId: string, items: DraftInput[], addedBy: string | null): Promise<DraftRecord[]>;
  abstract delete(id: string): Promise<void>;
}
