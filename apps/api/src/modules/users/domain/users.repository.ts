import type { TeacherStatus } from '@wl/shared';
import type { NewUser, UserRecord } from './user';

/** Порт доступу до користувачів. Реалізація — infrastructure/prisma-users.repository.ts */
export abstract class UsersRepository {
  /** Пошук без урахування регістру. */
  abstract findByUsername(username: string): Promise<UserRecord | null>;
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract create(user: NewUser): Promise<UserRecord>;
  abstract searchTeachers(query: string, limit: number): Promise<string[]>;
  abstract setTeacherLink(
    studentUsername: string,
    teacherUsername: string | null,
    status: TeacherStatus | null,
  ): Promise<UserRecord>;
  /** Атомарно змінює статус, лише якщо учень закріплений за цим вчителем і має очікуваний статус. */
  abstract transitionStudentStatus(
    teacherUsername: string,
    studentUsername: string,
    from: TeacherStatus,
    to: TeacherStatus,
  ): Promise<boolean>;
  abstract listStudents(teacherUsername: string, status: TeacherStatus): Promise<UserRecord[]>;
}
