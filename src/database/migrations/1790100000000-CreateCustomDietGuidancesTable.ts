import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomDietGuidancesTable1790100000000 implements MigrationInterface {
  name = 'CreateCustomDietGuidancesTable1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "custom_diet_guidances" (
        "custom_diet_id" SERIAL PRIMARY KEY,
        "case_id" VARCHAR NOT NULL,
        "doctor_id" INT NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "label" VARCHAR(100) NOT NULL DEFAULT 'Chế độ ăn chỉ định riêng',
        "meals_per_day_min" INT,
        "meals_per_day_max" INT,
        "meal_instruction" TEXT,
        "volume_per_meal_min" INT,
        "volume_per_meal_max" INT,
        "volume_instruction" TEXT,
        "recommended_foods" TEXT[] NOT NULL DEFAULT '{}',
        "recommended_drinks" TEXT[] NOT NULL DEFAULT '{}',
        "forbidden_foods" TEXT[] NOT NULL DEFAULT '{}',
        "forbidden_drinks" TEXT[] NOT NULL DEFAULT '{}',
        "doctor_notes" TEXT,
        "updated_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_custom_diet_case_id" FOREIGN KEY ("case_id") REFERENCES "patient_cases"("case_id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_custom_diet_doctor_id" FOREIGN KEY ("doctor_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_custom_diet_case_id" ON "custom_diet_guidances" ("case_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_custom_diet_is_active" ON "custom_diet_guidances" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_custom_diet_is_active"`);
    await queryRunner.query(`DROP INDEX "IDX_custom_diet_case_id"`);
    await queryRunner.query(`DROP TABLE "custom_diet_guidances"`);
  }
}
