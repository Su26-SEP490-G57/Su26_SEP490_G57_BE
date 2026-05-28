import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

const GENDERS = ['Nam', 'Nữ'] as const;
const ASA_CLASSIFICATIONS = ['I', 'II', 'III', 'IV'] as const;
const SURGERY_TYPES = ['Dạ dày', 'Đại tràng', 'Trực tràng'] as const;
const SURGERY_METHODS = ['Nội soi', 'Mổ mở'] as const;
const POD_STATUSES = ['Active', 'Paused', 'Rolled_Back', 'Completed'] as const;

export type Gender = (typeof GENDERS)[number];
export type AsaClassification = (typeof ASA_CLASSIFICATIONS)[number];
export type SurgeryType = (typeof SURGERY_TYPES)[number];
export type SurgeryMethod = (typeof SURGERY_METHODS)[number];
export type PodStatus = (typeof POD_STATUSES)[number];

@Entity('patients')
export class Patient {
  @PrimaryColumn({ name: 'patient_id', type: 'varchar', length: 50 })
  patient_id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  full_name!: string;

  @Column({ type: 'int' })
  age!: number;

  @Column({ type: 'enum', enum: GENDERS })
  gender!: Gender;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  bmi!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  occupation!: string | null;

  @Column({ type: 'text', nullable: true })
  underlying_diseases!: string | null;

  @Column({ type: 'enum', enum: ASA_CLASSIFICATIONS, nullable: true })
  asa_classification!: AsaClassification | null;

  @Column({ type: 'enum', enum: SURGERY_TYPES, nullable: true })
  surgery_type!: SurgeryType | null;

  @Column({ type: 'enum', enum: SURGERY_METHODS, nullable: true })
  surgery_method!: SurgeryMethod | null;

  @Column({ type: 'date', nullable: true })
  surgery_date!: string | null;

  @Column({ name: 'room_id', type: 'int', nullable: true })
  room_id!: number | null;

  @Column({ type: 'boolean', default: false })
  has_zalo!: boolean;

  @Column({ type: 'boolean', default: false })
  has_smartphone!: boolean;

  @Column({ type: 'boolean', default: false })
  has_caregiver_support!: boolean;

  @Column({ type: 'int', nullable: true })
  current_pod!: number | null;

  @Column({ type: 'enum', enum: POD_STATUSES, nullable: true })
  pod_status!: PodStatus | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}