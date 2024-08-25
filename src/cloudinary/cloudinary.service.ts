import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryResponse } from './cloudinary-response';

@Injectable()
export class CloudinaryService {
  async uploadAvatar(
    base64String: string,
    email: string,
  ): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>(async (resolve, reject) => {
      const uploadOptions = {
        upload_preset: 'unsigned_upload',
        public_id: `${email}-avatar`,
        invalidate: true,
        allowed_formats: [
          'png',
          'jpg',
          'jpeg',
          'gif',
          'svg',
          'ico',
          'jfif',
          'webp',
        ],
        transformation: [{ crop: 'fill' }],
      };

      cloudinary.uploader.upload(
        base64String,
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  async uploadImageFile(base64String: string): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>(async (resolve, reject) => {
      const uploadOptions = {
        upload_preset: 'unsigned_upload',
        allowed_formats: [
          'png',
          'jpg',
          'jpeg',
          'gif',
          'svg',
          'ico',
          'jfif',
          'webp',
        ],
        transformation: [{ crop: 'fill' }],
      };

      cloudinary.uploader.upload(
        base64String,
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  async uploadOtherFileTypes(
    base64String: string,
  ): Promise<CloudinaryResponse> {
    return new Promise<CloudinaryResponse>(async (resolve, reject) => {
      const RESOURCE_TYPE: 'auto' | 'image' | 'video' | 'raw' = 'auto';
      const uploadOptions = {
        upload_preset: 'unsigned_upload',
        resource_type: RESOURCE_TYPE,
      };

      cloudinary.uploader.upload(
        base64String,
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error(error);
            return reject(error);
          }
          resolve(result);
        },
      );
    });
  }

  async removeFile(publicId: string) {
    return new Promise<CloudinaryResponse>(async (resolve, reject) => {
      const deleteOptions = {
        invalidate: true,
      };
      cloudinary.uploader.destroy(publicId, deleteOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }
}
