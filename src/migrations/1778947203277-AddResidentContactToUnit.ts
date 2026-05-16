import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResidentContactToUnit1778947203277
  implements MigrationInterface
{
  name = 'AddResidentContactToUnit1778947203277';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "unit" ADD "residentEmail" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "unit" ADD "residentPhone" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "unit" DROP COLUMN "residentPhone"`);
    await queryRunner.query(`ALTER TABLE "unit" DROP COLUMN "residentEmail"`);
  }
}
