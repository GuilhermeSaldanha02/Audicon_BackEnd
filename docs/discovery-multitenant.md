# Mini-Discovery — Estado real do multi-tenant por empresa

> **Tipo:** Discovery somente-leitura (nenhum código alterado).
> **Base:** `master` (commit `124efd7`, 2026-05-22).
> **Data:** 2026-05-26.
> **Objetivo:** mapear com precisão o que já existe no `master` relativo a multi-tenancy **por empresa**, para a futura refatoração (papéis `MASTER|GERENTE|FUNCIONARIO`, remoção de `RESIDENT`) não recriar o que já está pronto.
> **Relacionado:** [`state-of-code.md`](./state-of-code.md) §7 (divergências SDD v2.0) · [`rbac.md`](./rbac.md).

---

## Resumo (TL;DR)

- A entidade **`Company` já existe** e é o topo da hierarquia (✅). Tem `id`, `name`, `cnpj`, `createdAt` e relações 1→N com `User` e `Condominium`.
- **`companyId` como coluna existe em 3 entidades:** `Condominium` (NOT NULL), `User` (nullable — master = NULL) e `AuditLog` (nullable). **`Unit` e `Infraction` NÃO têm `companyId`** — derivam a empresa pela cadeia `Unit → Condominium.companyId` e `Infraction → Unit → Condominium.companyId`.
- O vínculo usuário↔condomínio vive em **`user_condominium`** com **papel por condomínio** (`ADMIN|MANAGER|RESIDENT`). Esse é o ponto de maior divergência com o modelo-alvo (papel por empresa).
- **NÃO existe mecanismo central** de isolamento (sem query scope global / interceptor). O isolamento é feito por **guards dedicados + filtro `companyId` passado manualmente** a alguns services.
- **`RESIDENT`** aparece em 8 lugares de código (1 enum, 3 decorators de controller, 1 migration) + 4 no spec de condominiums — esforço de remoção **baixo-médio** (inclui 1 migration para alterar o enum do banco).

---

## 1. A entidade `Company` já existe?

**Sim.** [src/companies/entities/company.entity.ts](../src/companies/entities/company.entity.ts):

| Campo | Tipo | Observação |
|---|---|---|
| `id` | PK serial | |
| `name` | varchar | |
| `cnpj` | varchar | **unique** |
| `createdAt` | timestamp | `@CreateDateColumn` |
| `users` | `User[]` | `@OneToMany` (inverso de `User.company`) |
| `condominiums` | `Condominium[]` | `@OneToMany` (inverso de `Condominium.company`) |

**Migration:** [`1779235200000-AddCompanyAndMasterUser.ts`](../src/migrations/1779235200000-AddCompanyAndMasterUser.ts). Além de criar a tabela `company`, ela:
- adiciona `user.isMaster` + `user.companyId` (com índice);
- adiciona `condominium.companyId` (com índice);
- **semeia** uma "Empresa Demo Audicon" (id=1) e faz **backfill** de todos os users/condomínios existentes para ela;
- semeia o **master** (`master@audicon.com`, hash bcrypt **hard-coded** — ver divergência em state-of-code §7.3) com `companyId = NULL`;
- cria FKs: `user.companyId → company` (`ON DELETE SET NULL`), `condominium.companyId → company` (`ON DELETE RESTRICT`);
- torna `condominium.companyId` **NOT NULL** (user permanece nullable para o master).

Módulo/CRUD: [`CompaniesModule`](../src/companies/) — controller **master-only** (`JwtAuthGuard + MasterGuard`), service com criação de empresa+admin, reset de senha, listagem de usuários/condomínios, exclusão com limpeza em cascata manual.

---

## 2. Quais entidades já têm `companyId`?

| Entidade | `companyId`? | Como |
|---|---|---|
| `Company` | — | é o próprio tenant |
| `User` | ✅ coluna nullable | `companyId: number \| null` + FK (master = NULL). Sem coluna `role` (papel vive em `user_condominium`). |
| `Condominium` | ✅ coluna **NOT NULL** | `companyId: number` + FK RESTRICT + `@Index` |
| `AuditLog` | ✅ coluna nullable | `companyId` indexado (escopo do log; aceita override quando ator é master) |
| **`Unit`** | ❌ **não tem** | deriva via `Unit.condominium.companyId` |
| **`Infraction`** | ❌ **não tem** | deriva via `Infraction.unit.condominium.companyId` |
| `InfractionImage` | ❌ não tem | deriva via `infraction → unit → condominium` |
| `Notification` | ❌ não tem | deriva via `infraction → ...` |
| `UserCondominium` | ❌ não tem | tem `userId` + `condominiumId` (empresa derivada do condomínio) |

