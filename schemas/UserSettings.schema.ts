import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({
  timestamps: false,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_, obj) => {
      return obj;
    },
  },
  toObject: {
    virtuals: true,
    transform: (_, obj) => {
      return obj;
    },
  },
})
export class UserSettings {
  @Prop({ required: false })
  backgroundImage?: string;

  @Prop({ required: false })
  receiveNotifications?: boolean;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);
