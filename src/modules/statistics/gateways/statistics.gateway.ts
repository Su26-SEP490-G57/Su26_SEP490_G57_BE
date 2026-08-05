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
  totalScore?: number;
}

export interface PatientChangeEvent {
  caseId: string;
  userId?: number | null;
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

  emitCreatePatient(data: PatientChangeEvent): void {
    this.server.emit('createPatient', data);
    this.logger.log(`Patient created emitted: case_id=${data.caseId}`);
  }

  emitUpdatePatient(data: PatientChangeEvent): void {
    this.server.emit('updatePatient', data);
    this.logger.log(`Patient updated emitted: case_id=${data.caseId}`);
  }

  emitDeletePatient(data: PatientChangeEvent): void {
    this.server.emit('deletePatient', data);
    this.logger.log(`Patient deleted emitted: case_id=${data.caseId}`);
  }

  emitSubmitSurvey(data: AssessmentSubmittedEvent): void {
    this.server.emit('submitSurvey', data);
    this.logger.log(
      `Survey submitted emitted: case_id=${data.caseId}, assessment_id=${data.assessmentId}`,
    );
    this.emitAssessmentSubmitted(data);
  }
}
