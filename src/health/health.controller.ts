import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RedisService } from 'src/redis/redis.service';
import {
  HealthErrorResponseDto,
  HealthSuccessResponseDto,
} from './dto/HealthResponseDto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @ApiOkResponse({
    description: 'Redis is running',
    type: HealthSuccessResponseDto,
  })
  @ApiInternalServerErrorResponse({
    status: 500,
    description: 'Redis is not running. Please try again later',
    type: HealthErrorResponseDto,
  })
  @Get()
  async ping() {
    try {
      const message = await this.redisService.checkConnection();
      if (message === 'PONG') {
        return { status: 'success', message: 'Redis is running' };
      }
    } catch (err) {
      throw new InternalServerErrorException(
        'Redis is not running. Please try again later',
      );
    }
  }
}
