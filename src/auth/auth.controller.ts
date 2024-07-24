import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Type,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto, RefreshTokenDto } from './dto';
// import {
//   ApiBearerAuth,
//   ApiConflictResponse,
//   ApiCreatedResponse,
//   ApiNotFoundResponse,
//   ApiOkResponse,
//   ApiTags,
//   ApiUnauthorizedResponse,
// } from '@nestjs/swagger';
import { JwtGuard } from './guards';
import { GetUser } from './decorator/GetUser.decorator';
import { Types } from 'mongoose';

// @ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  //   @ApiCreatedResponse({
  //     status: 201,
  //     description: 'User Created',
  //   })
  //   @ApiConflictResponse({ description: 'User already Exists', status: 401 })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  //   @ApiOkResponse({
  //     status: 200,
  //     description: 'OK',
  //   })
  //   @ApiNotFoundResponse({
  //     description: 'User not found',
  //     status: 404,
  //   })
  //   @ApiUnauthorizedResponse({
  //     description: 'Invalid email or password',
  //     status: 401,
  //   })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }

  //   @ApiOkResponse({
  //     status: 200,
  //     description: 'OK',
  //   })
  //   @ApiUnauthorizedResponse({
  //     description: 'Invalid refresh token, log in again',
  //     status: 401,
  //   })
  @HttpCode(HttpStatus.OK)
  @Post('refresh/:refreshToken')
  async refreshToken(@Query('refreshToken') refreshToken: RefreshTokenDto) {
    return this.authService.refreshToken(refreshToken.refresh_token);
  }

  @UseGuards(JwtGuard)
  //   @ApiBearerAuth()
  //   @ApiOkResponse({
  //     status: 200,
  //     description: 'OK',
  //   })
  //   @ApiUnauthorizedResponse({
  //     description: 'Invalid JWT bearer access token',
  //     status: 401,
  //   })
  @UseGuards(JwtGuard)
  //   @ApiBearerAuth()
  //   @ApiOkResponse({
  //     status: 200,
  //     description: 'OK',
  //   })
  //   @ApiUnauthorizedResponse({
  //     description: 'Invalid JWT bearer access token',
  //     status: 401,
  //   })
  @Get('logout')
  async logout(@GetUser('_id') userId: Types.ObjectId) {
    return this.authService.logout(userId);
  }
}
