import { Controller, Get } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @Get()
  async ping() {
    try {
      const message = await this.redisService.checkConnection();
      if (message === 'PONG') {
        return { status: 'success', message: 'Redis is running' };
      }
      return { status: 'error', message };
    } catch (e) {
      return { status: 'error', message: e.message };
    }
  }
}
