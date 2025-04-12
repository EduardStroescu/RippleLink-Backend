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
export class Chat extends Document {
  _id: Types.ObjectId;

  @Prop({ required: false })
  name: string;

  @Prop({ required: true, enum: ['group', 'dm'] })
  type: string;

  @Prop({
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },
    ],
  })
  users: Types.ObjectId[];

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: false,
  })
  lastMessage: Types.ObjectId;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
