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
    image:
      card.imageUrl && card.imagePageUrl
        ? { url: card.imageUrl, author: card.imageAuthor ?? '', pageUrl: card.imagePageUrl }
        : null,
    imageHidden: card.imageHidden,
    k: card.k,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}
