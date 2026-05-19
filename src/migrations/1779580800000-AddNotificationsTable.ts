import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsTable1779580800000 implements MigrationInterface {
  name = 'AddNotificationsTable1779580800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notification_channel_enum" AS ENUM('email', 'whatsapp')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notification_status_enum" AS ENUM('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification" (
        "id" SERIAL NOT NULL,
        "channel" "public"."notification_channel_enum" NOT NULL,
        "recipient" character varying NOT NULL,
        "providerId" character varying(255),
        "status" "public"."notification_status_enum" NOT NULL DEFAULT 'sent',
        "failureReason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "infractionId" integer,
        CONSTRAINT "PK_notification" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_providerId" ON "notification" ("providerId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ADD CONSTRAINT "FK_notification_infraction" FOREIGN KEY ("infractionId") REFERENCES "infraction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" DROP CONSTRAINT "FK_notification_infraction"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_providerId"`,
    );
    await queryRunner.query(`DROP TABLE "notification"`);
    await queryRunner.query(`DROP TYPE "public"."notification_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notification_channel_enum"`);
  }
}
