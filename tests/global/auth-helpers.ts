import type { Server } from 'http';
import request from 'supertest';
import { UserRoleName } from '../../src/modules/user/enums/user-role.enum';

export function authed(req: request.Test, token: string): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}

interface Credentials {
  username: string;
  password: string;
}

// Matches the accounts src/database/seeds/seed.ts creates for each role.
const SEEDED_ACCOUNTS: Record<UserRoleName, Credentials> = {
  [UserRoleName.ADMIN]: { username: 'admin', password: 'Admin@123' },
  [UserRoleName.HEAD_NURSE]: { username: 'head_nurse', password: 'Nurse@123' },
  [UserRoleName.NURSE]: { username: 'nurse01', password: 'Nurse@123' },
  [UserRoleName.PATIENT]: { username: 'patient01', password: 'Patient@123' },
};

export function login(httpServer: Server, role: UserRoleName): request.Test;
export function login(httpServer: Server, username: string, password: string): request.Test;
export function login(
  httpServer: Server,
  roleOrUsername: UserRoleName | string,
  password?: string,
): request.Test {
  const credentials: Credentials =
    password === undefined
      ? SEEDED_ACCOUNTS[roleOrUsername as UserRoleName]
      : { username: roleOrUsername, password };

  return request(httpServer).post('/auth/login').send(credentials);
}
