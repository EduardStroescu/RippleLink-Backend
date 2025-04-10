import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
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
import { User } from 'schemas/User.schema';

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
    description: 'Unable to update settings. Please try again later!',
  })
  @ApiBadGatewayResponse({
    description: 'Cloudinary Error',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Patch()
  async updateSettings(
    @GetUser() user: User,
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(user, updateSettingsDto);
  }
}
