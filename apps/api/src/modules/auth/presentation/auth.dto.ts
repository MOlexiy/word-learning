import { createZodDto } from 'nestjs-zod';
import { loginSchema, registerSchema } from '@wl/shared';

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
