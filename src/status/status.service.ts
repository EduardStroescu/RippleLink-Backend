import {
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateStatusDto } from './dto/UpdateStatus.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'schemas/User.schema';
import { Status } from 'schemas/Status.schema';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class StatusService {
  constructor(
    @InjectModel(Status.name) private statusModel: Model<Status>,
    @InjectModel(User.name) private userModel: Model<User>,
    @Inject(forwardRef(() => RedisService))
    private readonly redisService: RedisService,
  ) {}

  async getUserStatus(userId: string) {
    try {
      const status = await this.statusModel.findOne({ userId }).exec();
      if (!status) throw new NotFoundException('User status not found');
      const isUserOnline = await this.redisService.isUserOnline(userId);
      if (isUserOnline) {
        status.online = true;
      } else {
        status.online = false;
      }

      return status.toObject();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException('Unable to get user status');
    }
  }

  async createStatus(userId: Types.ObjectId) {
    try {
      const updatedStatus = new this.statusModel({
        userId,
        lastSeen: new Date(),
      });
      await updatedStatus.save();
    } catch (err) {
      throw new InternalServerErrorException('Unable to create status');
    }
  }

  async updateStatus(_id: Types.ObjectId, updateStatusDto: UpdateStatusDto) {
    try {
      const user = await this.userModel
        .findById(_id)
        .populate({ path: 'status' })
        .exec();

      let newStatus: Status;
      if (user.status) {
        newStatus = await this.statusModel.findByIdAndUpdate(
          user.status._id,
          updateStatusDto,
          { new: true },
        );
      } else {
        newStatus = new this.statusModel(updateStatusDto);
        newStatus = await newStatus.save();
      }
      user.status = newStatus._id;
      await user.save();
      return newStatus.toObject();
    } catch (err) {
      throw new InternalServerErrorException('Unable to update status');
    }
  }

  async disconnectUser(userId: Types.ObjectId) {
    try {
      const user = await this.userModel.findById(userId).populate('status');

      if (!user) {
        throw new Error('User not found');
      }

      const updatedStatus = await this.statusModel
        .findByIdAndUpdate(user.status, { lastSeen: new Date() }, { new: true })
        .exec();

      user.status = updatedStatus._id;
      await user.save();

      return updatedStatus;
    } catch (err) {
      return { error: err.message };
    }
  }
}
