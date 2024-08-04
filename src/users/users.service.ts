import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'schemas/User.schema';
import UpdateUserDto from './dto/UpdateUser.dto';
import { Status } from 'schemas/Status.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Status.name) private statusModel: Model<Status>,
  ) {}

  async getAllUsers() {
    try {
      const response = await this.userModel.find().populate(['chats status']);
      return response;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async getUserById(userId: Types.ObjectId) {
    try {
      const response = await this.userModel
        .findById(userId)
        .populate('status')
        .exec();
      return response.toObject();
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
      const user = await this.userModel.findByIdAndUpdate(_id, updateUserDto, {
        new: true,
      });
      return user.toObject();
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  async deleteUser(_id: Types.ObjectId) {
    try {
      const deletedUser = await this.userModel.findByIdAndDelete(_id);
      if (!deletedUser) throw new BadRequestException('User not found');
      await this.statusModel.deleteOne({ userId: _id });
      return deletedUser;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async getUserByDisplayName(displayName: string) {
    try {
      const regex = new RegExp(displayName, 'i');
      const response = this.userModel
        .find({ displayName: { $regex: regex } })
        .exec();
      return response;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }
}
