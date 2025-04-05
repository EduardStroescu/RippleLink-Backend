import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
    const token = socket.handshake.headers['authorization'];
    const { _id } = socket.handshake.query;

    if (!token) {
      this.handleError(socket, 'Authentication token is missing');
      socket.disconnect();
      return;
    }

    try {
      this.jwtService.verify(token, {
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
      this.handleError(socket, 'Failed to connect');
      socket.disconnect();
    }
  }

  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    const { _id } = socket.handshake.query;

    await this.redisService.disconnectUser(_id as string);
    this.server.emit('broadcastUserStatus', {
      content: {
        _id: _id,
        isOnline: false,
      },
    });
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string },
  ) {
    const { room } = body;

    client.join(room);
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string },
  ) {
    const { room } = body;

    client.leave(room);
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId: string; isTyping: boolean },
  ) {
    const { chatId, isTyping } = body;
    const { _id, displayName } = client.handshake.query;

    client.broadcast.to(chatId).emit('interlocutorIsTyping', {
      content: { user: { _id, displayName }, isTyping },
    });
  }

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
      this.updateChat(updatedChat, 'update');
      this.server.to(chatId).emit('messagesRead', {
        content: updatedChat,
      });
    } catch (err) {
      // ignore error
    }
  }

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
        async () => newMessage,
      );

      this.updateChat(newChat, 'create');
      client.emit('messageCreated', { content: data });
      client.broadcast.to(chatId).emit('messageCreated', {
        content: data,
      });
      if (type === 'file') return { status: 'sent', message: newMessage };
    } catch (err) {
      this.handleError(client, err.message);
    }
  }

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
        async () => updatedMessage,
      );
      if (updatedChat) {
        this.updateChat(updatedChat, 'update');
      }

      this.server.to(chatId).emit(`messageUpdated`, {
        content: response,
      });
    } catch (err) {
      this.handleError(client, err.message);
    }
  }

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
        async () => deletedMessage,
      );
      if (updatedChat) {
        this.updateChat(updatedChat, 'delete');
      }

      this.server.to(chatId).emit('messageDeleted', {
        content: response,
      });
    } catch (err) {
      this.handleError(client, err.message);
    }
  }

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
        client.emit('callJoined', { call: newCall });
      } else {
        const checkInterval = setInterval(async () => {
          const iceSent = await this.callService.checkIfEveryoneInCallSentIce(
            chatId,
            _id as string,
          );

          if (iceSent) {
            clearInterval(checkInterval);
            clearTimeout(timeout);

            const existingCall = await this.callService.joinCall(
              _id as string,
              chatId,
            );

            client.emit('callJoined', { call: existingCall });
          }
        }, 1000);

        const maxWaitTime = 10000; // 10 seconds
        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          client.emit('callJoined', { error: 'Call join timeout' });
        }, maxWaitTime);
      }
    } catch (err) {
      this.handleError(client, 'Failed to join call');
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
    } catch (err) {
      this.handleError(client, 'Failed to send call event');
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
      if (!updatedCall) return;
      await this.updateCalls(updatedCall);
    } catch (err) {
      this.handleError(client, 'Failed to update ice candidates');
    }
  }

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
  }

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
    } catch (err) {
      this.handleError(client, err.message);
    }
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
        return { success: true };
      }

      this.server.to(message.chatId).emit(`messageUpdated`, {
        content: message,
      });
      return { success: true };
    } catch (err) {
      this.deleteMessage(client, {
        chatId: message.chatId,
        messageId: message._id,
      });

      this.handleError(client, "Couldn't send file. Please try again later!");
      return { success: false };
    }
  }

  async createChat(chat: Chat, existingChat: boolean) {
    const onlineUsers = await this.redisService.getOnlineUsers();

    const onlineUserSet = new Set(onlineUsers);
    const newChatUsers = chat.users.map((user) => user._id.toString());
    const onlineUserIds = newChatUsers.filter((userId) =>
      onlineUserSet.has(userId),
    );

    if (existingChat) {
      await this.redisService.invalidateCacheKey(
        `messages?chatId=${chat._id}`,
        async () => chat.lastMessage,
      );
    }

    await Promise.all(
      newChatUsers.map((userId) => {
        const updateCachePromise = this.redisService.updateInCache(
          `chats?userId=${userId}`,
          async () => chat,
          { addNew: true },
        );

        if (existingChat && onlineUserIds.includes(userId)) {
          this.server.to(userId).emit('messageCreated', {
            content: chat.lastMessage,
          });
        }

        return updateCachePromise;
      }),
    );

    // Broadcast the new chat to all online members of the chat
    if (!!onlineUserIds.length) {
      this.server.to(onlineUserIds).emit('chatCreated', {
        content: chat,
      });
    }
  }

  async updateChat(
    updatedChat: Chat,
    // Separation made for the eventType to be able distinguish events on the client
    eventType: 'create' | 'update' | 'delete',
  ) {
    const onlineUsers = await this.redisService.getOnlineUsers();
    const onlineUserSet = new Set(onlineUsers);
    const userIds = updatedChat.users.map((user) => user._id.toString());
    const onlineUserIds = userIds.filter((userId) => onlineUserSet.has(userId));

    // Update respective chat cache data for each user in the chat
    await Promise.all(
      userIds.map((userId) =>
        this.redisService.updateInCache(
          `chats?userId=${userId}`,
          async () => updatedChat,
          { addNew: eventType === 'create' },
        ),
      ),
    );

    // Broadcast the updated chat to all online members of the chat
    if (!!onlineUserIds.length) {
      this.server.to(onlineUserIds).emit('chatUpdated', {
        content: { ...updatedChat, eventType },
      });
    }
  }

  private async updateCalls(updatedCall: CallDto) {
    const onlineUsers = await this.redisService.getOnlineUsers();
    const onlineUserSet = new Set(onlineUsers);
    const userIds = updatedCall.chatId.users.map((user) => user._id.toString());
    const onlineUserIds = userIds.filter((userId) => onlineUserSet.has(userId));

    // Broadcast the updated chat to all online members of the chat
    if (!!onlineUserIds.length) {
      this.server.to(onlineUserIds).emit('callsUpdated', {
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
