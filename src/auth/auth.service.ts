import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto, LoginUserDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'schemas/User.schema';
import { Model, Types } from 'mongoose';
import { stripUserOfSensitiveData } from 'src/lib/utils';
import { StatusService } from 'src/status/status.service';
import { FileUploaderService } from 'src/fileUploader/fileUploader.provider';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly statusService: StatusService,
    private readonly fileUploaderService: FileUploaderService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    try {
      if (createUserDto.confirmPassword !== createUserDto.password)
        throw new BadRequestException(
          'Password and its confirmation do not match',
        );
      // Hash the password
      const password = await bcrypt.hash(createUserDto.password, 10);

      let newUser = new this.userModel({
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        displayName:
          createUserDto.displayName ||
          createUserDto.firstName + createUserDto.lastName,
        password,
      });
      newUser = await newUser.save();

      if (createUserDto.avatarUrl) {
        const userAvatar = await this.fileUploaderService.uploadBase64File(
          'avatar',
          newUser._id.toString(),
          {
            base64String: createUserDto.avatarUrl,
          },
        );

        newUser.avatarUrl = userAvatar;
      }
      const status = await this.statusService.createStatus(newUser._id);

      const tokens = await this.signTokens(newUser._id, newUser.email);
      await this.updateRefreshToken(newUser._id, tokens.refresh_token);
      newUser.status = status._id;
      newUser = await newUser.save();

      newUser = await newUser.populate('status');
      newUser = newUser.toObject();

      const strippedUser = stripUserOfSensitiveData(newUser);
      return { ...strippedUser, ...tokens };
    } catch (error) {
      if (error.code === 11000) {
        // Unique constraint failed
        throw new ConflictException('Email already in use');
      } else {
        if (error instanceof HttpException) throw error;
        throw new InternalServerErrorException(
          'An error occurred while registering new user',
        );
      }
    }
  }

  async login(loginUserDto: LoginUserDto) {
    try {
      const user = (
        await this.userModel
          .findOne({
            email: loginUserDto.email,
          })
          .populate([
            'settings',
            {
              path: 'status',
              select: 'statusMessage',
            },
          ])
          .exec()
      )?.toObject();

      if (!user) throw new NotFoundException('No user exists with this email');

      const isPasswordValid = await bcrypt.compare(
        loginUserDto.password,
        user.password,
      );

      if (!isPasswordValid)
        throw new UnauthorizedException('Invalid credentials');

      const tokens = await this.signTokens(user._id, user.email);
      await this.updateRefreshToken(user._id, tokens.refresh_token);

      const strippedUser = stripUserOfSensitiveData(user);
      return {
        ...strippedUser,
        ...tokens,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while logging the user in',
      );
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const user = (
        await this.userModel
          .findOne({
            refresh_token: refreshToken,
          })
          .select('-password -isDeleted')
          .populate([
            { path: 'settings' },
            { path: 'status', select: 'statusMessage' },
          ])
      )?.toObject();

      if (!user || user.refresh_token !== refreshToken)
        throw new UnauthorizedException(
          'Invalid refresh token, please log in again!',
        );

      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_SECRET'),
      });

      const { access_token, refresh_token } = await this.signTokens(
        payload.sub,
        payload.email,
      );
      await this.updateRefreshToken(user._id, refresh_token);

      return {
        ...user,
        access_token,
        refresh_token,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new UnauthorizedException(
        'Invalid refresh token, please log in again!',
      );
    }
  }

  async logout(userId: Types.ObjectId) {
    await this.updateRefreshToken(userId, '');
    return { success: 'Logged out' };
  }

  private async signTokens(
    userId: Types.ObjectId,
    email: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const payload = {
      sub: userId,
      email,
    };
    const accessSecret = this.configService.get('ACCESS_SECRET');
    const refreshSecret = this.configService.get('REFRESH_SECRET');

    const access_token = this.jwtService.sign(payload, {
      expiresIn: '15m',
      secret: accessSecret,
    });
    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: refreshSecret,
    });

    return {
      access_token,
      refresh_token,
    };
  }

  private async updateRefreshToken(
    userId: Types.ObjectId,
    refreshToken: string,
  ) {
    await this.userModel.findByIdAndUpdate(userId, {
      refresh_token: refreshToken,
    });
  }
}
