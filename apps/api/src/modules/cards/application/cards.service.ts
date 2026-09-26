import { HttpStatus, Injectable } from '@nestjs/common';
import type { CardInput, ImportCardsRequest, ImportCardsResult, WordCard, WordCardSummary } from '@wl/shared';
import { type CardRecord, CardsRepository } from '../domain/cards.repository';
import { toWordCard } from './card.mapper';
import { ApiException } from '../../../common/errors/api.exception';

/** CRUD власних карток. Чужа картка поводиться як неіснуюча (404), щоб не розкривати id. */
@Injectable()
export class CardsService {
  constructor(private readonly cards: CardsRepository) {}

  list(userId: string): Promise<WordCardSummary[]> {
    return this.cards.listSummaries(userId);
  }

  async get(userId: string, id: string): Promise<WordCard> {
    return toWordCard(await this.#getOwned(userId, id));
  }

  /** Відкриття детальної сторінки: k = k + 1. */
  async view(userId: string, id: string): Promise<WordCard> {
    await this.#getOwned(userId, id);
    return toWordCard(await this.cards.incrementViews(id));
  }

  async create(userId: string, input: CardInput): Promise<WordCard> {
    return toWordCard(await this.cards.create(userId, input));
  }

  async update(userId: string, id: string, input: CardInput): Promise<WordCard> {
    await this.#getOwned(userId, id);
    return toWordCard(await this.cards.update(id, input));
  }

  async addTopic(userId: string, id: string, text: string): Promise<WordCard> {
    await this.#getOwned(userId, id);
    return toWordCard(await this.cards.appendTopic(id, text));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.#getOwned(userId, id);
    await this.cards.delete(id);
  }

  async import(userId: string, dto: ImportCardsRequest): Promise<ImportCardsResult> {
    const imported = await this.cards.importMany(
      userId,
      dto.cards.map(({ id, ...card }) => ({ ...card, progress: dto.progress[id] })),
    );
    return { imported };
  }

  /** Read-only доступ вчителя (права перевіряє MentorshipService). */
  listForStudent(studentUsername: string): Promise<WordCardSummary[]> {
    return this.cards.listSummaries(studentUsername);
  }

  async getForStudent(studentUsername: string, id: string): Promise<WordCard> {
    return toWordCard(await this.#getOwned(studentUsername, id));
  }

  async #getOwned(userId: string, id: string): Promise<CardRecord> {
    const card = await this.cards.findById(id);
    if (!card || card.userId !== userId)
      throw new ApiException(HttpStatus.NOT_FOUND, 'CARD_NOT_FOUND', 'Card not found');
    return card;
  }
}
