import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/UpdateSettings.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiBearerAuth()
  @ApiCreatedResponse()
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Patch()
  async updateSettings(
    @GetUser('_id') userId: string,
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    return await this.settingsService.updateSettings(userId, updateSettingsDto);
  }
}
