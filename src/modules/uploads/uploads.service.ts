// src/modules/uploads/uploads.service.ts
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export type UploadImageResult = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {
    const cld = this.getCloudinary();
    if (cld) {
      cld.config({
        cloud_name: this.config.get<string>('app.cloudinaryCloudName') ?? process.env.CLOUDINARY_CLOUD_NAME,
        api_key: this.config.get<string>('app.cloudinaryApiKey') ?? process.env.CLOUDINARY_API_KEY,
        api_secret: this.config.get<string>('app.cloudinaryApiSecret') ?? process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    }
  }

  private getCloudinary(): any | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('cloudinary');
      return mod?.v2 ?? null;
    } catch {
      return null;
    }
  }

  private ensureConfigured() {
    const cld = this.getCloudinary();
    if (!cld) {
      throw new BadRequestException('Cloudinary module is not installed');
    }
    const cloudName =
      this.config.get<string>('app.cloudinaryCloudName') ?? process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = this.config.get<string>('app.cloudinaryApiKey') ?? process.env.CLOUDINARY_API_KEY;
    const apiSecret =
      this.config.get<string>('app.cloudinaryApiSecret') ?? process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException('Cloudinary is not configured');
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    opts: { folder: string; publicIdPrefix?: string; tags?: string[] },
  ): Promise<UploadImageResult> {
    if (!file?.buffer) throw new BadRequestException('File is required');
    this.ensureConfigured();
    const cloudinary = this.getCloudinary();
    if (!cloudinary) throw new BadRequestException('Cloudinary module is not installed');

    const publicIdPrefix = opts.publicIdPrefix ?? 'img';
    const publicId = `${publicIdPrefix}_${randomUUID()}`;

    try {
      const res = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: opts.folder,
            public_id: publicId,
            resource_type: 'image',
            tags: opts.tags,
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );
        stream.end(file.buffer);
      });

      return {
        url: res.secure_url,
        publicId: res.public_id,
        width: res.width,
        height: res.height,
        format: res.format,
        bytes: res.bytes,
      };
    } catch (e: any) {
      throw new InternalServerErrorException(`Cloudinary upload failed: ${e?.message ?? e}`);
    }
  }

  async uploadImages(
    files: Express.Multer.File[],
    opts: { folder: string; publicIdPrefix?: string; tags?: string[] },
  ): Promise<UploadImageResult[]> {
    if (!Array.isArray(files) || files.length === 0) return [];
    const results: UploadImageResult[] = [];
    for (const f of files) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await this.uploadImage(f, opts));
    }
    return results;
  }
}
