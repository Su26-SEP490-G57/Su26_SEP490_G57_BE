import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../user/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler()) || [];
    if (requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException('No user available');

    // Support both single role (string) and array of roles
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles
      : user.role
        ? [user.role]
        : [];

    return requiredRoles.some((r) => userRoles.includes(r));
  }
}
