import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import UpdateUserDto from './dto/UpdateUser.dto';
import { JwtGuard } from 'src/auth/guards';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { DeleteUserDto } from './dto/DeleteUser.dto';
import { GetUser } from 'src/auth/decorator/GetUser.decorator';
import { ChangePasswordDto } from './dto/ChangePassword.dto';
import ChangeAvatarDto from './dto/ChangeAvatar.dto';
import { PrivateUserDto, PublicUserDto } from 'src/lib/dtos/user.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: PublicUserDto })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
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
  @ApiOkResponse({ status: 200, type: PublicUserDto })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Get('search/:displayName')
  async getUserByDisplayName(@Param('displayName') displayName: string) {
    const findUser = await this.usersService.getUserByDisplayName(displayName);
    if (!findUser) throw new NotFoundException('User not found');
    return findUser;
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: PrivateUserDto })
  @ApiBadRequestResponse({
    description: 'Email already exists',
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Patch('update-details')
  async updateUser(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.updateUser(_id, updateUserDto);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'Avatar updated',
    schema: {
      type: 'object',
      properties: {
        avatarUrl: {
          type: 'string',
          description: "URL to the user's avatar image",
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Patch('change-avatar')
  async changeAvatar(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() updateAvatarDto: ChangeAvatarDto,
  ) {
    return await this.usersService.changeAvatar(_id, updateAvatarDto);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'string',
          example: 'Password changed',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Patch('update-password')
  async changePassword(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.usersService.changePassword(_id, changePasswordDto);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 204,
    description: 'User deleted',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'string',
          example: 'User deleted',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid access_token token',
  })
  @UseGuards(JwtGuard)
  @Delete()
  @HttpCode(204)
  async deleteUser(
    @GetUser('_id') _id: Types.ObjectId,
    @Body() deleteUserDto: DeleteUserDto,
  ) {
    return await this.usersService.deleteUser(_id, deleteUserDto);
  }
}
