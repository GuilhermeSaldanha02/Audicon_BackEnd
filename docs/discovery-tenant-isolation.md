# Discovery — R-05 Isolamento de Tenant (Central)

**Data:** 2026-05-29
**Branch:** `feat/r-03-04-aposentar-papel-por-condominio` foi mergeada via PR #52; este Discovery é leitura sobre `master` pós-merge.
**Objetivo:** Verificar o que do escopo original de R-05 (isolamento central por `companyId`) sobrou após R-03+04 ter introduzido `CondominiumAccessGuard` e ter trazido `RolesGuard` para o modelo `SystemRole`. Documento de leitura: nenhum código alterado.

---

## 1. Inventário de cobertura por área

Levantamento controller-a-controller. Cada rota cai em uma de três categorias:

- **GuardTenant** — passa por `InfractionAccessGuard` ou `CondominiumAccessGuard`, que resolvem o recurso → comparam `recurso.companyId` com `user.companyId`.
- **Master-only** — `MasterGuard` no controller; só master entra, isolamento não se aplica.
- **Filtro-no-service** — não há `:id` de recurso de empresa no path; o service filtra a query por `user.companyId` (lido do `req.user`).
- **Sem dado de empresa** — endpoints públicos, de saúde, ou que tocam apenas o próprio usuário autenticado.

### `src/condominiums/condominiums.controller.ts`

| Rota | Método | Guards | Categoria |
|---|---|---|---|
| `/condominiums` | POST | `JwtAuthGuard, MasterGuard` | Master-only |
| `/condominiums` | GET | `JwtAuthGuard` + service filtra por `actor.companyId` | Filtro-no-service |
| `/condominiums/:id` | GET | `JwtAuthGuard, RolesGuard, CondominiumAccessGuard` | GuardTenant |
| `/condominiums/:id` | PATCH | `JwtAuthGuard, RolesGuard, CondominiumAccessGuard` | GuardTenant |
| `/condominiums/:id` | DELETE | `JwtAuthGuard, MasterGuard` | Master-only |
| `/condominiums/:id/regimento` | POST | `JwtAuthGuard, RolesGuard, CondominiumAccessGuard` | GuardTenant |
| `/condominiums/:id/regimento` | GET | `JwtAuthGuard, CondominiumAccessGuard` | GuardTenant |
| `/condominiums/:id/regimento` | DELETE | `JwtAuthGuard, RolesGuard, CondominiumAccessGuard` | GuardTenant |

### `src/units/units.controller.ts`

Classe inteira em `@UseGuards(JwtAuthGuard, RolesGuard, CondominiumAccessGuard)`.

| Rota | Método | Categoria |
|---|---|---|
| `/condominiums/:condominiumId/units` | POST | GuardTenant |
| `/condominiums/:condominiumId/units` | GET | GuardTenant |
| `/condominiums/:condominiumId/units/:id` | GET | GuardTenant |
| `/condominiums/:condominiumId/units/:id` | PATCH | GuardTenant |
| `/condominiums/:condominiumId/units/:id` | DELETE | GuardTenant |

### `src/infractions/infractions.controller.ts`

Classe em `@UseGuards(JwtAuthGuard)`.

| Rota | Método | Guards no método | Categoria |
|---|---|---|---|
| `/infractions` | POST | — | Filtro-no-service (chega `actor.companyId` e service compara) |
| `/infractions` | GET | — | Filtro-no-service |
| `/infractions/export` | GET | — | Filtro-no-service |
| `/infractions/:id` | GET | `InfractionAccessGuard` | GuardTenant |
| `/infractions/:id/analyze` | POST | `InfractionAccessGuard` | GuardTenant |
| `/infractions/:id/document` | GET | `InfractionAccessGuard` | GuardTenant |
| `/infractions/:id/approve` | PATCH | `InfractionAccessGuard` | GuardTenant |
| `/infractions/:id/send` | POST | `InfractionAccessGuard` | GuardTenant |
| `/infractions/:id/send-whatsapp` | POST | `InfractionAccessGuard` | GuardTenant |
| `/infractions/:id` | PATCH | `InfractionAccessGuard` | GuardTenant |
| `/infractions/:id` | DELETE | `InfractionAccessGuard` | GuardTenant |

