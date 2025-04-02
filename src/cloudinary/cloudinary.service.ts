import { Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiOptions,
  UploadApiResponse,
} from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  async uploadBase64String(
    uploadType: 'avatar' | 'background' | 'other',
    userId: string,
    { name, base64String }: { name?: string; base64String: string },
  ) {
    const uploadOptions: UploadApiOptions = {
      upload_preset: 'unsigned_upload',
      resource_type: 'auto',
      public_id: name?.split('.')[0],
      folder: `${userId}-files`,
      unique_filename: true,
      use_asset_folder_as_public_id_prefix: true,
    };
    if (uploadType !== 'other') {
      uploadOptions.public_id = `${userId}-${uploadType}`;
      uploadOptions.invalidate = true;
      uploadOptions.overwrite = true;
      uploadOptions.allowed_formats = [
        'png',
        'jpg',
        'jpeg',
        'gif',
        'svg',
        'ico',
        'jfif',
        'webp',
      ];
      uploadOptions.transformation = [{ crop: 'fill' }];
    }
    try {
      return await cloudinary.uploader.upload(base64String, uploadOptions);
    } catch (error: unknown) {
      throw error as UploadApiErrorResponse;
    }
  }

  uploadFileStream(
    uploadType: 'avatar' | 'background' | 'other',
    userId: string,
    { name, buffer }: { name?: string; buffer: Buffer },
  ) {
    const uploadOptions: UploadApiOptions = {
      upload_preset: 'unsigned_upload',
      resource_type: 'auto',
      public_id: name?.split('.')[0],
      folder: `${userId}-files`,
      unique_filename: true,
      use_asset_folder_as_public_id_prefix: true,
    };
    if (uploadType !== 'other') {
      uploadOptions.public_id = `${userId}-${uploadType}`;
      uploadOptions.invalidate = true;
      uploadOptions.allowed_formats = [
        'png',
        'jpg',
        'jpeg',
        'gif',
        'svg',
        'ico',
        'jfif',
        'webp',
      ];
      uploadOptions.transformation = [{ crop: 'fill' }];
    }

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      const stream = Readable.from(buffer);
      stream.pipe(uploadStream);
    });
  }

  removeFiles(publicIds: string[], resourceType: string) {
    const deleteOptions = {
      invalidate: true,
      resource_type: resourceType,
    };
    void cloudinary.api.delete_resources(publicIds, deleteOptions);
  }
}
