import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { FileUploaderService } from './fileUploader.provider';

@Module({
  imports: [CloudinaryModule],
  providers: [FileUploaderService],
  exports: [FileUploaderService],
})
export class FileUploaderModule {}
