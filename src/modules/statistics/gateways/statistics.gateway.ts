import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface AssessmentSubmittedEvent {
  caseId: string;
  assessmentId: number;
  podContext: number | null;
  triageColor: string;
}

export interface NotificationCreatedEvent {
  caseId: string;
  notificationId: number;
  title: string;
  body: string;
  category: string;
  route: string | null;
  isRead: boolean;
  createdAt: Date;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/statistics',
})
export class StatisticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(StatisticsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitAssessmentSubmitted(data: AssessmentSubmittedEvent): void {
    this.server.emit('assessment.submitted', data);
    this.logger.log(
      `Assessment submitted emitted: case_id=${data.caseId}, assessment_id=${data.assessmentId}`,
    );
  }

  /** Broadcast — mobile (patient app) tự lọc theo caseId của chính mình, cùng
   * kiểu với các event khác trên gateway này. */
  emitNotificationCreated(data: NotificationCreatedEvent): void {
    this.server.emit('notification.created', data);
    this.logger.log(
      `Notification created emitted: case_id=${data.caseId}, notification_id=${data.notificationId}`,
    );
  }
}
