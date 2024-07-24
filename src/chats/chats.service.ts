import { HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat } from 'schemas/Chat.schema';
import { CreateChatDto } from './dto/CreateChat.dto';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ChatsService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<Chat>,
    private readonly usersService: UsersService,
  ) {}

  async createChat({
    userId,
    ...createChatDto
  }: {
    userId: string;
    createChatDto: CreateChatDto;
  }) {
    // const findUser = await this.usersService.getUserById(userId);
    // if (!findUser) throw new HttpException('User not found', 404);
    // const newChat = new this.chatModel(createChatDto);
    // const savedChat = await newChat.save();
    // await findUser.updateOne({
    //   $push: { chats: savedChat._id },
    // });
    // return savedChat;
  }

  async getAllChats(userId: string) {
    return this.chatModel
      .find({ users: userId })
      .populate({
        path: 'users',
        select: 'displayName',
      })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findChatById(chatId: string) {}
}
