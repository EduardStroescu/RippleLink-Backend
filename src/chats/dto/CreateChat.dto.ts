export class CreateChatDto {
  name?: string;

  type?: 'group' | 'dm';

  userIds: string[];

  messageType: 'text' | 'image' | 'video' | 'file' | 'audio';

  lastMessage: string;
}
