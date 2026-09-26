import { Module } from '@nestjs/common';
import { MentorshipService } from './application/mentorship.service';
import { UsersRepository } from './domain/users.repository';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { ProfileController } from './presentation/profile.controller';
import { TeacherController } from './presentation/teacher.controller';

@Module({
  controllers: [ProfileController, TeacherController],
  providers: [MentorshipService, { provide: UsersRepository, useClass: PrismaUsersRepository }],
  exports: [UsersRepository, MentorshipService],
})
export class UsersModule {}
