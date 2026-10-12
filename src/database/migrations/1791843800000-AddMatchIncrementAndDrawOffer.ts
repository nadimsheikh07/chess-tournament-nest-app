import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMatchIncrementAndDrawOffer1791843800000
  implements MigrationInterface
{
  name = 'AddMatchIncrementAndDrawOffer1791843800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "incrementMs" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "drawOfferedBy" uuid`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN IF EXISTS "drawOfferedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN IF EXISTS "incrementMs"`,
    );
  }
}
