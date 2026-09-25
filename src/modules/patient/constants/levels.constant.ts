import { Level } from '../entities/level.entity';

export const Levels = {
  RED: { levelId: 1, levelName: 'Red' } as Level,
  YELLOW: { levelId: 2, levelName: 'Yellow' } as Level,
  GREEN: { levelId: 3, levelName: 'Green' } as Level,
};

export const LevelNames = ['Red', 'Yellow', 'Green'] as const;
export type LevelName = (typeof LevelNames)[number];

export type TriageColor = 'RED' | 'YELLOW' | 'GREEN';

/**
 * Single source of truth for levelId -> triage color. Compares against
 * `Levels.*.levelId` (not hardcoded numbers) so this can never drift from the
 * canonical mapping above — every call site should use this instead of its
 * own `levelId === N` ternary (see the 2026-09-25 bug where two independent
 * copies of that ternary disagreed with each other and with this mapping).
 * Takes the plain `levelId` column rather than the joined `level` relation
 * so it works whether or not the caller's query loaded that relation.
 */
export function triageColorFromLevelId(levelId: number | null | undefined): TriageColor {
  switch (levelId) {
    case Levels.RED.levelId:
      return 'RED';
    case Levels.YELLOW.levelId:
      return 'YELLOW';
    case Levels.GREEN.levelId:
      return 'GREEN';
    default:
      // Every patient row has a NOT NULL levelId FK, so this shouldn't happen;
      // GREEN matches the fallback both previous (buggy) implementations used.
      return 'GREEN';
  }
}
