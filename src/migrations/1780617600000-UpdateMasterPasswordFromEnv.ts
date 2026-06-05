import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { requireEnv } from '../common/config/require-env';
import { validateMasterPassword } from '../common/config/master-password';

// Mesmo cost factor do resto do sistema (user.entity.ts, users.service.ts,
// companies.service.ts, SeedMasterFromEnv) — TEM que casar com o bcrypt.compare
// do login (auth.service.ts), senão o Master não autentica.
const BCRYPT_COST = 10;

/**
 * R-14 — Corrige a senha do Master usando MASTER_PASSWORD do ambiente.
 *
 * Por quê: o Master é criado pela migration legada AddCompanyAndMasterUser com
 * um hash bcrypt FIXO e PÚBLICO (versionado no git). O SeedMasterFromEnv valida
 * MASTER_PASSWORD no boot mas NÃO o aplica (pula porque o Master já existe). Em
 * produção, isso deixaria o Master com a senha pública do git (CWE-798 / OWASP
 * A07). Esta migration roda DEPOIS da legada (timestamp posterior) e dentro do
 * mesmo release (migration:run:prod), então o Master nunca fica no ar com a
 * senha do git: o release que cria já corrige.
 *
 * Identificação por `isMaster = true` (e não por MASTER_EMAIL): o Master é um
 * singleton garantidamente presente neste ponto. Selecionar por email seria
 * frágil — se MASTER_EMAIL divergisse do email gravado, o UPDATE casaria 0 linhas
 * silenciosamente, deixando a senha pública. O RETURNING + checagem de 0 linhas
 * torna esse caso um erro alto, nunca um no-op silencioso.
 */
export class UpdateMasterPasswordFromEnv1780617600000
  implements MigrationInterface
{
  name = 'UpdateMasterPasswordFromEnv1780617600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Roda fora do pipeline ConfigModule/Joi — lê e valida o env aqui. Sem
    // fallback: requireEnv lança erro claro se ausente/vazio.
    const password = requireEnv('MASTER_PASSWORD');
    validateMasterPassword(password);

    // Conta os Masters via SELECT (retorno confiável de linhas). Não usar o
    // resultado de UPDATE...RETURNING para contar: o queryRunner.query do
    // TypeORM devolve uma tupla [linhas, affectedCount] nesse driver, o que
    // tornaria a contagem incorreta.
    const masters: Array<{ id: number }> = await queryRunner.query(
      `SELECT "id" FROM "user" WHERE "isMaster" = true`,
    );
    if (!Array.isArray(masters) || masters.length === 0) {
      throw new Error(
        '[UpdateMasterPasswordFromEnv] Nenhum usuário Master encontrado para atualizar.',
      );
    }

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    await queryRunner.query(
      `UPDATE "user" SET "senha" = $1 WHERE "isMaster" = true`,
      [hash],
    );

    // eslint-disable-next-line no-console
    console.log(
      `[UpdateMasterPasswordFromEnv] Senha do Master definida a partir do ambiente (${masters.length} registro(s)).`,
    );
  }

  public async down(): Promise<void> {
    // No-op intencional (mesma justificativa do SeedMasterFromEnv): reverter a
    // credencial do dono do sistema automaticamente é perigoso — dependeria do
    // env presente no revert e poderia restaurar a senha pública do git. Se um
    // rollback for realmente necessário, rotacione a senha do Master manualmente.
  }
}
