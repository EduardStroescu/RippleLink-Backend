import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Settings, SettingsSchema } from 'schemas/Settings.schema';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { User, UserSchema } from 'schemas/User.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Settings.name, schema: SettingsSchema },
      { name: User.name, schema: UserSchema },
    ]),
    CloudinaryModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
