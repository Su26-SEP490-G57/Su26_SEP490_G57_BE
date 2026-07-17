import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('operation_types')
export class OperationType {
  @PrimaryGeneratedColumn({ name: 'operation_type_id', type: 'int' })
  operationTypeId!: number;

  @Column({ name: 'operation_name', type: 'varchar', length: 100 })
  operationName!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
