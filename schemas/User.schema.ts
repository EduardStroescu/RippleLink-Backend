import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { UserSettings } from './UserSettings.schema';
import { Chat } from './Chat.schema';

@Schema({
  timestamps: true,
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
export class User {
  @Prop({ type: String, unique: true, required: true })
  email: string;

  @Prop({ type: String, required: false })
  password: string;

  @Prop({ type: String, required: true })
  firstName: string;

  @Prop({ type: String, required: true })
  lastName: string;

  @Prop({ type: String, required: false })
  displayName?: string;

  @Prop({ type: String, required: false })
  avatarUrl?: string;

  @Prop({ type: String, required: false })
  refresh_token?: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'UserSettings' })
  settings?: UserSettings;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }] })
  chats?: Chat[];

  @Prop({ type: Boolean, default: false, required: false })
  isOnline?: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
