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
  ): Promise<{ newChat: Chat | undefined; updatedChat: Chat | undefined }> {
    try {
      const [user1, user2] = await Promise.all([
        this.userModel
          .findById(userId)
          .populate({
            path: 'chats',
            select: '_id, users',
            populate: { path: 'users' },
          })
          .exec(),
        this.userModel
          .findById(createChatDto.userId)
          .populate({
            path: 'chats',
            select: '_id, users',
            populate: { path: 'users' },
          })
          .exec(),
      ]);

      // Check if users exist
      if (!user1 || !user2) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const populatedChatsUser2 = user2.toObject().chats as any;
      const chatAlreadyExists = populatedChatsUser2.find(
        (chat) =>
          chat.users.some((user) => user._id.equals(userId)) &&
          chat.users.some((user) => user._id.equals(createChatDto.userId)),
      );

      let chat;
      if (chatAlreadyExists) {
        const chatId = chatAlreadyExists._id;
        chat = await this.chatModel.findById(chatId);
      } else {
        // Create new chat
        chat = new this.chatModel({
          users: [userId, createChatDto.userId],
          type: createChatDto.type || 'dm',
          name: createChatDto.name || '',
        });
        await chat.save();
      }

      // Create a new message
      const newMessage = new this.messageModel({
        chatId: chat._id,
        senderId: userId,
        content: createChatDto.lastMessage,
        type: createChatDto.messageType,
      });
      await newMessage.save();

      // Update new chat with the last message ID
      chat.lastMessage = newMessage._id;
      await chat.save(); // Save the updated chat document

      // Update users with the new chat
      await Promise.all(
        [user1, user2].map((user) =>
          this.userModel.findByIdAndUpdate(
            user._id,
            {
              $push: { chats: chat._id },
            },
            { new: true },
          ),
        ),
      );

      let finalChat = await chat.populate({
        path: 'users',
        select: 'displayName avatarUrl status',
        populate: { path: 'status' },
      });
      finalChat = await finalChat.populate({
        path: 'lastMessage',
        populate: { path: 'senderId' },
      });

      return {
        newChat: chatAlreadyExists ? undefined : finalChat.toObject(),
        updatedChat: chatAlreadyExists ? finalChat.toObject() : undefined,
      };
    } catch (err) {
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
          populate: { path: 'senderId' },
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

      let updatedChat = await this.chatModel
        .findById(chatId)
        .populate({
          path: 'users',
          select: 'displayName avatarUrl status',
          populate: { path: 'status' },
        })
        .populate({
          path: 'lastMessage',
          populate: { path: 'senderId' },
        });

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
