import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Level } from './level.entity';
import { OperationType } from './operation-type.entity';

@Entity('patient_cases')
export class Patient {
  @PrimaryColumn({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @Column({ type: 'int', nullable: true })
  age!: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender!: string | null;

  @Column({ type: 'float', nullable: true })
  height!: number | null;

  @Column({ type: 'float', nullable: true })
  weight!: number | null;

  @Column({ type: 'float', nullable: true })
  bmi!: number | null;

  @Column({ type: 'text', nullable: true })
  diagnosis!: string | null;

  @Column({ name: 'operation_type_id', type: 'int', nullable: true })
  operationTypeId!: number | null;

  @ManyToOne(() => OperationType, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'operation_type_id' })
  operationType!: OperationType | null;

  @Column({ name: 'surgery_date', type: 'date', nullable: true })
  surgeryDate!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  method!: string | null;

  @Column({ name: 'has_gi_anastomosis', type: 'boolean', nullable: true })
  hasGiAnastomosis!: boolean | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_nurse_id' })
  assignedNurse!: User | null;

  @Column({ name: 'room_bed', type: 'varchar', length: 50, nullable: true })
  roomBed!: string | null;

  @Column({ name: 'current_pod', type: 'int', nullable: true })
  currentPod!: number | null;

  @Column({ name: 'time_to_redrink', type: 'int', nullable: true })
  timeToRedrink!: number | null;

  @Column({ name: 'time_to_reeat', type: 'int', nullable: true })
  timeToReeat!: number | null;

  @Column({ name: 'pod_soft_diet_reached', type: 'int', nullable: true })
  podSoftDietReached!: number | null;

  @Column({ name: 'time_to_flatus', type: 'int', nullable: true })
  timeToFlatus!: number | null;

  @Column({ name: 'time_to_defecation', type: 'int', nullable: true })
  timeToDefecation!: number | null;

  @Column({ name: 'gi_complications', type: 'text', nullable: true })
  giComplications!: string | null;

  @Column({ name: 'length_of_stay', type: 'int', nullable: true })
  lengthOfStay!: number | null;

  @Column({ name: 'protocol_final_status', type: 'varchar', length: 50, nullable: true })
  protocolFinalStatus!: string | null;

  /** When true, the case's POD progression is held/locked from auto-advancing. */
  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked!: boolean;

  @Column({ name: 'guardian_phone', type: 'varchar', length: 20, nullable: true })
  guardianPhone!: string | null;

  /** Free-text reason recorded when a case's POD progression is put on hold. */
  @Column({ name: 'reason_hold_pod', type: 'text', nullable: true })
  reasonHoldPod!: string | null;

  @Column({ name: 'pod_start_date', type: 'timestamptz', nullable: true })
  podStartDate!: Date | null;

  @Column({ name: 'pod_end_date', type: 'timestamptz', nullable: true })
  podEndDate!: Date | null;

  /** Date/time the patient was discharged — separate from pod_end_date */
  @Column({ name: 'discharge_date', type: 'timestamptz', nullable: true })
  dischargeDate!: Date | null;

  /** Timestamp when POD was locked — null if not currently locked */
  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'level_id', type: 'int', nullable: true })
  levelId!: number | null;

  @ManyToOne(() => Level, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'level_id' })
  level!: Level | null;

  /** Indicates whether the patient has completed the ERAS protocol (reached max POD) */
  @Column({ name: 'eras_completed', type: 'boolean', default: false })
  erasCompleted!: boolean;

  /** Soft-delete marker. NULL = active; set to a timestamp when the patient is deleted. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  /**
   * The patient's user account (users.case_id -> patient_cases.case_id).
   * Not a real column — populated via leftJoinAndMapOne in the repository.
   */
  account?: User | null;
}
