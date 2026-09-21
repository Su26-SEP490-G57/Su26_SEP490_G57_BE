import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { TreatmentOrder } from '../../treatment-order/entities/treatment-order.entity';
import {
  CARE_LEVEL_ENUM_NAME,
  CARE_LEVELS,
} from '../../treatment-order/constants/care-level.constant';
import type { CareLevel } from '../../treatment-order/constants/care-level.constant';
import { CareObservationSheetTemplate } from './care-observation-sheet-template.entity';

export const CARE_OBSERVATION_TASK_STATUSES = ['OPEN', 'SUPERSEDED', 'COMPLETED'] as const;
export type CareObservationTaskStatus = (typeof CARE_OBSERVATION_TASK_STATUSES)[number];

/**
 * The sheet currently assigned to a patient's nursing workflow.
 *
 * Exactly one `OPEN` task may exist per case — enforced in the database by the
 * partial unique index `UQ_care_observation_tasks_one_open_per_case`. A task
 * persists (accumulating entries) until a treatment order switches the patient
 * to a different template, at which point it is marked `SUPERSEDED`.
 */
@Entity('care_observation_tasks')
export class CareObservationTask {
  @PrimaryGeneratedColumn({ name: 'task_id', type: 'int' })
  taskId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'template_id', type: 'int' })
  templateId!: number;

  @ManyToOne(() => CareObservationSheetTemplate, { onDelete: 'RESTRICT', eager: false })
  @JoinColumn({ name: 'template_id' })
  template!: CareObservationSheetTemplate;

  @Column({ name: 'treatment_order_id', type: 'int', nullable: true })
  treatmentOrderId!: number | null;

  @ManyToOne(() => TreatmentOrder, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'treatment_order_id' })
  treatmentOrder!: TreatmentOrder | null;

  @Column({
    name: 'care_level_at_assignment',
    type: 'enum',
    enum: CARE_LEVELS,
    enumName: CARE_LEVEL_ENUM_NAME,
  })
  careLevelAtAssignment!: CareLevel;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'OPEN' })
  status!: CareObservationTaskStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'superseded_at', type: 'timestamptz', nullable: true })
  supersededAt!: Date | null;
}
