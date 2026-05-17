import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegimentoToCondominium1778949914298
  implements MigrationInterface
{
  name = 'AddRegimentoToCondominium1778949914298';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "condominium" ADD "regimentoFilename" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "condominium" ADD "regimentoContent" bytea`,
    );
    await queryRunner.query(
      `ALTER TABLE "condominium" ADD "regimentoUploadedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "condominium" DROP COLUMN "regimentoUploadedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "condominium" DROP COLUMN "regimentoContent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "condominium" DROP COLUMN "regimentoFilename"`,
    );
  }
}
