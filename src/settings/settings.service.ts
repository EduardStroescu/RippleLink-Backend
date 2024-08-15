import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings } from 'schemas/Settings.schema';
import { UpdateSettingsDto } from './dto/UpdateSettings.dto';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { User } from 'schemas/User.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private settingsModel: Model<Settings>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getSettings(userId: string) {
    return 'settings';
  }

  async updateSettings(userId: string, updateSettingsDto: UpdateSettingsDto) {
    const currentSettings = await this.settingsModel.findOne({
      userId: userId,
    });
    let updatedSettings: Settings | undefined;
    let userBackgroundImage;
    if (updateSettingsDto.backgroundImage) {
      userBackgroundImage = await this.cloudinaryService.uploadImageFile(
        updateSettingsDto.backgroundImage,
      );
    }
    const fieldsToUpdate = {
      ...updateSettingsDto,
      userId,
      backgroundImage: userBackgroundImage?.url,
    };
    if (!userBackgroundImage) delete fieldsToUpdate.backgroundImage;

    if (currentSettings) {
      if (
        currentSettings.backgroundImage &&
        updateSettingsDto.backgroundImage
      ) {
        await this.cloudinaryService.removeFile(
          currentSettings.backgroundImage.split('/').pop().split('.')[0],
        );
      }
      updatedSettings = await this.settingsModel.findOneAndUpdate(
        { userId: userId },
        fieldsToUpdate,
        {
          new: true,
        },
      );
    } else {
      updatedSettings = new this.settingsModel(fieldsToUpdate);
      await updatedSettings.save();
      await this.userModel.findByIdAndUpdate(userId, {
        settings: updatedSettings._id,
      });
    }

    return updatedSettings.toObject();
  }
}
