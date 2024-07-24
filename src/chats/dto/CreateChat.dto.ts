import { Message } from 'schemas/Message.schema';
import { User } from 'schemas/User.schema';

export class CreateChatDto {
  users: User[];

  messages: Message[];
}
