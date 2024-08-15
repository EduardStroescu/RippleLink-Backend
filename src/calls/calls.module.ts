import { Module } from '@nestjs/common';
import { CallsService } from './calls.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'schemas/User.schema';
import { Call, CallSchema } from 'schemas/Call.schema';
import { CallsController } from './calls.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Call.name, schema: CallSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
