import { z } from 'zod';
import { usernameSchema, type TeacherStatus } from './auth.schema';

export const setTeacherSchema = z.object({ teacherUsername: usernameSchema });
export type SetTeacherRequest = z.infer<typeof setTeacherSchema>;

export const teacherSearchSchema = z.object({
  query: z.string().trim().max(32).default(''),
});

export interface TeacherSummary {
  username: string;
}

export interface StudentSummary {
  username: string;
  email: string;
  status: TeacherStatus;
}
