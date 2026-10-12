import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSwissTournamentSupport1791843780000
  implements MigrationInterface
{
  name = 'AddSwissTournamentSupport1791843780000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tournaments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "tournaments_status_enum" RENAME TO "tournaments_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "tournaments_status_enum" AS ENUM('draft', 'open', 'ongoing', 'completed')`,
    );
    await queryRunner.query(`
      ALTER TABLE "tournaments"
      ALTER COLUMN "status" TYPE "tournaments_status_enum"
      USING (
        CASE "status"::text
          WHEN 'upcoming' THEN 'open'
          WHEN 'active' THEN 'ongoing'
          WHEN 'cancelled' THEN 'completed'
          ELSE "status"::text
        END
      )::"tournaments_status_enum"
    `);
    await queryRunner.query(
      `DROP TYPE "tournaments_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" ADD "timeControl" character varying(20) NOT NULL DEFAULT '5+0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" ADD "currentRound" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_participants" ADD "byeCount" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_participants" ALTER COLUMN "points" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "tournament_participants"
      ALTER COLUMN "points" TYPE double precision
      USING "points"::double precision
    `);
    await queryRunner.query(
      `ALTER TABLE "tournament_participants" ALTER COLUMN "points" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD "roundNumber" integer`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "tournament_participants"
          WHERE "points" <> TRUNC("points")
        ) THEN
          RAISE EXCEPTION 'Cannot roll back Swiss tournament scores with fractional points';
        END IF;
      END;
      $$
    `);
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN "roundNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_participants" ALTER COLUMN "points" DROP DEFAULT`,
    );
    await queryRunner.query(`
      ALTER TABLE "tournament_participants"
      ALTER COLUMN "points" TYPE integer
      USING ROUND("points")::integer
    `);
    await queryRunner.query(
      `ALTER TABLE "tournament_participants" ALTER COLUMN "points" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournament_participants" DROP COLUMN "byeCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" DROP COLUMN "currentRound"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" DROP COLUMN "timeControl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TYPE "tournaments_status_enum" RENAME TO "tournaments_status_enum_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE "tournaments_status_enum" AS ENUM('draft', 'upcoming', 'active', 'completed', 'cancelled')`,
    );
    await queryRunner.query(`
      ALTER TABLE "tournaments"
      ALTER COLUMN "status" TYPE "tournaments_status_enum"
      USING (
        CASE "status"::text
          WHEN 'open' THEN 'upcoming'
          WHEN 'ongoing' THEN 'active'
          ELSE "status"::text
        END
      )::"tournaments_status_enum"
    `);
    await queryRunner.query(
      `DROP TYPE "tournaments_status_enum_new"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tournaments" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
  }
}
