export class CreateChatDto {
  name?: string;

  type?: 'group' | 'dm';

  userId: string;

  messageType: 'text' | 'image' | 'video' | 'file' | 'audio';

  lastMessage: string;
}
