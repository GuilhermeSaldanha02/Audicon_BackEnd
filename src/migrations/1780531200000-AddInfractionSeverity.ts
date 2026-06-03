import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona a coluna `severity` (gravidade) à infração — conceito central do
 * produto, classificado pelo operador no registro.
 *
 * A coluna é NOT NULL e SEM default (o operador DEVE classificar na criação).
 * Para não quebrar linhas legadas, o ADD COLUMN usa DEFAULT 'MEDIA' apenas para
 * backfill e em seguida o default é removido — alinhando o schema com a entity
 * (que declara o enum sem default).
 */
export class AddInfractionSeverity1780531200000 implements MigrationInterface {
  name = 'AddInfractionSeverity1780531200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."infraction_severity_enum" AS ENUM('LEVE', 'MEDIA', 'GRAVE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "infraction" ADD "severity" "public"."infraction_severity_enum" NOT NULL DEFAULT 'MEDIA'`,
    );
    await queryRunner.query(
      `ALTER TABLE "infraction" ALTER COLUMN "severity" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "infraction" DROP COLUMN "severity"`);
    await queryRunner.query(`DROP TYPE "public"."infraction_severity_enum"`);
  }
}
