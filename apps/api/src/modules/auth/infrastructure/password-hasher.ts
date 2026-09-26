import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

@Injectable()
export class PasswordHasher {
  private static readonly ROUNDS = 12;
  /** Хеш-«пустушка», щоб логін неіснуючого користувача тривав стільки ж (захист від перебору username). */
  private static readonly DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', PasswordHasher.ROUNDS);

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, PasswordHasher.ROUNDS);
  }

  verify(password: string, hash: string | null): Promise<boolean> {
    return bcrypt.compare(password, hash ?? PasswordHasher.DUMMY_HASH).then((ok) => ok && hash !== null);
  }
}
