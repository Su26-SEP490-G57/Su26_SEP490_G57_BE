import { PickType } from '@nestjs/swagger';
import { QueryPatientDto } from '../../patient/dtos/query-patient.dto';

/**
 * Ward-level filters for GET /patients/analytics/overview. Shares the same
 * filter vocabulary as GET /patients (search / level / operationTypeId /
 * room) so the FE can reuse one filter bar across the patient list and the
 * analytics dashboard.
 */
export class QueryAnalyticsOverviewDto extends PickType(QueryPatientDto, [
  'search',
  'level',
  'operationTypeId',
  'room',
] as const) {}
