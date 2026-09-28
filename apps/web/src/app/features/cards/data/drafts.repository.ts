import type { AddDraftsResult, DraftInput, WordDraft } from '@wl/shared';

/** Чернетки (Inbox) — і для гостя (LocalStorage), і для акаунта (API). */
export interface DraftsRepository {
  /** Нові зверху. */
  list(): Promise<WordDraft[]>;
  /** Слова, які вже є в чернетці чи мають картку, пропускаються (`skipped`). */
  add(items: DraftInput[]): Promise<AddDraftsResult>;
  remove(id: string): Promise<void>;
}
