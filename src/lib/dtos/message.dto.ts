import { ApiProperty } from '@nestjs/swagger';
import { Content } from 'schemas/Message.schema';
import { User } from 'schemas/User.schema';

class ReadByEntryDto {
  @ApiProperty({
    description: 'User who read the message',
    type: 'object',
    example: { _id: 'string', displayName: 'string' },
  })
  userId: {
    _id: User['_id'];
    displayName: User['displayName'];
    avatarUrl: User['avatarUrl'];
  };

  @ApiProperty({
    description: 'Timestamp when the message was read',
    type: String,
    example: '2024-09-21T12:34:56.789Z',
  })
  timestamp: string;
}

export class MessageDto {
  @ApiProperty({
    description: 'Message ID.',
    type: String,
  })
  _id: string;

  @ApiProperty({
    description: 'The ID of the chat the message belongs to.',
    type: String,
  })
  chatId: string;

  @ApiProperty({
    description: 'The user who sent the message.',
    type: String,
  })
  senderId: string;

  @ApiProperty({
    description: 'Message content',
    oneOf: [
      { type: 'string' },
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            fileId: { type: 'string' },
            type: { type: 'string', enum: ['image', 'video', 'audio', 'file'] },
          },
        },
      },
    ],
  })
  content: Content;

  @ApiProperty({
    description: 'Message type',
    oneOf: [{ type: 'string', enum: ['text', 'file', 'event'] }],
  })
  type: 'text' | 'file' | 'event';

  @ApiProperty({
    description: 'List of users who have read the message with timestamps.',
    type: [ReadByEntryDto],
  })
  readBy: ReadByEntryDto[];

  @ApiProperty({
    description: 'Time of message creation.',
    type: String,
  })
  createdAt: string;

  @ApiProperty({
    description: 'Last time the message was updated.',
    type: String,
  })
  updatedAt: string;
}
