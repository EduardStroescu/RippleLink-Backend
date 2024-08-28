import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat } from 'schemas/Chat.schema';
import { Message } from 'schemas/Message.schema';
import { User } from 'schemas/User.schema';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<Message>,
    @InjectModel(Chat.name) private chatsModel: Model<Chat>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createMessage(
    room: Types.ObjectId,
    userId: Types.ObjectId,
    message: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'file',
  ): Promise<{ newMessage: Message; newChat: Chat }> {
    if (!room || !userId || !message) {
      throw new BadRequestException('Invalid input');
    }
    try {
      let newMessage;

      if (type !== 'text') {
        const sender = await this.userModel.findById(userId).exec();
        if (sender) {
          const contentUrl =
            type === 'image'
              ? await this.cloudinaryService.uploadImageFile(message)
              : await this.cloudinaryService.uploadOtherFileTypes(message);

          newMessage = await this.messageModel.create({
            senderId: userId,
            chatId: room,
            content: contentUrl.url,
            type: type,
          });
        }
      } else {
        newMessage = await this.messageModel.create({
          senderId: userId,
          chatId: room,
          content: message,
          type: type,
        });
      }

      const newChat = await this.chatsModel
        .findByIdAndUpdate(
          room,
          {
            lastMessage: newMessage._id,
          },
          { new: true },
        )
        .populate({
          path: 'users',
          select: 'displayName avatarUrl status',
          populate: { path: 'status' },
        })
        .populate({
          path: 'lastMessage',
          populate: { path: 'senderId', select: 'displayName' },
        });

      const interlocutorId = newChat
        .toObject()
        .users.filter(
          (user) => user._id.toString() !== userId.toString(),
        )[0]._id;

      const interlocutor = await this.userModel.findById(interlocutorId).exec();
      if (!interlocutor.chats.includes(newChat._id)) {
        await interlocutor.updateOne({ $push: { chats: newChat._id } });
      }

      newMessage = await newMessage.populate({
        path: 'senderId',
        select: 'displayName',
      });
      return { newMessage: newMessage.toObject(), newChat: newChat.toObject() };
    } catch (err) {
      throw new HttpException(
        'Unable to create message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateMessage(
    messageId: Types.ObjectId,
    userId: Types.ObjectId,
    room: Types.ObjectId,
    content: string,
  ): Promise<{ updatedMessage: Message; updatedChat: Chat | null }> {
    if (!messageId || !userId || !room || !content) {
      throw new BadRequestException('Invalid input');
    }
    try {
      let updatedMessage = await this.messageModel
        .findOneAndUpdate(
          { _id: messageId, senderId: userId, chatId: room },
          { content },
          { new: true },
        )
        .exec();

      let updatedChat = await this.chatsModel.findById(room).exec();

      if (updatedChat.lastMessage.equals(updatedMessage._id)) {
        await updatedChat.updateOne(room, {
          $set: { lastMessage: updatedMessage._id },
        });

        updatedChat = await this.chatsModel
          .findById(room)
          .populate({
            path: 'users',
            select: 'displayName avatarUrl status',
            populate: { path: 'status' },
          })
          .populate({
            path: 'lastMessage',
            populate: { path: 'senderId', select: 'displayName' },
          })
          .exec();
      } else {
        updatedChat = null;
      }

      updatedMessage = await updatedMessage.populate({
        path: 'senderId',
        select: '_id, displayName',
      });
      return {
        updatedMessage: updatedMessage.toObject(),
        updatedChat: updatedChat ? updatedChat.toObject() : null,
      };
    } catch (err) {
      throw new HttpException(
        'Unable to update message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteMessage(
    messageId: Types.ObjectId,
    userId: Types.ObjectId,
    room: Types.ObjectId,
  ): Promise<{ deletedMessage: Message; updatedChat: Chat }> {
    if (!messageId || !userId) {
      throw new BadRequestException('Invalid input');
    }
    try {
      const deletedMessage = await this.messageModel
        .findOne({ _id: messageId, senderId: userId, chatId: room })
        .exec();

      if (!deletedMessage) {
        throw new NotFoundException('Message not found');
      }

      if (deletedMessage.type !== 'text') {
        const publicId = deletedMessage.content.split('/').pop().split('.')[0];
        await this.cloudinaryService.removeFile(publicId);
      }

      const latestMessages = await this.messageModel
        .find({ chatId: room })
        .limit(2)
        .sort({ createdAt: -1 })
        .exec();

      // Update the chat's last message if the deleted message is the latest message
      let updatedChat: Chat | undefined;
      if (
        latestMessages.length > 1 &&
        latestMessages[0]._id.toString() === deletedMessage._id.toString()
      ) {
        updatedChat = await this.chatsModel
          .findByIdAndUpdate(
            room,
            {
              $set: { lastMessage: latestMessages[1]._id },
            },
            { new: true },
          )
          .populate({
            path: 'users',
            select: 'displayName avatarUrl status',
            populate: { path: 'status' },
          })
          .populate({
            path: 'lastMessage',
            populate: { path: 'senderId', select: 'displayName' },
          })
          .exec();
      }

      await deletedMessage.deleteOne();
      return {
        deletedMessage: deletedMessage.toObject(),
        updatedChat: updatedChat?.toObject(),
      };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        'Unable to delete message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async readMessage(userId: Types.ObjectId, room: Types.ObjectId) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.chats.some((chat) => chat._id.equals(room))) {
      throw new NotFoundException('User not in chat');
    }
    await this.messageModel.updateMany(
      { chatId: room, senderId: { $ne: userId }, read: false },
      { $set: { read: true } },
    );
    const updatedChat = await this.chatsModel
      .findById(room)
      .populate({
        path: 'users',
        select: 'displayName avatarUrl status',
        populate: { path: 'status' },
      })
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: 'displayName' },
      })
      .exec();
    return updatedChat.toObject();
  }

  async getAllMessages(userId: Types.ObjectId, chatId: Types.ObjectId) {
    if (!userId || !chatId) {
      throw new BadRequestException('Invalid input');
    }
    try {
      const data = await this.messageModel
        .find({ chatId: chatId })
        .populate({
          path: 'senderId',
          select: 'displayName',
        })
        .populate({ path: 'chatId' })
        .sort({ createdAt: 1 })
        .exec();
      return data;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        'Unable to retrieve messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
