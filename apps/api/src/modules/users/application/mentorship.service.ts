import { HttpStatus, Injectable } from '@nestjs/common';
import type { StudentSummary, TeacherSummary, UserProfile } from '@wl/shared';
import { toUserProfile } from '../domain/user';
import { UsersRepository } from '../domain/users.repository';
import { ApiException } from '../../../common/errors/api.exception';

/**
 * Зв'язок учень ↔ вчитель.
 *
 *   student: PUT заявку → pending
 *   teacher: pending → accepted («Прийняти») | pending → rejected («Відхилити»)
 *   teacher: accepted → rejected («Відкріпити»; учень бачить статус і може надіслати запит знову)
 *   student: може будь-коли надіслати новий запит (тому самому чи іншому вчителю) → pending
 */
@Injectable()
export class MentorshipService {
  constructor(private readonly users: UsersRepository) {}

  async searchTeachers(query: string): Promise<TeacherSummary[]> {
    const usernames = await this.users.searchTeachers(query, 20);
    return usernames.map((username) => ({ username }));
  }

  async requestTeacher(studentUsername: string, teacherUsername: string): Promise<UserProfile> {
    const teacher = await this.users.findByUsername(teacherUsername);
    if (!teacher || teacher.role !== 'teacher') {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'TEACHER_NOT_FOUND',
        `Teacher "${teacherUsername}" not found`,
      );
    }
    const student = await this.users.findByUsername(studentUsername);
    if (!student) throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Student not found');
    if (student.teacherId === teacher.username && student.teacherStatus === 'accepted') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'TEACHER_ALREADY_ACCEPTED',
        'This teacher has already accepted you',
      );
    }
    const updated = await this.users.setTeacherLink(student.username, teacher.username, 'pending');
    return toUserProfile(updated);
  }

  async leaveTeacher(studentUsername: string): Promise<UserProfile> {
    return toUserProfile(await this.users.setTeacherLink(studentUsername, null, null));
  }

  async listRequests(teacherUsername: string): Promise<StudentSummary[]> {
    return this.#summaries(teacherUsername, 'pending');
  }

  async listStudents(teacherUsername: string): Promise<StudentSummary[]> {
    return this.#summaries(teacherUsername, 'accepted');
  }

  async accept(teacherUsername: string, studentUsername: string): Promise<void> {
    await this.#transition(teacherUsername, studentUsername, 'pending', 'accepted');
  }

  async reject(teacherUsername: string, studentUsername: string): Promise<void> {
    await this.#transition(teacherUsername, studentUsername, 'pending', 'rejected');
  }

  async removeStudent(teacherUsername: string, studentUsername: string): Promise<void> {
    await this.#transition(teacherUsername, studentUsername, 'accepted', 'rejected');
  }

  /** Вчитель має доступ до карток лише підтвердженого учня. Повертає канонічний username. */
  async assertAcceptedStudent(teacherUsername: string, studentUsername: string): Promise<string> {
    const student = await this.users.findByUsername(studentUsername);
    if (!student || student.teacherId !== teacherUsername || student.teacherStatus !== 'accepted') {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'STUDENT_NOT_ACCEPTED',
        `"${studentUsername}" is not your accepted student`,
      );
    }
    return student.username;
  }

  async #transition(
    teacherUsername: string,
    studentUsername: string,
    from: 'pending' | 'accepted',
    to: 'accepted' | 'rejected',
  ): Promise<void> {
    const student = await this.users.findByUsername(studentUsername);
    const ok =
      !!student && (await this.users.transitionStudentStatus(teacherUsername, student.username, from, to));
    if (!ok)
      throw new ApiException(HttpStatus.NOT_FOUND, 'REQUEST_NOT_FOUND', 'Request or student not found');
  }

  async #summaries(teacherUsername: string, status: 'pending' | 'accepted'): Promise<StudentSummary[]> {
    const students = await this.users.listStudents(teacherUsername, status);
    return students.map((s) => ({ username: s.username, email: s.email, status }));
  }
}
