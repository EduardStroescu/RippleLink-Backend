import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat } from 'schemas/Chat.schema';
import { Message } from 'schemas/Message.schema';
import { User } from 'schemas/User.schema';
import { FileUploaderService } from 'src/fileUploader/fileUploader.provider';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
    @InjectModel(Chat.name) private chatsModel: Model<Chat>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly fileUploaderService: FileUploaderService,
  ) {}

  async getAllMessages(
    userId: Types.ObjectId,
    chatId: Types.ObjectId,
    cursor?: string,
    limit: number = 20,
  ) {
    if (!chatId) {
      throw new BadRequestException('Invalid chat id');
    }

    try {
      const chat = await this.chatsModel.findOne({ _id: chatId });
      const isUserInChat = chat.users.some((user) => user.equals(userId));
      if (!isUserInChat)
        throw new UnauthorizedException('You are not a member of the chat');

      const query: any = { chatId };
      if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
      }

      const messages = (
        await this.messageModel
          .find(query)
          .populate([
            {
              path: 'senderId',
              select: 'displayName',
              transform: (doc, id) =>
                doc || { _id: id, displayName: 'Server Event' },
            },
            {
              path: 'readBy.userId',
              model: 'User',
              select: '_id displayName avatarUrl',
            },
          ])
          .sort({ createdAt: -1 }) // Sort from newest to oldest
          .limit(limit)
          .exec()
      ).reverse();

      // Prepare the next cursor (oldest message's `createdAt`)
      const nextCursor =
        messages.length > 0 ? messages[0].createdAt.toISOString() : null;

      return {
        messages,
        nextCursor,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'An unexpected error occurred. Please try again later!',
      );
    }
  }

  async createMessage(
    chatId: Types.ObjectId,
    userId: Types.ObjectId,
    content: Message['content'],
    type: 'text' | 'file' | 'event',
  ): Promise<{ newMessage: Message; newChat: Chat }> {
    if (!chatId || !userId || !content) {
      throw new BadRequestException('Invalid input');
    }
    try {
      let newMessage: Message;

      newMessage = await this.messageModel.create({
        senderId: type !== 'event' ? userId : new Types.ObjectId(),
        chatId,
        content,
        type,
        readBy:
          type === 'event'
            ? [{ userId: userId.toString(), timestamp: new Date() }]
            : [],
      });

      const newChat = (
        await this.chatsModel
          .findByIdAndUpdate(
            chatId,
            {
              lastMessage: newMessage._id,
            },
            { new: true },
          )
          .populate([
            {
              path: 'users',
              select: 'displayName avatarUrl',
            },
            {
              path: 'lastMessage',
              populate: [
                {
                  path: 'senderId',
                  select: 'displayName',
                  transform: (doc, id) =>
                    doc || { _id: id, displayName: 'Server Event' },
                },
                {
                  path: 'readBy.userId',
                  model: 'User',
                  select: '_id displayName avatarUrl',
                },
              ],
            },
          ])
      )?.toObject();

      if (!newChat) throw new NotFoundException('Chat not found');

      const interlocutorIds = newChat.users
        .filter((user) => user._id.toString() !== userId.toString())
        .map((user) => user._id);

      const interlocutors = await this.userModel
        .find({ _id: { $in: interlocutorIds } })
        .exec();
      const interlocutorsWithoutChat = interlocutors
        .filter((interlocutor) => !interlocutor.chats.includes(newChat._id))
        .map((interlocutor) => interlocutor._id);
      if (!!interlocutorsWithoutChat.length) {
        await this.userModel.updateMany(
          { _id: { $in: [interlocutorsWithoutChat] } },
          {
            $addToSet: { chats: newChat._id },
          },
        );
      }

      newMessage = (
        await newMessage.populate([
          {
            path: 'senderId',
            select: 'displayName',
            transform: (doc, id) =>
              doc || { _id: id, displayName: 'Server Event' },
          },
          {
            path: 'readBy.userId',
            model: 'User',
            select: '_id displayName avatarUrl',
          },
        ])
      )?.toObject();

      return { newMessage, newChat };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'Unable to create message. Please try again later!',
      );
    }
  }

  async updateMessage(
    messageId: Types.ObjectId,
    userId: Types.ObjectId,
    chatId: Types.ObjectId,
    content: Message['content'],
  ): Promise<{ updatedMessage: Message; updatedChat: Chat | null }> {
    if (!messageId || !userId || !chatId || !content)
      throw new BadRequestException('Invalid input');

    try {
      let updatedMessage = await this.messageModel
        .findOneAndUpdate(
          { _id: messageId, senderId: userId, chatId },
          { content },
          { new: true },
        )
        .exec();

      if (!updatedMessage) throw new NotFoundException('Message not found');

      let updatedChat: Chat | null = await this.chatsModel
        .findById(chatId)
        .exec();

      if (updatedChat.lastMessage.equals(updatedMessage._id)) {
        await updatedChat.updateOne(chatId, {
          $set: { lastMessage: updatedMessage._id },
        });

        updatedChat = (
          await this.chatsModel
            .findById(chatId)
            .populate([
              {
                path: 'users',
                select: 'displayName avatarUrl',
              },
              {
                path: 'lastMessage',
                populate: [
                  {
                    path: 'senderId',
                    select: 'displayName',
                  },
                  {
                    path: 'readBy.userId',
                    model: 'User',
                    select: '_id displayName avatarUrl',
                  },
                ],
              },
            ])
            .exec()
        )?.toObject();
      } else {
        updatedChat = null;
      }

      updatedMessage = (
        await updatedMessage.populate([
          {
            path: 'senderId',
            select: '_id, displayName',
          },
          {
            path: 'readBy.userId',
            model: 'User',
            select: '_id displayName avatarUrl',
          },
        ])
      ).toObject();
      return {
        updatedMessage,
        updatedChat,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'Unable to update message. Please try again later!',
      );
    }
  }

  async deleteMessage(
    messageId: Types.ObjectId,
    userId: Types.ObjectId,
    chatId: Types.ObjectId,
  ): Promise<{ deletedMessage: Message; updatedChat: Chat }> {
    if (!messageId || !userId) {
      throw new Error('Invalid input');
    }

    try {
      const deletedMessage = await this.messageModel
        .findOne({ _id: messageId, senderId: userId, chatId })
        .exec();

      if (!deletedMessage) throw new NotFoundException('Message not found');

      if (
        deletedMessage.type === 'file' &&
        Array.isArray(deletedMessage.content)
      ) {
        this.fileUploaderService.removeFiles(
          deletedMessage.content.map((file) => {
            return `${userId}-files/` + file.content.split('/').pop();
          }),
        );
      }

      const latestMessages = await this.messageModel
        .find({ chatId })
        .limit(2)
        .sort({ createdAt: -1 })
        .exec();

      // Update the chat's last message if the deleted message is the latest message
      let updatedChat: Chat | undefined;
      if (
        latestMessages.length > 1 &&
        latestMessages[0]._id.toString() === deletedMessage._id.toString()
      ) {
        updatedChat = (
          await this.chatsModel
            .findByIdAndUpdate(
              chatId,
              {
                $set: { lastMessage: latestMessages[1]._id },
              },
              { new: true },
            )
            .populate([
              {
                path: 'users',
                select: 'displayName avatarUrl',
              },
              {
                path: 'lastMessage',
                populate: [
                  {
                    path: 'senderId',
                    select: 'displayName',
                    transform: (doc, id) =>
                      doc || { _id: id, displayName: 'Server Event' },
                  },
                  {
                    path: 'readBy.userId',
                    model: 'User',
                    select: '_id displayName avatarUrl',
                  },
                ],
              },
            ])
            .exec()
        )?.toObject();
      }

      await deletedMessage.deleteOne();
      return {
        deletedMessage: deletedMessage.toObject(),
        updatedChat,
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new InternalServerErrorException(
        'Unable to delete message. Please try again later!',
      );
    }
  }

  async readMessage(userId: Types.ObjectId, chatId: Types.ObjectId) {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (!user.chats.some((chat) => chat.equals(chatId))) {
        throw new NotFoundException('User not in chat');
      }
      await this.messageModel.updateMany(
        {
          chatId,
          senderId: { $ne: userId },
          'readBy.userId': { $ne: userId },
        },
        { $addToSet: { readBy: { userId, timestamp: new Date() } } },
      );
      const newChat = (
        await this.chatsModel
          .findById(chatId)
          .populate([
            {
              path: 'users',
              select: 'displayName avatarUrl',
            },
            {
              path: 'lastMessage',
              populate: [
                {
                  path: 'senderId',
                  select: 'displayName',
                  transform: (doc, id) =>
                    doc || { _id: id, displayName: 'Server Event' },
                },
                {
                  path: 'readBy.userId',
                  model: 'User',
                  select: '_id displayName avatarUrl',
                },
              ],
            },
          ])
          .exec()
      )?.toObject();
      return newChat as typeof newChat & {
        users: { _id: Types.ObjectId; displayName: User['displayName'] }[];
        lastMessage: Message;
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new InternalServerErrorException(
        'Unable to mark messages as read. Please try again later!',
      );
    }
  }
}
