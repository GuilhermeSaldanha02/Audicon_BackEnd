import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * R-03+04 — Aposenta o modelo de papel-por-condomínio: dropa a tabela
 * user_condominium e o tipo PG user_condominium_role_enum.
 *
 * Pré-condição (validada no docs/discovery-resident.md): tabela vazia
 * no banco demo (0 rows). Em ambientes com dados, garantir backup
 * antes de aplicar — esta migration é DESTRUTIVA.
 *
 * down() recria a estrutura vazia para permitir rollback do schema —
 * dados originais NÃO são restaurados.
 */
export class DropUserCondominium1779840000000 implements MigrationInterface {
  name = 'DropUserCondominium1779840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_condominium"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."user_condominium_role_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_condominium_role_enum" AS ENUM('ADMIN', 'MANAGER', 'RESIDENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_condominium" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "condominiumId" integer NOT NULL,
        "role" "public"."user_condominium_role_enum" NOT NULL,
        CONSTRAINT "PK_user_condominium" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_condominium_user_condo" UNIQUE ("userId", "condominiumId"),
        CONSTRAINT "FK_user_condominium_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_condominium_condominium" FOREIGN KEY ("condominiumId") REFERENCES "condominium"("id") ON DELETE CASCADE
      )`,
    );
  }
}
