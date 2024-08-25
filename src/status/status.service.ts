import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateStatusDto } from './dto/updateStatus.dto';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'schemas/User.schema';
import { Status } from 'schemas/Status.schema';

@Injectable()
export class StatusService {
  constructor(
    @InjectModel(Status.name) private statusModel: Model<Status>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async updateStatus(_id: Types.ObjectId, updateStatusDto: UpdateStatusDto) {
    try {
      const user = await this.userModel
        .findById(_id)
        .populate({ path: 'status' })
        .exec();
      if (!user) throw new NotFoundException('User not found');

      let newStatus;
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
}
