import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Message } from 'schemas/Message.schema';

class LastMessageDto {
  @ApiProperty({
    description: 'The content of the message',
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: Message['content'] } },
    ],
  })
  content: Message['content'];

  @ApiProperty({
    description: 'The type of the message',
    oneOf: [{ type: 'string', enum: ['text', 'file', 'event'] }],
  })
  @IsString()
  type: Message['type'];
}

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
    description: 'The content of the first message in the chat',
    type: LastMessageDto,
  })
  @ValidateNested()
  @Type(() => LastMessageDto)
  lastMessage: LastMessageDto;
}
