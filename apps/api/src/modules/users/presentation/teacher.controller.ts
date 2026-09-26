import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { StudentSummary } from '@wl/shared';
import type { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../../common/auth/decorators';
import { MentorshipService } from '../application/mentorship.service';

@Controller('teacher')
@Roles('teacher')
export class TeacherController {
  constructor(private readonly mentorship: MentorshipService) {}

  @Get('requests')
  requests(@CurrentUser() user: AuthUser): Promise<StudentSummary[]> {
    return this.mentorship.listRequests(user.username);
  }

  @Post('requests/:username/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  accept(@CurrentUser() user: AuthUser, @Param('username') username: string): Promise<void> {
    return this.mentorship.accept(user.username, username);
  }

  @Post('requests/:username/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  reject(@CurrentUser() user: AuthUser, @Param('username') username: string): Promise<void> {
    return this.mentorship.reject(user.username, username);
  }

  @Get('students')
  students(@CurrentUser() user: AuthUser): Promise<StudentSummary[]> {
    return this.mentorship.listStudents(user.username);
  }

  /** «Відкріпити» учня. */
  @Delete('students/:username')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('username') username: string): Promise<void> {
    return this.mentorship.removeStudent(user.username, username);
  }
}
