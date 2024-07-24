import { OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from 'src/messages/messages.service';
import { UsersService } from 'src/users/users.service';

@WebSocketGateway({ cors: { origin: process.env.CLIENT_URL } })
export class Gateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messagesService: MessagesService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit() {
    this.server.on('connection', (socket) => {
      console.log(socket.id);
      console.log('connected');
    });
  }

  async handleConnection(@ConnectedSocket() socket: Socket) {
    const token = socket.handshake.headers['sec-websocket-protocol'];
    const { _id } = socket.handshake.query;

    try {
      const user = await this.usersService.connectUser(_id as string);
      this.server.emit('broadcastUserStatus', {
        content: {
          _id: user._id,
          displayName: user.displayName,
          isOnline: true,
        },
      });
    } catch (err) {
      socket.disconnect();
    }
  }

  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    const { _id } = socket.handshake.query;

    const user = await this.usersService.disconnectUser(_id as string);
    this.server.emit('broadcastUserStatus', {
      content: {
        _id: user._id,
        displayName: user.displayName,
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
    client.broadcast.to(room).emit('userIsTyping', {
      content: { user: { _id, displayName }, isTyping },
    });
  }

  @SubscribeMessage('createMessage')
  async createMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string; message: string },
  ) {
    const { room, message } = body;
    const { _id } = client.handshake.query;
    const data = await this.messagesService.createMessage(
      room,
      _id as string,
      message,
    );
    this.server.to(room).emit('messageCreated', {
      content: data,
    });
  }

  @SubscribeMessage('updateMessage')
  async updateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string; messageId: string; message: string },
  ) {
    const { room, messageId, message } = body;
    const { _id } = client.handshake.query;
    const data = await this.messagesService.updateMessage(
      messageId,
      _id as string,
      room,
      message,
    );
    this.server.to(room).emit(`messageUpdated`, {
      content: data,
    });
  }

  @SubscribeMessage('deleteMessage')
  async deleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room: string; messageId: string },
  ) {
    const { room, messageId } = body;
    const { _id } = client.handshake.query;
    const data = await this.messagesService.deleteMessage(
      messageId,
      _id as string,
      room,
    );
    this.server.to(room).emit('messageDeleted', {
      content: data,
    });
  }
}
