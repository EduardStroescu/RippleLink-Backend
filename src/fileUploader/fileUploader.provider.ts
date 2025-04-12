import {
  BadGatewayException,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { UploadApiResponse } from 'cloudinary';
import { FileContent } from 'schemas/Message.schema';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { MessageDto } from 'src/lib/dtos/message.dto';

@Injectable()
export class FileUploaderService implements OnModuleDestroy {
  private readonly chunkStorage: Record<
    string,
    { files: Map<string, Buffer[] | string>; timestamp: number }
  > = {};
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute interval
  private readonly MESSAGE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
  interval: NodeJS.Timeout | null = null;

  constructor(private readonly cloudinaryService: CloudinaryService) {}

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async uploadChunkedFile(
    uploadType: 'avatar' | 'background' | 'other',
    userId: string,
    message: MessageDto & { content: FileContent },
    {
      fileId,
      name,
      chunk,
      index,
      totalChunks,
    }: {
      fileId: string;
      name: string;
      chunk: Buffer;
      index: number;
      totalChunks: number;
    },
  ): Promise<
    | UploadApiResponse['secure_url']
    | Map<string, UploadApiResponse['secure_url']>
    | undefined
  > {
    if (!this.interval) {
      this.interval = setInterval(
        () => this.cleanupOldMessages(),
        this.CLEANUP_INTERVAL,
      );
    }

    if (message._id in this.chunkStorage === false) {
      this.chunkStorage[message._id] = {
        files: new Map(message.content.map((content) => [content.fileId, []])),
        timestamp: Date.now(),
      };
    }

    const fileChunks = this.chunkStorage[message._id].files.get(
      fileId,
    ) as Buffer[];
    // Store chunk in memory
    fileChunks[index] = chunk;
    this.chunkStorage[message._id].timestamp = Date.now();

    if (fileChunks.filter(Boolean).length === totalChunks) {
      // Merge all chunks into a single Buffer
      const mergedBuffer = Buffer.concat(fileChunks);
      try {
        // Upload the merged file
        const response = await this.cloudinaryService.uploadFileStream(
          uploadType,
          userId,
          {
            name,
            buffer: mergedBuffer,
          },
        );

        // Replace the stored chunks with the uploaded file's URL
        this.chunkStorage[message._id].files.set(fileId, response.secure_url);
        this.chunkStorage[message._id].timestamp = Date.now();

        // Clear stored message content from memory
        if (
          [...this.chunkStorage[message._id].files.values()].every(
            (fileId) => typeof fileId === 'string',
          )
        ) {
          // Store the content for the message before deleting
          const content = this.chunkStorage[message._id].files;
          delete this.chunkStorage[message._id];
          return content as Map<string, string>;
        }

        return response.secure_url;
      } catch (error) {
        delete this.chunkStorage[message._id];
        throw new BadGatewayException('Cloudinary Error:' + error.message);
      }
    }
  }

  async uploadBase64File(
    uploadType: 'avatar' | 'background' | 'other',
    userId: string,
    {
      name,
      base64String,
    }: {
      name?: string;
      base64String: string;
    },
  ) {
    try {
      const response = await this.cloudinaryService.uploadBase64String(
        uploadType,
        userId,
        {
          name,
          base64String,
        },
      );
      return response.secure_url;
    } catch (error) {
      throw new BadGatewayException('Cloudinary Error:' + error.message);
    }
  }

  removeFiles(publicIds: string | string[]) {
    if (Array.isArray(publicIds)) {
      const fileNames = publicIds.map((id) => id.split('.')[0]);
      const resourceType = this.getResourceType(publicIds[0].split('.').pop());
      this.cloudinaryService.removeFiles(fileNames, resourceType);
    } else {
      const resourceType = this.getResourceType(publicIds.split('.').pop());
      this.cloudinaryService.removeFiles([publicIds], resourceType);
    }
  }

  /**
   * Cleanup old messages from the file storage if they were left unhandled for too long
   */
  private cleanupOldMessages() {
    if (Object.keys(this.chunkStorage).length === 0) {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
      return;
    }

    const now = Date.now();

    for (const [messageId, { timestamp }] of Object.entries(
      this.chunkStorage,
    )) {
      if (now - timestamp > this.MESSAGE_EXPIRY_TIME) {
        // If message is older than MESSAGE_EXPIRY_TIME, clear it from the storage
        delete this.chunkStorage[messageId];
      }
    }
  }

  /**
   * Get the resource type based on the file extension. Needed for Cloudinary deletes.
   */
  private getResourceType(fileExtension: string) {
    const imageExtensions = [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'bmp',
      'tiff',
      'svg',
      'webp',
      'heif',
      'heic',
    ];

    const videoExtensions = [
      'mp4',
      'avi',
      'mov',
      'webm',
      'mkv',
      'flv',
      'wmv',
      '3gp',
      'ogv',
      'ts',
      'vob',
    ];

    const audioExtensions = [
      'mp3',
      'wav',
      'flac',
      'aac',
      'ogg',
      'm4a',
      'wma',
      'alac',
      'aiff',
      'pcm',
    ];

    // Convert file extension to lowercase for case-insensitive matching
    const ext = fileExtension.toLowerCase();

    if (imageExtensions.includes(ext)) {
      return 'image';
    } else if (videoExtensions.includes(ext) || audioExtensions.includes(ext)) {
      return 'video';
    } else {
      return 'raw';
    }
  }
}
