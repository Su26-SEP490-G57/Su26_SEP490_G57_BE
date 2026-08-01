import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { RolesGuard } from '../../../src/modules/auth/guards/roles.guard';
import { UserRoleName } from '../../../src/modules/user/enums/user-role.enum';
import { UserResponseDto } from '../../../src/modules/user/dtos/user-response.dto';

describe('RolesGuard', () => {
  let reflector: DeepMocked<Reflector>;
  let guard: RolesGuard;

  const seededNurse: UserResponseDto = {
    id: 3,
    username: 'nurse01',
    fullName: 'Điều dưỡng 01',
    phoneNumber: null,
    caseId: null,
    roles: [UserRoleName.NURSE],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function contextWithUser(user: UserResponseDto | undefined): DeepMocked<ExecutionContext> {
    const context = createMock<ExecutionContext>();
    context.switchToHttp().getRequest.mockReturnValue({ user });
    return context;
  }

  beforeEach(() => {
    reflector = createMock<Reflector>();
    guard = new RolesGuard(reflector);
  });

  describe('canActivate()', () => {
    describe('GIVEN the route declares no required roles', () => {
      it('THEN should allow the request through', () => {
        reflector.get.mockReturnValue(undefined);

        const result = guard.canActivate(contextWithUser(seededNurse));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the route requires a role the authenticated user has', () => {
      it('THEN should allow the request through', () => {
        reflector.get.mockReturnValue([UserRoleName.NURSE, UserRoleName.HEAD_NURSE]);

        const result = guard.canActivate(contextWithUser(seededNurse));

        expect(result).toBe(true);
      });
    });

    describe('GIVEN the route requires a role the authenticated user does not have', () => {
      it('THEN should deny the request', () => {
        reflector.get.mockReturnValue([UserRoleName.ADMIN]);

        const result = guard.canActivate(contextWithUser(seededNurse));

        expect(result).toBe(false);
      });
    });

    describe('GIVEN the route requires a role but no user is attached to the request', () => {
      it('THEN should throw UnauthorizedException', () => {
        reflector.get.mockReturnValue([UserRoleName.ADMIN]);

        expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(UnauthorizedException);
      });
    });
  });
});
