import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CardInput, RandomProgress, WordCardSummary } from '@wl/shared';
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

  findById(id: string): Promise<CardRecord | null> {
    return this.prisma.wordCard.findUnique({ where: { id } });
  }

  create(userId: string, input: CardInput): Promise<CardRecord> {
    return this.prisma.wordCard.create({ data: { ...input, userId } });
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

  importMany(userId: string, cards: ImportedCard[]): Promise<number> {
    const rows = cards.map(({ progress, ...card }) => ({ id: randomUUID(), card, progress }));
    return this.prisma.$transaction(async (tx) => {
      await tx.wordCard.createMany({ data: rows.map(({ id, card }) => ({ ...card, id, userId })) });
      const progress = rows.flatMap(({ id, progress: p }) =>
        p ? [{ cardId: id, repetitionStep: p.n, lockedUntil: new Date(p.lockedUntil) }] : [],
      );
      if (progress.length) await tx.cardRandomProgress.createMany({ data: progress });
      return rows.length;
    });
  }
}
