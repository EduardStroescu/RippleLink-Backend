import { ApiProperty } from '@nestjs/swagger';
import { ChatDto } from './chat.dto';
import { Types } from 'mongoose';

export class OfferDto {
  @ApiProperty({
    description: 'Recipient user ID for the offer.',
    type: String,
  })
  to: string;

  @ApiProperty({
    description: 'Session Description Protocol (SDP) for the offer.',
    type: String,
  })
  sdp: string;

  @ApiProperty({
    description: 'List of ICE candidates for the offer.',
    type: [String],
  })
  iceCandidates: string[];
}

export class AnswerDto {
  @ApiProperty({
    description: 'Recipient user ID for the answer.',
    type: String,
  })
  to: string;

  @ApiProperty({
    description: 'Session Description Protocol (SDP) for the answer.',
    type: String,
  })
  sdp: string;

  @ApiProperty({
    description: 'List of ICE candidates for the answer.',
    type: [String],
  })
  iceCandidates: string[];
}

class ParticipantDto {
  @ApiProperty({
    description: 'User id, displayName and avatarUrl of the participant.',
    type: Types.ObjectId,
  })
  userId: Types.ObjectId;

  @ApiProperty({
    description: 'List of offers made by the participant.',
    type: [OfferDto],
    required: false,
  })
  offers?: OfferDto[];

  @ApiProperty({
    description: 'List of answers sent by the participant.',
    type: [AnswerDto],
    required: false,
  })
  answers?: AnswerDto[];

  @ApiProperty({
    description: 'Status of the participant relative to the call.',
    oneOf: [{ type: 'string', enum: ['notified', 'inCall', 'rejected'] }],
  })
  status: 'notified' | 'inCall' | 'rejected';
}

export class CallDto {
  @ApiProperty({
    description: 'Call ID',
    type: String,
  })
  _id: string;

  @ApiProperty({
    description: 'Chat ID',
    type: ChatDto,
  })
  chatId: ChatDto;

  @ApiProperty({
    description:
      'List of all participants in the call. Automatically populated with all users in chat.',
    type: [ParticipantDto],
  })
  participants: ParticipantDto[];

  @ApiProperty({
    description: 'Current status of the call.',
    oneOf: [{ type: 'string', enum: ['ongoing', 'ended'] }],
  })
  status: 'ongoing' | 'ended';

  @ApiProperty({
    description: 'Date when the call was created',
    type: String,
  })
  createdAt: string;
}
