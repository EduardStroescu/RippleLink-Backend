import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'schemas/User.schema';
import UpdateUserDto from './dto/UpdateUser.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getAllUsers() {
    return await this.userModel.find().populate(['settings', 'chats']);
  }

  async connectUser(userId: string) {
    return await this.userModel.findByIdAndUpdate(userId, { isOnline: true });
  }

  async disconnectUser(userId: string) {
    return await this.userModel.findByIdAndUpdate(userId, { isOnline: false });
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
        new: true,
      });
      return user;
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  deleteUser(id: string) {
    return this.userModel.findByIdAndDelete(id);
  }

  async getUserByDisplayName(displayName: string) {
    const regex = new RegExp(displayName, 'i'); // Case-insensitive search
    return this.userModel.find({ displayName: { $regex: regex } }).exec();
  }
}
