import { Module } from '@nestjs/common';
import { Gateway } from './gateway';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [MessagesModule, UsersModule],
  providers: [Gateway],
})
export class GatewayModule {}
