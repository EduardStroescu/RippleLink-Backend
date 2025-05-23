import { ApiProperty } from '@nestjs/swagger';
import { PublicUserDto } from './user.dto';
import { MessageDto } from './message.dto';

export class ChatDto {
  @ApiProperty({
    description: 'Chat ID',
    type: String,
  })
  _id: string;

  @ApiProperty({
    description:
      'The name of the chat given my users or automatically generated.',
    type: String,
  })
  name: string;

  @ApiProperty({
    description: 'Chat type',
    oneOf: [{ type: 'string', enum: ['dm', 'group'] }],
  })
  type: 'dm' | 'group';

  @ApiProperty({
    description: 'List of users in the chat',
    type: [PublicUserDto],
  })
  users: PublicUserDto[];

  @ApiProperty({
    description: 'Last message in the chat',
    type: MessageDto,
  })
  lastMessage: MessageDto;
}
