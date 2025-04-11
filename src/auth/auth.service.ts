import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto, LoginUserDto } from './dto';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
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
        _id: new Types.ObjectId(),
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        displayName:
          createUserDto.displayName ||
          createUserDto.firstName + createUserDto.lastName,
        password,
      });

      const [userAvatar, status] = await Promise.all([
        createUserDto.avatarUrl
          ? this.fileUploaderService.uploadBase64File(
              'avatar',
              newUser._id.toString(),
              { base64String: createUserDto.avatarUrl },
            )
          : Promise.resolve(null),
        this.statusService.createStatus(newUser._id),
      ]);

      if (userAvatar) {
        newUser.avatarUrl = userAvatar;
      }

      newUser.status = status._id;
      newUser = await newUser.save();

      const tokens = this.signTokens(newUser._id, newUser.email);
      await this.updateRefreshToken(newUser._id, tokens.refresh_token);

      newUser = (await newUser.populate('status'))?.toObject();

      const strippedUser = stripUserOfSensitiveData(newUser);
      return { ...strippedUser, ...tokens };
    } catch (error) {
      if (error.code === 11000) {
        // Unique constraint failed
        throw new ConflictException('Email already in use');
      } else {
        if (error instanceof HttpException) throw error;
        throw new InternalServerErrorException(
          'An error occurred during the registration process. Please try again later!',
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

      if (!user)
        throw new UnauthorizedException(
          'Invalid credentials. Please check your email and password.',
        );

      const isPasswordValid = await bcrypt.compare(
        loginUserDto.password,
        user.password,
      );

      if (!isPasswordValid)
        throw new UnauthorizedException(
          'Invalid credentials. Please check your email and password.',
        );

      const tokens = this.signTokens(user._id, user.email);
      await this.updateRefreshToken(user._id, tokens.refresh_token);

      const strippedUser = stripUserOfSensitiveData(user);
      return {
        ...strippedUser,
        ...tokens,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while logging the user in. Please try again later!',
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
          'Invalid session, please log in again!',
        );

      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_SECRET'),
      });

      const { access_token, refresh_token } = this.signTokens(
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
      if (err instanceof TokenExpiredError)
        throw new UnauthorizedException(
          'Session expired, please log in again!',
        );
      if (err instanceof JsonWebTokenError)
        throw new UnauthorizedException(
          'Invalid session, please log in again!',
        );

      throw new InternalServerErrorException(
        'An internal error occurred. Please log in again!',
      );
    }
  }

  async logout(userId: Types.ObjectId) {
    await this.updateRefreshToken(userId, '');
    return { success: 'Logged out' };
  }

  private signTokens(userId: Types.ObjectId, email: string) {
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
