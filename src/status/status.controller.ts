import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { StatusService } from './status.service';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { UpdateStatusDto } from './dto/UpdateStatus.dto';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guards';
import { StatusDto } from 'src/lib/dtos/status.dto';
import { User } from 'schemas/User.schema';

@ApiTags('Status')
@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'Status retrieved successfully',
    type: StatusDto,
  })
  @ApiNotFoundResponse({
    description: 'User status not found',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to get user status. Please try again later!',
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid JWT bearer access token',
  })
  @UseGuards(JwtGuard)
  @Get(':userId')
  async getUserStatus(@Param('userId') userId: string) {
    return this.statusService.getUserStatus(userId);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'Status updated successfully',
    type: StatusDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to update status. Please try again later!',
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid JWT bearer access token',
  })
  @UseGuards(JwtGuard)
  @Patch()
  async updateStatus(
    @GetUser() user: User,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.statusService.updateStatus(user, updateStatusDto);
  }
}
