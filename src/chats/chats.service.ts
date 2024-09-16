import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat } from 'schemas/Chat.schema';
import { CreateChatDto } from './dto/CreateChat.dto';
import { User } from 'schemas/User.schema';
import { Message } from 'schemas/Message.schema';
import { MessagesService } from 'src/messages/messages.service';
import { UpdateChatDto } from './dto/UpdateChat.dto';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private readonly messageService: MessagesService,
  ) {}

  async createChat(
    userId: Types.ObjectId,
    createChatDto: CreateChatDto,
  ): Promise<{ newChat: Chat; wasExistingChat: boolean }> {
    try {
      // Retrieve all users involved in the chat, including the initiating user
      const usersInChat = await this.userModel
        .find({ _id: { $in: [userId, ...createChatDto.userIds] } })
        .exec();

      // Check if all user IDs provided exist
      if (usersInChat.length !== createChatDto.userIds.length + 1) {
        throw new NotFoundException('One or more users not found');
      }

      let chat = await this.chatModel.findOne({
        users: { $all: [userId, ...createChatDto.userIds] },
        $expr: { $eq: [{ $size: '$users' }, createChatDto.userIds.length + 1] },
      });
      let wasExistingChat = false;

      if (!chat) {
        // Create a new chat if no existing chat is found
        chat = new this.chatModel({
          users: [userId, ...createChatDto.userIds],
          type: createChatDto.type || 'dm',
          name: createChatDto.name || '',
        });
        await chat.save();
      } else {
        wasExistingChat = true;
      }

      // Create a new message (if provided) and associate it with the chat
      const { newMessage } = await this.messageService.createMessage(
        chat._id,
        userId,
        createChatDto.lastMessage,
        createChatDto.messageType,
      );

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
        select: 'displayName avatarUrl',
      });
      finalChat = await finalChat.populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'displayName' },
      });

      return { newChat: finalChat.toObject(), wasExistingChat };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException('Unable to create chat');
    }
  }

  async getAllChats(user: User): Promise<Chat[]> {
    try {
      const chats = await this.chatModel
        .find({ _id: { $in: user.chats } })
        .populate({
          path: 'users',
          select: 'displayName avatarUrl',
        })
        .populate({
          path: 'lastMessage',
          populate: { path: 'senderId', select: 'displayName' },
        })
        .sort({ updatedAt: -1 })
        .exec();

      return chats;
    } catch (error) {
      throw new InternalServerErrorException("Couldn't retrieve chats");
    }
  }

  async getSharedFiles(chatId: string) {
    try {
      return await this.messageModel
        .find({ chatId: chatId, type: { $ne: 'text' } })
        .sort({ createdAt: -1 });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException('Unable to retrieve shared files');
    }
  }

  async updateChat(chatId: string, updateChatDto: UpdateChatDto) {
    try {
      let updatedChat = await this.chatModel
        .findByIdAndUpdate(chatId, updateChatDto, { new: true })
        .exec();
      if (!updatedChat) {
        throw new BadRequestException('Chat not found');
      }

      updatedChat = await updatedChat.populate({
        path: 'users',
        select: 'displayName avatarUrl',
      });
      updatedChat = await updatedChat.populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'displayName' },
      });
      return updatedChat.toObject();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException('Unable to update chat');
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
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException('Unable to delete chat');
    }
  }
}
