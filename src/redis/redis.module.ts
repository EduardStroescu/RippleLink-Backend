import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisModule as IoredisModule } from '@nestjs-modules/ioredis';

@Global()
@Module({
  imports: [
    IoredisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL,
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
