import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('health_education_pod_contents')
export class HealthEducationPodContent {
  @PrimaryGeneratedColumn({ name: 'content_id' })
  contentId!: number;

  @Column({ name: 'pod_day', type: 'smallint' })
  podDay!: number;

  @Column({ name: 'operation_type_id', type: 'int', nullable: true })
  operationTypeId!: number | null;

  @Column({ name: 'goals', type: 'jsonb', default: '[]' })
  goals!: any[];

  @Column({ name: 'actions', type: 'jsonb', default: '[]' })
  actions!: any[];

  @Column({ name: 'warning_signs', type: 'jsonb', default: '[]' })
  warningSigns!: any[];

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
