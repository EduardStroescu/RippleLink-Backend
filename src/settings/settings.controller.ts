import { Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(@GetUser('_id') userId: string) {
    return this.settingsService.getSettings(userId);
  }

  @ApiBearerAuth()
  @ApiCreatedResponse()
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Post()
  async createSettings(@GetUser('_id') userId: string) {
    return this.settingsService.createSettings(userId);
  }

  @ApiBearerAuth()
  @ApiCreatedResponse()
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired token',
    status: 200,
  })
  @UseGuards(JwtGuard)
  @Patch()
  async updateSettings(@GetUser('_id') userId: string) {
    return this.settingsService.updateSettings(userId);
  }
}
