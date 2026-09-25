import { UserRoleName } from '../../user/enums/user-role.enum';

/** Roles shown on the "Quản lý nhân viên y tế" screen (list / detail / edit). */
export const MEDICAL_STAFF_ROLES = [
  UserRoleName.NURSE,
  UserRoleName.HEAD_NURSE,
  UserRoleName.DOCTOR,
] as const;

/**
 * Roles that may be given when creating/editing staff from that screen.
 * Head Nurse is intentionally excluded — head nurse accounts are not created there.
 */
export const ASSIGNABLE_STAFF_ROLES = [UserRoleName.NURSE, UserRoleName.DOCTOR] as const;
