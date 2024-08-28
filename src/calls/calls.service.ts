import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Call } from 'schemas/Call.schema';
import { User } from 'schemas/User.schema';

@Injectable({})
export class CallsService implements OnModuleInit {
  private iceCandidatesQueue: any[] = [];
  constructor(
    @InjectModel(Call.name) private callModel: Model<Call>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async onModuleInit() {
    setInterval(() => this.flushIceCandidatesQueue(), 1000);
  }

  async getAllCalls(user: User): Promise<Call[]> {
    try {
      const chatIds = user.chats.map((chat) => chat._id);
      const calls = await this.callModel
        .find({ chatId: { $in: chatIds } })
        .populate({
          path: 'chatId',
          populate: {
            path: 'users',
            select: 'displayName avatarUrl status chats',
          },
        })
        .populate({
          path: 'participants.userId',
          select: 'displayName avatarUrl status',
        })
        .sort({ updatedAt: -1 })
        .exec();

      return calls;
    } catch (error) {
      throw new Error(
        'An error occurred while retrieving chats: ' + error.message,
      );
    }
  }

  //
  // Never Touch the call related methods below!!!
  //

  async joinCall(_id: Types.ObjectId, chatId: Types.ObjectId) {
    try {
      // Verify that the user is a member of the chat
      const user = await this.userModel.findById(_id).exec();
      if (!user || !user.chats.some((chat) => chat._id.equals(chatId))) {
        throw new BadRequestException('You are not a member of this chat');
      }

      // Find or create the call document
      let updatedCall = await this.callModel.findOne({ chatId }).exec();
      if (!updatedCall) {
        updatedCall = new this.callModel({
          chatId,
          participants: [],
        });
      }

      // Check if the user is already in the participants list
      const existingParticipant = updatedCall.participants.find((p) =>
        p.userId.equals(_id),
      );

      if (!existingParticipant) {
        // Add the user to the participants list
        updatedCall.participants.push({
          userId: _id,
          offers: [],
          answers: [],
        });
      }

      // Save the updated call
      updatedCall = await updatedCall.save();

      // Populate necessary fields
      updatedCall = await updatedCall.populate({
        path: 'chatId',
        populate: {
          path: 'users',
          select: 'displayName avatarUrl',
        },
      });

      updatedCall = await updatedCall.populate({
        path: 'participants.userId',
        select: 'displayName avatarUrl',
      });

      return updatedCall.toObject();
    } catch (err) {
      throw new BadRequestException('Unable to join call');
    }
  }

  async getCall(chatId: Types.ObjectId) {
    try {
      return await this.callModel.findOne({ chatId }).exec();
    } catch (err) {
      throw new BadRequestException('Unable to get call');
    }
  }

  async checkIfEveryoneInCallSentIce(
    callId: Types.ObjectId,
    _id: Types.ObjectId,
  ): Promise<boolean> {
    try {
      const call = await this.callModel.findById(callId).exec();
      if (!call) return false;

      const participants = call.participants;

      // Ensure each participant (excluding the checking user) has sent ICE candidates for the checking user
      const iceSent = participants
        .filter((participant) => !participant.userId.equals(_id))
        .every((participant) =>
          participant.offers.some(
            (offer) =>
              offer.to.equals(_id) &&
              Array.isArray(offer.iceCandidates) &&
              offer.iceCandidates.length > 0,
          ),
        );

      return iceSent;
    } catch (err) {
      throw new BadRequestException(
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
    _id: Types.ObjectId;
    chatId: Types.ObjectId;
    offer?: string;
    answer?: string;
    to: Types.ObjectId;
  }) {
    try {
      // Check if the user is still part of the chat
      const user = await this.userModel.findById(_id).exec();
      if (!user || !user.chats.some((chat) => chat._id.equals(chatId))) {
        throw new BadRequestException('You are not a member of this chat');
      }

      // Check if the user is still a participant in the call
      let updatedCall = await this.callModel
        .findOne({
          chatId,
          'participants.userId': _id,
        })
        .exec();

      if (!updatedCall) {
        throw new BadRequestException('User is no longer part of the call');
      }

      // Find the existing participant in the call
      const existingParticipant = updatedCall.participants.find((participant) =>
        participant.userId.equals(_id),
      );

      if (existingParticipant) {
        // Update the existing participant's signal
        const offerIndex = existingParticipant.offers.findIndex((offer) =>
          offer.to.equals(to),
        );
        const answerIndex = existingParticipant.answers.findIndex((answer) =>
          answer.to.equals(to),
        );

        if (offer) {
          if (offerIndex === -1) {
            existingParticipant.offers.push({
              sdp: offer,
              to,
              iceCandidates: [],
            });
          } else {
            existingParticipant.offers[offerIndex].sdp = offer;
            existingParticipant.offers[offerIndex].iceCandidates = [];
          }
        }
        if (answer) {
          if (answerIndex === -1) {
            existingParticipant.answers.push({
              sdp: answer,
              to,
              iceCandidates: [],
            });
          } else {
            existingParticipant.answers[answerIndex].sdp = answer;
            existingParticipant.answers[answerIndex].iceCandidates = [];
          }
        }
      }

      // Save the updated call data
      updatedCall = await updatedCall.save();

      // Populate the updated call data
      updatedCall = await updatedCall.populate({
        path: 'chatId',
        populate: {
          path: 'users',
          select: 'displayName avatarUrl',
        },
      });
      updatedCall = await updatedCall.populate({
        path: 'participants.userId',
        select: 'displayName avatarUrl',
      });

      return updatedCall.toObject();
    } catch (err) {
      throw new BadRequestException('Unable to update call');
    }
  }

  async queueIceCandidates({
    _id,
    chatId,
    iceCandidates,
    candidatesType,
    to,
  }: {
    _id: Types.ObjectId;
    chatId: Types.ObjectId;
    iceCandidates: string;
    candidatesType: 'offer' | 'answer';
    to: Types.ObjectId;
  }) {
    const updateOperation =
      candidatesType === 'offer'
        ? {
            updateOne: {
              filter: { chatId, 'participants.userId': _id },
              update: {
                $addToSet: {
                  'participants.$[participant].offers.$[offer].iceCandidates':
                    iceCandidates,
                },
              },
              arrayFilters: [{ 'participant.userId': _id }, { 'offer.to': to }],
            },
          }
        : {
            updateOne: {
              filter: { chatId, 'participants.userId': _id },
              update: {
                $addToSet: {
                  'participants.$[participant].answers.$[answer].iceCandidates':
                    iceCandidates,
                },
              },
              arrayFilters: [
                { 'participant.userId': _id },
                { 'answer.to': to },
              ],
            },
          };

    // Add the operation to the queue
    this.iceCandidatesQueue.push(updateOperation);

    // Add a short delay to ensure the database is updated
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // Immediately flush the queue to apply the changes
    await this.flushIceCandidatesQueue();

    // Fetch and return the updated call data
    const updatedCall = await this.callModel
      .findOne({ chatId })
      .populate({
        path: 'chatId',
        populate: { path: 'users', select: 'displayName avatarUrl' },
      })
      .populate({
        path: 'participants.userId',
        select: 'displayName avatarUrl',
      })
      .exec();
    if (!updatedCall) return;
    return updatedCall.toObject();
  }

  async flushIceCandidatesQueue() {
    if (this.iceCandidatesQueue.length > 0) {
      try {
        const validOperations = [];

        for (const operation of this.iceCandidatesQueue) {
          const { filter } = operation.updateOne;
          const { chatId, 'participants.userId': userId } = filter;

          // Verify if the user is still part of the call
          const isUserInCall = await this.callModel.exists({
            chatId,
            'participants.userId': userId,
          });

          // Only include the operation if the user is still part of the call
          if (isUserInCall) {
            validOperations.push(operation);
          }
        }

        // Perform the bulk write operation only with valid operations
        if (validOperations.length > 0) {
          await this.callModel.bulkWrite(validOperations);
        }

        this.iceCandidatesQueue = [];
      } catch (err) {
        throw new Error('Error during bulk write');
      }
    }
  }

  async endCall(_id: Types.ObjectId, callId: Types.ObjectId): Promise<any> {
    try {
      const call = await this.callModel
        .findById(callId)
        .populate({
          path: 'chatId',
          populate: { path: 'users', select: 'displayName avatarUrl' },
        })
        .populate({
          path: 'participants.userId',
          select: 'displayName avatarUrl',
        })
        .exec();

      if (!call) {
        throw new BadRequestException('Chat or ongoing call not found');
      }

      // Ensure the user is part of the call before proceeding
      const isUserInCall = call.participants.some((participant) =>
        participant?.userId?._id.equals(_id),
      );

      if (!isUserInCall) {
        throw new BadRequestException('User is not part of this call');
      }

      // Filter out the participant to be removed
      const updatedParticipants = call.participants.filter((participant) =>
        participant?.userId?._id ? !participant.userId._id.equals(_id) : false,
      );

      if (updatedParticipants.length === 0) {
        // No participants left, delete the call
        await this.callModel.deleteOne({ _id: call._id }).exec();
        return { updatedCall: call.toObject(), callEnded: true };
      } else {
        // Update the call with remaining participants
        call.participants = updatedParticipants;

        await call.save();
        await call.populate({
          path: 'chatId',
          populate: { path: 'users', select: 'displayName avatarUrl' },
        });
        await call.populate({
          path: 'participants.userId',
          select: 'displayName avatarUrl',
        });

        return { updatedCall: call.toObject() };
      }
    } catch (err) {
      throw new BadRequestException('Unable to end call');
    }
  }
}
