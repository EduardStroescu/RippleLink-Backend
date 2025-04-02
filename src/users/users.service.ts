import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'schemas/User.schema';
import UpdateUserDto from './dto/UpdateUser.dto';
import { Status } from 'schemas/Status.schema';
import { Settings } from 'schemas/Settings.schema';
import { DeleteUserDto } from './dto/DeleteUser.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/ChangePassword.dto';
import ChangeAvatarDto from './dto/ChangeAvatar.dto';
import { FileUploaderService } from 'src/fileUploader/fileUploader.provider';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Status.name) private statusModel: Model<Status>,
    @InjectModel(Settings.name) private settingsModel: Model<Settings>,
    private readonly fileUploaderService: FileUploaderService,
  ) {}

  async getUserById(userId: Types.ObjectId) {
    try {
      const user = await this.userModel
        .findById(userId)
        .select(
          '-password -firstName -lastName -email -refresh_token -createdAt -updatedAt -isDeleted',
        )
        .exec();

      if (!user) throw new NotFoundException('User not found');

      return user;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'An unexpected error occurred. Please try again later!',
      );
    }
  }

  async getUserByDisplayName(
    displayName: string,
    currentUserId: Types.ObjectId,
  ) {
    try {
      const regex = new RegExp(displayName, 'i');
      const user = await this.userModel
        .find({
          displayName: { $regex: regex },
          isDeleted: { $ne: true },
          _id: { $ne: currentUserId },
        })
        .select(
          '-password -settings -firstName -lastName -email -refresh_token -createdAt -updatedAt -status -isDeleted',
        )
        .exec();
      if (!user) throw new NotFoundException('User not found');

      return user;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'An unexpected error occurred. Please try again later!',
      );
    }
  }

  async updateUser(_id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    try {
      if (updateUserDto.email) {
        const user = await this.userModel
          .findOne({ email: updateUserDto.email })
          .exec();
        if (user) throw new BadRequestException('Email address already in use');
      }
      return await this.userModel
        .findByIdAndUpdate(_id, updateUserDto, {
          new: true,
        })
        .select('-password -isDeleted')
        .populate('settings status')
        .exec();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'An unexpected error occurred. Please try again later!',
      );
    }
  }

  async changeAvatar(user: User, changeAvatarDto: ChangeAvatarDto) {
    try {
      const newUserAvatar = await this.fileUploaderService.uploadBase64File(
        'avatar',
        user._id.toString(),
        { base64String: changeAvatarDto.avatar },
      );
      user.avatarUrl = newUserAvatar;
      await user.save();

      return { avatarUrl: newUserAvatar };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'Unable to change avatar. Please try again later!',
      );
    }
  }

  async changePassword(user: User, changePasswordDto: ChangePasswordDto) {
    try {
      if (
        changePasswordDto.newPassword !== changePasswordDto.confirmNewPassword
      )
        throw new BadRequestException(
          'New password and its confirmation do not match',
        );

      const isPasswordValid = await bcrypt.compare(
        changePasswordDto.currentPassword,
        user.password,
      );
      if (!isPasswordValid) throw new UnauthorizedException('Invalid password');

      const hashedPassword = await bcrypt.hash(
        changePasswordDto.newPassword,
        10,
      );

      await this.userModel.findByIdAndUpdate(user._id, {
        password: hashedPassword,
      });
      return { success: 'Password changed' };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'An unexpected error occurred. Please try again later!',
      );
    }
  }

  async deleteUser(_id: Types.ObjectId, deleteUserDto: DeleteUserDto) {
    try {
      if (
        deleteUserDto.currentPassword !== deleteUserDto.confirmCurrentPassword
      )
        throw new BadRequestException('Passwords do not match');

      const deletedUser = await this.userModel
        .findById(_id)
        .populate<{ settings: Settings }>({
          path: 'settings',
        })
        .exec();

      const isPasswordValid = await bcrypt.compare(
        deleteUserDto.currentPassword,
        deletedUser.password,
      );
      if (!isPasswordValid) throw new UnauthorizedException('Invalid password');

      if (deletedUser.avatarUrl) {
        this.fileUploaderService.removeFiles(
          `${deletedUser._id}-files/${deletedUser.avatarUrl.split('/').pop()}`,
        );
      }
      if (deletedUser.settings && deletedUser.settings.backgroundImage) {
        this.fileUploaderService.removeFiles(
          `${deletedUser._id}-files/${deletedUser.settings.backgroundImage.split('/').pop()}`,
        );
      }
      await deletedUser.updateOne({
        displayName: 'User',
        firstName: null,
        lastName: null,
        email: null,
        password: null,
        avatarUrl: null,
        refresh_token: null,
        status: null,
        settings: null,
        isDeleted: true,
      });
      await this.statusModel.deleteOne({ userId: _id });
      await this.settingsModel.deleteOne({ userId: _id });
      return { success: 'User deleted' };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'An error occurred while deleting the user',
      );
    }
  }
}