➡️ **Implicação para a refatoração:** o tenant é "ancorado" em `Condominium.companyId`. Toda checagem de empresa para unidade/infração depende de **join** até o condomínio. Se a refatoração quiser filtros mais baratos/diretos, considerar desnormalizar `companyId` em `Unit`/`Infraction` — mas hoje **não** é necessário para correção, só performance.

---

## 3. Vínculo usuário↔condomínio (`user_condominium`) — e o que muda no modelo por empresa

**Hoje** ([user-condominium.entity.ts](../src/users/entities/user-condominium.entity.ts)):

```
user_condominium (
  id, userId, condominiumId,
  role: ENUM('ADMIN','MANAGER','RESIDENT'),
  UNIQUE(userId, condominiumId)
)
```

- Papel é **por condomínio**: o mesmo usuário pode ser `ADMIN` no condomínio A e `RESIDENT` no B.
- FKs `ON DELETE CASCADE` para user e condominium.
- Ao criar um condomínio, o criador vira `ADMIN` automaticamente; membros são adicionados via `POST /condominiums/:id/members`.
- O **`RolesGuard`** ([roles.guard.ts](../src/common/guards/roles.guard.ts)) resolve o papel **olhando esta tabela** pelo `condominiumId` da rota (`params.condominiumId ?? params.id`).
- Migration: [`1778890000000-AddUserCondominiumRole.ts`](../src/migrations/1778890000000-AddUserCondominiumRole.ts).

**O que muda se o modelo passar a ser por empresa (`MASTER|GERENTE|FUNCIONARIO`):**

| Aspecto | Hoje (por condomínio) | Alvo (por empresa) |
|---|---|---|
| Onde mora o papel | `user_condominium.role` | provavelmente `User.role` (1 papel por empresa) |
| Granularidade | papel distinto por condomínio | papel único no escopo da empresa |
| `RolesGuard` | lookup em `user_condominium` por `condominiumId` | checar `User.role` + escopo `companyId` (sem depender de condomínio) |
| `user_condominium` | tabela de papel + membership | candidata a **virar tabela de atribuição sem papel** (quais condomínios um funcionário gere) **ou ser removida**, conforme decisão |
| Master | `isMaster` boolean | manter `isMaster` **ou** virar valor de enum `MASTER` |

➡️ **Decisão futura a registrar:** se `GERENTE` pode tudo na empresa e `FUNCIONARIO` só escreve infração, o papel não precisa mais ser por condomínio. `user_condominium` perde a coluna `role` (e talvez a tabela inteira, se "quais condomínios" deixar de ser uma restrição por usuário). Isso é refatoração de schema (migration) — **fora do escopo desta Discovery**.

---

## 4. O que o `feat/infraction-company-isolation` de fato implementou

