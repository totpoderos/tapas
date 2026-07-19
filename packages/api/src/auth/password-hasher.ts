import bcrypt from 'bcryptjs';

/** Port for password hashing. Kept behind an interface so the domain/use cases don't depend on bcrypt. */
export interface PasswordHasher {
  hash(raw: string): Promise<string>;
  verify(raw: string, hash: string): Promise<boolean>;
}

/** bcrypt (pure-JS) hasher. 12 rounds in production; tests inject a lower cost. */
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds = 12) {}

  hash(raw: string): Promise<string> {
    return bcrypt.hash(raw, this.rounds);
  }

  verify(raw: string, hash: string): Promise<boolean> {
    return bcrypt.compare(raw, hash);
  }
}
