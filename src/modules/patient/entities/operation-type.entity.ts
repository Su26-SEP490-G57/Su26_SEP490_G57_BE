import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('operation_types')
export class OperationType {
  @PrimaryGeneratedColumn({ name: 'operation_type_id', type: 'int' })
  operation_type_id!: number;

  @Column({ name: 'operation_name', type: 'varchar', length: 100 })
  operation_name!: string;
}
