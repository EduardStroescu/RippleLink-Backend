import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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
export class Settings extends Document {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: false })
  backgroundImage?: string;

  @Prop({ required: false })
  glowColor?: string;

  @Prop({ required: false })
  tintColor?: string;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
