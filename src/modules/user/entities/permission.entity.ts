import { Column, Entity, ManyToMany, PrimaryGeneratedColumn, JoinTable } from 'typeorm';
import { Role } from './role.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn({ name: 'permission_id', type: 'int' })
  id!: number;

  @Column({ name: 'permission_code', type: 'varchar', length: 100, unique: true })
  permissionCode!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @ManyToMany(() => Role, (role) => role.permissions)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'permission_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles!: Role[];
}