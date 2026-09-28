import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AddDraftsResult,
  type DraftInput,
  normalizeCardName,
  type SkippedDraft,
  type WordDraft,
} from '@wl/shared';
import { ApiException } from '../../../common/errors/api.exception';
import { CardsRepository } from '../domain/cards.repository';
import { type DraftRecord, DraftsRepository } from '../domain/drafts.repository';

/**
 * Чернетки (Inbox). Слово, яке вже є в чернетці або вже має картку з такою назвою,
 * не додається — клієнт показує, що саме пропущено (і куди перейти).
 */
@Injectable()
export class DraftsService {
  constructor(
    private readonly drafts: DraftsRepository,
    private readonly cards: CardsRepository,
  ) {}

  async list(userId: string): Promise<WordDraft[]> {
    return (await this.drafts.list(userId)).map(toWordDraft);
  }

  /** `addedBy` — username вчителя, якщо слово додає вчитель учню. */
  async add(userId: string, items: DraftInput[], addedBy: string | null = null): Promise<AddDraftsResult> {
    const [existingDrafts, existingCards] = await Promise.all([
      this.drafts.list(userId),
      this.cards.listSummaries(userId),
    ]);
    const draftWords = new Set(existingDrafts.map((d) => normalizeCardName(d.word)));
    const cardIds = new Map(existingCards.map((c) => [normalizeCardName(c.name), c.id]));

    const fresh: DraftInput[] = [];
    const skipped: SkippedDraft[] = [];
    for (const item of items) {
      const key = normalizeCardName(item.word);
      const cardId = cardIds.get(key);
      if (cardId) {
        skipped.push({ word: item.word, reason: 'card', cardId });
      } else if (draftWords.has(key)) {
        skipped.push({ word: item.word, reason: 'draft' });
      } else {
        draftWords.add(key);
        fresh.push(item);
      }
    }
    const created = fresh.length ? await this.drafts.createMany(userId, fresh, addedBy) : [];
    // Відповідь — у порядку списку «нові зверху».
    return { created: created.map(toWordDraft).reverse(), skipped };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.#getOwned(userId, id);
    await this.drafts.delete(id);
  }

  /** Вчитель прибирає лише ті слова, які додав сам; решта — справа учня. */
  async removeAddedBy(studentUsername: string, teacherUsername: string, id: string): Promise<void> {
    const draft = await this.#getOwned(studentUsername, id);
    if (draft.addedBy !== teacherUsername) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN_ROLE',
        'Only drafts added by you can be removed',
      );
    }
    await this.drafts.delete(id);
  }

  async #getOwned(userId: string, id: string): Promise<DraftRecord> {
    const draft = await this.drafts.findById(id);
    if (!draft || draft.userId !== userId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'DRAFT_NOT_FOUND', 'Draft not found');
    }
    return draft;
  }
}

function toWordDraft(draft: DraftRecord): WordDraft {
  return {
    id: draft.id,
    word: draft.word,
    meaning: draft.meaning,
    addedBy: draft.addedBy,
    createdAt: draft.createdAt.toISOString(),
  };
}
