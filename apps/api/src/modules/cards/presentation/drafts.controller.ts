import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { AddDraftsResult, WordDraft } from '@wl/shared';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser } from '../../../common/auth/decorators';
import { DraftsService } from '../application/drafts.service';
import { AddDraftsDto } from './cards.dto';

/** Власні чернетки (Inbox): швидке збереження слів, які згодом стануть картками. */
@Controller('drafts')
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<WordDraft[]> {
    return this.drafts.list(user.username);
  }

  /** Одне слово (Quick Add) або список (Bulk Add). */
  @Post()
  add(@CurrentUser() user: AuthUser, @Body() dto: AddDraftsDto): Promise<AddDraftsResult> {
    return this.drafts.add(user.username, dto.items);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.drafts.remove(user.username, id);
  }
}
