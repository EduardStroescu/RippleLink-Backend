import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from 'schemas/Message.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
  ) {}

  async createMessage(room: string, userId: string, message: string) {
    if (!room || !userId || !message) {
      throw new HttpException('Invalid input', 400);
    }
    return await this.messageModel.create({
      userId: userId,
      chatId: room,
      content: message,
    });
  }

  async updateMessage(
    messageId: string,
    userId: string,
    room: string,
    content: string,
  ) {
    if (!messageId || !userId || !room || !content) {
      throw new HttpException('Invalid input', 400);
    }
    return await this.messageModel
      .findOneAndUpdate(
        { _id: messageId, userId: userId, chatId: room },
        { content },
        { new: true },
      )
      .exec();
  }

  async deleteMessage(messageId: string, userId: string, room: string) {
    if (!messageId || !userId) {
      throw new HttpException('Invalid input', 400);
    }
    return await this.messageModel
      .findOneAndDelete({ _id: messageId, userId: userId, chatId: room })
      .exec();
  }
  z;

  async getAllMessages(userId: string, chatId: string) {
    if (!userId || !chatId) {
      throw new HttpException('Invalid input', 400);
    }
    try {
      return await this.messageModel
        .find({ chatId: chatId })
        .populate({
          path: 'userId',
          select: 'displayName',
        })
        .sort({ createdAt: -1 })
        .exec();
    } catch (err) {
      throw new HttpException('Unable to retrieve messages', 500);
    }
  }
}
