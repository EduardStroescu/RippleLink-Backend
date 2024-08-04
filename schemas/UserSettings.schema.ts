import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: false,
  versionKey: false,
  toJSON: {
    virtuals: false,
    transform: (_, obj) => {
      return obj;
    },
  },
  toObject: {
    virtuals: false,
    transform: (_, obj) => {
      return obj;
    },
  },
})
export class UserSettings extends Document {
  _id: string;

  @Prop({ required: false })
  backgroundImage?: string;

  @Prop({ required: false })
  receiveNotifications?: boolean;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);
