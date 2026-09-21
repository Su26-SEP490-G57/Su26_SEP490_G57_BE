/**
 * Care Level vocabulary for a doctor's treatment order.
 *
 * Backed by the Postgres enum type `care_level_enum`, created by the
 * `CreateCareLevelEnumAndTreatmentOrders` migration. Entities pin their enum
 * columns to that type name via `enumName` (same convention as
 * `pod_tracking_logs_action_type_enum`) so `migration:generate` never proposes
 * recreating it.
 *
 * NOTE: deliberately distinct from the existing `levels` table
 * (Red/Yellow/Green ERAS triage) — different concept, never interchangeable.
 */
export const CARE_LEVELS = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'] as const;
export type CareLevel = (typeof CARE_LEVELS)[number];

/** Name of the Postgres enum type backing every care-level column. */
export const CARE_LEVEL_ENUM_NAME = 'care_level_enum';
