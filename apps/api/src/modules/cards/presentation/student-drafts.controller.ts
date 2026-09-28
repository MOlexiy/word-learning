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
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { MentorshipService } from '../../users/application/mentorship.service';
import { DraftsService } from '../application/drafts.service';
import { AddDraftsDto } from './cards.dto';

/**
 * Чернетка підтвердженого учня очима вчителя: перегляд і «швидке слово» для учня.
 * Вчитель може прибрати лише слова, які додав сам.
 */
@Controller('teacher/students/:username/drafts')
@Roles('teacher')
export class StudentDraftsController {
  constructor(
    private readonly mentorship: MentorshipService,
    private readonly drafts: DraftsService,
  ) {}

  @Get()
  async list(@CurrentUser() teacher: AuthUser, @Param('username') username: string): Promise<WordDraft[]> {
    const student = await this.mentorship.assertAcceptedStudent(teacher.username, username);
    return this.drafts.list(student);
  }

  @Post()
  async add(
    @CurrentUser() teacher: AuthUser,
    @Param('username') username: string,
    @Body() dto: AddDraftsDto,
  ): Promise<AddDraftsResult> {
    const student = await this.mentorship.assertAcceptedStudent(teacher.username, username);
    return this.drafts.add(student, dto.items, teacher.username);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() teacher: AuthUser,
    @Param('username') username: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    const student = await this.mentorship.assertAcceptedStudent(teacher.username, username);
    await this.drafts.removeAddedBy(student, teacher.username, id);
  }
}
