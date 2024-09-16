import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageDto {
  @ApiProperty({
    description: 'Message id',
    type: String,
  })
  _id: string;

  @ApiProperty({
    description: 'Chat id',
    type: String,
  })
  chatId: string;

  @ApiProperty({
    description: 'Sender id',
    type: String,
  })
  senderId: string;

  @ApiProperty({
    description: 'Message content',
    type: String,
  })
  content: string;

  @ApiProperty({
    description: 'Message type',
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file'],
  })
  type: 'text' | 'image' | 'video' | 'audio' | 'file';

  @ApiProperty({
    description: 'Message read status',
    type: Boolean,
  })
  read: boolean;

  @ApiPropertyOptional({
    description: 'Message read at',
    type: Date,
  })
  readAt?: Date;

  @ApiProperty({
    description: 'Message created at',
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Message updated at',
    type: Date,
  })
  updatedAt: Date;
}
