import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Message } from './Message.schema';
import { User } from './User.schema';

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
export class Chat {
  @Prop({
    type: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ],
  })
  users: User[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }] })
  messages?: Message[];
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
