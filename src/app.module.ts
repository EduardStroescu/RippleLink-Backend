import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { ChatsModule } from './chats/chats.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { MessagesModule } from './messages/messages.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI),
    ConfigModule.forRoot({ isGlobal: true }),
    GatewayModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    ChatsModule,
    MessagesModule,
  ],
})
export class AppModule {}
