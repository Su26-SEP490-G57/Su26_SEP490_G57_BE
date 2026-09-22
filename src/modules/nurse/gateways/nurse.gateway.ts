import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/nurses',
})
export class NurseGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NurseGateway.name);

  /**
   * This deliberately carries no assignment data. Connected nurse clients
   * reload their own room scope through the authenticated REST endpoint.
   */
  emitRoomAssignmentsChanged(): void {
    this.server.emit('nurse.rooms.changed');
    this.logger.log('Room assignments changed');
  }
}
