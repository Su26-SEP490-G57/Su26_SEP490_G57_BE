import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

@Entity('audit_logs')
@Index(['userId'])
@Index(['entityType', 'entityId'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 50 })
  action!: AuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 255 })
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  changes!: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
