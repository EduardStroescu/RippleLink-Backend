import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'schemas/User.schema';
import { CallsController } from './calls.controller';
import { Chat, ChatSchema } from 'schemas/Chat.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
