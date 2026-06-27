import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OperationType } from '../../patient/entities/operation-type.entity';
import { User } from '../../user/entities/user.entity';

@Entity('pod_protocols')
export class PodProtocol {
  @PrimaryGeneratedColumn({ name: 'pod_id', type: 'int' })
  pod_id!: number;

  @Column({ name: 'operation_type_id', type: 'int' })
  operation_type_id!: number;

  @ManyToOne(() => OperationType, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'operation_type_id' })
  operationType!: OperationType;

  @Column({ type: 'varchar', length: 50 })
  label!: string;

  @Column({ name: 'meals_per_day_min', type: 'int', nullable: true })
  meals_per_day_min!: number | null;

  @Column({ name: 'meals_per_day_max', type: 'int', nullable: true })
  meals_per_day_max!: number | null;

  @Column({ name: 'meal_instruction', type: 'text', nullable: true })
  meal_instruction!: string | null;

  @Column({ name: 'volume_per_meal_min', type: 'int', nullable: true })
  volume_per_meal_min!: number | null;

  @Column({ name: 'volume_per_meal_max', type: 'int', nullable: true })
  volume_per_meal_max!: number | null;

  @Column({ name: 'volume_instruction', type: 'text', nullable: true })
  volume_instruction!: string | null;

  @Column({ name: 'recommended_foods', type: 'text', array: true, default: '{}' })
  recommended_foods!: string[];

  @Column({ name: 'recommended_drinks', type: 'text', array: true, default: '{}' })
  recommended_drinks!: string[];

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'updated_by' })
  updatedBy!: User | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updated_at!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  created_at!: Date;
}
