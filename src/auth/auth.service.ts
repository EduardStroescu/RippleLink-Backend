import {
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
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'schemas/User.schema';
import { Model, Types } from 'mongoose';
import { stripUserOfSensitiveData } from 'src/lib/utils';
import { StatusService } from 'src/status/status.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly statusService: StatusService,
    private readonly cloudinaryService: CloudinaryService,
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

        newUser.avatarUrl = userAvatar.secure_url;
      }

      newUser = await newUser.save();
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
      if (error.code === 'P2002') {
        // Unique constraint failed
        throw new ConflictException('User already exists');
      } else {
        throw new InternalServerErrorException(
          'An error occurred while registering new user',
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
        throw new UnauthorizedException('Invalid credentials');

      const tokens = await this.signTokens(
        user._id as Types.ObjectId,
        user.email,
      );
      await this.updateRefreshToken(
        user._id as Types.ObjectId,
        tokens.refresh_token,
      );

      user = await user.populate('settings');
      user = await user.populate({
        path: 'status',
        select: 'statusMessage',
      });

      const strippedUser = stripUserOfSensitiveData(user.toObject());
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
      const user = await this.userModel
        .findOne({
          refresh_token: refreshToken,
        })
        .select('-password -isDeleted')
        .populate({ path: 'settings' })
        .populate({ path: 'status', select: 'statusMessage' });

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

      return {
        ...user.toObject(),
        access_token,
        refresh_token,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new UnauthorizedException(
        'Invalid refresh token, please log in again',
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
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        refresh_token: refreshToken,
      });
    } catch (error) {
      // Ignore error
    }
  }
}
