import { ForbiddenException } from '@nestjs/common';
import { UserResponseDto } from 'src/modules/user/dtos/user-response.dto';
import { UserRoleName } from 'src/modules/user/enums/user-role.enum';

/**
 * A Patient caller may only read data of their own case; staff roles pass
 * through unchanged. Throws 403 otherwise.
 */
export function assertOwnCaseForPatient(caller: UserResponseDto, caseId: string): void {
  if (caller.roles.includes(UserRoleName.PATIENT) && caller.caseId !== caseId) {
    throw new ForbiddenException('You can only view your own sheets');
  }
}
