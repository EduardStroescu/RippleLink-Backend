import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto, LoginUserDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'schemas/User.schema';
import { Model, Types } from 'mongoose';
import { Status } from 'schemas/Status.schema';
import { UsersService } from 'src/users/users.service';
import { stripUserOfSensitiveData } from 'src/lib/utils';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Status.name) private statusModel: Model<Status>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly usersService: UsersService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    try {
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

      if (createUserDto.avatarUrl) {
        const userAvatar = await this.cloudinaryService.uploadAvatar(
          createUserDto.avatarUrl,
          createUserDto.email,
        );

        newUser.avatarUrl = userAvatar.url;
      }

      newUser = await newUser.save();

      const userStatus = await this.statusModel.create({
        userId: newUser._id,
        online: true,
      });
      await userStatus.save();

      const tokens = await this.signTokens(newUser._id, newUser.email);
      await this.updateRefreshToken(newUser._id, tokens.refresh_token);

      newUser = await newUser.populate('status');
      newUser = newUser.toObject();

      await this.usersService.connectUser(newUser._id);

      const strippedUser = stripUserOfSensitiveData(newUser);
      return { ...strippedUser, ...tokens };
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint failed
        throw new ConflictException('User already exists');
      } else {
        console.log(error);
        throw new HttpException(
          'An error occurred while registering user',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  async login(loginUserDto: LoginUserDto) {
    try {
      let user = await this.userModel
        .findOne({
          email: loginUserDto.email,
        })
        .exec();

      if (!user) throw new NotFoundException('User not found');

      const isPasswordValid = await bcrypt.compare(
        loginUserDto.password,
        user.password,
      );

      if (!isPasswordValid)
        throw new UnauthorizedException('Invalid email or password');

      const tokens = await this.signTokens(
        user._id as Types.ObjectId,
        user.email,
      );
      await this.updateRefreshToken(
        user._id as Types.ObjectId,
        tokens.refresh_token,
      );

      await this.usersService.connectUser(user._id);
      user = await user.populate('settings');
      user = await user.populate({
        path: 'status',
        select: 'statusMessage online',
      });

      const strippedUser = stripUserOfSensitiveData(user.toObject());
      return {
        ...strippedUser,
        ...tokens,
      };
    } catch (error) {
      throw new HttpException(
        'An error occurred while logging user in',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const user = await this.userModel
        .findOne({
          refresh_token: refreshToken,
        })
        .populate('chats');

      if (!user || user.refresh_token !== refreshToken)
        throw new UnauthorizedException(
          'Invalid refresh token, please log in again',
        );

      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_SECRET'),
      });

      const { access_token, refresh_token } = await this.signTokens(
        payload.sub,
        payload.email,
      );
      await this.updateRefreshToken(user._id as Types.ObjectId, refresh_token);

      const strippedUser = stripUserOfSensitiveData(user.toObject());
      return {
        ...strippedUser,
        access_token,
        refresh_token,
      };
    } catch (err) {
      throw new UnauthorizedException(
        'Invalid refresh token, please log in again',
      );
    }
  }

  async logout(userId: Types.ObjectId) {
    await this.updateRefreshToken(userId, '');
    await this.usersService.disconnectUser(userId);
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
