import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'schemas/User.schema';
import { Settings, SettingsSchema } from 'schemas/Settings.schema';
import { JwtStrategy } from './strategies';
import { JwtModule } from '@nestjs/jwt';
import { Status, StatusSchema } from 'schemas/Status.schema';
import { UsersModule } from 'src/users/users.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      {
        name: Settings.name,
        schema: SettingsSchema,
      },
      { name: Status.name, schema: StatusSchema },
    ]),
    JwtModule.register({}),
    UsersModule,
    CloudinaryModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
