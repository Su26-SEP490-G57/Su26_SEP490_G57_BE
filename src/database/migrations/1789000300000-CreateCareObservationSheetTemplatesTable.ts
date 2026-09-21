import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `care_observation_sheet_templates` and seeds the two hardcoded sheets
 * (Level 2 and Level 3 deliberately share one sheet, per the ticket).
 *
 * ⚠️ PLACEHOLDER CLINICAL CONTENT — the `checklist_items` below (pain
 * assessment, wound/dressing check, mobility, fluid intake/output, vital-signs
 * reminder) are engineering placeholders so the FE has a renderable structure.
 * They are NOT clinically reviewed. Real checklist content must be supplied by
 * the nursing team and shipped as a follow-up data migration.
 */
export class CreateCareObservationSheetTemplatesTable1789000300000 implements MigrationInterface {
  name = 'CreateCareObservationSheetTemplatesTable1789000300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."care_observation_sheet_templates" (
        "template_id" SERIAL NOT NULL,
        "code" character varying(50) NOT NULL,
        "name" character varying(255) NOT NULL,
        "checklist_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
        CONSTRAINT "PK_care_observation_sheet_templates_template_id" PRIMARY KEY ("template_id"),
        CONSTRAINT "UQ_care_observation_sheet_templates_code" UNIQUE ("code"),
        CONSTRAINT "CHK_care_observation_sheet_templates_code"
          CHECK ("code" IN ('LEVEL_1_SHEET', 'LEVEL_2_3_SHEET'))
      )
    `);

    // PLACEHOLDER content — see the class comment above.
    const level1Items = JSON.stringify([
      { key: 'painAssessment', label: 'Đánh giá đau (thang điểm 0-10)', inputType: 'number' },
      { key: 'woundDressingCheck', label: 'Kiểm tra vết mổ / thay băng', inputType: 'checkbox' },
      { key: 'mobility', label: 'Vận động / đi lại', inputType: 'text' },
      { key: 'fluidIntakeOutput', label: 'Dịch vào / dịch ra (ml)', inputType: 'text' },
      {
        key: 'vitalSignsCheck',
        label: 'Đã đo dấu hiệu sinh tồn (ghi ở mục Chỉ số)',
        inputType: 'checkbox',
      },
    ]);

    const level23Items = JSON.stringify([
      { key: 'painAssessment', label: 'Đánh giá đau (thang điểm 0-10)', inputType: 'number' },
      { key: 'woundDressingCheck', label: 'Kiểm tra vết mổ / thay băng', inputType: 'checkbox' },
      { key: 'mobility', label: 'Vận động / đi lại', inputType: 'text' },
      { key: 'fluidIntakeOutput', label: 'Dịch vào / dịch ra (ml)', inputType: 'text' },
      {
        key: 'vitalSignsCheck',
        label: 'Đã đo dấu hiệu sinh tồn (ghi ở mục Chỉ số)',
        inputType: 'checkbox',
      },
    ]);

    await queryRunner.query(
      `
      INSERT INTO ${schema}."care_observation_sheet_templates" ("code", "name", "checklist_items")
      VALUES
        ('LEVEL_1_SHEET', 'Phiếu theo dõi chăm sóc cấp 1', $1::jsonb),
        ('LEVEL_2_3_SHEET', 'Phiếu theo dõi chăm sóc cấp 2-3', $2::jsonb)
      ON CONFLICT ("code") DO NOTHING
    `,
      [level1Items, level23Items],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."care_observation_sheet_templates"`);
  }
}
