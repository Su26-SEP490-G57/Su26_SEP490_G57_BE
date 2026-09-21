import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { User } from '../../user/entities/user.entity';
import { CARE_LEVEL_ENUM_NAME, CARE_LEVELS } from '../constants/care-level.constant';
import type { CareLevel } from '../constants/care-level.constant';

/**
 * A doctor's treatment order for a patient case. The required Care Level drives
 * the nursing Care Observation Sheet assignment (see `CareObservationService`).
 *
 * The most recent order for a case is mirrored onto
 * `patient_cases.active_treatment_order_id` / `active_care_level`.
 */
@Entity('treatment_orders')
@Index('IDX_treatment_orders_case_ordered_at', ['caseId', 'orderedAt'])
export class TreatmentOrder {
  @PrimaryGeneratedColumn({ name: 'treatment_order_id', type: 'int' })
  treatmentOrderId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  // Pinned to the `care_level_enum` Postgres type created by the
  // CreateCareLevelEnumAndTreatmentOrders migration.
  @Column({
    name: 'care_level',
    type: 'enum',
    enum: CARE_LEVELS,
    enumName: CARE_LEVEL_ENUM_NAME,
  })
  careLevel!: CareLevel;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions!: string | null;

  @Column({ name: 'ordered_by_user_id', type: 'int', nullable: true })
  orderedByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'ordered_by_user_id' })
  orderedBy!: User | null;

  /** Snapshot of the ordering doctor's display name. */
  @Column({ name: 'ordered_by_name', type: 'varchar', length: 255 })
  orderedByName!: string;

  @CreateDateColumn({ name: 'ordered_at', type: 'timestamptz' })
  orderedAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt!: Date | null;
}
