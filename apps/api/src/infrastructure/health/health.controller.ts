import { Controller, Get, HttpStatus } from '@nestjs/common';
import { Public } from '../../common/auth/decorators';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../prisma/prisma.service';

/** Liveness/readiness для Docker healthcheck: API живий і БД відповідає. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'INTERNAL', 'Database is unavailable');
    }
  }
}
