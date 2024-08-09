import { forwardRef, Module } from '@nestjs/common';
import { Gateway } from './gateway';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { ChatsModule } from 'src/chats/chats.module';

@Module({
  imports: [
    JwtModule.register({}),
    MessagesModule,
    UsersModule,
    forwardRef(() => ChatsModule),
  ],
  providers: [Gateway],
  exports: [Gateway],
})
export class GatewayModule {}
