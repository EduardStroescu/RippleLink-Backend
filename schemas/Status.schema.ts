import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({
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
export class Status extends Document {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  online: boolean;

  @Prop({ type: String, required: false })
  statusMessage?: string;

  @Prop({ type: Date, default: Date.now })
  lastSeen: Date;
}

export const StatusSchema = SchemaFactory.createForClass(Status);
