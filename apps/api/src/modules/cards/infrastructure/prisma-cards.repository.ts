import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CARD_SEARCH_FIELDS,
  type CardImage,
  type CardInput,
  type CardWordForms,
  type DraftInput,
  normalizeCardName,
  type RandomProgress,
  searchCards,
  type WordCardSummary,
} from '@wl/shared';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type CardRecord, CardsRepository, type ImportedCard } from '../domain/cards.repository';

interface RandomCandidateRow {
  id: string;
  repetition_step: number | null;
  locked_until: Date | null;
}

@Injectable()
export class PrismaCardsRepository extends CardsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  listSummaries(userId: string): Promise<WordCardSummary[]> {
    return this.prisma.wordCard.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * SQL звужує вибірку (ILIKE по name, n, v, adj, adv; Prisma екранує % і _), а порядок
   * рахує спільна функція `searchCards` — так само, як у гостьовому режимі.
   * Клієнту віддаємо лише id і name.
   */
  async search(userId: string, q: string): Promise<WordCardSummary[]> {
    const query = q.trim().replace(/\s+/g, ' ');
    const rows = await this.prisma.wordCard.findMany({
      where: {
        userId,
        OR: CARD_SEARCH_FIELDS.map((field) => ({
          [field]: { contains: query, mode: 'insensitive' as const },
        })),
      },
      select: WORD_FORMS_SELECT,
    });
    return searchCards(rows, query).map(({ id, name }) => ({ id, name }));
  }

  findWordFormCandidates(userId: string, word: string): Promise<CardWordForms[]> {
    const contains = { contains: word.trim(), mode: 'insensitive' as const };
    return this.prisma.wordCard.findMany({
      where: {
        userId,
        OR: [{ name: contains }, { n: contains }, { v: contains }, { adj: contains }, { adv: contains }],
      },
      select: WORD_FORMS_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  listWordForms(userId: string): Promise<CardWordForms[]> {
    return this.prisma.wordCard.findMany({ where: { userId }, select: WORD_FORMS_SELECT });
  }

  findById(id: string): Promise<CardRecord | null> {
    return this.prisma.wordCard.findUnique({ where: { id } });
  }

  create(userId: string, input: CardInput, fromDraftId?: string): Promise<CardRecord> {
    if (!fromDraftId) return this.prisma.wordCard.create({ data: { ...input, userId } });
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.wordCard.create({ data: { ...input, userId } });
      // deleteMany: чужа чи вже видалена чернетка просто ігнорується.
      await tx.wordDraft.deleteMany({ where: { id: fromDraftId, userId } });
      return card;
    });
  }

  update(id: string, input: CardInput): Promise<CardRecord> {
    return this.prisma.wordCard.update({ where: { id }, data: input });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.wordCard.delete({ where: { id } });
  }

  incrementViews(id: string): Promise<CardRecord> {
    return this.prisma.wordCard.update({ where: { id }, data: { k: { increment: 1 } } });
  }

  appendTopic(id: string, text: string): Promise<CardRecord> {
    return this.prisma.wordCard.update({ where: { id }, data: { topic: { push: text } } });
  }

  setTopics(id: string, topics: string[]): Promise<CardRecord> {
    return this.prisma.wordCard.update({ where: { id }, data: { topic: { set: topics } } });
  }

  setImage(id: string, image: CardImage | null): Promise<CardRecord> {
    return this.prisma.wordCard.update({ where: { id }, data: imageColumns(image, image === null) });
  }

  drawRandom(
    userId: string,
    now: Date,
    advance: (current: RandomProgress | null) => RandomProgress,
  ): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      // FOR UPDATE ... SKIP LOCKED: два одночасні «Рандоми» не отримають ту саму картку.
      const rows = await tx.$queryRaw<RandomCandidateRow[]>`
        SELECT c.id, p.repetition_step, p.locked_until
        FROM word_cards c
        LEFT JOIN card_random_progress p ON p.card_id = c.id
        WHERE c.user_id = ${userId}
          AND (p.card_id IS NULL OR p.locked_until <= ${now})
        ORDER BY random()
        LIMIT 1
        FOR UPDATE OF c SKIP LOCKED`;

      const row = rows[0];
      if (!row) return null;

      const current =
        row.repetition_step !== null && row.locked_until !== null
          ? { n: row.repetition_step, lockedUntil: row.locked_until.toISOString() }
          : null;
      const next = advance(current);
      const data = { repetitionStep: next.n, lockedUntil: new Date(next.lockedUntil) };

      await tx.cardRandomProgress.upsert({
        where: { cardId: row.id },
        create: { cardId: row.id, ...data },
        update: data,
      });
      return row.id;
    });
  }

  async nextUnlockAt(userId: string): Promise<Date | null> {
    const result = await this.prisma.cardRandomProgress.aggregate({
      where: { card: { userId } },
      _min: { lockedUntil: true },
    });
    return result._min.lockedUntil;
  }

  importMany(
    userId: string,
    cards: ImportedCard[],
    drafts: DraftInput[],
  ): Promise<{ cards: number; drafts: number }> {
    const rows = cards.map(({ progress, image, imageHidden, ...card }) => ({
      id: randomUUID(),
      card: { ...card, ...imageColumns(image, imageHidden) },
      progress,
    }));
    return this.prisma.$transaction(async (tx) => {
      await tx.wordCard.createMany({ data: rows.map(({ id, card }) => ({ ...card, id, userId })) });
      const progress = rows.flatMap(({ id, progress: p }) =>
        p ? [{ cardId: id, repetitionStep: p.n, lockedUntil: new Date(p.lockedUntil) }] : [],
      );
      if (progress.length) await tx.cardRandomProgress.createMany({ data: progress });
      // Слова, які вже є в чернетці акаунта, пропускаються (унікальний word_key).
      const imported = drafts.length
        ? await tx.wordDraft.createMany({
            data: drafts.map((d) => ({ ...d, userId, wordKey: normalizeCardName(d.word) })),
            skipDuplicates: true,
          })
        : { count: 0 };
      return { cards: rows.length, drafts: imported.count };
    });
  }
}

const WORD_FORMS_SELECT = { id: true, name: true, n: true, v: true, adj: true, adv: true } as const;

function imageColumns(image: CardImage | null, hidden: boolean) {
  return {
    imageUrl: image?.url ?? null,
    imageAuthor: image?.author ?? null,
    imagePageUrl: image?.pageUrl ?? null,
    imageHidden: image ? false : hidden,
  };
}
