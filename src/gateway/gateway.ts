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
import { Message } from 'schemas/Message.schema';
import { Server, Socket } from 'socket.io';
import { CallsService } from 'src/calls/calls.service';
import { CallDto } from 'src/lib/dtos/call.dto';
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
    @MessageBody() body: { room: string; isTyping: boolean },
  ) {
    const { room, isTyping } = body;
    const { _id, displayName } = client.handshake.query;

    client.broadcast.to(room).emit('interlocutorIsTyping', {
      content: { user: { _id, displayName }, isTyping },
    });
  }

  @SubscribeMessage('createMessage')
  async createMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      room: string;
      message: string;
      type: 'text' | 'image' | 'video' | 'audio' | 'file';
      tempId?: string;
    },
  ) {
    const { room, message, type, tempId } = body;
    const { _id } = client.handshake.query;
    try {
      const { newMessage, newChat } = await this.messagesService.createMessage(
        new Types.ObjectId(room),
        new Types.ObjectId(_id as string),
        message,
        type,
      );
      const data = await this.redisService.invalidateCacheKey(
        `messages?chatId=${room}`,
        async () => newMessage,
      );

      this.updateChat(newChat, 'create');
      client.emit('messageCreated', { content: { ...data, tempId } });
      client.broadcast.to(room).emit('messageCreated', {
        content: data,
      });
    } catch (err) {
      this.handleError(client, err.message);
    }
  }

  @SubscribeMessage('updateMessage')
  async updateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string; messageId: string; message: string },
  ) {
    const { room, messageId, message } = body;
    const { _id } = client.handshake.query;

    try {
      const { updatedMessage, updatedChat } =
        await this.messagesService.updateMessage(
          new Types.ObjectId(messageId),
          new Types.ObjectId(_id as string),
          new Types.ObjectId(room),
          message,
        );

      const response = await this.redisService.invalidateCacheKey(
        `messages?chatId=${room}`,
        async () => updatedMessage,
      );
      if (updatedChat) {
        this.updateChat(updatedChat, 'update');
      }

      this.server.to(room).emit(`messageUpdated`, {
        content: response,
      });
    } catch (err) {
      this.handleError(client, err.message);
    }
  }

  @SubscribeMessage('deleteMessage')
  async deleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string; messageId: string },
  ) {
    const { room, messageId } = body;
    const { _id } = client.handshake.query;

    try {
      const { deletedMessage, updatedChat } =
        await this.messagesService.deleteMessage(
          new Types.ObjectId(messageId),
          new Types.ObjectId(_id as string),
          new Types.ObjectId(room),
        );
      const response = await this.redisService.invalidateCacheKey(
        `messages?chatId=${room}`,
        async () => deletedMessage,
      );
      if (updatedChat) {
        this.updateChat(updatedChat, 'delete');
      }

      this.server.to(room).emit('messageDeleted', {
        content: response,
      });
    } catch (err) {
      this.handleError(client, err.message);
    }
  }

  @SubscribeMessage('readMessages')
  async readMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string },
  ) {
    const { room } = body;
    const { _id } = client.handshake.query;

    try {
      const updatedChat = await this.messagesService.readMessage(
        new Types.ObjectId(_id as string),
        new Types.ObjectId(room),
      );
      await this.redisService.updateInCacheByFilter<Message>(
        `messages?chatId=${room}`,
        { senderId: { $ne: _id as string } },
        'read',
        true,
      );
      this.updateChat(updatedChat, 'update');
      this.server.to(room).emit('messagesRead', {
        content: updatedChat,
      });
    } catch (err) {
      this.handleError(client, 'Failed to mark messages as read');
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
        const updatedCall = await this.callService.joinCall(
          new Types.ObjectId(_id as string),
          new Types.ObjectId(chatId),
        );
        client.emit('callJoined', { call: updatedCall });
      } else {
        const call = await this.callService.getCall(new Types.ObjectId(chatId));

        const checkInterval = setInterval(async () => {
          const iceSent = await this.callService.checkIfEveryoneInCallSentIce(
            new Types.ObjectId(call._id),
            new Types.ObjectId(_id as string),
          );

          if (iceSent) {
            clearInterval(checkInterval);
            clearTimeout(timeout);

            const updatedCall = await this.callService.joinCall(
              new Types.ObjectId(_id as string),
              new Types.ObjectId(chatId),
            );

            client.emit('callJoined', { call: updatedCall });
          }
        }, 1000);

        const maxWaitTime = 10000; // 10 seconds
        const timeout = setTimeout(() => {
          clearInterval(checkInterval);
          client.emit('callJoined', { error: 'Call timeout' });
        }, maxWaitTime);
      }
    } catch (err) {
      this.handleError(client, 'Failed to join call');
    }
  }

  @SubscribeMessage('initiateCall')
  async initiateCall(
    @MessageBody()
    body: {
      chatId: string;
      offer?: any;
      participantId: string;
      saveToDb?: boolean;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { chatId, offer, participantId, saveToDb } = body;
    const { _id } = client.handshake.query;
    try {
      if (saveToDb) {
        await this.callService.callUpdate({
          _id: new Types.ObjectId(_id as string),
          chatId: new Types.ObjectId(chatId),
          to: new Types.ObjectId(participantId),
          offer,
        });
      }
      client.broadcast
        .to(participantId)
        .emit('callCreated', { offer, participantId: _id });
    } catch (err) {
      this.handleError(client, 'Failed to create call');
    }
  }

  @SubscribeMessage('sendCallAnswer')
  async answerCall(
    @MessageBody()
    body: {
      chatId: string;
      answer?: any;
      participantId: string;
      saveToDb?: boolean;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { chatId, answer, participantId, saveToDb } = body;
    const { _id } = client.handshake.query;
    try {
      if (saveToDb) {
        const updatedCall = await this.callService.callUpdate({
          _id: new Types.ObjectId(_id as string),
          chatId: new Types.ObjectId(chatId),
          to: new Types.ObjectId(participantId),
          answer,
        });
        await this.updateCalls(updatedCall);
      }
      client.broadcast
        .to(participantId)
        .emit('callAnswered', { answer, participantId: _id });
    } catch (err) {
      this.handleError(client, 'Failed to answer call');
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
      const updatedCall = await this.callService.queueIceCandidates({
        _id: new Types.ObjectId(_id as string),
        chatId: new Types.ObjectId(chatId),
        iceCandidates,
        candidatesType,
        to: new Types.ObjectId(to),
      });
      if (!updatedCall) return;
      await this.updateCalls(updatedCall);
    } catch (err) {
      this.handleError(client, 'Failed to update ice candidates');
    }
  }

  @SubscribeMessage('endCall')
  async endCall(
    @MessageBody() body: { callId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    const { callId } = body;
    const { _id } = client.handshake.query;

    try {
      const { updatedCall, callEnded } = await this.callService.endCall(
        new Types.ObjectId(_id as string),
        new Types.ObjectId(callId),
      );
      if (!callEnded) {
        await this.updateCalls(updatedCall);
      } else {
        await this.deleteCalls({ ...updatedCall, callEnded });
      }
    } catch (err) {
      this.handleError(client, err.message);
    }
  }

  async createChat(
    chatCreatorId: Types.ObjectId,
    chat: Chat,
    existingChat: boolean,
  ) {
    const onlineUsers = (await this.redisService.getOnlineUsers())?.filter(
      (id) => id !== chatCreatorId.toString(),
    );

    const onlineUserSet = new Set(onlineUsers);
    const onlineUserIds = chat.users
      .map((user) => user._id.toString())
      .filter((userId) => onlineUserSet.has(userId));

    const newChatUsers = chat.users.map((user) => user._id.toString());

    await this.redisService.invalidateCacheKey(
      `messages?chatId=${chat._id}`,
      async () => chat.lastMessage,
    );

    newChatUsers.forEach((userId) => {
      if (!existingChat) {
        this.redisService.addToCache(
          `chats?userId=${userId}`,
          async () => chat,
        );
      } else {
        this.redisService.updateInCache(
          `chats?userId=${userId}`,
          async () => chat,
        );
        this.server.to(String(chat._id)).emit('messageCreated', {
          content: chat.lastMessage,
        });
      }
    });

    // Broadcast the new chat to all online members of the chat
    if (!!onlineUserIds.length) {
      this.server.to(onlineUserIds).emit('chatCreated', {
        content: { ...chat },
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
    userIds.forEach((userId) =>
      this.redisService.updateInCache(
        `chats?userId=${userId}`,
        async () => updatedChat,
        { addNew: eventType === 'create' },
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

  private async deleteCalls(deletedCall: CallDto & { callEnded?: boolean }) {
    const onlineUsers = await this.redisService.getOnlineUsers();
    const onlineUserSet = new Set(onlineUsers);
    const userIds = deletedCall.chatId.users.map((user) => user._id.toString());
    const onlineUserIds = userIds.filter((userId) => onlineUserSet.has(userId));
    // Broadcast the updated chat to all online members of the chat
    if (!!onlineUserIds.length) {
      this.server.to(onlineUserIds).emit('callsUpdated', {
        content: deletedCall,
      });
    }
  }

  private async handleError(client: Socket, error: string) {
    client.emit('error', {
      message: error,
    });
  }
}
