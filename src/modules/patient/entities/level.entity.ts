import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const LEVEL_NAMES = ['Red', 'Yellow', 'Green'] as const;
export type LevelName = (typeof LEVEL_NAMES)[number];

@Entity('levels')
export class Level {
  @PrimaryGeneratedColumn({ name: 'level_id', type: 'int' })
  levelId!: number;

  @Column({ name: 'level_name', type: 'varchar', length: 20 })
  levelName!: LevelName;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
