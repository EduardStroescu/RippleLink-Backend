import { ApiProperty } from '@nestjs/swagger';
import { ChatDto } from './chat.dto';

export class OfferDto {
  @ApiProperty({
    description: 'Recipient user ID for the offer',
    type: String,
  })
  to: string;

  @ApiProperty({
    description: 'Session Description Protocol (SDP) for the offer',
    type: String,
  })
  sdp: string;

  @ApiProperty({
    description: 'List of ICE candidates for the offer',
    type: [String],
  })
  iceCandidates: string[];
}

export class AnswerDto {
  @ApiProperty({
    description: 'Recipient user ID for the answer',
    type: String,
  })
  to: string;

  @ApiProperty({
    description: 'Session Description Protocol (SDP) for the answer',
    type: String,
  })
  sdp: string;

  @ApiProperty({
    description: 'List of ICE candidates for the answer',
    type: [String],
  })
  iceCandidates: string[];
}

class ParticipantDto {
  @ApiProperty({
    description: 'User ID of the participant',
    type: String,
  })
  userId: string;

  @ApiProperty({
    description: 'List of offers made by the participant',
    type: [OfferDto],
    required: false,
  })
  offers?: OfferDto[];

  @ApiProperty({
    description: 'List of answers received by the participant',
    type: [AnswerDto],
    required: false,
  })
  answers?: AnswerDto[];
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
    description: 'List of participants in the call',
    type: [ParticipantDto],
  })
  participants: ParticipantDto[];
}