### `src/infractions/images.controller.ts`

Classe em `@UseGuards(JwtAuthGuard, InfractionAccessGuard)` → todas as 5 rotas (`POST/GET/GET/:imageId/DELETE/:imageId`) são **GuardTenant**.

### `src/infractions/reports.controller.ts`

Classe em `@UseGuards(JwtAuthGuard, RolesGuard, CondominiumAccessGuard)` → `GET /condominiums/:condominiumId/infractions/report.pdf` é **GuardTenant**.

### `src/notifications/notifications.controller.ts`

| Rota | Guards | Categoria |
|---|---|---|
| `/infractions/:id/notifications` | `JwtAuthGuard, InfractionAccessGuard` | GuardTenant |

### `src/notifications/webhooks.controller.ts`

| Rota | Guards | Categoria |
|---|---|---|
| `/webhooks/resend` | nenhum NestJS guard; assinatura HMAC svix validada inline | Sem dado de empresa (atualiza notification por `providerId`; sem ID de empresa no payload) |

### `src/audit/audit.controller.ts`

| Rota | Guards | Categoria | Observação |
|---|---|---|---|
| `/audit-log` | `JwtAuthGuard` + lógica explícita no controller | Filtro-no-service | Master pode passar `?companyId=`; **non-master sem companyId é rejeitado com 403 explícito** (pattern correto, ver §3). |

### `src/dashboard/dashboard.controller.ts`

| Rota | Guards | Categoria |
|---|---|---|
| `/dashboard` | `JwtAuthGuard` + service filtra por `req.user.companyId` quando não-master | Filtro-no-service |

### `src/companies/companies.controller.ts`

Classe em `@UseGuards(JwtAuthGuard, MasterGuard)` — **toda a área é master-only**. As 10 rotas (`POST /companies`, `GET /companies`, `GET /companies/:id`, `GET /:companyId/users`, `GET /:companyId/condominiums`, `PATCH /:id`, `DELETE /:id`, `POST /:companyId/users`, `POST /:companyId/users/:userId/reset-password`) caem em **Master-only**. Cross-check de tenant fica na camada de service em `resetPassword` (compara `target.companyId !== opts.companyId`).

### `src/users/users.controller.ts`

| Rota | Guards | Categoria |
|---|---|---|
| `POST /users` | `JwtAuthGuard, MasterGuard` | Master-only |

### `src/auth/auth.controller.ts`

| Rota | Guards | Categoria |
|---|---|---|
| `POST /auth/login` | `LocalAuthGuard` | Sem dado de empresa (autenticação) |
| `GET /auth/profile` | `JwtAuthGuard` | Sem dado de empresa (opera no próprio `req.user.id`) |
| `POST /auth/change-password` | `JwtAuthGuard` | Sem dado de empresa (opera no próprio usuário) |

### `src/health/health.controller.ts` e `src/app.controller.ts`

Sem dado de empresa.

### Serviços que NÃO expõem rota mas tocam dados de empresa

- `MailService`, `WhatsappService`, `PdfService`, `IaService`, `InfractionNotificationService`, `InfractionAnalysisService`: sem rota direta; são chamados pelos services de infraction, que já estão sob `InfractionAccessGuard` ou filtro de empresa. Não há vetor de acesso direto.

### Resumo numérico

- **GuardTenant** (resolução automática por `recurso.companyId`): **24 rotas**
- **Master-only**: **13 rotas**
- **Filtro-no-service** (depende do service ler `req.user.companyId` corretamente): **5 rotas** — `GET /condominiums`, `POST /infractions`, `GET /infractions`, `GET /infractions/export`, `GET /audit-log`, `GET /dashboard`
- **Sem dado de empresa**: restantes