Branch **mergeada** (PR #31). O commit central é **`d08875d` — T-MT-04 "isolation de infrações por empresa"**. Resolveu a vulnerabilidade de funcionário da empresa A ler/editar infração da empresa B sabendo o ID. Entregou:

- **`InfractionAccessGuard`** ([infraction-access.guard.ts](../src/common/guards/infraction-access.guard.ts)): para rotas `/infractions/:id/*`, faz lookup `Infraction → Unit → Condominium → companyId` e valida `=== user.companyId`. Master bypassa. 404 se não existe; 403 se empresa diferente.
  - Aplicado em: `GET/PATCH/DELETE /:id`, `/analyze`, `/approve`, `/send`, `/send-whatsapp`, `/document` e **todas** as rotas de `/images`.
- **`InfractionsService.create`**: valida que `dto.unitId` pertence à empresa do solicitante (`condo.companyId !== requesterCompanyId` → erro).
- **`InfractionsService.findAll`**: filtra por `companyId` do solicitante via `qb.andWhere('condo.companyId = :companyId')` (master vê tudo).
- Controller passa `req.user.companyId + isMaster` (hoje via `@CurrentActor`).
- Testes: 7 cenários do guard + 3 do create + specs de controller com `overrideGuard`.

> Obs.: o **rótulo** da branch é mais amplo do que o nome sugere — ela também carregou commits de audit log, dashboard, reset de senha, listagem de usuários e authz master/admin. Mas o núcleo de *isolation de infração* é o `d08875d`.

---

## 5. Existe mecanismo central de isolamento de tenant?

**Não.** Não há query scope global, subscriber do TypeORM, nem interceptor central que injete `companyId`. O isolamento é uma **combinação** de:

**(a) Guards dedicados** (`src/common/guards/`):
- `MasterGuard` — exige `isMaster` (rotas master-only: companies, criar/remover condomínio).
- `InfractionAccessGuard` — lookup da cadeia até `companyId` para `/infractions/:id/*` e `/images`.
- `CompanyAdminGuard` — exige que o usuário seja `ADMIN` de pelo menos um condomínio da própria empresa.
- `RolesGuard` — papel por condomínio via `user_condominium`.

**(b) Filtro `companyId` passado manualmente a services** (parâmetro de método):
- `InfractionsService.create` (valida) e `findAll` (filtra) — recebem `companyId` + `isMaster`.
- `CondominiumsService.findAll` — `innerJoin` em `memberships` por `userId` + `andWhere c.companyId`.
- `DashboardService.getMetrics(companyId, isMaster)` — filtra por `condo.companyId`.
- `AuditService.list({ companyId })` — escopo por empresa.

**(c) Lacuna observada:** `UnitsService` **não filtra por `companyId`** diretamente. As rotas de unidade (`/condominiums/:condominiumId/units`) são protegidas pelo `RolesGuard` (membership no condomínio), o que indiretamente restringe — mas não há checagem explícita de empresa na camada de service. Vale verificar no esforço de reconciliação se há rota de unidade que escape do `RolesGuard`.

➡️ **Divergência com C9 do SDD** (já registrada em state-of-code §7.2): o SDD pede mecanismo **único e central**, "nunca repetido manualmente por service". A realidade é guards + parâmetros manuais. A refatoração pode considerar centralizar (ex.: interceptor que injeta `companyId` no contexto + repositório com escopo), mas **funciona e é testado** hoje.

---

## 6. Onde `RESIDENT` aparece (dimensionar a remoção)

Esforço de remoção: **baixo-médio**. Ocorrências:

| Local | Linha(s) | O que é | Ação na remoção |
|---|---|---|---|
| [common/enums/user-role.enum.ts](../src/common/enums/user-role.enum.ts) | 4 | valor do enum `UserRole.RESIDENT` | remover o valor |
| [condominiums/condominiums.controller.ts](../src/condominiums/condominiums.controller.ts) | 83 | `@Roles(ADMIN, MANAGER, RESIDENT)` em `GET /:id` | remover `RESIDENT` da lista |
| [units/units.controller.ts](../src/units/units.controller.ts) | 49, 59 | `@Roles(ADMIN, MANAGER, RESIDENT)` em 2 GETs | remover `RESIDENT` |
| [migrations/1778890000000-AddUserCondominiumRole.ts](../src/migrations/1778890000000-AddUserCondominiumRole.ts) | 8 | enum do banco `('ADMIN','MANAGER','RESIDENT')` | **nova migration** para alterar o tipo enum (não editar a migration antiga) |
| [condominiums/condominiums.service.spec.ts](../src/condominiums/condominiums.service.spec.ts) | 276, 294, 304, 331 | 4 usos em testes | atualizar/remover cenários |

**Pontos de atenção da remoção:**
- É preciso garantir que **nenhum registro** em `user_condominium` tenha `role = 'RESIDENT'` antes de alterar o enum no banco (migration de dados, se houver dados).
- A remoção de `RESIDENT` muda o significado das rotas de **leitura** de condomínio/unidade (hoje `RESIDENT` tem leitura). Decidir quem passa a ter essa leitura no modelo por empresa (provável: `GERENTE` e `FUNCIONARIO`).
- Como a refatoração de papéis (por empresa) provavelmente reescreve `RolesGuard` e talvez `user_condominium`, a remoção de `RESIDENT` deve ser feita **junto** dessa refatoração, não isolada.

---

## 7. Conclusão para a futura refatoração (não executar agora)

Já está pronto e **não deve ser recriado**:
- Entidade `Company` + migration + CRUD master-only.
- `companyId` em `Condominium` (NOT NULL) e `User` (nullable, master=NULL) + FKs e índices.
- Seed do master + backfill da empresa demo (rever apenas o hash hard-coded).
- `InfractionAccessGuard` (isolamento por cadeia até `companyId`) + filtros em `InfractionsService`.
- `MasterGuard`, `CompanyAdminGuard`, escopo por empresa em audit/dashboard.

O que a refatoração precisa **mudar** (escopo futuro, fora desta Discovery):
1. Mover papel de **por condomínio** (`user_condominium.role`) para **por empresa** (`User.role` = `MASTER|GERENTE|FUNCIONARIO`).
2. Remover `RESIDENT` (8 ocorrências + migration de enum + dados).
3. Reescrever `RolesGuard` para checar papel por empresa em vez de membership por condomínio.
4. Decidir o destino de `user_condominium` (tabela de atribuição sem papel, ou remoção).
5. Avaliar centralizar o isolamento (C9) e fechar a lacuna de `UnitsService` (sem filtro explícito de empresa).
6. (Opcional) desnormalizar `companyId` em `Unit`/`Infraction` se quiser evitar joins.

---

## Metadados

- Branch: `discovery/multitenant` (off `master`).
- Comandos: apenas `git`/leitura de arquivos. Nenhum arquivo de `src/` ou `test/` modificado.
- Não foi iniciada nenhuma refatoração.
