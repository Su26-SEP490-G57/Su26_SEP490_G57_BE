import { type Level } from '../entities/level.entity';

export const Levels = {
  RED: {
    levelId: 1,
    levelName: 'Red',
    description: 'High risk - immediate attention required',
    sortOrder: 1,
  },
  YELLOW: {
    levelId: 2,
    levelName: 'Yellow',
    description: 'Moderate risk - monitor closely',
    sortOrder: 2,
  },
  GREEN: {
    levelId: 3,
    levelName: 'Green',
    description: 'Low risk - stable',
    sortOrder: 3,
  },
} satisfies Record<string, Level>;

export const LevelNames = Object.values(Levels).map((level) => level.levelName);

export type LevelColor = keyof typeof Levels;
