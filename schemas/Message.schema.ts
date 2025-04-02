import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type FileContent = {
  content: string;
  fileId: string;
  type: 'image' | 'video' | 'audio' | 'file';
}[];
export type TextContent = string;
export type Content = TextContent | FileContent;

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
export class Message extends Document {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true,
  })
  chatId: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  senderId: Types.ObjectId;

  @Prop({
    required: true,
    validate: {
      validator: function (value: any) {
        // Ensure content is a string if type is "text" or "event"
        if (this.type === 'text' || this.type === 'event') {
          return typeof value === 'string';
        }
        // Ensure content is an array of objects if type is "file"
        if (this.type === 'file') {
          return (
            Array.isArray(value) &&
            value.every(
              (item: any) =>
                typeof item.content === 'string' &&
                typeof item.fileId === 'string' &&
                ['image', 'video', 'audio', 'file'].includes(item.type),
            )
          );
        }
        return false;
      },
      message: 'Invalid content format for the given type.',
    },
    type: mongoose.Schema.Types.Mixed, // Mixed to handle union types
  })
  content: Content;

  @Prop({ enum: ['text', 'file', 'event'], required: true, index: true })
  type: 'text' | 'file' | 'event';

  @Prop({ type: [{ userId: String, timestamp: Date }], default: [] })
  readBy: { userId: string; timestamp: Date }[];

  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
