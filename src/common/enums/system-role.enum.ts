/**
 * Papel do usuário no sistema, por empresa (modelo-alvo do SDD v3.0).
 *
 * Não confundir com `UserRole` (ADMIN/MANAGER/RESIDENT), que é o papel
 * legado por condomínio (tabela `user_condominium`) — removido em R-03/R-04.
 */
export enum SystemRole {
  MASTER = 'MASTER',
  GERENTE = 'GERENTE',
  FUNCIONARIO = 'FUNCIONARIO',
}
