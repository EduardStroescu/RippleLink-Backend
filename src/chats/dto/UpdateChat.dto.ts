import { User } from 'schemas/User.schema';

export class UpdateChatDto {
  name?: string;

  type?: 'group' | 'dm';

  userIds: string[];

  messageType: 'text' | 'image' | 'video' | 'file' | 'audio';

  lastMessage: string;
}
