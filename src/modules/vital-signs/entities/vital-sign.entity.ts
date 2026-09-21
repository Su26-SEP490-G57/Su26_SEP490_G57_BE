import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { User } from '../../user/entities/user.entity';

/**
 * A single set of vital signs recorded for a patient case ("Chỉ số" tab).
 *
 * Append-only: there is no update/delete endpoint. `recordedAt` and
 * `recordedByUserId`/`recordedByName` are always server-derived from the
 * authenticated user and the server clock — never accepted from the client.
 */
@Entity('vital_signs')
@Index('IDX_vital_signs_case_recorded_at', ['caseId', 'recordedAt'])
export class VitalSign {
  @PrimaryGeneratedColumn({ name: 'vital_sign_id', type: 'int' })
  vitalSignId!: number;

  @Column({ name: 'case_id', type: 'varchar' })
  caseId!: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'case_id' })
  patient!: Patient;

  @Column({ name: 'pulse_bpm', type: 'int' })
  pulseBpm!: number;

  @Column({ name: 'blood_pressure_systolic', type: 'int' })
  bloodPressureSystolic!: number;

  @Column({ name: 'blood_pressure_diastolic', type: 'int' })
  bloodPressureDiastolic!: number;

  // Postgres `numeric` comes back as a string through node-postgres; the
  // transformer keeps the entity/API surface numeric.
  @Column({
    name: 'temperature_celsius',
    type: 'numeric',
    precision: 4,
    scale: 1,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value === null ? null : Number(value)),
    },
  })
  temperatureCelsius!: number;

  @Column({ name: 'respiratory_rate', type: 'int' })
  respiratoryRate!: number;

  @Column({ name: 'spo2_percent', type: 'int' })
  spo2Percent!: number;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'recorded_by_user_id', type: 'int', nullable: true })
  recordedByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'recorded_by_user_id' })
  recordedBy!: User | null;

  /** Snapshot of the recorder's display name, kept if the account is later removed. */
  @Column({ name: 'recorded_by_name', type: 'varchar', length: 255 })
  recordedByName!: string;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;
}
