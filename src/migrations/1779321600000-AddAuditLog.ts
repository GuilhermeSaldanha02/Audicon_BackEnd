import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLog1779321600000 implements MigrationInterface {
  name = 'AddAuditLog1779321600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_log" (
        "id" SERIAL NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" integer,
        "userEmail" character varying,
        "userIsMaster" boolean NOT NULL DEFAULT false,
        "companyId" integer,
        "action" character varying NOT NULL,
        "entity" character varying NOT NULL,
        "entityId" integer,
        "context" jsonb,
        CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_companyId" ON "audit_log" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_action" ON "audit_log" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_log_entity" ON "audit_log" ("entity")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_entity"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_action"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_log_companyId"`);
    await queryRunner.query(`DROP TABLE "audit_log"`);
  }
}
