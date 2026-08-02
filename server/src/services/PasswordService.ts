import bcrypt from 'bcrypt';
import { Config } from '../config';

/**
 * PasswordService
 * Handles password hashing and verification with bcrypt.
 * Design Pattern: Singleton
 * SOLID: SRP — password cryptography only
 */
export class PasswordService {
  private static instance: PasswordService | null = null;
  private readonly saltRounds: number;

  private constructor() {
    this.saltRounds = Config.getInstance().bcryptSaltRounds;
  }

  public static getInstance(): PasswordService {
    if (!PasswordService.instance) {
      PasswordService.instance = new PasswordService();
    }
    return PasswordService.instance;
  }

  public async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  public async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
