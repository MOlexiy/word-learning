import { Injectable } from '@nestjs/common';
import { advanceProgress, type RandomPickResult } from '@wl/shared';
import { Clock } from '../../../common/time/clock';
import { CardsRepository } from '../domain/cards.repository';

/**
 * «Рандом» для власника карток: вибірка лише серед доступних, після випадання —
 * блокування на 5·n днів і n → n+1 (7 → 1). Правило — спільна функція `advanceProgress`
 * з @wl/shared, тож гостьовий режим і сервер поводяться однаково.
 */
@Injectable()
export class RandomCardService {
  constructor(
    private readonly cards: CardsRepository,
    private readonly clock: Clock,
  ) {}

  async draw(userId: string): Promise<RandomPickResult> {
    const now = this.clock.now();
    const cardId = await this.cards.drawRandom(userId, now, (current) => advanceProgress(current, now));
    if (cardId) return { cardId, nextAvailableAt: null };

    const next = await this.cards.nextUnlockAt(userId);
    return { cardId: null, nextAvailableAt: next?.toISOString() ?? null };
  }
}
