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
import { DeleteUserDto } from './dto/DeleteUser.dto';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { ChangePasswordDto } from './dto/ChangePassword.dto';
import ChangeAvatarDto from './dto/ChangeAvatar.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @Patch('update-details')
  @UsePipes(new ValidationPipe())
  async updateUser(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.updateUser(_id, updateUserDto);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: UpdateUserDto })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Patch('change-avatar')
  @UsePipes(new ValidationPipe())
  async changeAvatar(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() updateAvatarDto: ChangeAvatarDto,
  ) {
    return await this.usersService.changeAvatar(_id, updateAvatarDto);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: ChangePasswordDto })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Patch('update-password')
  @UsePipes(new ValidationPipe())
  async changePassword(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.usersService.changePassword(_id, changePasswordDto);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: String, description: 'User deleted' })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Delete()
  async deleteUser(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() deleteUserDto: DeleteUserDto,
  ) {
    return await this.usersService.deleteUser(_id, deleteUserDto);
  }
}
