import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * R-16: soft-delete (desativação) de usuário.
 *
 * Adiciona a coluna `deletedAt` ao `user` para o @DeleteDateColumn do TypeORM.
 * Backfill é trivial: a coluna nasce NULL = todos os usuários existentes ficam
 * ATIVOS. Não há UPDATE de dados.
 *
 * NOTA: a migration auto-gerada (`migration:generate`) vinha poluída com churn
 * não relacionado (rename do enum system_role_enum, recriação de índices com
 * nomes autogerados, troca de semântica de FK e — perigoso — DROP do índice
 * único parcial `UQ_user_one_gerente_per_company` que sustenta a trava de
 * "um GERENTE por empresa"). Esse ruído vem do schema ter sido criado por
 * migrations à mão com convenções que o TypeORM não reconhece. Mantemos aqui
 * SOMENTE a mudança real desta tarefa.
 */
export class AddUserSoftDelete1780756001972 implements MigrationInterface {
  name = 'AddUserSoftDelete1780756001972';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "deletedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "deletedAt"`);
  }
}
