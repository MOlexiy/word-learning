import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RefreshTokenRepository, type RefreshTokenRecord } from '../domain/refresh-token.repository';

@Injectable()
export class PrismaRefreshTokenRepository extends RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(token: { id: string; userId: string; expiresAt: Date }): Promise<void> {
    await this.prisma.refreshToken.create({ data: token });
  }

  findById(id: string): Promise<RefreshTokenRecord | null> {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  async revoke(id: string, at: Date, replacedById?: string): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: at, replacedById: replacedById ?? null },
    });
    return count === 1;
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async deleteExpired(before: Date): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: before } } });
  }
}
