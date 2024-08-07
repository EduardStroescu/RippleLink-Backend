import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RedisService } from 'src/redis/redis.service';
import { Types } from 'mongoose';
import { CreateChatDto } from './dto/CreateChat.dto';
import { Gateway } from 'src/gateway/gateway';
import { User } from 'schemas/User.schema';

@ApiTags('Chats')
@Controller('chats')
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly redisService: RedisService,
    private readonly gatewayService: Gateway,
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
      return await this.redisService.getOrSetCache(
        `chats?userId=${user._id.toString()}`,
        async () => this.chatsService.getAllChats(user),
      );
    } catch (error) {
      throw new HttpException(
        'There was an error while retrieving chats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
  @Post()
  async createChat(
    @GetUser('_id') userId: Types.ObjectId,
    @Body() createChatDto: CreateChatDto,
  ) {
    try {
      const { newChat, updatedChat } = await this.chatsService.createChat(
        userId,
        createChatDto,
      );

      if (newChat) {
        await this.redisService.addToCache(
          `chats?userId=${userId}`,
          async () => newChat,
        );
        await this.gatewayService.createChat(userId, newChat);
        return newChat;
      } else {
        await this.redisService.updateInCache(
          `messages?chatId=${updatedChat._id.toString()}`,
          async () => updatedChat.lastMessage,
        );
        await this.gatewayService.updateChat(updatedChat);
        this.gatewayService.server
          .to(updatedChat._id.toString())
          .emit('messageCreated', {
            content: updatedChat.lastMessage,
          });
        return updatedChat;
      }
    } catch (error) {
      throw new HttpException(
        'There was an error while creating chat',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sharedFiles/:chatId')
  async getSharedFiles(@Param('chatId') chatId: string) {
    const response = await this.chatsService.getSharedFiles(chatId);
    return response;
  }

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
  @Delete(':chatId')
  async deleteChat(@GetUser() user: User, @Param('chatId') chatId: string) {
    try {
      await this.redisService.deleteFromCache(
        `chats?userId=${user._id.toString()}`,
        async () =>
          this.chatsService.deleteChat(user, new Types.ObjectId(chatId)),
      );

      return { message: 'Chat deleted successfully' };
    } catch (err) {
      throw new HttpException(
        'There was an error while deleting chat',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
