import { Body, Controller, Delete, Get, Put, Query } from '@nestjs/common';
import type { TeacherSummary, UserProfile } from '@wl/shared';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { MentorshipService } from '../application/mentorship.service';
import { SetTeacherDto, TeacherSearchDto } from './mentorship.dto';

@Controller()
export class ProfileController {
  constructor(private readonly mentorship: MentorshipService) {}

  /** Пошук вчителів за префіксом username. */
  @Get('teachers')
  searchTeachers(@Query() { query }: TeacherSearchDto): Promise<TeacherSummary[]> {
    return this.mentorship.searchTeachers(query);
  }

  /** Учень надсилає (або повторно надсилає) заявку вчителю. */
  @Put('profile/teacher')
  @Roles('student')
  setTeacher(@CurrentUser() user: AuthUser, @Body() dto: SetTeacherDto): Promise<UserProfile> {
    return this.mentorship.requestTeacher(user.username, dto.teacherUsername);
  }

  @Delete('profile/teacher')
  @Roles('student')
  leaveTeacher(@CurrentUser() user: AuthUser): Promise<UserProfile> {
    return this.mentorship.leaveTeacher(user.username);
  }
}
