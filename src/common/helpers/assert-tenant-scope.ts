import { ForbiddenException } from '@nestjs/common';

export interface TenantUser {
  isMaster?: boolean;
  companyId?: number | null;
}

export interface TenantScope {
  /**
   * companyId a aplicar no WHERE da query.
   * `null` significa "sem filtro" — usado apenas quando o usuário é master
   * sem override explícito (master vê todas as empresas).
   */
  companyId: number | null;
  isMaster: boolean;
}

/**
 * Resolve o escopo de tenant a partir do usuário autenticado.
 *
 * Centraliza o padrão antes espalhado como `if (!isMaster && companyId)` em
 * múltiplos services, que era silently permissive: se um non-master nascesse
 * com `companyId = null` (estado teoricamente impossível, mas não enforced no
 * schema — `User.companyId` é nullable para acomodar o master), a query rodava
 * sem filtro de empresa e vazava dados.
 *
 * - Master sem override → `{ companyId: null, isMaster: true }` (vê tudo)
 * - Master com override válido → `{ companyId: override, isMaster: true }`
 * - Non-master com companyId válido (> 0) → `{ companyId: x, isMaster: false }`
 * - Non-master sem companyId válido → ForbiddenException
 * - User undefined → ForbiddenException
 */
export function assertTenantScope(
  user: TenantUser | undefined | null,
  opts: { masterOverrideCompanyId?: number | null } = {},
): TenantScope {
  if (!user) {
    throw new ForbiddenException('Não autenticado.');
  }
  const isMaster = !!user.isMaster;
  if (isMaster) {
    const override = opts.masterOverrideCompanyId;
    return {
      isMaster: true,
      companyId: typeof override === 'number' && override > 0 ? override : null,
    };
  }
  const cid = user.companyId;
  if (typeof cid !== 'number' || cid <= 0) {
    throw new ForbiddenException(
      'Usuário sem empresa associada não pode acessar este recurso.',
    );
  }
  return { isMaster: false, companyId: cid };
}
