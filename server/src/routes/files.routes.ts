import { Router, type NextFunction, type Request, type Response } from 'express';
import { MulterError } from 'multer';
import { FileController } from '../controllers/FileController';
import { FileStorageService } from '../services/FileStorageService';
import { AppRoles } from '../constants';
import { BadRequestError } from '../errors/AppError';
import { authenticate } from '../middlewares/authenticate.middleware';
import { authorize } from '../middlewares/authorize.middleware';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * File uploads / downloads.
 * Mount as: ['files', filesRoutes] in api/router.ts.
 */
const router = Router();
const controller = FileController.getInstance();
const files = FileStorageService.getInstance();

router.use(authenticate, authorize(AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR));

/** Maps multer's own errors (size limit etc.) onto the API error envelope. */
function uploadSingle(req: Request, res: Response, next: NextFunction): void {
  files.singleFileMiddleware()(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      next(
        new BadRequestError(
          err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 5 MB' : err.message,
        ),
      );
      return;
    }
    next(err as Error | undefined);
  });
}

router.post('/', uploadSingle, asyncHandler(controller.upload));
router.get('/:key', asyncHandler(controller.download));

export default router;
