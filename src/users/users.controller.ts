import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import UpdateUserDto from './dto/UpdateUser.dto';
import { JwtGuard } from 'src/auth/guards';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
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
import { User } from 'schemas/User.schema';

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
    description: 'Invalid JWT bearer access token',
  })
  @ApiInternalServerErrorResponse({
    description: 'An unexpected error occurred. Please try again later!',
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
    description: 'Invalid JWT bearer access token',
  })
  @ApiInternalServerErrorResponse({
    description: 'An unexpected error occurred. Please try again later!',
  })
  @UseGuards(JwtGuard)
  @Get('search/:displayName')
  async getUserByDisplayName(
    @Param('displayName') displayName: string,
    @GetUser('_id') currentUserId: Types.ObjectId,
  ) {
    return await this.usersService.getUserByDisplayName(
      displayName,
      currentUserId,
    );
  }

  @ApiBearerAuth()
  @ApiOkResponse({ status: 200, type: PrivateUserDto })
  @ApiBadRequestResponse({
    description: 'Email address already in use',
  })
  @ApiInternalServerErrorResponse({
    description: 'An unexpected error occurred. Please try again later!',
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid JWT bearer access token',
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
  @ApiInternalServerErrorResponse({
    description: 'Could not update avatar. Please try again later!',
  })
  @ApiBadGatewayResponse({
    description: 'Cloudinary Error',
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid JWT bearer access token',
  })
  @UseGuards(JwtGuard)
  @Patch('change-avatar')
  async changeAvatar(
    @GetUser() user: User,
    @Body() updateAvatarDto: ChangeAvatarDto,
  ) {
    return await this.usersService.changeAvatar(user, updateAvatarDto);
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
  @ApiBadRequestResponse({
    description: 'New password and its confirmation do not match',
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid JWT bearer access token or password',
  })
  @ApiInternalServerErrorResponse({
    description: 'An unexpected error occurred. Please try again later!',
  })
  @UseGuards(JwtGuard)
  @Patch('update-password')
  async changePassword(
    @GetUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.usersService.changePassword(user, changePasswordDto);
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
  @ApiBadRequestResponse({
    description: 'Passwords do not match',
  })
  @ApiInternalServerErrorResponse({
    description: 'An error occurred while deleting the user',
  })
  @ApiUnauthorizedResponse({
    status: 401,
    description: 'Invalid JWT bearer access token or password',
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
