import { Body, Controller, Post } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ResetRedisCacheDto } from './dto/ResetRedisCache.dto';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Redis')
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
