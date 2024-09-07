import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { StatusService } from './status.service';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { UpdateStatusDto } from './dto/updateStatus.dto';
import { Types } from 'mongoose';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtGuard } from 'src/auth/guards';

@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    type: String,
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Get(':userId')
  async getUserStatus(@Param('userId') userId: string) {
    return await this.statusService.getUserStatus(userId);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    type: String,
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Patch()
  async updateStatus(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return await this.statusService.updateStatus(_id, updateStatusDto);
  }
}
