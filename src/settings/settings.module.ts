import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Settings, SettingsSchema } from 'schemas/Settings.schema';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { User, UserSchema } from 'schemas/User.schema';
import { FileUploaderModule } from 'src/fileUploader/fileUploader.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Settings.name, schema: SettingsSchema },
      { name: User.name, schema: UserSchema },
    ]),
    FileUploaderModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
