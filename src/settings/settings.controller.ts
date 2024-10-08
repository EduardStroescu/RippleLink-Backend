import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
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
  @ApiOkResponse({
    description: 'Settings updated',
    type: UpdateSettingsDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to update settings',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
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
