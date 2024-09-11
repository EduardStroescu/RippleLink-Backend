import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Status, StatusSchema } from 'schemas/Status.schema';
import { User, UserSchema } from 'schemas/User.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Status.name, schema: StatusSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}
