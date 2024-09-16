import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RedisService } from 'src/redis/redis.service';
import { Types } from 'mongoose';
import { CreateChatDto } from './dto/CreateChat.dto';
import { Gateway } from 'src/gateway/gateway';
import { User } from 'schemas/User.schema';
import { UpdateChatDto } from './dto/UpdateChat.dto';
import { ChatDto } from 'src/lib/dtos/chat.dto';
import { MessageDto } from 'src/lib/dtos/message.dto';

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
    description: 'All chats retrieved successfully',
    type: [ChatDto],
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Get('all')
  async getAllChats(@GetUser() user: User) {
    return await this.redisService.getOrSetCache(
      `chats?userId=${user._id.toString()}`,
      async () => this.chatsService.getAllChats(user),
    );
  }

  @ApiBearerAuth()
  @ApiCreatedResponse({
    description: 'Chat created successfully',
    type: ChatDto,
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
    const { newChat, wasExistingChat } = await this.chatsService.createChat(
      userId,
      createChatDto,
    );

    await this.gatewayService.createChat(userId, newChat, wasExistingChat);
    return newChat;
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'Shared files retrieved successfully',
    type: [MessageDto],
  })
  @ApiNotFoundResponse({
    description: 'Shared files not found by the provided Chat ID',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Get('sharedFiles/:chatId')
  async getSharedFiles(@Param('chatId') chatId: string) {
    const response = await this.chatsService.getSharedFiles(chatId);
    return response;
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'Chat updated successfully',
    type: ChatDto,
  })
  @ApiNotFoundResponse({
    description: 'Chat not found by the provided ID',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Patch(':chatId')
  async updateChat(
    @Param('chatId') chatId: string,
    @Body() updateChatDto: UpdateChatDto,
  ) {
    const updatedChat = await this.chatsService.updateChat(
      chatId,
      updateChatDto,
    );
    await this.gatewayService.updateChat(updatedChat, 'update');
    return updatedChat;
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 204,
    description: 'Chat deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'string',
          example: 'Chat deleted successfully',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Delete(':chatId')
  async deleteChat(@GetUser() user: User, @Param('chatId') chatId: string) {
    await this.redisService.deleteFromCache(
      `chats?userId=${user._id.toString()}`,
      async () =>
        this.chatsService.deleteChat(user, new Types.ObjectId(chatId)),
    );

    return { message: 'Chat deleted successfully' };
  }
}
