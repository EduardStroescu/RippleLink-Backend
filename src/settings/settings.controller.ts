import { Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';

@Controller('settings')
export class SettingsController {
  @UseGuards(JwtGuard)
  @Post()
  async createSettings(@GetUser('_id') userId: string) {
    return 'settings created';
  }

  @UseGuards(JwtGuard)
  @Patch()
  async updateSettings(@GetUser('_id') userId: string) {
    return 'settings updated';
  }
}
