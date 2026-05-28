import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * R-02 — Introduz o enum de papéis-alvo (MASTER|GERENTE|FUNCIONARIO) em User.role.
 *
 * - Adiciona a coluna COM default temporário só para popular linhas existentes
 *   (banco demo); em seguida REMOVE o default — o papel passa a ser obrigatório
 *   e explícito em todo INSERT (informação de segurança, sem default silencioso).
 * - Corrige o master pela flag isMaster (única atualização; não é backfill por
 *   membership de user_condominium).
 * - Cria índice único parcial garantindo no máximo um GERENTE por empresa.
 *
 * NÃO remove RESIDENT nem user_condominium (R-03/R-04).
 */
export class AddUserRole1779753600000 implements MigrationInterface {
  name = 'AddUserRole1779753600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."system_role_enum" AS ENUM('MASTER', 'GERENTE', 'FUNCIONARIO')`,
    );
    // default temporário só para popular as linhas já existentes
    await queryRunner.query(
      `ALTER TABLE "user" ADD "role" "public"."system_role_enum" NOT NULL DEFAULT 'FUNCIONARIO'`,
    );
    // master correto pela flag (não é CASE sobre membership)
    await queryRunner.query(
      `UPDATE "user" SET "role" = 'MASTER' WHERE "isMaster" = true`,
    );
    // remove o default: a partir daqui todo INSERT deve informar role
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT`,
    );
    // trava: no máximo um GERENTE por empresa
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_one_gerente_per_company" ON "user" ("companyId") WHERE "role" = 'GERENTE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_user_one_gerente_per_company"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."system_role_enum"`);
  }
}
