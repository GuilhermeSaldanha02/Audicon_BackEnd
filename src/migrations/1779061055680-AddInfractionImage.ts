import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInfractionImage1779061055680 implements MigrationInterface {
  name = 'AddInfractionImage1779061055680';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "infraction_image" ("id" SERIAL NOT NULL, "filename" character varying NOT NULL, "mimetype" character varying NOT NULL, "sizeBytes" integer NOT NULL, "content" bytea NOT NULL, "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(), "infractionId" integer, CONSTRAINT "PK_4e71b2105cb764245a0c067f456" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c017ffc56b289eebdcfd29bbb4" ON "infraction_image" ("infractionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "infraction_image" ADD CONSTRAINT "FK_c017ffc56b289eebdcfd29bbb4f" FOREIGN KEY ("infractionId") REFERENCES "infraction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "infraction_image" DROP CONSTRAINT "FK_c017ffc56b289eebdcfd29bbb4f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c017ffc56b289eebdcfd29bbb4"`,
    );
    await queryRunner.query(`DROP TABLE "infraction_image"`);
  }
}
