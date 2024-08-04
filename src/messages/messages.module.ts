import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from 'schemas/Message.schema';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { Chat, ChatSchema } from 'schemas/Chat.schema';
import { User, UserSchema } from 'schemas/User.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
