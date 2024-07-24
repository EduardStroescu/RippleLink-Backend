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
// import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'schemas/User.schema';
import { UserSettings } from 'schemas/UserSettings.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(UserSettings.name) private settingsModel: Model<UserSettings>,
    private jwtService: JwtService,
    private configService: ConfigService,
    // private cloudinaryService: CloudinaryService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    try {
      let newUser;
      const password = await bcrypt.hash(createUserDto.password, 10);
      let avatar: string;
      if (createUserDto.avatarUrl) {
        // const userAvatar = await this.cloudinaryService.uploadFile(
        //   user.avatar,
        //   user.email,
        // );
        avatar = createUserDto.avatarUrl;
      }
      if (createUserDto.settings) {
        const newSettings = new this.settingsModel(createUserDto.settings);
        const savedNewSettings = await newSettings.save();
        newUser = new this.userModel({
          email: createUserDto.email,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          displayName: createUserDto.displayName,
          avatarUrl: avatar,
          password,
          settings: savedNewSettings._id,
        });
      } else {
        newUser = new this.userModel({
          email: createUserDto.email,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          displayName: createUserDto.displayName,
          avatarUrl: avatar,
          password,
        });
      }
      const { _doc: savedUser } = await newUser.save();
      const tokens = await this.signTokens(savedUser._id, savedUser.email);
      await this.updateRefreshToken(savedUser._id, tokens.refresh_token);

      delete savedUser.password;
      return { ...savedUser, ...tokens };
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint failed
        throw new ConflictException('User already exists');
      }
      throw new HttpException(
        'An error occurred while registering user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const user = await this.userModel.findOne({
      email: loginUserDto.email,
    });

    if (!user) throw new NotFoundException('User not found');

    const isPasswordValid = await bcrypt.compare(
      loginUserDto.password,
      user.password,
    );

    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.signTokens(user._id, user.email);
    await this.updateRefreshToken(user._id, tokens.refresh_token);

    delete user.password;

    return {
      ...user.toObject(),
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const user = await this.userModel.findOne({
        refresh_token: refreshToken,
      });

      if (!user || user.refresh_token !== refreshToken)
        throw new UnauthorizedException(
          'Invalid refresh token, please log in again',
        );

      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_SECRET'),
      });

      const { access_token } = await this.signTokens(
        payload.sub,
        payload.email,
      );

      return {
        access_token,
      };
    } catch (err) {
      throw new UnauthorizedException(
        'Invalid refresh token, please log in again',
      );
    }
  }

  async logout(userId: Types.ObjectId) {
    const user = await this.userModel.findByIdAndUpdate(userId, {
      refresh_token: '',
    });
    if (!user) throw new UnauthorizedException();

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
