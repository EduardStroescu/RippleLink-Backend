import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings } from 'schemas/Settings.schema';
import { UpdateSettingsDto } from './dto/UpdateSettings.dto';
import { User } from 'schemas/User.schema';
import { FileUploaderService } from 'src/fileUploader/fileUploader.provider';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private settingsModel: Model<Settings>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly fileUploaderService: FileUploaderService,
  ) {}

  async updateSettings(userId: string, updateSettingsDto: UpdateSettingsDto) {
    try {
      const currentSettings = await this.settingsModel.findOne({ userId });

      let userBackgroundImage: string | undefined;
      if (updateSettingsDto.backgroundImage) {
        userBackgroundImage = await this.fileUploaderService.uploadBase64File(
          'background',
          userId,
          { base64String: updateSettingsDto.backgroundImage },
        );
      }

      const fieldsToUpdate = {
        ...updateSettingsDto,
        userId,
        backgroundImage: userBackgroundImage,
      };

      // Remove backgroundImage field if it's not being updated
      if (!userBackgroundImage) delete fieldsToUpdate.backgroundImage;

      let updatedSettings: Settings;

      // If current settings exist, update them
      if (currentSettings) {
        updatedSettings = await this.settingsModel.findOneAndUpdate(
          { userId },
          fieldsToUpdate,
          { new: true },
        );
      } else {
        // Otherwise, create new settings and associate with the user
        updatedSettings = new this.settingsModel(fieldsToUpdate);
        await updatedSettings.save();
        await this.userModel.findByIdAndUpdate(userId, {
          settings: updatedSettings._id,
        });
      }

      return updatedSettings?.toObject();
    } catch (err) {
      throw new InternalServerErrorException(
        'Unable to update settings. Please try again later!',
      );
    }
  }
}
