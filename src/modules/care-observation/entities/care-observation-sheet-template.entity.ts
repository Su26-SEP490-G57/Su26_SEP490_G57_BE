import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Stable codes of the two hardcoded sheet templates (seeded by migration). */
export const CARE_OBSERVATION_TEMPLATE_CODES = ['LEVEL_1_SHEET', 'LEVEL_2_3_SHEET'] as const;
export type CareObservationTemplateCode = (typeof CARE_OBSERVATION_TEMPLATE_CODES)[number];

/** One checklist row rendered generically by the FE. */
export interface CareObservationChecklistItem {
  key: string;
  label: string;
  inputType?: string;
}

/**
 * A Care Observation Sheet template. MVP: content is fixed — the two rows are
 * seeded by `CreateCareObservationSheetTemplatesTable` and there is no CRUD
 * endpoint.
 */
@Entity('care_observation_sheet_templates')
export class CareObservationSheetTemplate {
  @PrimaryGeneratedColumn({ name: 'template_id', type: 'int' })
  templateId!: number;

  @Column({ name: 'code', type: 'varchar', length: 50, unique: true })
  code!: CareObservationTemplateCode;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'checklist_items', type: 'jsonb', default: () => `'[]'::jsonb` })
  checklistItems!: CareObservationChecklistItem[];
}
