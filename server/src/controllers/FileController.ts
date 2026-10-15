import type { Request, Response } from 'express';
import { BadRequestError, UnauthorizedError } from '../errors/AppError';
import { FileStorageService } from '../services/FileStorageService';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../constants';

export class FileController {
  private static instance: FileController | null = null;
  private constructor(private readonly files = FileStorageService.getInstance()) {}
  public static getInstance(): FileController {
    if (!FileController.instance) FileController.instance = new FileController();
    return FileController.instance;
  }

  /** POST /files — multipart field `file` + body field `purpose`. */
  public upload = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    if (!req.file) throw new BadRequestError('Attach one file in the `file` field');
    const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose : '';
    const row = await this.files.register(req.file, purpose, req.user);
    ApiResponse.success(res, row, 'File uploaded', HttpStatus.CREATED);
  };

  /** GET /files/:key — streams the file with its stored content type. */
  public download = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const { absolutePath, mimeType, fileName } = await this.files.getForDownload(
      String(req.params.key ?? ''),
      req.user,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName.replace(/[^\w.\- ]+/g, '_')}"`,
    );
    res.sendFile(absolutePath);
  };
}
