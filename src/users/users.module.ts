import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'schemas/User.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SettingsModule } from 'src/settings/settings.module';
import { Status, StatusSchema } from 'schemas/Status.schema';
import { Settings, SettingsSchema } from 'schemas/Settings.schema';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Status.name, schema: StatusSchema },
      { name: Settings.name, schema: SettingsSchema },
    ]),
    SettingsModule,
    CloudinaryModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
