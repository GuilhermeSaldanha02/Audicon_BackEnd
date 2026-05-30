import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { requireEnv } from '../common/config/require-env';
import { validateMasterPassword } from '../common/config/master-password';

// Same cost factor the rest of the system uses (see user.entity.ts,
// users.service.ts, companies.service.ts).
const BCRYPT_COST = 10;

export class SeedMasterFromEnv1779926400000 implements MigrationInterface {
  name = 'SeedMasterFromEnv1779926400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotency — "the Master is a singleton". If any Master already exists
    // (e.g. the one seeded with a fixed hash by AddCompanyAndMasterUser), do
    // nothing, even if MASTER_EMAIL in the environment differs. Rotating an
    // existing Master's credentials is an explicit operational task, never
    // something a migration does silently. This prevents accidentally creating
    // parallel Masters.
    const existing = await queryRunner.query(
      `SELECT 1 FROM "user" WHERE "isMaster" = true LIMIT 1`,
    );
    if (Array.isArray(existing) && existing.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        '[SeedMasterFromEnv] A Master user already exists — skipping seed.',
      );
      return;
    }

    // This migration runs OUTSIDE the Nest ConfigModule/Joi pipeline, so it
    // reads and validates the env itself. requireEnv throws a clear
    // MissingEnvVarError if unset/empty.
    const email = requireEnv('MASTER_EMAIL');
    const password = requireEnv('MASTER_PASSWORD');

    // Floor check so the migration fails fast instead of seeding junk. The
    // full strong-password rule (upper/lower/digit/symbol) lives in the Joi
    // schema and runs at app boot.
    validateMasterPassword(password);

    const hash = await bcrypt.hash(password, BCRYPT_COST);

    await queryRunner.query(
      `INSERT INTO "user" ("nome", "email", "senha", "isMaster", "companyId")
       VALUES ('Master Audicon', $1, $2, true, NULL)`,
      [email, hash],
    );

    // eslint-disable-next-line no-console
    console.log(`[SeedMasterFromEnv] Master user created for ${email}.`);
  }

  public async down(): Promise<void> {
    // Intentional no-op. Rolling back the system owner must be an explicit
    // manual operation, never automatic: an automated down() would depend on
    // the environment being present at revert time and could delete the sole
    // Master by accident. Remove the Master manually if a rollback is ever
    // truly required.
  }
}
