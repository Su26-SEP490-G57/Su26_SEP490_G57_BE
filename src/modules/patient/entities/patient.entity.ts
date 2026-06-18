import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('patient_cases')
export class Patient {
  @PrimaryColumn({ name: 'case_id', type: 'varchar' })
  case_id!: string;

  @Column({ name: 'name_initials', type: 'varchar', length: 50, nullable: true })
  name_initials!: string | null;

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

  @Column({ name: 'operation_type', type: 'varchar', length: 100, nullable: true })
  operation_type!: string | null;

  @Column({ name: 'surgery_date', type: 'date', nullable: true })
  surgery_date!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  method!: string | null;

  @Column({ name: 'has_gi_anastomosis', type: 'boolean', nullable: true })
  has_gi_anastomosis!: boolean | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_nurse_id' })
  assigned_nurse!: User | null;

  @Column({ name: 'room_bed', type: 'varchar', length: 50, nullable: true })
  room_bed!: string | null;

  @Column({ name: 'current_pod', type: 'int', nullable: true })
  current_pod!: number | null;

  @Column({ name: 'time_to_redrink', type: 'int', nullable: true })
  time_to_redrink!: number | null;

  @Column({ name: 'time_to_reeat', type: 'int', nullable: true })
  time_to_reeat!: number | null;

  @Column({ name: 'pod_soft_diet_reached', type: 'int', nullable: true })
  pod_soft_diet_reached!: number | null;

  @Column({ name: 'time_to_flatus', type: 'int', nullable: true })
  time_to_flatus!: number | null;

  @Column({ name: 'time_to_defecation', type: 'int', nullable: true })
  time_to_defecation!: number | null;

  @Column({ name: 'gi_complications', type: 'text', nullable: true })
  gi_complications!: string | null;

  @Column({ name: 'length_of_stay', type: 'int', nullable: true })
  length_of_stay!: number | null;

  @Column({ name: 'protocol_final_status', type: 'varchar', length: 50, nullable: true })
  protocol_final_status!: string | null;

  /**
   * The patient's user account (users.case_id -> patient_cases.case_id).
   * Not a real column — populated via leftJoinAndMapOne in the repository.
   */
  account?: User | null;
}
