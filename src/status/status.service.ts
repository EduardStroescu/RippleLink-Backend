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
      const status = (
        await this.statusModel.findOne({ userId }).exec()
      )?.toObject();
      if (!status) throw new NotFoundException('User status not found');

      const isUserOnline = await this.redisService.isUserOnline(userId);
      if (isUserOnline) {
        status.online = true;
      } else {
        status.online = false;
      }

      return status;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'Unable to get user status. Please try again later!',
      );
    }
  }

  async createStatus(userId: Types.ObjectId) {
    try {
      const updatedStatus = (
        await this.statusModel.create({
          userId,
          lastSeen: new Date(),
        })
      )?.toObject();

      return updatedStatus;
    } catch (err) {
      throw new InternalServerErrorException(
        'Unable to create status. Please try again later!',
      );
    }
  }

  async updateStatus(user: User, updateStatusDto: UpdateStatusDto) {
    try {
      let newStatus: Status;
      if (user.status) {
        newStatus = (
          await this.statusModel.findByIdAndUpdate(
            user.status,
            updateStatusDto,
            { new: true },
          )
        )?.toObject();
      } else {
        newStatus = (
          await this.statusModel.create({
            userId: user._id,
            ...updateStatusDto,
          })
        )?.toObject();
        user.status = newStatus._id;
        await user.save();
      }
      return newStatus;
    } catch (err) {
      throw new InternalServerErrorException(
        'Unable to update status. Please try again later!',
      );
    }
  }

  async disconnectUser(userId: Types.ObjectId) {
    try {
      const user = await this.userModel.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const updatedStatus = (
        await this.statusModel
          .findByIdAndUpdate(
            user.status,
            { lastSeen: new Date() },
            { new: true },
          )
          .exec()
      )?.toObject();

      return updatedStatus;
    } catch (err) {
      return { error: err.message };
    }
  }
}
