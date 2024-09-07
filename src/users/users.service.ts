import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
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
          '-password -firstName -lastName -email -refresh_token -createdAt -updatedAt',
        )
        .exec();
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async connectUser(userId: Types.ObjectId) {
    try {
      const user = await this.userModel.findById(userId).populate('status');

      if (!user) {
        throw new Error('User not found');
      }

      let updatedStatus;
      if (user.status) {
        updatedStatus = await this.statusModel
          .findByIdAndUpdate(
            user.status,
            { online: true, lastSeen: new Date() },
            { new: true },
          )
          .exec();
      } else {
        updatedStatus = new this.statusModel({
          userId,
          online: true,
          lastSeen: new Date(),
        });
        await updatedStatus.save();
      }

      user.status = updatedStatus;
      await user.save();

      return updatedStatus;
    } catch (err) {
      return { error: err.message };
    }
  }

  async disconnectUser(userId: Types.ObjectId) {
    try {
      const user = await this.userModel.findById(userId).populate('status');

      if (!user) {
        throw new Error('User not found');
      }

      let updatedStatus;
      if (user.status) {
        updatedStatus = await this.statusModel
          .findByIdAndUpdate(
            user.status,
            { online: false, lastSeen: new Date() },
            { new: true },
          )
          .exec();
      } else {
        updatedStatus = new this.statusModel({
          userId,
          online: false,
          lastSeen: new Date(),
        });
        await updatedStatus.save();
      }

      if (updatedStatus) {
        user.status = updatedStatus._id;
        await user.save();
      }

      return updatedStatus;
    } catch (err) {
      return { error: err.message };
    }
  }

  async updateUser(_id: Types.ObjectId, updateUserDto: UpdateUserDto) {
    try {
      return await this.userModel
        .findByIdAndUpdate(_id, updateUserDto, {
          new: true,
        })
        .select('-password')
        .exec();
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  async changeAvatar(_id: Types.ObjectId, changeAvatarDto: ChangeAvatarDto) {
    try {
      const user = await this.userModel.findById(_id).exec();

      if (!user) throw new BadRequestException('User not found');
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

  async changePassword(
    _id: Types.ObjectId,
    changePasswordDto: ChangePasswordDto,
  ) {
    try {
      const user = await this.userModel.findById(_id).exec();
      if (!user) throw new BadRequestException('User not found');
      if (changePasswordDto.currentPassword !== user.password)
        throw new UnauthorizedException('Invalid password');

      const isPasswordValid = await bcrypt.compare(
        changePasswordDto.newPassword,
        user.password,
      );
      if (!isPasswordValid) throw new UnauthorizedException('Invalid password');

      await this.userModel.findByIdAndUpdate(
        _id,
        { password: changePasswordDto.newPassword },
        {
          new: true,
        },
      );
      return { success: 'Password changed' };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async getUserByDisplayName(displayName: string) {
    try {
      const regex = new RegExp(displayName, 'i');
      return await this.userModel
        .find({ displayName: { $regex: regex } })
        .select(
          '-password -settings -firstName -lastName -email -refresh_token -createdAt -updatedAt -status',
        )
        .exec();
    } catch (err) {
      throw new InternalServerErrorException(err);
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
      if (!deletedUser) throw new BadRequestException('User not found');
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
      await deletedUser.deleteOne();
      await this.statusModel.deleteOne({ userId: _id });
      await this.settingsModel.deleteOne({ userId: _id });
      return { success: 'User deleted' };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
}
