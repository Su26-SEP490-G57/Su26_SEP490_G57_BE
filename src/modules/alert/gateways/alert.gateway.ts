import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AlertResponseDto } from '../dtos/alert-response.dto';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/alerts',
})
export class AlertGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AlertGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitNewAlert(alert: AlertResponseDto): void {
    this.server.emit('alert.created', alert);
    this.logger.log(`Alert emitted: alert_id=${alert.alert_id}, type=${alert.alert_type}`);
  }
}
