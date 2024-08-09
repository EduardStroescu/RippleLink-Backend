import { User } from 'schemas/User.schema';

export class UpdateChatDto {
  name?: string;

  type?: 'group' | 'dm';

  userId: string;

  messageType: 'text' | 'image' | 'video' | 'file' | 'audio';

  lastMessage: string;

  ongoingCall?: {
    participants: { userId: User; signal: string }[];
  };
}
