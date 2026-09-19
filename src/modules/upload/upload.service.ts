import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

function slugify(text: string) {
  return text
    .toString()
    .normalize('NFD') // remove diacritics
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

@Injectable()
export class UploadService {
  async uploadFileToCloudinary(
    file: Express.Multer.File,
    type?: string,
  ): Promise<any> {
    if (!file) throw new BadRequestException('File is required');

    return new Promise((resolve, reject) => {
      const originalNameParts = file.originalname.split('.');
      const ext =
        originalNameParts.length > 1 ? `.${originalNameParts.pop()}` : '';
      const baseName = originalNameParts.join('.');

      const safeBaseName = slugify(baseName) || 'file';
      const uniqueName = `${safeBaseName}-${Date.now()}${ext}`;

      let folderPath = 'kltn';
      if (type === 'templates') folderPath = 'kltn/templates';
      else if (type === 'reports') folderPath = 'kltn/reports';

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          resource_type: 'raw',
          public_id: uniqueName,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
