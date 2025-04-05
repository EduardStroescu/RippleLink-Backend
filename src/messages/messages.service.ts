import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
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

      const query: FilterQuery<Message> = { chatId };
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
        messages: messages,
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
      let chat = await this.chatsModel.findById(chatId).exec();
      if (!chat) throw new NotFoundException('Chat not found');

      const isUserInChat = chat.users.some((user) => user.equals(userId));
      if (!isUserInChat)
        throw new UnauthorizedException('You are not a member of the chat');

      const message = await this.messageModel.create({
        _id: new Types.ObjectId(),
        senderId: type !== 'event' ? userId : new Types.ObjectId(),
        chatId,
        content,
        type,
        readBy:
          type === 'event'
            ? [{ userId: userId.toString(), timestamp: new Date() }]
            : [],
      });

      chat.lastMessage = message._id;
      chat = await chat.save();
      const interlocutorIds = chat.users;

      const [newChat, newMessage, interlocutors] = await Promise.all([
        chat.populate([
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
        ]),
        message.populate([
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
        ]),
        this.userModel.find({ _id: { $in: interlocutorIds } }).exec(),
      ]);

      const interlocutorsWithoutChat = interlocutors
        .filter((interlocutor) => !interlocutor.chats.includes(newChat._id))
        .map((interlocutor) => interlocutor._id);
      if (!!interlocutorsWithoutChat.length) {
        await this.userModel.updateMany(
          { _id: { $in: interlocutorsWithoutChat } },
          {
            $addToSet: { chats: newChat._id },
          },
        );
      }

      return { newMessage: newMessage.toObject(), newChat: newChat.toObject() };
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
      const chat = await this.chatsModel.findById(chatId).exec();
      if (!chat) throw new NotFoundException('Chat not found');

      const userInChat = chat.users.some((user) => user.equals(userId));
      if (!userInChat)
        throw new UnauthorizedException('You are not a member of the chat');

      const newMessage = await this.messageModel
        .findOneAndUpdate(
          { _id: messageId, senderId: userId, chatId },
          { content },
          { new: true },
        )
        .exec();

      if (!newMessage) throw new NotFoundException('Message not found');

      const [updatedMessage, updatedChat] = await Promise.all([
        newMessage.populate([
          {
            path: 'senderId',
            select: '_id, displayName',
          },
          {
            path: 'readBy.userId',
            model: 'User',
            select: '_id displayName avatarUrl',
          },
        ]),
        chat.lastMessage.equals(newMessage._id)
          ? chat.populate([
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
          : Promise.resolve(null),
      ]);

      return {
        updatedMessage: updatedMessage.toObject(),
        updatedChat: updatedChat?.toObject() ?? null,
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
    if (!messageId || !userId || !chatId) {
      throw new Error('Invalid input');
    }

    try {
      const chat = await this.chatsModel.findById(chatId).exec();
      if (!chat) throw new NotFoundException('Chat not found');

      const userInChat = chat.users.some((user) => user.equals(userId));
      if (!userInChat)
        throw new UnauthorizedException('You are not a member of the chat');

      const [deletedMessage, latestMessages] = await Promise.all([
        this.messageModel
          .findOne({ _id: messageId, senderId: userId, chatId })
          .exec(),
        this.messageModel
          .find({ chatId })
          .limit(2)
          .sort({ createdAt: -1 })
          .exec(),
      ]);

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

      // Update the chat's last message if the deleted message is the latest message
      let updatedChat: Chat | null = null;
      if (
        latestMessages.length > 1 &&
        deletedMessage._id.equals(latestMessages[0]._id)
      ) {
        const [newChat] = await Promise.all([
          this.chatsModel
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
            .exec(),
          deletedMessage.deleteOne(),
        ]);
        updatedChat = newChat?.toObject() ?? null;
      }

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
      let chat = await this.chatsModel.findById(chatId).exec();
      if (!chat) throw new NotFoundException('Chat not found');

      const userInChat = chat.users.some((user) => user.equals(userId));

      if (!userInChat)
        throw new UnauthorizedException('You are not a member of the chat');

      const timestamp = new Date();
      await this.messageModel.updateMany(
        {
          chatId,
          senderId: { $ne: userId },
          'readBy.userId': { $ne: userId },
        },
        { $addToSet: { readBy: { userId, timestamp } } },
      );

      chat = (
        await chat.populate([
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

      return chat as typeof chat & {
        users: {
          _id: Types.ObjectId;
          displayName: User['displayName'];
          avatarUrl: User['avatarUrl'];
        }[];
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
