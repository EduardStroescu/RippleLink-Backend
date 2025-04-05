import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
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
  @ApiInternalServerErrorResponse({
    description: 'Unable to retrieve chats. Please try again later!',
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
  @ApiNotFoundResponse({
    description: 'One or more users not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to create chat. Please try again later!',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token or not',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async createChat(
    @GetUser('_id') userId: Types.ObjectId,
    @Body() createChatDto: CreateChatDto,
  ) {
    const { newChat, wasExistingChat } = await this.chatsService.createChat(
      userId,
      createChatDto,
    );

    await this.gatewayService.createChat(newChat, wasExistingChat);
    return newChat;
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description:
      'Shared files retrieved successfully. Returns an empty array if no files are found.',
    type: MessageDto,
    isArray: true,
  })
  @ApiNotFoundResponse({
    description: 'Chat not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to retrieve shared files. Please try again later!',
  })
  @ApiUnauthorizedResponse({
    description:
      'Invalid JWT bearer access token or you are not a member of the chat.',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Get('sharedFiles/:chatId')
  async getSharedFiles(
    @GetUser('_id') userId: Types.ObjectId,
    @Param('chatId') chatId: string,
  ) {
    return await this.chatsService.getSharedFiles(userId, chatId);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'Chat updated successfully',
    type: ChatDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid chat id provided' })
  @ApiNotFoundResponse({
    description: 'Chat not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to update chat. Please try again later!',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token or not a member of the chat',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @Patch(':chatId')
  async updateChat(
    @GetUser('_id') userId: Types.ObjectId,
    @Param('chatId') chatId: string,
    @Body() updateChatDto: UpdateChatDto,
  ) {
    const updatedChat = await this.chatsService.updateChat(
      userId,
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
  @ApiNotFoundResponse({
    description: 'Chat not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to delete chat. Please try again later!',
  })
  @ApiUnauthorizedResponse({
    description:
      'Invalid JWT bearer access token or you are not a member of this chat',
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
