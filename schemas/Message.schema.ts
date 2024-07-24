import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

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
export class Message {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true })
  chatId: string;

  @Prop({ type: String, required: true })
  content: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
