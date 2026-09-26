import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { WordCard, WordCardSummary } from '@wl/shared';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { MentorshipService } from '../../users/application/mentorship.service';
import { CardsService } from '../application/cards.service';

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
  ): Promise<WordCardSummary[]> {
    const student = await this.mentorship.assertAcceptedStudent(teacher.username, username);
    return this.cards.listForStudent(student);
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
