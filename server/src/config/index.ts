import { z } from 'zod';

/**
 * IConfig
 * Abstraction for configuration access. Enables dependency inversion and easier testing.
 */
export interface IConfig {
  get(key: string): string | undefined;
  getString(key: string, fallback?: string): string;
  getNumber(key: string, fallback?: number): number;
  getBoolean(key: string, fallback?: boolean): boolean;
  has(key: string): boolean;
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly databaseUrl: string;
  readonly jwtAccessSecret: string;
  readonly jwtRefreshSecret: string;
  readonly jwtAccessExpiresIn: string;
  readonly jwtRefreshExpiresIn: string;
  readonly corsOrigin: string;
  readonly bcryptSaltRounds: number;
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default('debug'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NAME: z.string().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

/**
 * Config
 * Singleton responsible for reading, validating and exposing environment configuration.
 * Design patterns: Singleton
 * SOLID: SRP, OCP, LSP, ISP, DIP via IConfig
 */
export class Config implements IConfig {
  private static instance: Config | null = null;
  private readonly env: NodeJS.ProcessEnv;
  private readonly parsed: EnvConfig;

  private constructor() {
    this.env = process.env;
    const parseResult = envSchema.safeParse(this.env);

    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid environment configuration: ${issues}`);
    }

    this.parsed = parseResult.data;
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /** Test helper — resets singleton between test runs */
  public static resetInstance(): void {
    Config.instance = null;
  }

  public get(key: string): string | undefined {
    return this.env[key];
  }

  public getString(key: string, fallback = ''): string {
    const value = this.get(key);
    return value !== undefined ? value : fallback;
  }

  public getNumber(key: string, fallback?: number): number {
    const value = this.get(key);
    if (value === undefined || value === '') {
      if (fallback !== undefined) return fallback;
      throw new Error(`Configuration key ${key} is missing and no fallback provided`);
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      if (fallback !== undefined) return fallback;
      throw new Error(`Configuration key ${key} is not a number`);
    }
    return parsed;
  }

  public getBoolean(key: string, fallback = false): boolean {
    const value = this.get(key);
    if (value === undefined) return fallback;
    const normalized = value.toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public get nodeEnv(): 'development' | 'test' | 'production' {
    return this.parsed.NODE_ENV;
  }

  public get port(): number {
    return this.parsed.PORT;
  }

  public get databaseUrl(): string {
    return this.parsed.DATABASE_URL;
  }

  public get jwtAccessSecret(): string {
    return this.parsed.JWT_ACCESS_SECRET;
  }

  public get jwtRefreshSecret(): string {
    return this.parsed.JWT_REFRESH_SECRET;
  }

  public get jwtAccessExpiresIn(): string {
    return this.parsed.JWT_ACCESS_EXPIRES_IN;
  }

  public get jwtRefreshExpiresIn(): string {
    return this.parsed.JWT_REFRESH_EXPIRES_IN;
  }

  public get corsOrigin(): string {
    return this.parsed.CORS_ORIGIN;
  }

  public get bcryptSaltRounds(): number {
    return this.parsed.BCRYPT_SALT_ROUNDS;
  }

  public get rateLimitWindowMs(): number {
    return this.parsed.RATE_LIMIT_WINDOW_MS;
  }

  public get rateLimitMax(): number {
    return this.parsed.RATE_LIMIT_MAX;
  }
}

export default Config;
