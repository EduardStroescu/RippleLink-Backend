import { Module } from '@nestjs/common';
import { Gateway } from './gateway';
import { MessagesModule } from 'src/messages/messages.module';
import { UsersModule } from 'src/users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { CallsModule } from 'src/calls/calls.module';
import { FileUploaderModule } from 'src/fileUploader/fileUploader.module';

@Module({
  imports: [
    JwtModule.register({}),
    MessagesModule,
    UsersModule,
    CallsModule,
    FileUploaderModule,
  ],
  providers: [Gateway],
  exports: [Gateway],
})
export class GatewayModule {}
