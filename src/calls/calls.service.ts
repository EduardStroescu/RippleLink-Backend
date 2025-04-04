import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from 'schemas/Chat.schema';
import { User } from 'schemas/User.schema';
import { CallDto } from 'src/lib/dtos/call.dto';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class CallsService {
  constructor(
    private readonly redisService: RedisService,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
  ) {}

  async getCall(chatId: string): Promise<CallDto> {
    try {
      const call = await this.redisService.getFormattedCall(chatId);
      if (!call) throw new BadRequestException('Call not found');

      return call;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new BadRequestException('Unable to get call');
    }
  }

  async getAllCalls(user: User): Promise<CallDto[]> {
    const chatIds = user.chats.map((chat) => chat.toString());

    const results = await Promise.allSettled(
      chatIds.map((chatId) => this.redisService.getFormattedCall(chatId)),
    );

    return results
      .filter((result) => result.status === 'fulfilled' && result.value)
      .map((result) => (result as PromiseFulfilledResult<CallDto>).value);
  }

  async joinCall(_id: string, chatId: string): Promise<CallDto> {
    try {
      const user = await this.userModel.findById(_id).exec();
      if (!user)
        throw new UnauthorizedException('Invalid JWT bearer access token.');

      let call = await this.redisService.getUnformattedCall(chatId);

      if (!call) {
        const chat = await this.chatModel
          .findById(chatId)
          .populate({
            path: 'users',
            select: 'displayName avatarUrl',
          })
          .exec();

        if (!chat) throw new NotFoundException('Chat not found');

        const otherParticipants = chat
          .toObject()
          .users.filter((u) => u._id.toString() !== _id);
        const updatedParticipants = chat.toObject().users.map((user) => {
          const userObject = {
            userId: user,
            offers: [] as CallDto['participants'][number]['offers'],
            answers: [] as CallDto['participants'][number]['answers'],
            status:
              user._id.toString() === _id
                ? ('inCall' as const)
                : ('notified' as const),
          };

          if (user._id.toString() === _id) {
            otherParticipants.forEach((participant) => {
              userObject.offers.push({
                to: participant._id.toString(),
                sdp: `sdp:${_id}:${participant._id}:offer` as unknown as CallDto['participants'][number]['offers'][number]['sdp'],
                iceCandidates:
                  `ice:${_id}:${participant._id}:offer` as unknown as CallDto['participants'][number]['offers'][number]['iceCandidates'],
              });
            });
          }

          return userObject;
        });

        call = {
          _id: chat.toObject()._id.toString(),
          chatId: chat.toObject(),
          participants: updatedParticipants,
          status: 'ongoing',
          createdAt: new Date().toISOString(),
        };
      } else {
        const userIndex = call.participants.findIndex(
          (participant) => participant.userId._id.toString() === _id,
        );

        if (userIndex === -1) {
          throw new BadRequestException('You are not part of this call');
        }
        const otherParticipants = call.participants.filter(
          (participant) =>
            participant.userId._id.toString() !== _id &&
            participant.status === 'inCall',
        );
        call.participants[userIndex].answers = otherParticipants.map(
          (participant) => ({
            to: participant.userId._id.toString(),
            sdp: `sdp:${_id}:${participant.userId._id}:answer` as unknown as CallDto['participants'][number]['answers'][number]['sdp'],
            iceCandidates:
              `ice:${_id}:${participant.userId._id}:answer` as unknown as CallDto['participants'][number]['answers'][number]['iceCandidates'],
          }),
        );
        call.participants[userIndex].status = 'inCall';
      }

      await this.redisService.setCall(chatId, call);
      return await this.redisService.formatCallForUser(call);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(
        'Unable to join call. Please try again later!',
      );
    }
  }

  async checkIfEveryoneInCallSentIce(
    chatId: string,
    _id: string,
  ): Promise<boolean> {
    try {
      const call = await this.redisService.getFormattedCall(chatId);
      if (!call) return false;
      // Ensure each participant (excluding the checking user) has sent ICE candidates for the checking user
      const iceSent = call.participants
        .filter(
          (participant) =>
            participant.userId._id.toString() !== _id &&
            participant.status === 'inCall',
        )
        .every((participant) =>
          participant.offers.some(
            (offer) =>
              offer.to === _id &&
              Array.isArray(offer.iceCandidates) &&
              offer.iceCandidates.length > 0,
          ),
        );

      return iceSent;
    } catch (err) {
      throw new InternalServerErrorException(
        'Unable to check if everyone sent ICE candidates',
      );
    }
  }

  async callUpdate({
    _id,
    chatId,
    offer,
    answer,
    to,
  }: {
    _id: string;
    chatId: string;
    offer?: string;
    answer?: string;
    to: string;
  }): Promise<CallDto> {
    try {
      const call = await this.redisService.getUnformattedCall(chatId);
      if (!call) throw new BadRequestException('Call not found');

      const currUserIndex = call.participants.findIndex(
        (participant) => participant.userId._id.toString() === _id,
      );
      if (currUserIndex === -1)
        throw new BadRequestException('You are not part of this call');

      const currUser = call.participants[currUserIndex];
      if (offer) {
        this.redisService.addOrReplaceSDP(_id, to, offer, 'offer');
        const offerIndex = currUser.offers.findIndex(
          (offer) => offer.to === to,
        );

        if (offerIndex === -1) {
          currUser.offers.push({
            to,
            sdp: `sdp:${_id}:${to}:offer` as unknown as CallDto['participants'][number]['offers'][number]['sdp'],
            iceCandidates:
              `ice:${_id}:${to}:offer` as unknown as CallDto['participants'][number]['offers'][number]['iceCandidates'],
          });
        }
      }
      if (answer) {
        this.redisService.addOrReplaceSDP(_id, to, answer, 'answer');
        const answerIndex = currUser.answers.findIndex(
          (answer) => answer.to === to,
        );

        if (answerIndex === -1) {
          currUser.answers.push({
            to,
            sdp: `sdp:${_id}:${to}:answer` as unknown as CallDto['participants'][number]['answers'][number]['sdp'],
            iceCandidates:
              `ice:${_id}:${to}:answer` as unknown as CallDto['participants'][number]['answers'][number]['iceCandidates'],
          });
        }
      }
      if (offer || answer) {
        call.participants[currUserIndex] = currUser;
      }

      await this.redisService.setCall(chatId, call);
      return await this.redisService.formatCallForUser(call);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(
        'Unable to update call. Please try again later!',
      );
    }
  }

  async endCall(_id: string, chatId: string): Promise<CallDto> {
    try {
      const call = await this.redisService.getUnformattedCall(chatId);
      if (!call) throw new BadRequestException('Call not found');

      const userIndex = call.participants.findIndex(
        (participant) => participant.userId._id.toString() === _id,
      );
      if (userIndex === -1)
        throw new BadRequestException('You are not part of this call');

      const updatedParticipants = call.participants.filter(
        (participant) =>
          participant.userId._id.toString() !== _id &&
          participant.status === 'inCall',
      );
      if (updatedParticipants.length === 0) {
        await this.redisService.deleteCall(chatId);
        call.status = 'ended';
      } else {
        // If other participants are in call, delete their ice and sdp for the participant who is leaving, alo delete the leaving participants' ice and sdp for everyone still in call
        await Promise.all([
          this.redisService.deleteIceAndSDPForParticipant(
            call.participants[userIndex],
          ),
          this.redisService.deleteOtherParticipantsIceAndSDPForParticipant(
            updatedParticipants,
            call.participants[userIndex],
          ),
        ]);

        call.participants = call.participants.map((participant, index) => {
          if (index === userIndex) {
            return {
              ...participant,
              offers: [],
              answers: [],
              status: 'rejected',
            };
          } else {
            return {
              ...participant,
              offers: participant.offers.filter(
                (offer) =>
                  offer.to !==
                  call.participants[userIndex].userId._id.toString(),
              ),
              answers: participant.answers.filter(
                (answer) =>
                  answer.to !==
                  call.participants[userIndex].userId._id.toString(),
              ),
            };
          }
        });

        await this.redisService.setCall(chatId, call);
      }
      return await this.redisService.formatCallForUser(call);
    } catch (err) {
      throw new BadRequestException('Unable to end call');
    }
  }

  async rejectCall(_id: string, chatId: string) {
    try {
      const call = await this.redisService.getUnformattedCall(chatId);
      if (!call) throw new BadRequestException('Call not found');

      const userIndex = call.participants.findIndex(
        (participant) => participant.userId._id.toString() === _id,
      );
      if (userIndex === -1)
        throw new BadRequestException('You are not part of this call');

      call.participants[userIndex] = {
        ...call.participants[userIndex],
        status: 'rejected',
      };
      await this.redisService.setCall(chatId, call);

      return await this.redisService.formatCallForUser(call);
    } catch (_) {
      // Ignore error
    }
  }

  async saveIceCandidates({ _id, chatId, iceCandidates, candidatesType, to }) {
    try {
      const call = await this.redisService.getFormattedCall(chatId);
      if (!call) throw new BadRequestException('Call not found');

      await this.redisService.addIce({
        from: _id,
        to,
        type: candidatesType,
        iceCandidates,
      });
      return call;
    } catch (_) {
      // Ignore error
    }
  }
}
