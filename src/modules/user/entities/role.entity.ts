import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({ name: 'role_id', type: 'int' })
  id!: number;

  @Column({ name: 'role_name', type: 'varchar', length: 50, unique: true })
  roleName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @ManyToMany(() => User, (user) => user.roles)
  users!: User[];

  @ManyToMany(() => Permission, (permission) => permission.roles, { eager: true })
  permissions!: Permission[];

  constructor(props?: Partial<Role>) {
    if (props) {
      Object.assign(this, props);
    }
  }
}
