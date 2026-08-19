import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class WebsocketGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { channel: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.channel);
    return { event: 'subscribed', data: { channel: data.channel } };
  }

  emitProgress(channel: string, percent: number, message: string) {
    this.server.to(channel).emit('progress', { percent, message });
  }

  emitLockUpdate(channel: string, data: unknown) {
    this.server.to(channel).emit('lock-update', data);
  }
}
