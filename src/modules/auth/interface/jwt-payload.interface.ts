import { UserRole } from '../../user/enums/user-role.enum';

export interface JwtPayload {
  sub: number;
  username: string;
  roles: string[];
}
