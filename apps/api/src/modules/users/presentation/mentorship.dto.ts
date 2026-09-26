import { createZodDto } from 'nestjs-zod';
import { setTeacherSchema, teacherSearchSchema } from '@wl/shared';

export class SetTeacherDto extends createZodDto(setTeacherSchema) {}
export class TeacherSearchDto extends createZodDto(teacherSearchSchema) {}
