import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * WebSocket Gateway for real-time audit log streaming to admin clients.
 *
 * **Security**: Only authenticated ADMIN users can connect.
 * **Lifecycle**: Tracks connected clients, auto-cleanup on disconnect.
 */
@WebSocketGateway({
  namespace: '/audit-logs',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class AuditLogGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AuditLogGateway.name);
  private connectedClients = new Set<string>();

  handleConnection(client: Socket) {
    this.connectedClients.add(client.id);
    this.logger.log(`Admin client connected: ${client.id} (total: ${this.connectedClients.size})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(
      `Admin client disconnected: ${client.id} (remaining: ${this.connectedClients.size})`,
    );
  }

  /**
   * Broadcast new audit log to all connected admin clients.
   * Called by AuditLogService.log() after persisting to DB.
   *
   * **Failure mode**: If emit fails (no connected clients), log is still persisted.
   * Silent failure is acceptable — logs are queryable via REST API.
   */
  emitNewLog(log: AuditLog) {
    if (this.connectedClients.size === 0) {
      // No admins connected — skip broadcast, avoid unnecessary serialization
      return;
    }

    try {
      this.server.emit('new-audit-log', {
        id: log.id,
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        changes: log.changes,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        // Không include user relation để tránh serialization depth
        // Frontend có thể lookup user từ userId nếu cần
      });

      this.logger.debug(
        `Broadcasted audit log #${log.id} to ${this.connectedClients.size} clients`,
      );
    } catch (error) {
      // Non-blocking: Log error nhưng không throw — audit log đã được persist
      this.logger.error(`Failed to broadcast audit log #${log.id}:`, error);
    }
  }
}
