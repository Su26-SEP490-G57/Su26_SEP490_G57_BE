import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { CareObservationTask } from './care-observation-task.entity';

/**
 * One nurse observation filled into an assigned sheet. `findings` is keyed by
 * the template's `checklistItems[].key`. Observer identity and timestamp are
 * always server-derived — never accepted from the client.
 */
@Entity('care_observation_entries')
export class CareObservationEntry {
  @PrimaryGeneratedColumn({ name: 'entry_id', type: 'int' })
  entryId!: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId!: number;

  @ManyToOne(() => CareObservationTask, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'task_id' })
  task!: CareObservationTask;

  @Column({ name: 'findings', type: 'jsonb', default: () => `'{}'::jsonb` })
  findings!: Record<string, unknown>;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'observed_by_user_id', type: 'int', nullable: true })
  observedByUserId!: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'observed_by_user_id' })
  observedBy!: User | null;

  /** Snapshot of the observing nurse's display name. */
  @Column({ name: 'observed_by_name', type: 'varchar', length: 255 })
  observedByName!: string;

  @CreateDateColumn({ name: 'observed_at', type: 'timestamptz' })
  observedAt!: Date;
}
