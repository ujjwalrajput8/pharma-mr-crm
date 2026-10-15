import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Config } from '../config';
import { AppRoles } from '../constants';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { TeamScopeService } from './TeamScopeService';
import { AuditService } from './AuditService';
import type { AuthUser } from '../types/auth.types';

export const FILE_PURPOSES = [
  'leave-proof',
  'selfie',
  'employee-doc',
  'expense-receipt',
  'avatar',
] as const;

export type FilePurpose = (typeof FILE_PURPOSES)[number];

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface PublicStoredFile {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  purpose: string;
}

/**
 * FileStorageService — disk-backed uploads behind the `StoredFile` table.
 *
 * Files land under `UPLOAD_DIR` (default `<cwd>/uploads`) with a random 32-hex
 * name + the original extension, so a key can never traverse outside the
 * directory. Every download is access-checked: uploader, ADMIN, or a manager
 * whose team includes the uploader.
 */
export class FileStorageService {
  private static instance: FileStorageService | null = null;

  public readonly uploadDir: string;
  private readonly upload: multer.Multer;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
    private readonly audits = AuditService.getInstance(),
    private readonly config = Config.getInstance(),
  ) {
    const configured = this.config.getString('UPLOAD_DIR', '').trim();
    this.uploadDir = configured
      ? path.resolve(configured)
      : path.join(process.cwd(), 'uploads');
    fs.mkdirSync(this.uploadDir, { recursive: true });

    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, this.uploadDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().slice(0, 11) || '';
        const safeExt = /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
        cb(null, `${crypto.randomBytes(16).toString('hex')}${safeExt}`);
      },
    });

    this.upload = multer({
      storage,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(new BadRequestError('Only JPEG, PNG, WebP images or PDF files are allowed'));
          return;
        }
        cb(null, true);
      },
    });
  }

  public static getInstance(): FileStorageService {
    if (!FileStorageService.instance) FileStorageService.instance = new FileStorageService();
    return FileStorageService.instance;
  }

  /** Multer middleware for the single `file` multipart field. */
  public singleFileMiddleware() {
    return this.upload.single('file');
  }

  /** Persists the StoredFile row after multer has written the file to disk. */
  public async register(
    file: Express.Multer.File,
    purpose: string,
    actor: AuthUser,
  ): Promise<PublicStoredFile> {
    if (!FILE_PURPOSES.includes(purpose as FilePurpose)) {
      // Never leave an orphan on disk for a rejected request.
      this.removeFromDisk(file.filename);
      throw new BadRequestError(
        `purpose must be one of: ${FILE_PURPOSES.join(', ')}`,
      );
    }

    const row = await this.prisma.storedFile.create({
      data: {
        key: file.filename,
        fileName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        purpose,
        uploadedBy: actor.id,
      },
    });

    try {
      await this.audits.log({
        userId: actor.id,
        action: 'FILE_UPLOADED',
        entity: 'StoredFile',
        entityId: row.key,
        metadata: { fileName: row.fileName, purpose, sizeBytes: row.sizeBytes },
      });
    } catch {
      // Audit must never fail an upload.
    }

    return {
      key: row.key,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      purpose: row.purpose,
    };
  }

  /** Looks up a stored file by key (no access check) — used to validate references. */
  public async findByKey(key: string) {
    return this.prisma.storedFile.findFirst({ where: { key, deletedAt: null } });
  }

  /** Asserts a key references a live stored file; used by services storing `file:<key>`. */
  public async assertExists(key: string): Promise<void> {
    const row = await this.findByKey(key);
    if (!row) throw new BadRequestError('Uploaded file not found — upload it again');
  }

  /**
   * Resolves a file for download with the access rule:
   * uploader themselves, ADMIN, or a manager whose team includes the uploader.
   */
  public async getForDownload(
    key: string,
    actor: AuthUser,
  ): Promise<{ absolutePath: string; mimeType: string; fileName: string }> {
    // The key is always a generated hex name — reject anything path-like outright.
    if (!/^[0-9a-f]{32}(\.[a-z0-9]{1,10})?$/i.test(key)) {
      throw new NotFoundError('File not found');
    }

    const row = await this.findByKey(key);
    if (!row) throw new NotFoundError('File not found');

    const allowed =
      actor.role === AppRoles.ADMIN ||
      (row.uploadedBy !== null && row.uploadedBy === actor.id) ||
      (actor.role === AppRoles.MANAGER &&
        row.uploadedBy !== null &&
        ((await this.scope.visibleUserIds(actor)) ?? []).includes(row.uploadedBy));
    if (!allowed) {
      throw new ForbiddenError('You do not have access to this file');
    }

    const absolutePath = path.join(this.uploadDir, row.key);
    if (!fs.existsSync(absolutePath)) throw new NotFoundError('File not found');

    return { absolutePath, mimeType: row.mimeType, fileName: row.fileName };
  }

  private removeFromDisk(key: string): void {
    try {
      fs.unlinkSync(path.join(this.uploadDir, key));
    } catch {
      // Best effort only.
    }
  }
}
