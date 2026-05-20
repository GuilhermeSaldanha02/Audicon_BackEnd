import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMustChangePassword1779667200000 implements MigrationInterface {
  name = 'AddMustChangePassword1779667200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "mustChangePassword" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "mustChangePassword"`,
    );
  }
}
