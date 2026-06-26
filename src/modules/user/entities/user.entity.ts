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

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  password_hash!: string;

  @Column({ type: 'varchar', length: 100 })
  full_name!: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  phone_number!: string | null;

  @Column({ name: 'case_id', type: 'varchar', nullable: true })
  case_id!: string | null;

  /** Date of birth (date only, no time component). */
  @Column({ name: 'dob', type: 'date', nullable: true })
  dob!: string | null;

  @Column({ name: 'city_province', type: 'varchar', length: 100, nullable: true })
  city_province!: string | null;

  @Column({ name: 'ward', type: 'varchar', length: 100, nullable: true })
  ward!: string | null;

  @Column({ name: 'detailed_address', type: 'varchar', length: 255, nullable: true })
  detailed_address!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;

  /** Soft-delete marker. NULL = active; set to a timestamp when the account is deleted. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deleted_at!: Date | null;

  /** Eagerly loaded so JwtStrategy & guards can read role names without extra queries */
  @ManyToMany(() => Role, (role) => role.users, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: Role[];
}
