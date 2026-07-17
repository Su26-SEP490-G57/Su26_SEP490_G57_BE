import { SetMetadata } from '@nestjs/common';
import { UserRoleName } from '../enums/user-role.enum';

export const Roles = (...roles: UserRoleName[]) => SetMetadata('roles', roles);
