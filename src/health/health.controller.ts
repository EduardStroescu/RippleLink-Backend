import { Controller, Get } from '@nestjs/common';
import { ApiInternalServerErrorResponse, ApiOkResponse } from '@nestjs/swagger';
import { RedisService } from 'src/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @ApiOkResponse({ type: String })
  @ApiInternalServerErrorResponse({
    status: 500,
    description: 'Redis is not running. Please try again later',
  })
  @Get()
  async ping() {
    const message = await this.redisService.checkConnection();
    if (message === 'PONG') {
      return { status: 'success', message: 'Redis is running' };
    }
    return { status: 'error', message };
  }
}
