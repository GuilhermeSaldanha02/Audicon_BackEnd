import { MigrationInterface, QueryRunner } from 'typeorm';

const MASTER_PASSWORD_HASH =
  '$2b$10$KidSLi20qTU4MIP0Ij8rkeLWbCeS6zEAfpn3LtYnYunMM7kTZV8p2'; // MasterAudicon@2026

export class AddCompanyAndMasterUser1779235200000
  implements MigrationInterface
{
  name = 'AddCompanyAndMasterUser1779235200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. company table
    await queryRunner.query(
      `CREATE TABLE "company" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "cnpj" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_company_cnpj" UNIQUE ("cnpj"),
        CONSTRAINT "PK_company_id" PRIMARY KEY ("id")
      )`,
    );

    // 2. user.isMaster + user.companyId (nullable for backfill)
    await queryRunner.query(
      `ALTER TABLE "user" ADD "isMaster" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "companyId" integer`);
    await queryRunner.query(
      `CREATE INDEX "IDX_user_companyId" ON "user" ("companyId")`,
    );

    // 3. condominium.companyId (nullable for backfill)
    await queryRunner.query(
      `ALTER TABLE "condominium" ADD "companyId" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_condominium_companyId" ON "condominium" ("companyId")`,
    );

    // 4. Seed "Empresa Demo" with id=1
    await queryRunner.query(
      `INSERT INTO "company" ("id", "name", "cnpj") VALUES (1, 'Empresa Demo Audicon', '00.000.000/0001-00')`,
    );
    await queryRunner.query(
      `SELECT setval(pg_get_serial_sequence('company', 'id'), 1, true)`,
    );

    // 5. Backfill existing users and condominiums to company 1
    await queryRunner.query(`UPDATE "user" SET "companyId" = 1`);
    await queryRunner.query(`UPDATE "condominium" SET "companyId" = 1`);

    // 6. Seed master user (companyId stays NULL)
    await queryRunner.query(
      `INSERT INTO "user" ("nome", "email", "senha", "isMaster", "companyId")
       VALUES ('Master Audicon', 'master@audicon.com', $1, true, NULL)`,
      [MASTER_PASSWORD_HASH],
    );

    // 7. Foreign keys
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_user_company" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "condominium" ADD CONSTRAINT "FK_condominium_company" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    // 8. Make condominium.companyId NOT NULL (user.companyId stays nullable for master)
    await queryRunner.query(
      `ALTER TABLE "condominium" ALTER COLUMN "companyId" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "condominium" DROP CONSTRAINT "FK_condominium_company"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_user_company"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_condominium_companyId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_companyId"`);
    await queryRunner.query(
      `ALTER TABLE "condominium" DROP COLUMN "companyId"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "companyId"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isMaster"`);
    await queryRunner.query(`DROP TABLE "company"`);
  }
}
