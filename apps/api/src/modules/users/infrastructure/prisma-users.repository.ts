import { Injectable } from '@nestjs/common';
import type { TeacherStatus } from '@wl/shared';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { NewUser, UserRecord } from '../domain/user';
import { UsersRepository } from '../domain/users.repository';

@Injectable()
export class PrismaUsersRepository extends UsersRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findByUsername(username: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  create(user: NewUser): Promise<UserRecord> {
    return this.prisma.user.create({ data: user });
  }

  async searchTeachers(query: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: 'teacher', ...(query ? { username: { startsWith: query, mode: 'insensitive' } } : {}) },
      select: { username: true },
      orderBy: { username: 'asc' },
      take: limit,
    });
    return rows.map((row) => row.username);
  }

  setTeacherLink(
    studentUsername: string,
    teacherUsername: string | null,
    status: TeacherStatus | null,
  ): Promise<UserRecord> {
    return this.prisma.user.update({
      where: { username: studentUsername },
      data: { teacherId: teacherUsername, teacherStatus: status },
    });
  }

  async transitionStudentStatus(
    teacherUsername: string,
    studentUsername: string,
    from: TeacherStatus,
    to: TeacherStatus,
  ): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { username: studentUsername, role: 'student', teacherId: teacherUsername, teacherStatus: from },
      data: { teacherStatus: to },
    });
    return count === 1;
  }

  listStudents(teacherUsername: string, status: TeacherStatus): Promise<UserRecord[]> {
    return this.prisma.user.findMany({
      where: { teacherId: teacherUsername, teacherStatus: status, role: 'student' },
      orderBy: { username: 'asc' },
    });
  }
}
