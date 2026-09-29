import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { DraftLinkRepository } from '../domain/draft-link.repository';

@Injectable()
export class PrismaDraftLinkRepository extends DraftLinkRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findToken(userId: string): Promise<string | null> {
    const link = await this.prisma.draftLink.findUnique({ where: { userId }, select: { token: true } });
    return link?.token ?? null;
  }

  async findOwner(token: string): Promise<string | null> {
    const link = await this.prisma.draftLink.findUnique({ where: { token }, select: { userId: true } });
    return link?.userId ?? null;
  }

  async upsert(userId: string, token: string): Promise<void> {
    await this.prisma.draftLink.upsert({
      where: { userId },
      create: { userId, token },
      update: { token, createdAt: new Date() },
    });
  }
}
