import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import { type ImageSearchResult, imageSearchQuerySchema } from '@wl/shared';
import { Public } from '../../common/auth/decorators';
import { AuthThrottlerGuard } from '../../common/security/auth-throttler.guard';
import { PexelsImageSearch } from './pexels-image-search.service';

class ImageSearchQueryDto extends createZodDto(imageSearchQuerySchema) {}

/** Пошук ілюстрацій до прикладу вживання. Публічний: гість теж бачить картинки. */
@Controller('images')
export class ImagesController {
  constructor(private readonly pexels: PexelsImageSearch) {}

  @Get('search')
  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(@Query() query: ImageSearchQueryDto): Promise<ImageSearchResult> {
    return this.pexels.search(query.q, query.page);
  }
}
