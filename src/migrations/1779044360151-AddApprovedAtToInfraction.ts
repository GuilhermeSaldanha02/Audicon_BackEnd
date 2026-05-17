import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovedAtToInfraction1779044360151
  implements MigrationInterface
{
  name = 'AddApprovedAtToInfraction1779044360151';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "infraction" ADD "approvedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "infraction"."approvedAt" IS 'When the infraction was approved by staff.'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "infraction"."approvedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "infraction" DROP COLUMN "approvedAt"`,
    );
  }
}
