import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDelete1779408000000 implements MigrationInterface {
  name = 'AddSoftDelete1779408000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "condominium" ADD "deletedAt" TIMESTAMP`,
    );
    await queryRunner.query(`ALTER TABLE "unit" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "infraction" ADD "deletedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "infraction" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "unit" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "condominium" DROP COLUMN "deletedAt"`,
    );
  }
}
