import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from 'schemas/Chat.schema';
import { User, UserSchema } from 'schemas/User.schema';
import { Message, MessageSchema } from 'schemas/Message.schema';
import { GatewayModule } from 'src/gateway/gateway.module';
import { MessagesModule } from 'src/messages/messages.module';
import { FileUploaderModule } from 'src/fileUploader/fileUploader.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: User.name, schema: UserSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    MessagesModule,
    GatewayModule,
    FileUploaderModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
