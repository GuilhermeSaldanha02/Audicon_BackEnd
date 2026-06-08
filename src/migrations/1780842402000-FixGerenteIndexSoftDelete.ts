import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * R-17 — Corrige o índice único parcial "um GERENTE por empresa" para
 * ignorar usuários soft-deleted (deletedAt IS NULL).
 *
 * Problema original (AddUserRole): a condição era só `role = 'GERENTE'`,
 * portanto um GERENTE desativado (deletedAt preenchido) ainda ocupava a
 * vaga — impossibilitando promover outro FUNCIONARIO sem limpeza manual.
 *
 * Recriação transacional na mesma migration (DROP → CREATE) sem janela
 * de inconsistência: a nova condição é subconjunto estrito da anterior,
 * portanto nenhum dado existente viola o novo índice.
 *
 * down() reconstrói a versão sem o filtro de deletedAt (estado anterior).
 */
export class FixGerenteIndexSoftDelete1780842402000
  implements MigrationInterface
{
  name = 'FixGerenteIndexSoftDelete1780842402000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_user_one_gerente_per_company"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_one_gerente_per_company"
         ON "user" ("companyId")
         WHERE "role" = 'GERENTE' AND "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ATENÇÃO: restaura o índice sem filtro de deletedAt — estado vulnerável
    // onde um GERENTE soft-deleted ainda ocupa a vaga da empresa, impedindo
    // promover outro FUNCIONARIO. Use down() só para rollback controlado.
    await queryRunner.query(
      `DROP INDEX "public"."UQ_user_one_gerente_per_company"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_one_gerente_per_company"
         ON "user" ("companyId")
         WHERE "role" = 'GERENTE'`,
    );
  }
}
