import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PodLockResponseDto } from '../dtos/pod-lock.dto';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/patients',
})
export class PatientGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PatientGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitPodLocked(data: PodLockResponseDto): void {
    this.server.emit('pod.locked', data);
    this.logger.log(`POD locked emitted: caseId=${data.caseId}`);
  }

  emitPodUnlocked(data: PodLockResponseDto): void {
    this.server.emit('pod.unlocked', data);
    this.logger.log(`POD unlocked emitted: caseId=${data.caseId}`);
  }
}
