import { Level } from '../entities/level.entity';

export const Levels = {
  RED: { levelId: 1, levelName: 'Red' } as Level,
  YELLOW: { levelId: 2, levelName: 'Yellow' } as Level,
  GREEN: { levelId: 3, levelName: 'Green' } as Level,
};

export const LevelNames = ['Red', 'Yellow', 'Green'] as const;
export type LevelName = (typeof LevelNames)[number];
