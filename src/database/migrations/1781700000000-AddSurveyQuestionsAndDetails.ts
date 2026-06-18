import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSurveyQuestionsAndDetails1781700000000 implements MigrationInterface {
  name = 'AddSurveyQuestionsAndDetails1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    // ── Tables ─────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."survey_questions" (
        "question_id"   SERIAL    NOT NULL,
        "question_text" TEXT      NOT NULL,
        "order_number"  integer,
        CONSTRAINT "PK_survey_questions_question_id" PRIMARY KEY ("question_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."question_options" (
        "option_id"    SERIAL                  NOT NULL,
        "question_id"  integer                 NOT NULL,
        "option_text"  character varying(255)  NOT NULL,
        "score_value"  integer                 NOT NULL,
        CONSTRAINT "PK_question_options_option_id" PRIMARY KEY ("option_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${schema}."patient_assessment_details" (
        "detail_id"          SERIAL   NOT NULL,
        "assessment_id"      integer  NOT NULL,
        "question_id"        integer  NOT NULL,
        "selected_option_id" integer  NOT NULL,
        "score_earned"       integer  NOT NULL,
        CONSTRAINT "PK_patient_assessment_details_detail_id" PRIMARY KEY ("detail_id")
      )
    `);

    // ── Foreign keys ───────────────────────────────────────────────────────────

    await queryRunner.query(`
      ALTER TABLE ${schema}."question_options"
      ADD CONSTRAINT "FK_question_options_question_id"
      FOREIGN KEY ("question_id") REFERENCES ${schema}."survey_questions"("question_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessment_details"
      ADD CONSTRAINT "FK_patient_assessment_details_assessment_id"
      FOREIGN KEY ("assessment_id") REFERENCES ${schema}."patient_assessments"("assessment_id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessment_details"
      ADD CONSTRAINT "FK_patient_assessment_details_question_id"
      FOREIGN KEY ("question_id") REFERENCES ${schema}."survey_questions"("question_id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE ${schema}."patient_assessment_details"
      ADD CONSTRAINT "FK_patient_assessment_details_selected_option_id"
      FOREIGN KEY ("selected_option_id") REFERENCES ${schema}."question_options"("option_id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // ── Seed survey questions/options ──────────────────────────────────────────

    await queryRunner.query(`
      INSERT INTO ${schema}."survey_questions" ("question_text", "order_number")
      VALUES
        ('Bạn có buồn nôn không?', 1),
        ('Bạn có nôn nhiều không?', 2),
        ('Bạn có chướng bụng không?', 3),
        ('Bạn ăn được bao nhiêu?', 4),
        ('Bạn đã trung tiện chưa?', 5)
    `);

    await queryRunner.query(`
      INSERT INTO ${schema}."question_options" ("question_id", "option_text", "score_value")
      SELECT q."question_id", v."option_text", v."score_value"
      FROM ${schema}."survey_questions" q
      JOIN (
        VALUES
          (1, 'Không', 0),
          (1, 'Nhẹ', 1),
          (1, 'Nhiều', 2),
          (2, 'Không', 0),
          (2, '1 lần', 2),
          (2, '≥2 lần', 3),
          (3, 'Không', 0),
          (3, 'Nhẹ', 1),
          (3, 'Nặng', 2),
          (4, 'Bình thường', 0),
          (4, 'Ít', 1),
          (4, 'Không ăn', 2),
          (5, 'Có', 0),
          (5, 'Chưa', 1)
      ) AS v("order_number", "option_text", "score_value")
        ON q."order_number" = v."order_number"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemaName = process.env.DB_SCHEMA ?? 'public';
    const schema = `"${schemaName}"`;

    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessment_details" DROP CONSTRAINT IF EXISTS "FK_patient_assessment_details_selected_option_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessment_details" DROP CONSTRAINT IF EXISTS "FK_patient_assessment_details_question_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."patient_assessment_details" DROP CONSTRAINT IF EXISTS "FK_patient_assessment_details_assessment_id"`);
    await queryRunner.query(`ALTER TABLE ${schema}."question_options"           DROP CONSTRAINT IF EXISTS "FK_question_options_question_id"`);

    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."patient_assessment_details"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."question_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${schema}."survey_questions"`);
  }
}
