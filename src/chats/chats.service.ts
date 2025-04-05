import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat } from 'schemas/Chat.schema';
import { CreateChatDto } from './dto/CreateChat.dto';
import { User } from 'schemas/User.schema';
import { Message } from 'schemas/Message.schema';
import { MessagesService } from 'src/messages/messages.service';
import { UpdateChatDto } from './dto/UpdateChat.dto';
import { FileUploaderService } from 'src/fileUploader/fileUploader.provider';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private readonly messageService: MessagesService,
    private readonly fileUploaderService: FileUploaderService,
  ) {}

  async getAllChats(user: User): Promise<Chat[]> {
    try {
      const chats = await this.chatModel
        .find({ _id: { $in: user.chats } })
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
        .sort({ updatedAt: -1 })
        .exec();

      return chats;
    } catch (error) {
      throw new InternalServerErrorException(
        "Couldn't retrieve chats. Please try again later!",
      );
    }
  }

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
      if (usersInChat.length !== createChatDto.userIds.length + 1)
        throw new NotFoundException('One or more users not found');

      let chat = await this.chatModel.findOne({
        users: { $all: [userId, ...createChatDto.userIds] },
        $expr: { $eq: [{ $size: '$users' }, createChatDto.userIds.length + 1] },
      });
      let wasExistingChat = false;

      if (!chat) {
        // Create a new chat if no existing chat is found
        chat = await this.chatModel.create({
          users: [userId, ...createChatDto.userIds],
          type: createChatDto.type || 'dm',
          name: createChatDto.name || '',
        });
      } else {
        wasExistingChat = true;
      }

      // Create a new message, which will also update and return the chat
      const { newChat } = await this.messageService.createMessage(
        chat._id,
        userId,
        createChatDto.lastMessage.content,
        createChatDto.lastMessage.type,
      );

      return { newChat, wasExistingChat };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'Unable to create chat. Please try again later!',
      );
    }
  }

  async getSharedFiles(userId: Types.ObjectId, chatId: string) {
    try {
      const chat = await this.chatModel.findById(chatId).exec();
      if (!chat) throw new NotFoundException('Chat not found');

      const isUserInChat = chat.users.some((user) => user.equals(userId));
      if (!isUserInChat)
        throw new UnauthorizedException("You're not a member of this chat.");

      return await this.messageModel
        .find({ chatId: chatId, type: 'file' })
        .populate({ path: 'senderId', select: '_id displayName' })
        .sort({ createdAt: -1 });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'Unable to retrieve shared files. Please try again later!',
      );
    }
  }

  async updateChat(
    userId: Types.ObjectId,
    chatId: string,
    updateChatDto: UpdateChatDto,
  ) {
    try {
      let chat = await this.chatModel.findById(chatId).exec();
      if (!chat) throw new NotFoundException('Chat not found');

      const isUserInChat = chat.users.some((user) => user.equals(userId));

      if (!isUserInChat) {
        throw new UnauthorizedException('You are not a member of this chat');
      }

      chat.set(updateChatDto);

      chat = await chat.save();
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

      return chat;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'Unable to update chat. Please try again later!',
      );
    }
  }

  async deleteChat(user: User, chatId: Types.ObjectId): Promise<Chat> {
    try {
      const chat = (await this.chatModel.findById(chatId).exec())?.toObject();
      if (!chat) throw new NotFoundException('Chat not found');

      const userInChat = chat.users.some((chatUser) =>
        chatUser.equals(user._id),
      );

      if (!userInChat) {
        throw new UnauthorizedException('You are not a member of this chat');
      }

      const otherChatUsers = chat.users.filter(
        (person) => !person.equals(user._id),
      );
      const [persons] = await Promise.all([
        !!otherChatUsers.length
          ? await this.userModel
              .find({
                _id: { $in: otherChatUsers },
              })
              .exec()
          : Promise.resolve([]),
        this.userModel.findByIdAndUpdate(user._id, {
          $pull: { chats: chatId },
        }),
      ]);

      const checkIfOtherUsersAreInChat = persons.some((person) =>
        person.chats.some((chat) => chat.equals(chatId)),
      );
      if (!!persons.length && !checkIfOtherUsersAreInChat) {
        await this.deleteAllContentForChat(chatId, chat);
      }

      return chat;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        'Unable to delete chat. Please try again later!',
      );
    }
  }

  private async deleteAllContentForChat(
    chatId: Types.ObjectId,
    updatedChat: Chat,
  ) {
    const [fileMessages] = await Promise.all([
      this.messageModel.find({ chatId: updatedChat._id, type: 'file' }).exec(),
      this.chatModel.findByIdAndDelete(chatId),
    ]);

    const fileKeysToDelete = fileMessages.flatMap((message) =>
      Array.isArray(message.content)
        ? message.content.map(
            (file) =>
              `${message.senderId}-files/${file.content.split('/').pop()}`,
          )
        : [],
    );

    if (fileKeysToDelete.length > 0) {
      this.fileUploaderService.removeFiles(fileKeysToDelete);
    }

    await this.messageModel.deleteMany({ chatId: updatedChat._id });
  }
}
