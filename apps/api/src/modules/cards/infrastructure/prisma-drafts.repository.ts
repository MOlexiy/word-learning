import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type DraftInput, normalizeCardName } from '@wl/shared';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { type DraftRecord, DraftsRepository } from '../domain/drafts.repository';

@Injectable()
export class PrismaDraftsRepository extends DraftsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  list(userId: string): Promise<DraftRecord[]> {
    return this.prisma.wordDraft.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  findById(id: string): Promise<DraftRecord | null> {
    return this.prisma.wordDraft.findUnique({ where: { id } });
  }

  /**
   * createMany не повертає рядки, тож id генеруємо самі. created_at зсуваємо на мілісекунду,
   * щоб слова зі списку Bulk Add у «нові зверху» йшли в порядку вставки (останнє — зверху).
   * Унікальний (user_id, word_key) + skipDuplicates: слово, яке паралельний запит уже вставив,
   * просто не додається — повертаються лише справді створені рядки.
   */
  async createMany(userId: string, items: DraftInput[], addedBy: string | null): Promise<DraftRecord[]> {
    const base = Date.now();
    const rows = items.map((item, i) => ({
      ...item,
      id: randomUUID(),
      userId,
      wordKey: normalizeCardName(item.word),
      addedBy,
      createdAt: new Date(base + i),
    }));
    const { count } = await this.prisma.wordDraft.createMany({ data: rows, skipDuplicates: true });
    if (count === rows.length) return rows;
    const saved = await this.prisma.wordDraft.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: { id: true },
    });
    const savedIds = new Set(saved.map((row: { id: string }) => row.id));
    return rows.filter((row) => savedIds.has(row.id));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.wordDraft.delete({ where: { id } });
  }
}
