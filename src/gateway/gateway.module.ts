import { Module } from '@nestjs/common';
import { Gateway } from './gateway';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({}), MessagesModule, UsersModule],
  providers: [Gateway],
  exports: [Gateway],
})
export class GatewayModule {}
