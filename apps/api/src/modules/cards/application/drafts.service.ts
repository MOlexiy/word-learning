import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AddDraftsResult,
  type DraftInput,
  type DraftRelated,
  findDuplicatesForWords,
  normalizeCardName,
  type SkippedDraft,
  type WordDraft,
} from '@wl/shared';
import { ApiException } from '../../../common/errors/api.exception';
import { CardsRepository } from '../domain/cards.repository';
import { type DraftRecord, DraftsRepository } from '../domain/drafts.repository';

/**
 * Чернетки (Inbox). Слово, яке вже є в чернетці або вже має картку з такою назвою,
 * не додається — клієнт показує, що саме пропущено (і куди перейти). Слово, що є лише у формах
 * (n / v / adj / adv) інших карток, додається, але повертається в `related` — напр. для читалки,
 * де перепитати нікого; під час заповнення картки його можна прибрати з чернетки.
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
    const [existingDrafts, cardForms] = await Promise.all([
      this.drafts.list(userId),
      this.cards.listWordForms(userId),
    ]);
    const draftWords = new Set(existingDrafts.map((d) => normalizeCardName(d.word)));
    const duplicates = new Map(
      findDuplicatesForWords(
        items.map((item) => item.word),
        cardForms,
      ).map((found) => [normalizeCardName(found.word), found]),
    );

    const fresh: DraftInput[] = [];
    const skipped: SkippedDraft[] = [];
    for (const item of items) {
      const key = normalizeCardName(item.word);
      const exact = duplicates.get(key)?.exact;
      if (exact) {
        skipped.push({ word: item.word, reason: 'card', cardId: exact.id });
      } else if (draftWords.has(key)) {
        skipped.push({ word: item.word, reason: 'draft' });
      } else {
        draftWords.add(key);
        fresh.push(item);
      }
    }
    const created = fresh.length ? await this.drafts.createMany(userId, fresh, addedBy) : [];
    // Паралельний запит міг уже вставити те саме слово (унікальний ключ) — теж «вже в чернетці».
    const createdKeys = new Set(created.map((d) => normalizeCardName(d.word)));
    for (const item of fresh) {
      if (!createdKeys.has(normalizeCardName(item.word))) skipped.push({ word: item.word, reason: 'draft' });
    }
    const related: DraftRelated[] = created.flatMap((draft) => {
      const found = duplicates.get(normalizeCardName(draft.word));
      return found?.related.length ? [{ word: draft.word, related: found.related }] : [];
    });
    // Відповідь — у порядку списку «нові зверху».
    return { created: created.map(toWordDraft).reverse(), skipped, related };
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
