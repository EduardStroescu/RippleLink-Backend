import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'schemas/User.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Status, StatusSchema } from 'schemas/Status.schema';
import { Settings, SettingsSchema } from 'schemas/Settings.schema';
import { FileUploaderModule } from 'src/fileUploader/fileUploader.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Status.name, schema: StatusSchema },
      { name: Settings.name, schema: SettingsSchema },
    ]),
    FileUploaderModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
