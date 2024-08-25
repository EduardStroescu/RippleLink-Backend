import { Module } from '@nestjs/common';
import { GatewayModule } from './gateway/gateway.module';
import { ChatsModule } from './chats/chats.module';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { MessagesModule } from './messages/messages.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { CallsModule } from './calls/calls.module';
import { StatusModule } from './status/status.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    RedisModule,
    GatewayModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    ChatsModule,
    MessagesModule,
    CallsModule,
    StatusModule,
    HealthModule,
  ],
})
export class AppModule {}
