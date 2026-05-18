import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappSentAtToInfraction1779148800000
  implements MigrationInterface
{
  name = 'AddWhatsappSentAtToInfraction1779148800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "infraction" ADD "whatsappSentAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "infraction"."whatsappSentAt" IS 'When the WhatsApp alert was sent to the resident.'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "infraction"."whatsappSentAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "infraction" DROP COLUMN "whatsappSentAt"`,
    );
  }
}
