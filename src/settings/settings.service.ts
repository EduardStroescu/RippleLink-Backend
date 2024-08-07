import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings } from 'schemas/Settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private settingsModel: Model<Settings>,
  ) {}

  async getSettings(userId: string) {
    return 'settings';
  }

  async createSettings(userId: string) {
    return 'settings created';
  }

  async updateSettings(userId: string) {
    return 'settings updated';
  }

  async deleteSettings(userId: string) {
    return 'settings deleted';
  }
}
