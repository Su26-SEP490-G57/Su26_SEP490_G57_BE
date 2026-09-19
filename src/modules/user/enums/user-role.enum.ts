import { type Role } from '../entities/role.entity';

export enum UserRoleName {
  ADMIN = 'Admin',
  HEAD_NURSE = 'Head_Nurse',
  NURSE = 'Nurse',
  DOCTOR = 'Doctor',
  PATIENT = 'Patient',
}

export const UserRole = {
  ADMIN: {
    roleName: UserRoleName.ADMIN,
  },
  HEAD_NURSE: {
    roleName: UserRoleName.HEAD_NURSE,
  },
  NURSE: {
    roleName: UserRoleName.NURSE,
  },
  DOCTOR: {
    roleName: UserRoleName.DOCTOR,
  },
  PATIENT: {
    roleName: UserRoleName.PATIENT,
  },
} as const satisfies Record<string, Partial<Role>>;
