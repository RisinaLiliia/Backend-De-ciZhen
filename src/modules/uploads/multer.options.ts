// src/modules/uploads/multer.options.ts
import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const IMAGE_MULTER_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: (error: any, acceptFile: boolean) => void) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Only image files are allowed'), false);
    }
    return cb(null, true);
  },
};
