import { z } from 'zod';

export const ROLES = ['student', 'teacher'] as const;
export const TEACHER_STATUSES = ['pending', 'accepted', 'rejected'] as const;

export const roleSchema = z.enum(ROLES);
export const teacherStatusSchema = z.enum(TEACHER_STATUSES);

export type Role = z.infer<typeof roleSchema>;
export type TeacherStatus = z.infer<typeof teacherStatusSchema>;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'validation.usernameLength')
  .max(32, 'validation.usernameLength')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'validation.usernameFormat');

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.email('validation.email').trim().toLowerCase().max(254),
  password: z.string().min(8, 'validation.passwordLength').max(128, 'validation.passwordLength'),
  role: roleSchema,
});
export type RegisterRequest = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** username або email */
  login: z.string().trim().min(1, 'validation.loginRequired').max(254),
  password: z.string().min(1, 'validation.passwordRequired').max(128),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export interface TeacherLink {
  username: string;
  status: TeacherStatus;
}

/** Профіль, що повертає `/api/auth/me` та login/register. */
export interface UserProfile {
  username: string;
  email: string;
  role: Role;
  /** Лише для student: закріплений вчитель та статус заявки. */
  teacher: TeacherLink | null;
}
