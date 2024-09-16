import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RedisService } from 'src/redis/redis.service';
import { Types } from 'mongoose';
import { MessageDto } from 'src/lib/dtos/message.dto';

@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly redisService: RedisService,
  ) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'All messages retrieved successfully',
    type: [MessageDto],
  })
  @ApiNotFoundResponse({
    description: 'Chat not found by the provided ID',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @ApiQuery({
    name: 'cursor',
    description:
      'Pagination cursor for fetching messages. Omit for first page, then use the value returned in the response',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of messages to fetch. Default is 20',
    required: false,
    type: Number,
    example: 20,
  })
  @UseGuards(JwtGuard)
  @Get(':chatId')
  async getAllMessages(
    @Param('chatId') chatId: Types.ObjectId,
    @GetUser('_id') userId: Types.ObjectId,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = 20,
  ) {
    if (cursor) {
      return await this.messagesService.getAllMessages(
        userId,
        chatId,
        cursor,
        limit,
      );
    } else {
      return await this.redisService.getOrSetCache(
        `messages?chatId=${chatId}`,
        async () =>
          await this.messagesService.getAllMessages(
            userId,
            chatId,
            cursor,
            limit,
          ),
      );
    }
  }
}
