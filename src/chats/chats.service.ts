import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat } from 'schemas/Chat.schema';
import { CreateChatDto } from './dto/CreateChat.dto';
import { User } from 'schemas/User.schema';
import { Message } from 'schemas/Message.schema';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
  ) {}

  async createChat(
    userId: Types.ObjectId,
    createChatDto: CreateChatDto,
  ): Promise<Chat> {
    try {
      // Retrieve all users involved in the chat, including the initiating user
      const usersInChat = await this.userModel
        .find({ _id: { $in: [userId, ...createChatDto.userIds] } })
        .exec();

      // Check if all user IDs provided exist
      if (usersInChat.length !== createChatDto.userIds.length + 1) {
        throw new HttpException(
          'One or more users not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const existingChats = await this.chatModel.find({
        users: { $all: [userId, ...createChatDto.userIds] },
      });

      const exactMatchChat = existingChats.find(
        (chat) => chat.users.length === createChatDto.userIds.length + 1,
      );

      if (exactMatchChat) {
        throw new HttpException('Chat already exists', HttpStatus.BAD_REQUEST);
      }

      // Create a new chat if no existing chat is found
      const chat = new this.chatModel({
        users: [userId, ...createChatDto.userIds],
        type: createChatDto.type || 'dm',
        name: createChatDto.name || '',
      });
      await chat.save();

      // Create a new message (if provided) and associate it with the chat
      const newMessage = new this.messageModel({
        chatId: chat._id,
        senderId: userId,
        content: createChatDto.lastMessage,
        type: createChatDto.messageType,
      });
      await newMessage.save();

      // Update the chat with the last message ID
      chat.lastMessage = newMessage._id;
      await chat.save();

      // Update users with the new chat
      await this.userModel.updateMany(
        { _id: { $in: [userId, ...createChatDto.userIds] } },
        { $push: { chats: chat._id } },
        { new: true },
      );

      // Populate the newly created chat with relevant data
      let finalChat = await chat.populate({
        path: 'users',
        select: 'displayName avatarUrl status',
        populate: { path: 'status' },
      });
      finalChat = await finalChat.populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: '_id, displayName' },
      });

      return finalChat.toObject();
    } catch (err) {
      console.log(err);
      throw new HttpException(
        'Unable to create chat',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllChats(user: User): Promise<Chat[]> {
    try {
      const chats = await this.chatModel
        .find({ _id: { $in: user.chats } })
        .populate({
          path: 'users',
          select: 'displayName avatarUrl status',
          populate: { path: 'status' },
        })
        .populate({
          path: 'lastMessage',
          populate: { path: 'senderId', select: '_id, displayName' },
        })
        .sort({ updatedAt: -1 })
        .exec();

      return chats;
    } catch (error) {
      throw new Error(
        'An error occurred while retrieving chats: ' + error.message,
      );
    }
  }

  //TODO IMPLEMENT PAGINATION AND CURSORS
  async getSharedFiles(chatId: string) {
    return await this.messageModel
      .find({ chatId: chatId, type: { $ne: 'text' } })
      .sort({ createdAt: -1 });
  }

  async deleteChat(user: User, chatId: Types.ObjectId): Promise<Chat> {
    if (!chatId) {
      throw new BadRequestException('Invalid input');
    }

    try {
      const userInChat = user.chats.some((chat) => {
        return chat._id.equals(chatId);
      });

      if (!userInChat) {
        throw new BadRequestException('You are not a member of this chat');
      }

      await this.userModel.findByIdAndUpdate(
        user._id,
        { $pull: { chats: chatId } },
        { new: true },
      );

      let updatedChat = await this.chatModel.findById(chatId).exec();

      updatedChat = updatedChat.toObject();
      const otherChatUsers = updatedChat.users.filter(
        (person) => person._id.toString() !== user._id.toString(),
      );
      let persons: User[] | undefined;
      if (otherChatUsers.length > 0) {
        persons = await Promise.all(
          otherChatUsers.map((personId) => this.userModel.findById(personId)),
        );
      }
      const checkIfOtherUsersAreInChat =
        persons &&
        persons?.some((person) => {
          return person.chats.some((chat) => chat._id.equals(chatId));
        });
      if (persons.length && !checkIfOtherUsersAreInChat) {
        await this.chatModel.findByIdAndDelete(chatId);
        await this.messageModel.deleteMany({ chatId: updatedChat._id });
      }
      return updatedChat;
    } catch (err) {
      throw new BadRequestException('Unable to delete chat');
    }
  }
}
