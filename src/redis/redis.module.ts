import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisModule as IoredisModule } from '@nestjs-modules/ioredis';
import { RedisController } from './redis.controller';
import { StatusModule } from 'src/status/status.module';

@Global()
@Module({
  imports: [
    IoredisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL,
    }),
    StatusModule,
  ],
  controllers: [RedisController],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
