import { ApiProperty } from '@nestjs/swagger';

/**
 * A surgical patient record as returned by the external HIS (dummy) service.
 * Mirrors the HIS response shape 1:1 — this endpoint only fetches and forwards
 * the list; it does not yet import records into `patient_cases`.
 */
export class ExternalSurgicalRecordDto {
  @ApiProperty({ example: 'HIS-REC-01' })
  recordId!: string;

  @ApiProperty({ example: 'HIS-100000' })
  hospitalPatientCode!: string;

  @ApiProperty({ example: 'N.V.A' })
  patientName!: string;

  @ApiProperty({ example: '1975-04-12', nullable: true })
  dateOfBirth!: string | null;

  @ApiProperty({ example: 'M', nullable: true })
  sex!: string | null;

  @ApiProperty({ example: 168, nullable: true })
  heightCm!: number | null;

  @ApiProperty({ example: 62.5, nullable: true })
  weightKg!: number | null;

  @ApiProperty({ example: 'Carcinoma of the sigmoid colon', nullable: true })
  admissionDiagnosis!: string | null;

  @ApiProperty({ example: 'Laparoscopic anterior resection' })
  procedureName!: string;

  @ApiProperty({ example: '48.63', nullable: true })
  procedureCode!: string | null;

  @ApiProperty({ example: 'LAPAROSCOPIC', nullable: true })
  surgicalApproach!: string | null;

  @ApiProperty({ example: true, nullable: true })
  bowelAnastomosis!: boolean | null;

  @ApiProperty({ example: '2026-07-01T08:30:00.000Z' })
  operatedAt!: string;

  @ApiProperty({ example: 'Dr. Tran Van B', nullable: true })
  attendingSurgeon!: string | null;

  @ApiProperty({ example: 'GI-2', nullable: true })
  wardCode!: string | null;

  @ApiProperty({ example: 'B-14', nullable: true })
  bedNumber!: string | null;

  @ApiProperty({ example: 'IN_HOSPITAL', nullable: true })
  dischargeStatus!: string | null;

  @ApiProperty({ example: '+84901234567', nullable: true })
  contactPhone!: string | null;
}

/** Envelope returned by GET /patients/external-records. */
export class ExternalSurgicalRecordListDto {
  @ApiProperty({ type: [ExternalSurgicalRecordDto] })
  data!: ExternalSurgicalRecordDto[];

  @ApiProperty({ example: 25 })
  total!: number;
}
