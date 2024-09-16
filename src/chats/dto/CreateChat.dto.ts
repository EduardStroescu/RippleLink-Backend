import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateChatDto {
  @ApiPropertyOptional({
    description: 'Chat Name',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Chat Type',
    enum: ['group', 'dm'],
    example: ['group', 'dm'],
  })
  @IsOptional()
  @IsEnum(['group', 'dm'])
  type?: 'group' | 'dm';

  @ApiProperty({
    description: 'Array of user IDs associated with the chat',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Message type',
    enum: ['text', 'image', 'video', 'file', 'audio'],
    example: ['text', 'image', 'video', 'file', 'audio'],
  })
  @IsEnum(['text', 'image', 'video', 'file', 'audio'])
  messageType: 'text' | 'image' | 'video' | 'file' | 'audio';

  @ApiProperty({
    description: 'The content of the first message in the chat',
    type: String,
  })
  @IsString()
  lastMessage: string;
}
