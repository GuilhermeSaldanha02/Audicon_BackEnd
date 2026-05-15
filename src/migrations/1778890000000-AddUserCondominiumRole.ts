import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserCondominiumRole1778890000000 implements MigrationInterface {
  name = 'AddUserCondominiumRole1778890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_condominium_role_enum" AS ENUM('ADMIN', 'MANAGER', 'RESIDENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_condominium" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "condominiumId" integer NOT NULL,
        "role" "public"."user_condominium_role_enum" NOT NULL,
        CONSTRAINT "UQ_user_condominium_user_condo" UNIQUE ("userId", "condominiumId"),
        CONSTRAINT "PK_user_condominium" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_condominium"
        ADD CONSTRAINT "FK_user_condominium_user"
        FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_condominium"
        ADD CONSTRAINT "FK_user_condominium_condominium"
        FOREIGN KEY ("condominiumId") REFERENCES "condominium"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_condominium" DROP CONSTRAINT "FK_user_condominium_condominium"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_condominium" DROP CONSTRAINT "FK_user_condominium_user"`,
    );
    await queryRunner.query(`DROP TABLE "user_condominium"`);
    await queryRunner.query(`DROP TYPE "public"."user_condominium_role_enum"`);
  }
}
