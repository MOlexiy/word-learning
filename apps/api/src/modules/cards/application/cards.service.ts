import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type CardDuplicateCheck,
  type CardDuplicatesBatchResult,
  type CardImage,
  type CardInput,
  findCardDuplicates,
  findDuplicatesForWords,
  type ImportCardsRequest,
  isCardNameChanged,
  type ImportCardsResult,
  type WordCard,
  type WordCardSummary,
} from '@wl/shared';
import { type CardRecord, CardsRepository } from '../domain/cards.repository';
import { toWordCard } from './card.mapper';
import { ApiException } from '../../../common/errors/api.exception';

/** CRUD власних карток. Чужа картка поводиться як неіснуюча (404), щоб не розкривати id. */
@Injectable()
export class CardsService {
  constructor(private readonly cards: CardsRepository) {}

  /** Без `q` — увесь каталог за алфавітом; з `q` — пошук по name, n, v, adj, adv. */
  list(userId: string, q = ''): Promise<WordCardSummary[]> {
    return q.trim() ? this.cards.search(userId, q) : this.cards.listSummaries(userId);
  }

  /**
   * Чи є вже така картка: `exact` — та сама назва (створити не можна),
   * `related` — слово записане як n / v / adj / adv інших карток (варто перепитати).
   * `excludeId` — картка, яку редагують (не порівнюється сама з собою).
   */
  async checkDuplicates(userId: string, name: string, excludeId?: string): Promise<CardDuplicateCheck> {
    return findCardDuplicates(name, await this.cards.findWordFormCandidates(userId, name), excludeId);
  }

  /** Те саме для списку слів (Bulk Add / швидке слово); повертає лише слова зі збігами. */
  async checkDuplicatesMany(userId: string, names: string[]): Promise<CardDuplicatesBatchResult> {
    return { items: findDuplicatesForWords(names, await this.cards.listWordForms(userId)) };
  }

  async get(userId: string, id: string): Promise<WordCard> {
    return toWordCard(await this.#getOwned(userId, id));
  }

  /** Відкриття детальної сторінки: k = k + 1. */
  async view(userId: string, id: string): Promise<WordCard> {
    await this.#getOwned(userId, id);
    return toWordCard(await this.cards.incrementViews(id));
  }

  /** Друга картка з тією самою назвою заборонена (409 CARD_EXISTS з id наявної). */
  async create(userId: string, input: CardInput, fromDraftId?: string): Promise<WordCard> {
    await this.#assertNameFree(userId, input.name);
    return toWordCard(await this.cards.create(userId, input, fromDraftId));
  }

  /**
   * Перейменувати на назву іншої картки не можна (409 CARD_EXISTS). Перевіряється лише при зміні
   * назви — старі дублікати (напр. з імпорту) не блокують редагування інших полів.
   */
  async update(userId: string, id: string, input: CardInput): Promise<WordCard> {
    const current = await this.#getOwned(userId, id);
    if (isCardNameChanged(current.name, input.name)) await this.#assertNameFree(userId, input.name, id);
    return toWordCard(await this.cards.update(id, input));
  }

  async addTopic(userId: string, id: string, text: string): Promise<WordCard> {
    await this.#getOwned(userId, id);
    return toWordCard(await this.cards.appendTopic(id, text));
  }

  /** Видаляє параграф `index`, лише якщо його текст досі збігається з `expectedText`. */
  async removeTopic(userId: string, id: string, index: number, expectedText: string): Promise<WordCard> {
    const card = await this.#getOwned(userId, id);
    if (card.topic[index] !== expectedText) {
      throw new ApiException(HttpStatus.CONFLICT, 'TOPIC_CHANGED', 'Paragraph has changed, reload the card');
    }
    const topics = card.topic.filter((_, i) => i !== index);
    return toWordCard(await this.cards.setTopics(id, topics));
  }

  async setImage(userId: string, id: string, image: CardImage | null): Promise<WordCard> {
    await this.#getOwned(userId, id);
    return toWordCard(await this.cards.setImage(id, image));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.#getOwned(userId, id);
    await this.cards.delete(id);
  }

  async import(userId: string, dto: ImportCardsRequest): Promise<ImportCardsResult> {
    const imported = await this.cards.importMany(
      userId,
      dto.cards.map(({ id, ...card }) => ({ ...card, progress: dto.progress[id] })),
      dto.drafts,
    );
    return { imported: imported.cards, importedDrafts: imported.drafts };
  }

  /** Read-only доступ вчителя (права перевіряє MentorshipService). */
  listForStudent(studentUsername: string, q = ''): Promise<WordCardSummary[]> {
    return this.list(studentUsername, q);
  }

  async getForStudent(studentUsername: string, id: string): Promise<WordCard> {
    return toWordCard(await this.#getOwned(studentUsername, id));
  }

  async #assertNameFree(userId: string, name: string, excludeId?: string): Promise<void> {
    const { exact } = await this.checkDuplicates(userId, name, excludeId);
    if (exact) {
      throw new ApiException(HttpStatus.CONFLICT, 'CARD_EXISTS', `Card "${exact.name}" already exists`, {
        meta: { cardId: exact.id, name: exact.name },
      });
    }
  }

  async #getOwned(userId: string, id: string): Promise<CardRecord> {
    const card = await this.cards.findById(id);
    if (!card || card.userId !== userId)
      throw new ApiException(HttpStatus.NOT_FOUND, 'CARD_NOT_FOUND', 'Card not found');
    return card;
  }
}
