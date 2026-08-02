import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';
import { Config } from '../config';

/**
 * ILogger
 * Minimal logger interface used across the application to depend on an abstraction.
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string | Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): ILogger;
  readonly stream: { write: (msg: string) => void };
}

/**
 * Logger
 * Production-ready singleton wrapper around `pino`.
 * - Provides structured logging
 * - Exposes `stream.write` for integration with `morgan`
 * Design patterns: Singleton, Adapter (adapts pino to ILogger and morgan stream)
 * SOLID:
 *  - SRP: Only logging concerns are implemented here.
 *  - OCP: Behavior can be extended via child loggers without modifying callers.
 *  - LSP: `child` returns an `ILogger` compatible instance.
 *  - ISP: Consumers depend on `ILogger` (narrow interface).
 *  - DIP: High-level modules depend on `ILogger` abstraction, not pino directly.
 */
export class Logger implements ILogger {
  private static instance: Logger | null = null;
  private readonly logger: PinoLogger;
  public readonly stream: { write: (msg: string) => void };

  private constructor() {
    const cfg = Config.getInstance();
    const level = cfg.getString(
      'LOG_LEVEL',
      cfg.nodeEnv === 'production' ? 'info' : 'debug',
    );

    this.logger = pino({
      level,
      base: { env: cfg.nodeEnv },
      timestamp: pino.stdTimeFunctions.isoTime,
    });

    // morgan expects a writable stream with a write(string) method
    this.stream = {
      write: (message: string) => {
        // morgan includes a newline — trim it
        this.info(message.trim());
      },
    };
  }

  /**
   * Returns singleton instance of Logger.
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.info({ ...meta }, message);
  }

  public warn(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.warn({ ...meta }, message);
  }

  public error(message: string | Error, meta: Record<string, unknown> = {}): void {
    if (message instanceof Error) {
      this.logger.error({ ...meta, err: { message: message.message, stack: message.stack } }, 'Error');
    } else {
      this.logger.error({ ...meta }, message);
    }
  }

  public debug(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.debug({ ...meta }, message);
  }

  public child(bindings: Record<string, unknown>): ILogger {
    const childLogger = this.logger.child(bindings);
    const wrapper: ILogger = {
      info: (msg: string, meta?: Record<string, unknown>) => childLogger.info({ ...meta }, msg),
      warn: (msg: string, meta?: Record<string, unknown>) => childLogger.warn({ ...meta }, msg),
      error: (msg: string | Error, meta?: Record<string, unknown>) => {
        if (msg instanceof Error) childLogger.error({ ...meta, err: { message: msg.message, stack: msg.stack } }, 'Error');
        else childLogger.error({ ...meta }, msg);
      },
      debug: (msg: string, meta?: Record<string, unknown>) => childLogger.debug({ ...meta }, msg),
      child: (b: Record<string, unknown>) => {
        const c = childLogger.child(b);
        return Logger.wrapPino(c);
      },
      stream: { write: (m: string) => childLogger.info(m.trim()) },
    };
    return wrapper;
  }

  private static wrapPino(p: PinoLogger): ILogger {
    return {
      info: (msg: string, meta?: Record<string, unknown>) => p.info({ ...meta }, msg),
      warn: (msg: string, meta?: Record<string, unknown>) => p.warn({ ...meta }, msg),
      error: (msg: string | Error, meta?: Record<string, unknown>) => {
        if (msg instanceof Error) p.error({ ...meta, err: { message: msg.message, stack: msg.stack } }, 'Error');
        else p.error({ ...meta }, msg);
      },
      debug: (msg: string, meta?: Record<string, unknown>) => p.debug({ ...meta }, msg),
      child: (b: Record<string, unknown>) => Logger.wrapPino(p.child(b)),
      stream: { write: (m: string) => p.info(m.trim()) },
    };
  }
}

export default Logger;
