import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import UpdateUserDto from './dto/UpdateUser.dto';
import { JwtGuard } from 'src/auth/guards';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateUserDto } from 'src/auth/dto';
import { Types } from 'mongoose';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200 })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Get()
  async getAllUsers() {
    return await this.usersService.getAllUsers();
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200 })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return await this.usersService.getUserById(new Types.ObjectId(id));
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: String })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    const deletedUser = await this.usersService.deleteUser(
      new Types.ObjectId(id),
    );
    if (!deletedUser) throw new HttpException('User not found', 404);
    return deletedUser;
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: CreateUserDto })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Get('search/:displayName')
  async getUserByDisplayName(@Param('displayName') displayName: string) {
    const findUser = await this.usersService.getUserByDisplayName(displayName);
    if (!findUser) throw new HttpException('User not found', 404);
    return findUser;
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: UpdateUserDto })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Patch(':id')
  @UsePipes(new ValidationPipe())
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const updatedUser = await this.usersService.updateUser(
      new Types.ObjectId(id),
      updateUserDto,
    );
    if (!updatedUser) throw new HttpException('User not found', 404);
    return updatedUser;
  }
}
