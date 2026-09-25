import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleName } from '../../user/enums/user-role.enum';
import { AuthenticatedRequest } from 'src/shared/types/authenticated-request';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRoleName[]>('roles', context.getHandler()) || [];
    if (requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user) throw new UnauthorizedException('No user available');

    this.logger.debug(`Required roles: ${JSON.stringify(requiredRoles)}`);
    this.logger.debug(`User roles: ${JSON.stringify(user.roles)}`);
    this.logger.debug(`User object: ${JSON.stringify(user)}`);

    const userRoles = (user.roles ?? []).map((r) => String(r).toLowerCase());
    const hasRole = requiredRoles.some((r) => userRoles.includes(String(r).toLowerCase()));
    this.logger.debug(`Has required role: ${hasRole}`);

    return hasRole;
  }
}
