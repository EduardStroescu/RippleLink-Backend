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
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Settings } from 'schemas/Settings.schema';
import { DeleteUserDto } from './dto/DeleteUser.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/ChangePassword.dto';
import ChangeAvatarDto from './dto/ChangeAvatar.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Status.name) private statusModel: Model<Status>,
    @InjectModel(Settings.name) private settingsModel: Model<Settings>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getUserById(userId: Types.ObjectId) {
    try {
      return await this.userModel
        .findById(userId)
        .select(
          '-password -firstName -lastName -email -refresh_token -createdAt -updatedAt -isDeleted',
        )
        .exec();
    } catch (err) {
      throw new NotFoundException('User not found');
    }
  }

  async getUserByDisplayName(
    displayName: string,
    currentUserId: Types.ObjectId,
  ) {
    try {
      const regex = new RegExp(displayName, 'i');
      return await this.userModel
        .find({
          displayName: { $regex: regex },
          isDeleted: { $ne: true },
          _id: { $ne: currentUserId },
        })
        .select(
          '-password -settings -firstName -lastName -email -refresh_token -createdAt -updatedAt -status -isDeleted',
        )
        .exec();
    } catch (err) {
      throw new NotFoundException('User not found');
    }
  }

  async updateUser(_id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    try {
      if (updateUserDto.email) {
        const user = await this.userModel
          .findOne({ email: updateUserDto.email })
          .exec();
        if (user) throw new BadRequestException('Email already exists');
      }
      return await this.userModel
        .findByIdAndUpdate(_id, updateUserDto, {
          new: true,
        })
        .select('-password -isDeleted')
        .exec();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException("Couldn't update user");
    }
  }

  async changeAvatar(user: User, changeAvatarDto: ChangeAvatarDto) {
    try {
      const currentAvatar = user.avatarUrl;
      if (currentAvatar) {
        await this.cloudinaryService.removeFile(`${user.email}-avatar`);
      }
      const newUserAvatar = await this.cloudinaryService.uploadAvatar(
        changeAvatarDto.avatar,
        user.email,
      );
      user.avatarUrl = newUserAvatar.secure_url;
      await user.save();

      return { avatarUrl: newUserAvatar.secure_url };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async changePassword(user: User, changePasswordDto: ChangePasswordDto) {
    try {
      if (changePasswordDto.currentPassword !== user.password)
        throw new UnauthorizedException('Invalid password');

      const isPasswordValid = await bcrypt.compare(
        changePasswordDto.newPassword,
        user.password,
      );
      if (!isPasswordValid) throw new UnauthorizedException('Invalid password');

      await this.userModel.findByIdAndUpdate(
        user._id,
        { password: changePasswordDto.newPassword },
        {
          new: true,
        },
      );
      return { success: 'Password changed' };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException("Couldn't change password");
    }
  }

  async deleteUser(_id: Types.ObjectId, deleteUserDto: DeleteUserDto) {
    try {
      const deletedUser = await this.userModel
        .findById(_id)
        .populate<{ settings: Settings }>({
          path: 'settings',
        })
        .exec();
      if (
        deleteUserDto.currentPassword !== deleteUserDto.confirmCurrentPassword
      )
        throw new UnauthorizedException('Passwords do not match');

      const isPasswordValid = await bcrypt.compare(
        deleteUserDto.currentPassword,
        deletedUser.password,
      );
      if (!isPasswordValid) throw new UnauthorizedException('Invalid password');

      if (deletedUser.avatarUrl) {
        const publicId = deletedUser.avatarUrl.split('/').pop().split('.')[0];
        await this.cloudinaryService.removeFile(publicId);
      }
      if (deletedUser.settings && deletedUser.settings.backgroundImage) {
        const publicId = deletedUser.settings.backgroundImage
          .split('/')
          .pop()
          .split('.')[0];
        await this.cloudinaryService.removeFile(publicId);
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
