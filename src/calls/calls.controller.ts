import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { User } from 'schemas/User.schema';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';
import { CallsService } from './calls.service';
import { RedisService } from 'src/redis/redis.service';

@Controller('calls')
export class CallsController {
  constructor(
    private readonly callsService: CallsService,
    private readonly redisService: RedisService,
  ) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'OK',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Get('all')
  async getAllChats(@GetUser() user: User) {
    try {
      return await this.callsService.getAllCalls(user);
    } catch (error) {
      throw new HttpException(
        'There was an error while retrieving chats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
