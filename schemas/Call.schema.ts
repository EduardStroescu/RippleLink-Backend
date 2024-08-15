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
export class Call extends Document {
  _id: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true })
  chatId: Types.ObjectId;

  @Prop({
    type: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        offers: [
          {
            to: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
              required: true,
            },
            sdp: { type: String, required: true },
            iceCandidates: [{ type: String }],
          },
        ],
        answers: [
          {
            to: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
              required: true,
            },
            sdp: { type: String, required: true },
            iceCandidates: [{ type: String }],
          },
        ],
      },
    ],
    required: true,
  })
  participants: {
    userId: Types.ObjectId;
    offers?: { to: Types.ObjectId; sdp: string; iceCandidates: string[] }[];
    answers?: { to: Types.ObjectId; sdp: string; iceCandidates: string[] }[];
  }[];
}

export const CallSchema = SchemaFactory.createForClass(Call);
