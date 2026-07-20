import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id', type: 'int' })
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  username!: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 100 })
  fullName!: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phoneNumber!: string | null;

  @Column({ name: 'case_id', type: 'varchar', nullable: true })
  caseId!: string | null;

  /** Date of birth (date only, no time component). */
  @Column({ name: 'dob', type: 'date', nullable: true })
  dob!: string | null;

  @Column({ name: 'city_province', type: 'varchar', length: 100, nullable: true })
  cityProvince!: string | null;

  @Column({ name: 'ward', type: 'varchar', length: 100, nullable: true })
  ward!: string | null;

  @Column({ name: 'detailed_address', type: 'varchar', length: 255, nullable: true })
  detailedAddress!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  /** Soft-delete marker. NULL = active; set to a timestamp when the account is deleted. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  /** Eagerly loaded so JwtStrategy & guards can read role names without extra queries */
  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: Role[];
}
