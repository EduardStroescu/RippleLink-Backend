import { Body, Controller, Post } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ResetRedisCacheDto } from './dto/resetRedisCache.dto';
import { ApiInternalServerErrorResponse, ApiOkResponse } from '@nestjs/swagger';

@Controller('redis')
export class RedisController {
  constructor(private readonly redisService: RedisService) {}

  @ApiOkResponse({
    status: 200,
    description: 'Cache reset successfully.',
  })
  @ApiInternalServerErrorResponse({
    status: 401,
    description: 'Invalid admin credentials.',
  })
  @Post('reset')
  async reset(@Body() resetRedisCacheDto: ResetRedisCacheDto) {
    await this.redisService.resetCache(resetRedisCacheDto);
    return { message: 'Cache reset successfully.' };
  }
}