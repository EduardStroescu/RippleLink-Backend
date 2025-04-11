import { UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Types } from 'mongoose';
import { Chat } from 'schemas/Chat.schema';
import { FileContent, Message } from 'schemas/Message.schema';
import { Server, Socket } from 'socket.io';
import { JwtGuard } from 'src/auth/guards';
import { CallsService } from 'src/calls/calls.service';
import { FileUploaderService } from 'src/fileUploader/fileUploader.provider';
import { CallDto } from 'src/lib/dtos/call.dto';
import { MessageDto } from 'src/lib/dtos/message.dto';
import { getCallDuration } from 'src/lib/utils';
import { MessagesService } from 'src/messages/messages.service';
import { RedisService } from 'src/redis/redis.service';

@WebSocketGateway({ cors: { origin: process.env.CLIENT_URL } })
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messagesService: MessagesService,
    private readonly callService: CallsService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly fileUploaderService: FileUploaderService,
  ) {}

  async handleConnection(@ConnectedSocket() socket: Socket) {
    const token = socket.handshake.headers.authorization;
    const { _id } = socket.handshake.query;

    if (!token) {
      this.handleError(socket, 'Failed to connect');
      socket.disconnect();
      return;
    }

    try {
      this.jwtService.verify(token.split(' ')[1], {
        secret: this.configService.get<string>('ACCESS_SECRET'),
      });
      await this.redisService.connectUser(_id as string);
      this.server.emit('broadcastUserStatus', {
        content: {
          _id: _id,
          isOnline: true,
        },
      });
    } catch (err) {
      if (
        err instanceof TokenExpiredError ||
        err instanceof JsonWebTokenError
      ) {
        this.handleError(socket, 'Failed to connect');
        socket.disconnect();
      }
    }
  }

  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    const { _id } = socket.handshake.query;

    try {
      await this.redisService.disconnectUser(_id as string);
      this.server.emit('broadcastUserStatus', {
        content: {
          _id: _id,
          isOnline: false,
        },
      });
    } catch (err) {
      // ignore error
    }
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string },
  ) {
    const { room } = body;

    client.join(room);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string },
  ) {
    const { room } = body;

    client.leave(room);
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId: string; isTyping: boolean },
  ) {
    const { chatId, isTyping } = body;
    const { _id, displayName } = client.handshake.query;

    client.broadcast.to(chatId).emit('interlocutorIsTyping', {
      content: { user: { _id, displayName }, isTyping },
    });
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('readMessages')
  async readMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId: string },
  ) {
    const { chatId } = body;
    const { _id } = client.handshake.query;

    try {
      const updatedChat = await this.messagesService.readMessage(
        new Types.ObjectId(_id as string),
        new Types.ObjectId(chatId),
      );
      if (updatedChat.lastMessage.senderId._id.toString() !== _id) {
        await this.redisService.updateInCacheByFilter<Message>(
          `messages?chatId=${chatId}`,
          { senderId: { $ne: _id } },
          'readBy',
          updatedChat.lastMessage.readBy,
        );
      }
      this.createOrUpdateChat(updatedChat, { type: 'update' });
      this.server.to(chatId).emit('messagesRead', {
        content: updatedChat,
      });
    } catch (err) {
      // ignore error
    }
    return { status: 'success' };
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('createMessage')
  async createMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      chatId: string;
      content: Message['content'];
      type: Message['type'];
    },
  ) {
    const { chatId, content, type } = body;
    const { _id } = client.handshake.query;
    try {
      const { newMessage, newChat } = await this.messagesService.createMessage(
        new Types.ObjectId(chatId),
        new Types.ObjectId(_id as string),
        content,
        type,
      );
      const data = await this.redisService.invalidateCacheKey(
        `messages?chatId=${chatId}`,
        newMessage,
      );

      this.createOrUpdateChat(newChat, { type: 'create' });
      this.server.to(chatId).emit('messageCreated', {
        content: data,
      });
      if (type === 'file') return { status: 'success', message: data };
      return { status: 'success' };
    } catch (err) {
      return { status: 'error', error: { message: err.message } };
    }
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('updateMessage')
  async updateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { chatId: string; messageId: string; content: Message['content'] },
  ) {
    const { chatId, messageId, content } = body;
    const { _id } = client.handshake.query;

    try {
      const { updatedMessage, updatedChat } =
        await this.messagesService.updateMessage(
          new Types.ObjectId(messageId),
          new Types.ObjectId(_id as string),
          new Types.ObjectId(chatId),
          content,
        );

      const response = await this.redisService.updateInCache(
        `messages?chatId=${chatId}`,
        updatedMessage,
      );
      if (updatedChat) {
        this.createOrUpdateChat(updatedChat, { type: 'update' });
      }

      this.server.to(chatId).emit(`messageUpdated`, {
        content: response,
      });
      return { status: 'success' };
    } catch (err) {
      return { status: 'error', error: { message: err.message } };
    }
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('deleteMessage')
  async deleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId: string; messageId: string },
  ) {
    const { chatId, messageId } = body;
    const { _id } = client.handshake.query;

    try {
      const { deletedMessage, updatedChat } =
        await this.messagesService.deleteMessage(
          new Types.ObjectId(messageId),
          new Types.ObjectId(_id as string),
          new Types.ObjectId(chatId),
        );
      const response = await this.redisService.invalidateCacheKey(
        `messages?chatId=${chatId}`,
        deletedMessage,
      );
      if (updatedChat) {
        this.createOrUpdateChat(updatedChat, { type: 'update' });
      }

      this.server.to(chatId).emit('messageDeleted', {
        content: response,
      });
      return { status: 'success' };
    } catch (err) {
      return { status: 'error', error: { message: err.message } };
    }
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('joinCall')
  async handleJoinCall(
    @MessageBody()
    body: {
      chatId: string;
      isInitiator: boolean;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { chatId, isInitiator } = body;
    const { _id } = client.handshake.query;

    try {
      if (isInitiator) {
        const newCall = await this.callService.joinCall(_id as string, chatId);
        await this.createMessage(client, {
          chatId,
          content: `Call Started`,
          type: 'event',
        });
        return { status: 'success', call: newCall };
      } else {
        try {
          const existingCall = await new Promise<CallDto>((resolve, reject) => {
            const checkInterval = setInterval(async () => {
              const iceSent =
                await this.callService.checkIfEveryoneInCallSentIce(
                  chatId,
                  _id as string,
                );

              if (iceSent) {
                clearInterval(checkInterval);
                clearTimeout(timeout);

                const call = await this.callService.joinCall(
                  _id as string,
                  chatId,
                );
                resolve(call);
              }
            }, 200);

            const timeout = setTimeout(() => {
              clearInterval(checkInterval);
              reject(new Error('Call join timeout'));
            }, 1000);
          });

          return { status: 'success', call: existingCall };
        } catch (error) {
          return { status: 'error', error: { message: error.message } };
        }
      }
    } catch (err) {
      return { status: 'error', error: { message: 'Failed to join call' } };
    }
  }

  @SubscribeMessage('sendCallEvent')
  async sendCallEvent(
    @MessageBody()
    body: {
      chatId: string;
      offer?: any;
      answer?: any;
      participantId: string;
      saveToDb?: boolean;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { chatId, offer, answer, participantId, saveToDb } = body;
    const { _id } = client.handshake.query;
    try {
      if (saveToDb) {
        await this.callService.callUpdate({
          _id: _id as string,
          chatId,
          to: participantId,
          offer,
          answer,
        });
      }
      client.broadcast
        .to(participantId)
        .emit('callEvent', { message: offer ?? answer, participantId: _id });

      return { status: 'success' };
    } catch (err) {
      return {
        status: 'error',
        error: { message: 'Failed to send call event' },
      };
    }
  }

  @SubscribeMessage('saveIceCandidates')
  async saveIceCandidates(
    @MessageBody()
    body: {
      chatId: string;
      candidatesType: 'offer' | 'answer';
      iceCandidates: string;
      to: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { chatId, candidatesType, iceCandidates, to } = body;
    const { _id } = client.handshake.query;

    try {
      const updatedCall = await this.callService.saveIceCandidates({
        _id: _id as string,
        chatId: chatId,
        iceCandidates,
        candidatesType,
        to: to,
      });
      if (updatedCall) {
        await this.updateCalls(updatedCall);
      }
      return { status: 'success' };
    } catch (err) {
      return {
        status: 'error',
        error: { message: 'Failed to update ice candidates' },
      };
    }
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('endCall')
  async endCall(
    @MessageBody() body: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { chatId } = body;
    const { _id } = client.handshake.query;

    try {
      const updatedCall = await this.callService.endCall(_id as string, chatId);
      await this.updateCalls(updatedCall);

      if (updatedCall.status === 'ended') {
        await this.createMessage(client, {
          chatId,
          content: `Call Ended ${getCallDuration(updatedCall.createdAt)}`,
          type: 'event',
        });
      }
    } catch (_) {
      // Ignore error
    }
    return { status: 'success' };
  }

  @UseGuards(JwtGuard)
  @SubscribeMessage('rejectCall')
  async rejectCall(
    @MessageBody() body: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { chatId } = body;
    const { _id } = client.handshake.query;

    try {
      const updatedCall = await this.callService.rejectCall(
        _id as string,
        chatId,
      );
      await this.updateCalls(updatedCall);
    } catch (_) {
      // Ignore error
    }
    return { status: 'success' };
  }

  @SubscribeMessage('sendChunkedFile')
  async sendChunkedFile(
    @MessageBody()
    body: {
      message: MessageDto & { content: FileContent };
      fileId: string;
      name: string;
      chunk: Buffer;
      index: number;
      totalChunks: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { message, fileId, name, chunk, index, totalChunks } = body;
    const { _id } = client.handshake.query;
    try {
      const response = await this.fileUploaderService.uploadChunkedFile(
        'other',
        _id as string,
        message,
        {
          fileId,
          name,
          chunk,
          index,
          totalChunks,
        },
      );

      if (typeof response === 'string') {
        const fileIdx = message.content.findIndex(
          (file) => file.fileId === fileId,
        );
        message.content[fileIdx].content = response;
      }

      if (response instanceof Map) {
        this.updateMessage(client, {
          chatId: message.chatId,
          messageId: message._id,
          content: message.content.map((file) => ({
            ...file,
            content: response.get(file.fileId),
          })),
        });
        return { status: 'success' };
      }

      this.server.to(message.chatId).emit(`messageUpdated`, {
        content: message,
      });
      return { status: 'success' };
    } catch (err) {
      try {
        this.deleteMessage(client, {
          chatId: message.chatId,
          messageId: message._id,
        });
      } catch (_) {
        // Ignore error
      }

      return {
        status: 'error',
        error: { message: "Couldn't send file. Please try again later!" },
      };
    }
  }

  async createOrUpdateChat(
    chat: Chat,
    options?: { type: 'create' | 'update'; existingChat?: boolean },
  ) {
    const newChatUsers = chat.users.map((user) => user._id.toString());

    if (options.type === 'create' && options.existingChat) {
      await this.redisService.invalidateCacheKey(
        `messages?chatId=${chat._id}`,
        chat.lastMessage,
      );
    }

    await Promise.all(
      newChatUsers.map((userId) =>
        this.redisService.updateInCache(`chats?userId=${userId}`, chat, {
          addNew: options.type === 'create',
        }),
      ),
    );

    // Broadcast the new chat to all online members of the chat
    if (!!newChatUsers.length) {
      this.server
        .to(newChatUsers)
        .emit('chatCreatedOrUpdated', { chat, eventType: options.type });

      if (options.type === 'create' && options.existingChat) {
        this.server.to(newChatUsers).emit('messageCreated', {
          content: chat.lastMessage,
        });
      }
    }
  }

  private async updateCalls(updatedCall: CallDto) {
    const userIds = updatedCall.chatId.users.map((user) => user._id.toString());

    // Broadcast the updated chat to all online members of the chat
    if (!!userIds.length) {
      this.server.to(userIds).emit('callsUpdated', {
        content: updatedCall,
      });
    }
  }

  private handleError(client: Socket, error: string) {
    client.emit('error', {
      message: error,
    });
  }
}
