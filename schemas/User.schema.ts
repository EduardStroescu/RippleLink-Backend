import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
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
export class User extends Document {
  _id: Types.ObjectId;

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

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Status' })
  status?: Types.ObjectId;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }] })
  chats?: Types.ObjectId[];

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Settings' })
  settings?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);
