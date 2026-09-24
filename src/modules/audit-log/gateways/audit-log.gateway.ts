import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuditLog } from '../entities/audit-log.entity';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/audit-logs',
})
export class AuditLogGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AuditLogGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitNewLog(log: AuditLog): void {
    this.server.emit('new-audit-log', log);
    this.logger.log(`Audit log emitted: ${log.id}`);
  }
}
