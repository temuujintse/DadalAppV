import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Argon2id with OWASP-recommended parameters (m=19 MiB, t=2, p=1). */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService implements OnModuleInit {
  /** Hash of a random value; verified against when the e-mail is unknown to equalise timing. */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(`dummy-${Date.now()}-${Math.random()}`, ARGON2_OPTIONS);
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string | null | undefined, password: string): Promise<boolean> {
    try {
      const ok = await argon2.verify(hash ?? this.dummyHash, password);
      return Boolean(hash) && ok;
    } catch {
      return false;
    }
  }
}
