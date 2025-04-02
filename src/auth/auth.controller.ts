import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto, RefreshTokenDto } from './dto';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtGuard } from './guards';
import { GetUser } from './decorator/GetUser.decorator';
import { Types } from 'mongoose';
import { PrivateUserDto } from 'src/lib/dtos/user.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiCreatedResponse({
    status: 201,
    description: 'User Created',
    type: PrivateUserDto,
  })
  @ApiBadRequestResponse({
    description: 'Password and its confirmation do not match',
  })
  @ApiConflictResponse({ description: 'Email already in use', status: 409 })
  @ApiInternalServerErrorResponse({
    description: 'An error occurred while registering new user',
  })
  @ApiBadGatewayResponse({
    description: 'Cloudinary Error',
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @ApiOkResponse({
    status: 200,
    description: 'Logged in successfully',
    type: PrivateUserDto,
  })
  @ApiNotFoundResponse({
    description: 'No user exists with this email',
  })
  @ApiInternalServerErrorResponse({
    description: 'An error occurred while logging the user in',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials',
    status: 401,
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }

  @ApiOkResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: PrivateUserDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid refresh token, please log in again!',
    status: 401,
  })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refresh_token);
  }

  @ApiBearerAuth()
  @ApiOkResponse({
    status: 200,
    description: 'Logged out successfully',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'string',
          example: 'Logged out successfully',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid JWT bearer access token',
    status: 401,
  })
  @UseGuards(JwtGuard)
  @Get('logout')
  async logout(@GetUser('_id') userId: Types.ObjectId) {
    return this.authService.logout(userId);
  }
}
