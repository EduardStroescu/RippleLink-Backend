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

  async updateSettings(user: User, updateSettingsDto: UpdateSettingsDto) {
    try {
      let userBackgroundImage: string | undefined;
      if (updateSettingsDto.backgroundImage) {
        userBackgroundImage = await this.fileUploaderService.uploadBase64File(
          'background',
          user._id.toString(),
          { base64String: updateSettingsDto.backgroundImage },
        );
      }

      const fieldsToUpdate = {
        ...updateSettingsDto,
        userId: user._id,
        backgroundImage: userBackgroundImage,
      };

      // Remove backgroundImage field if it's not being updated
      if (!userBackgroundImage) delete fieldsToUpdate.backgroundImage;

      let updatedSettings: Settings;

      // If current settings exist, update them
      if (user.settings) {
        updatedSettings = await this.settingsModel.findOneAndUpdate(
          { userId: user._id },
          fieldsToUpdate,
          { new: true },
        );
      } else {
        // Otherwise, create new settings and associate with the user
        updatedSettings = await this.settingsModel.create(fieldsToUpdate);
        user.settings = updatedSettings._id;
        await user.save();
      }

      return updatedSettings?.toObject();
    } catch (err) {
      throw new InternalServerErrorException(
        'Unable to update settings. Please try again later!',
      );
    }
  }
}
