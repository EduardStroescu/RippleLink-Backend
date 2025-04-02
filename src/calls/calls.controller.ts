import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { User } from 'schemas/User.schema';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { JwtGuard } from 'src/auth/guards';
import { CallsService } from './calls.service';
import { CallDto } from 'src/lib/dtos/call.dto';

@ApiTags('Calls')
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description:
      'Retrieved all calls successfully. An empty array is returned if no calls are found.',
    type: CallDto,
    isArray: true,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unable to get calls. Please try again later!',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Get('all')
  async getAllCalls(@GetUser() user: User) {
    return await this.callsService.getAllCalls(user);
  }
}
