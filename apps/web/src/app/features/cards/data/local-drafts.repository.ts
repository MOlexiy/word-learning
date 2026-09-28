import { inject, Injectable } from '@angular/core';
import { z } from 'zod';
import {
  type AddDraftsResult,
  addDraftsSchema,
  type DraftInput,
  draftInputSchema,
  normalizeCardName,
  type SkippedDraft,
  type WordDraft,
} from '@wl/shared';
import { BrowserStorage } from '../../../core/browser/browser-storage';
import { LocalCardsRepository } from './local-cards.repository';
import type { DraftsRepository } from './drafts.repository';
import { newId } from './local-id';

export const GUEST_DRAFTS_KEY = 'wl.guest.drafts';

const storedDraftSchema = draftInputSchema.extend({
  id: z.string().min(1),
  addedBy: z.null().catch(null),
  createdAt: z.string().catch(() => new Date().toISOString()),
});

/** Гостьова чернетка — у LocalStorage; правила ті самі, що на сервері (DraftsService). */
@Injectable({ providedIn: 'root' })
export class LocalDraftsRepository implements DraftsRepository {
  readonly #storage = inject(BrowserStorage);
  readonly #cards = inject(LocalCardsRepository);

  async list(): Promise<WordDraft[]> {
    return this.#read();
  }

  async add(rawItems: DraftInput[]): Promise<AddDraftsResult> {
    const { items } = addDraftsSchema.parse({ items: rawItems });
    const drafts = this.#read();
    const draftWords = new Set(drafts.map((d) => normalizeCardName(d.word)));
    const cardIds = new Map((await this.#cards.list()).map((c) => [normalizeCardName(c.name), c.id]));

    const created: WordDraft[] = [];
    const skipped: SkippedDraft[] = [];
    const base = Date.now();
    for (const item of items) {
      const key = normalizeCardName(item.word);
      const cardId = cardIds.get(key);
      if (cardId) {
        skipped.push({ word: item.word, reason: 'card', cardId });
      } else if (draftWords.has(key)) {
        skipped.push({ word: item.word, reason: 'draft' });
      } else {
        draftWords.add(key);
        const createdAt = new Date(base + created.length).toISOString();
        created.unshift({ ...item, id: newId(), addedBy: null, createdAt });
      }
    }
    if (created.length) this.#write([...created, ...drafts]);
    return { created, skipped };
  }

  async remove(id: string): Promise<void> {
    this.#write(this.#read().filter((d) => d.id !== id));
  }

  count(): number {
    return this.#read().length;
  }

  /** Для перенесення в акаунт: найстаріші першими, щоб на сервері зберігся порядок. */
  exportForImport(): DraftInput[] {
    return this.#read()
      .reverse()
      .map(({ word, meaning }) => ({ word, meaning }));
  }

  clear(): void {
    this.#storage.remove(GUEST_DRAFTS_KEY);
  }

  #read(): WordDraft[] {
    const raw = this.#storage.read(GUEST_DRAFTS_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item: unknown) => {
      const parsed = storedDraftSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }

  #write(drafts: WordDraft[]): void {
    if (!this.#storage.write(GUEST_DRAFTS_KEY, drafts)) throw new Error('errors.storageUnavailable');
  }
}
