import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @UseGuards(JwtGuard)
  @Get(':chatId')
  async getAllMessages(
    @Param('chatId') chatId: string,
    @GetUser('_id') userId: string,
  ) {
    return await this.messagesService.getAllMessages(userId, chatId);
  }
}
