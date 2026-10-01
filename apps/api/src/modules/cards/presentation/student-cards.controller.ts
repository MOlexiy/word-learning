import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { CardDuplicatesBatchResult, WordCard, WordCardSummary } from '@wl/shared';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { MentorshipService } from '../../users/application/mentorship.service';
import { CardsService } from '../application/cards.service';
import { CardDuplicatesBatchDto, CardSearchQueryDto } from './cards.dto';

/**
 * Read-only перегляд карток підтвердженого учня. Лічильник `k` і прогрес рандому учня
 * тут навмисно не змінюються. «Рандомне слово учня» обирається на фронті зі списку — без таймерів.
 */
@Controller('teacher/students/:username/cards')
@Roles('teacher')
export class StudentCardsController {
  constructor(
    private readonly mentorship: MentorshipService,
    private readonly cards: CardsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() teacher: AuthUser,
    @Param('username') username: string,
    @Query() query: CardSearchQueryDto,
  ): Promise<WordCardSummary[]> {
    const student = await this.mentorship.assertAcceptedStudent(teacher.username, username);
    return this.cards.listForStudent(student, query.q);
  }

  /** Перевірка слів перед «швидким словом» для учня — по картках учня. */
  @Post('duplicates')
  @HttpCode(HttpStatus.OK)
  async duplicatesMany(
    @CurrentUser() teacher: AuthUser,
    @Param('username') username: string,
    @Body() dto: CardDuplicatesBatchDto,
  ): Promise<CardDuplicatesBatchResult> {
    const student = await this.mentorship.assertAcceptedStudent(teacher.username, username);
    return this.cards.checkDuplicatesMany(student, dto.names);
  }

  @Get(':id')
  async get(
    @CurrentUser() teacher: AuthUser,
    @Param('username') username: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<WordCard> {
    const student = await this.mentorship.assertAcceptedStudent(teacher.username, username);
    return this.cards.getForStudent(student, id);
  }
}
