import type { WordCard } from '@wl/shared';
import type { CardRecord } from '../domain/cards.repository';

export function toWordCard(card: CardRecord): WordCard {
  return {
    id: card.id,
    userId: card.userId,
    name: card.name,
    means: card.means,
    used: card.used,
    n: card.n,
    v: card.v,
    adj: card.adj,
    adv: card.adv,
    collocations: card.collocations,
    topic: card.topic,
    k: card.k,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}
