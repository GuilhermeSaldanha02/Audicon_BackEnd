import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSentAtToInfraction1779058281446 implements MigrationInterface {
  name = 'AddSentAtToInfraction1779058281446';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "infraction" ADD "sentAt" TIMESTAMP`);
    await queryRunner.query(
      `COMMENT ON COLUMN "infraction"."sentAt" IS 'When the infraction notification was sent to the resident.'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON COLUMN "infraction"."sentAt" IS NULL`);
    await queryRunner.query(`ALTER TABLE "infraction" DROP COLUMN "sentAt"`);
  }
}
