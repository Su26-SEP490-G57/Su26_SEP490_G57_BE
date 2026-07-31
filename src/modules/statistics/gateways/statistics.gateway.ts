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
}
