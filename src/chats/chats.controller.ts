import { Controller, Get, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @UseGuards(JwtGuard)
  @Get('all')
  async getAllChats(@GetUser('_id') userId: string) {
    return await this.chatsService.getAllChats(userId);
  }
}
