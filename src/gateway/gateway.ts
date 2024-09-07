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
      this.handleError(socket, { message: 'Authentication token is missing' });
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
      const error = {
        message: 'Failed to connect user',
        details: err.message,
      };
      this.handleError(socket, error);
      socket.disconnect();
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
      const error = {
        message: 'Failed to disconnect user',
        details: err.message,
      };
      this.handleError(socket, error);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string },
  ) {
    const { room } = body;
    try {
      client.join(room);
    } catch (err) {
      const error = {
        message: 'Failed to join room',
        details: err.message,
      };
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string },
  ) {
    const { room } = body;

    try {
      client.leave(room);
    } catch (err) {
      const error = {
        message: 'Failed to leave room',
        details: err.message,
      };
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string; isTyping: boolean },
  ) {
    const { room, isTyping } = body;
    const { _id, displayName } = client.handshake.query;
    try {
      client.broadcast.to(room).emit('interlocutorIsTyping', {
        content: { user: { _id, displayName }, isTyping },
      });
    } catch (err) {
      const error = {
        message: 'Failed to broadcast typing status',
        details: err.message,
      };
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('createMessage')
  async createMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      room: string;
      message: string;
      type: 'text' | 'image' | 'video' | 'audio' | 'file';
    },
  ) {
    const { room, message, type } = body;
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

      this.updateChat(newChat);
      this.server.to(room).emit('messageCreated', {
        content: data,
      });
    } catch (err) {
      const error = {
        message: 'Failed to create message',
        details: err.message,
      };
      this.handleError(client, error);
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
        this.updateChat(updatedChat);
      }

      this.server.to(room).emit(`messageUpdated`, {
        content: response,
      });
    } catch (err) {
      const error = {
        message: 'Failed to update message',
        details: err.message,
      };
      this.handleError(client, error);
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
        this.updateChat(updatedChat);
      }

      this.server.to(room).emit('messageDeleted', {
        content: response,
      });
    } catch (err) {
      const error = {
        message: 'Failed to delete message',
        details: err.message,
      };
      this.handleError(client, error);
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
      this.updateChat(updatedChat);
      this.server.to(room).emit('messagesRead', {
        content: updatedChat,
      });
    } catch (err) {
      const error = {
        message: 'Failed to send message status',
        details: err.message,
      };
      this.handleError(client, error);
    }
  }

  async createChat(
    chatCreatorId: Types.ObjectId,
    chat: Chat,
    existingChat: boolean,
  ) {
    try {
      const onlineUsers = (await this.redisService.getOnlineUsers())?.filter(
        (id) => id !== chatCreatorId.toString(),
      );

      const onlineUserSet = new Set(onlineUsers);
      const onlineUserIds = chat.users
        .map((user) => user._id.toString())
        .filter((userId) => onlineUserSet.has(userId));

      const newChatUsers = chat.users.map((user) => user._id.toString());

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
        }
        this.redisService.addToCache(
          `messages?chatId=${chat._id}`,
          async () => chat.lastMessage,
        );
      });

      // Broadcast the new chat to all online members of the chat
      if (!!onlineUserIds.length) {
        this.server.to(onlineUserIds).emit('chatCreated', {
          content: { ...chat },
        });
      }
    } catch (err) {
      throw err;
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
      const error = {
        message: 'Failed to join call',
      };
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('initiateCall')
  async handleCallUser(
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
      const error = {
        message: 'Failed to create call',
      };
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('sendCallAnswer')
  async handleMakeAnswer(
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
      const error = {
        message: 'Failed to send call answer',
        error: err.message,
      };
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('saveIceCandidates')
  async handleSaveIceCandidates(
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
      const error = {
        message: 'Failed to update ice candidates',
        error: err.message,
      };
      this.handleError(client, error);
    }
  }

  @SubscribeMessage('endCall')
  async handleEndCall(
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
      const error = {
        message: 'Failed to end call',
        error: err.message,
      };
      this.handleError(client, error);
    }
  }

  async updateChat(updatedChat: Chat) {
    try {
      const onlineUsers = await this.redisService.getOnlineUsers();
      const onlineUserSet = new Set(onlineUsers);
      const userIds = updatedChat.users.map((user) => user._id.toString());
      const onlineUserIds = userIds.filter((userId) =>
        onlineUserSet.has(userId),
      );

      // Update respective chat cache data for each user in the chat
      userIds.forEach((userId) =>
        this.redisService.updateInCache(
          `chats?userId=${userId}`,
          async () => updatedChat,
        ),
      );
      // Broadcast the updated chat to all online members of the chat
      if (!!onlineUserIds.length) {
        this.server.to(onlineUserIds).emit('chatUpdated', {
          content: updatedChat,
        });
      }
    } catch (err) {
      throw err;
    }
  }

  private async updateCalls(updatedCall) {
    try {
      const onlineUsers = await this.redisService.getOnlineUsers();
      const onlineUserSet = new Set(onlineUsers);
      const userIds = updatedCall.chatId.users.map((user) =>
        user._id.toString(),
      );
      const onlineUserIds = userIds.filter((userId) =>
        onlineUserSet.has(userId),
      );

      // Broadcast the updated chat to all online members of the chat
      if (!!onlineUserIds.length) {
        this.server.to(onlineUserIds).emit('callsUpdated', {
          content: updatedCall,
        });
      }
    } catch (err) {
      throw err;
    }
  }

  private async deleteCalls(deletedCall) {
    try {
      const onlineUsers = await this.redisService.getOnlineUsers();
      const onlineUserSet = new Set(onlineUsers);
      const userIds = deletedCall.chatId.users.map((user) =>
        user._id.toString(),
      );
      const onlineUserIds = userIds.filter((userId) =>
        onlineUserSet.has(userId),
      );
      // Broadcast the updated chat to all online members of the chat
      if (!!onlineUserIds.length) {
        this.server.to(onlineUserIds).emit('callsUpdated', {
          content: deletedCall,
        });
      }
    } catch (err) {
      throw err;
    }
  }

  private async handleError(client: Socket, error: any) {
    client.emit('error', {
      message: error.message,
      details: error.message,
    });
  }
}