### Veredito de cobertura

**Não encontrei rota onde a Empresa A consiga ler/escrever dado da Empresa B.** R-03+04 fechou o último vazamento (o de `GET /:id/regimento`). O que sobra são endpoints que **dependem da disciplina do service** em filtrar por `companyId` — não há vazamento real hoje, mas o padrão é repetitivo e frágil contra regressão.

---

## 2. Filtros manuais de `companyId` espalhados nos services

Lista exaustiva (lida com Grep + leitura de cada arquivo):

### Padrão A — "if (!isMaster && companyId) → andWhere"

| Local | Linhas | Risco |
|---|---|---|
| [`condominiums.service.ts:56-58`](src/condominiums/condominiums.service.ts#L56-L58) — `findAll` | `if (companyId) { qb.where('c.companyId = :companyId', ...) }` | Não checa `isMaster` (paginação master ignora). Se um não-master tiver `companyId = null/0` aqui passa sem filtro. |
| [`infractions.service.ts:90-94`](src/infractions/infractions.service.ts#L90-L94) — `findAll` | `if (!isMaster && requesterCompanyId) { qb.andWhere(...) }` | Se non-master tiver `companyId` falsy, vê tudo. |
| [`infractions.service.ts:122-126`](src/infractions/infractions.service.ts#L122-L126) — `exportCsv` | mesma forma | Mesmo risco. |
| [`dashboard.service.ts:38-40`](src/dashboard/dashboard.service.ts#L38-L40) — `getMetrics` | `if (!isMaster && companyId) { base.where(...) }` | Mesmo risco. |
| [`audit.service.ts:99-101`](src/audit/audit.service.ts#L99-L101) — `list` | `if (companyId !== undefined && companyId !== null) { qb.where(...) }` | Aqui o controller (audit) **já rejeita** non-master sem companyId com 403 antes de chamar. Único ponto onde o pattern está blindado. |

### Padrão B — checagem explícita `companyId !== requesterCompanyId`

| Local | Linhas |
|---|---|
| [`infractions.service.ts:35-43`](src/infractions/infractions.service.ts#L35-L43) — `create` | Resolve a unit, busca o condo, compara com `requesterCompanyId`. Estilo "guarda no service". |
| [`companies.service.ts:195-197`](src/companies/companies.service.ts#L195-L197) — `resetPassword` | `if (target.companyId !== opts.companyId) throw ForbiddenException` |
| [`InfractionAccessGuard`](src/common/guards/infraction-access.guard.ts) e [`CondominiumAccessGuard`](src/common/guards/condominium-access.guard.ts) | Padrão único e consistente. |

### Padrão C — query direta `where: { companyId }` (sem checar isMaster)

| Local |
|---|
| [`condominiums.service.ts:66-71`](src/condominiums/condominiums.service.ts#L66-L71) — `findByCompany` (chamado por endpoint master-only) |
| [`companies.service.ts:155-160`](src/companies/companies.service.ts#L155-L160) — `listEmployees` |
| [`companies.service.ts:167-172`](src/companies/companies.service.ts#L167-L172) — `listUsersOfCompany` |

Esses são consumidos por rotas master-only, então o `companyId` recebido vem do path validado por `MasterGuard`. Sem risco.

### Padrão D — bypass de master no controller

| Local | Linhas |
|---|---|
| [`audit.controller.ts:51-66`](src/audit/audit.controller.ts#L51-L66) | Lógica explícita e correta. |
| [`dashboard.controller.ts:24-29`](src/dashboard/dashboard.controller.ts#L24-L29) | Passa `companyId` e `isMaster` separados. |
| [`infractions.controller.ts:53-72`](src/infractions/infractions.controller.ts#L53-L72) | Passa ambos para o service. |
| [`condominiums.controller.ts:69-71`](src/condominiums/condominiums.controller.ts#L69-L71) | Só passa `actor.companyId`; service não recebe `isMaster` (não precisa porque master tem `companyId = null`, o `if (companyId)` cai). |

### Diagnóstico do espalhamento

- **5 services** com filtro manual (`condominiums`, `infractions` × 2 métodos, `dashboard`, `audit`).
- **4 controllers** fazem o split `companyId / isMaster` (`audit`, `dashboard`, `infractions`, `condominiums`).
- **Variações pequenas** no formato do `if`: às vezes checa `!isMaster && companyId`, às vezes só `companyId`, às vezes `companyId !== null && companyId !== undefined`. Isso é exatamente o tipo de inconsistência que R-05 queria atacar — não é um vazamento, é uma **superfície grande para regressão futura**.

### Vazamento concreto?

**Não.** A única rota que tinha vazamento (`GET /:id/regimento`) foi fechada em R-03+04. Os padrões manuais funcionam hoje porque (a) os controllers passam o `companyId` correto e (b) na prática só master tem `companyId = null`.

**Risco residual:** se um dia for criado um non-master com `companyId = null` (bug, dado corrompido, migration mal feita), os endpoints `Filtro-no-service` deixam de filtrar silenciosamente. O pattern do `audit.controller` (rejeita explicitamente non-master sem companyId) é o único blindado.

---

## 3. Recomendação de escopo

### Opção (a) — Documentar padrão + fechar lacunas pontuais

**O que faria:**
1. Documentar em `docs/SDD-audicon.md` a regra "toda rota de recurso de empresa usa `CondominiumAccessGuard` ou `InfractionAccessGuard`; endpoints sem `:id` filtram por `req.user.companyId` no service".
2. Pequeno hardening defensivo: criar `assertTenantScope(user)` em `common/helpers` que **lança 403 se non-master tiver companyId falsy**. Aplicar em `dashboard.service.getMetrics`, `infractions.service.findAll/exportCsv`, `condominiums.service.findAll`. Espelha o que o `audit.controller` já faz.
3. Test de regressão por área: para cada um dos 5 endpoints `Filtro-no-service`, adicionar caso e2e que prove "non-master de empresa A não vê dado de empresa B" (parte está em `rbac.e2e-spec.ts`, falta cobrir audit e dashboard).

**Custo:** ~half day. 1 helper + 4 chamadas + ~3 casos e2e + ajuste em `SDD-audicon.md`.
**Risco:** baixíssimo. Mexe em código existente preservando comportamento atual; só adiciona checagem que hoje é implícita.
**Cobertura ganha:** elimina o "silently permissive" e dá uma fonte única de verdade para o padrão.

### Opção (b) — Replicar guard pattern em áreas descobertas

**Premissa quebrada.** Não há áreas descobertas. Os endpoints `Filtro-no-service` (dashboard, audit, lista de infrações, lista de condomínios) **não têm `:id`** — não há recurso para resolver. Um guard de tenant precisa de um ID de entidade. Forçar um guard aqui significaria, na prática, reescrever o que já está sendo feito no service (ler `req.user.companyId` e aplicar filtro).

**Custo:** médio (3-5 dias) inventando guards "marker" + interceptors para os endpoints sem ID.
**Risco:** médio-alto. Vira abstração premature; provavelmente acaba parecida com (c) sem os benefícios de (c).
**Recomendação:** **descartar**. Categoria não se aplica ao estado atual.

### Opção (c) — Mecanismo central (interceptor global / query scope TypeORM)

**O que faria:**
1. Subscriber/middleware no TypeORM que intercepta toda query e injeta `WHERE companyId = :userCompanyId` automaticamente — provavelmente via [`@nestjs-cls/transactional`](https://github.com/Papooch/nestjs-cls) + um custom `EntitySubscriber`, ou um `QueryRunner` personalizado.
2. Lista de "tenant-scoped entities" (Condominium, Unit, Infraction, AuditLog, Notification, User-non-master, InfractionImage).
3. Bypass via `cls.runWith({ isMaster: true })` ou similar.

**Custo:** alto (1-2 semanas). Subscribers do TypeORM em multi-tenant são notoriamente difíceis: ordem de execução com soft-delete, joins, raw queries, `manager.query(...)` (já usado em `companies.service.remove`), `repository.manager.createQueryBuilder()`. Hot paths como o dashboard usam `getRawMany` e `Promise.all` de `clone()` — precisa garantir que o scope CLS propaga em todas as ramificações. Eu já vi essa armadilha em projetos NestJS; o subscriber funciona para 80% das queries e quebra silenciosamente em 20%, geralmente nos lugares mais sensíveis (relatórios, exports).
**Risco:** alto. Falsa sensação de segurança se o subscriber não cobrir TypeORM `manager.query(raw)`. Difícil de testar exaustivamente. Difícil de fazer master ignorar de forma confiável sem que alguém esqueça de abrir o "bypass scope".
**Benefício:** uma rota nova nasce isolada por default, sem precisar lembrar do filtro.

**Atenuante:** PostgreSQL Row-Level Security (RLS) seria mais robusto que subscriber, mas exigiria refatorar o pool de conexão para passar `SET app.current_company_id`, fugir do master bypass na DB (precisa de role separada), e ainda assim deixar exports CSV/dashboards funcionando com cross-tenant para master. Não é viável dentro do escopo da Fase A.

### Recomendação fundamentada

**Faria a opção (a).**

Motivos:
1. O R-05 original assumia que havia áreas descobertas que precisavam de um mecanismo central. Após R-03+04, **não há mais**. Os dois guards (`InfractionAccessGuard`, `CondominiumAccessGuard`) cobrem todas as rotas com `:id` de forma consistente, e os 5 endpoints sem `:id` têm filtro de service.
2. O custo/risco da (c) só compensa se o projeto crescer em ordem de magnitude no número de rotas. Hoje são ~37 rotas; o padrão atual é cognitivamente manejável e testável.
3. O ganho real e barato é tirar o "silently permissive" dos `if (!isMaster && companyId)`. Isso vira (a) com um helper + alguns e2e.
4. Documentar o padrão no SDD evita que rotas futuras "escapem" — desde que o reviewer cobre o uso do helper / guard quando aplicável.

**Não recomendo (c) agora.** Se daqui a 6 meses o sistema tiver dobrado de superfície e estiver vazando por esquecimento, aí vale revisitar — com a vantagem de a essa altura termos histórico de quais lugares mais escapam.

---

## 4. Próximos passos sugeridos para R-05

Se a recomendação (a) for aceita, o R-05 passa a ser:

- [ ] **Commit 1 (helper + uso):** criar `src/common/helpers/assert-tenant-scope.ts` com `assertTenantScope(user, { allowMaster })`. Aplicar em `dashboard.service.getMetrics`, `infractions.service.findAll/exportCsv`, `condominiums.service.findAll`. Unit tests para cada (master bypassa; non-master sem companyId lança 403; non-master com companyId filtra).
- [ ] **Commit 2 (e2e):** estender `test/rbac.e2e-spec.ts` ou criar `test/tenant-isolation.e2e-spec.ts` com casos cobrindo: `GET /audit-log` cross-tenant; `GET /dashboard` cross-tenant; `GET /infractions` cross-tenant; `GET /infractions/export` cross-tenant; `GET /condominiums` cross-tenant.
- [ ] **Commit 3 (docs):** atualizar `docs/SDD-audicon.md` com seção "Padrão de isolamento de tenant" e referência aos dois guards + helper. Atualizar `docs/state-of-code.md`.

Volume estimado: ~250 linhas de código + ~150 linhas de teste. Half day de implementação + meio dia de validação. PR único.

---

## 5. Bandeiras vermelhas observadas (fora do escopo)

Nenhuma. Não encontrei nada equivalente ao vazamento de `GET /:id/regimento` que motivou priorizar R-03+04. Apenas inconsistências de pattern já listadas em §2.
