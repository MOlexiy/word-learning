import type { Role, TeacherStatus, UserProfile } from '@wl/shared';

export interface UserRecord {
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  teacherId: string | null;
  teacherStatus: TeacherStatus | null;
}

export interface NewUser {
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export function toUserProfile(user: UserRecord): UserProfile {
  const teacher =
    user.role === 'student' && user.teacherId && user.teacherStatus
      ? { username: user.teacherId, status: user.teacherStatus }
      : null;
  return { username: user.username, email: user.email, role: user.role, teacher };
}
