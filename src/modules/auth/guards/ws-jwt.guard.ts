import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UsersService } from '../../user/services/users.service';
import { UserRoleName } from '../../user/enums/user-role.enum';

/**
 * WebSocket JWT Guard for validating JWT tokens on socket connections.
 *
 * **Authentication flow**:
 * 1. Client connects with `auth.token` in handshake
 * 2. Guard validates JWT and fetches user
 * 3. Checks if user has ADMIN role
 * 4. Attaches user to socket.data for downstream use
 *
 * **Security**: Rejects non-admin connections immediately.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      client.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      this.logger.warn(`WebSocket connection rejected: No token provided (clientId: ${client.id})`);
      throw new WsException('Unauthorized: No token provided');
    }

    try {
      // Verify JWT
      const payload = this.jwtService.verify<{ sub: number }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
      });

      // Fetch user
      const user = await this.usersService.findOne(payload.sub);
      if (!user || !user.isActive) {
        this.logger.warn(
          `WebSocket connection rejected: Invalid or inactive user (userId: ${payload.sub})`,
        );
        throw new WsException('Unauthorized: Invalid user');
      }

      // **Admin-only access**
      if (!user.roles.includes(UserRoleName.ADMIN)) {
        this.logger.warn(
          `WebSocket connection rejected: Non-admin user (userId: ${user.id}, roles: ${user.roles.join(',')})`,
        );
        throw new WsException('Forbidden: Admin role required');
      }

      // Attach user to socket for downstream handlers
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.data.user = user;

      this.logger.log(
        `WebSocket connection authorized: admin user ${user.id} (clientId: ${client.id})`,
      );
      return true;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }

      this.logger.error(`WebSocket JWT validation failed (clientId: ${client.id}):`, error);
      throw new WsException('Unauthorized: Invalid token');
    }
  }
}
