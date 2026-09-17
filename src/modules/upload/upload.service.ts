import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class UploadService {
  async uploadFileToCloudinary(file: Express.Multer.File): Promise<any> {
    if (!file) throw new BadRequestException('File is required');
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'kltn',
          resource_type: 'raw', // Important for .doc, .pdf
          use_filename: true,
          unique_filename: true,
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

