# State of Code — Audicon API (Backend)

> **Tarefa:** T-00 (Discovery) · §5 do [SDD v2.0](./SDD-audicon.md)
> **Branch de entrega:** `discovery/state-of-code`
> **Base inventariada:** `master` (commit `4208622`, 2026-05-22) — código real em produção/integração
> **Data:** 2026-05-26
> **Versão do SDD lida:** 2.0 (multi-tenant)
> **Escopo:** somente leitura e documentação. Nenhum arquivo em `src/` ou `test/` foi modificado nesta tarefa.
>
> ⚠️ **Substitui** a versão de 2026-05-15 (preservada em [`state-of-code-2026-05-15.md`](./state-of-code-2026-05-15.md)). Aquela descrevia um código pré-multi-tenant (4 entidades, SDD v1.0) que **já foi superado**. Este documento reflete o `master` atual.

---

## 1. Resumo executivo

**O código está MUITO à frente do SDD v2.0.** O SDD v2.0 foi escrito como um plano de execução em fases (Fase 0 → 6) supondo uma base pré-multi-tenant. Na realidade, **praticamente todo o plano já foi implementado e mergeado em `master`**: multi-tenancy com `Company`, RBAC, seed do master, isolamento por empresa, Swagger, rate limiting, pino, healthcheck, CI, soft delete, paginação, validação estrita de env — além de **um conjunto grande de features que o SDD v2.0 nem menciona** (e-mail/Resend, WhatsApp/Z-API, audit log, dashboard, imagens de infração, regimento PDF + leitura por IA, reincidência, aprovação/envio, CSV, histórico de notificações com webhook).

Das ~30 tarefas do plano (T-00…T-29), as de backend estão majoritariamente **entregues**. O que resta é, em larga medida, **frontend, deploy (T-19) e configurações externas** (verificar domínio Resend, conta Z-API real), além de 3 branches de refactor ainda não mergeadas.

**Modelo de RBAC implementado diverge do SDD** (ver §7): o código usa papéis **por condomínio** (`ADMIN | MANAGER | RESIDENT` na tabela `user_condominium`) + flag `isMaster` no `User`, enquanto o SDD v2.0 especifica papéis **por empresa** (`MASTER | GERENTE | FUNCIONARIO`). Há inclusive um papel `RESIDENT`, que o SDD declara explicitamente não existir.

Maturidade por camada:
- **Entidades/migrations:** 9 entidades, 13 migrations, todas consistentes; `synchronize: false`. ✓
- **Segurança transversal:** `ValidationPipe` global (whitelist+forbid), `HttpExceptionFilter`, `ResponseInterceptor`, `ThrottlerGuard` global, validação Joi do `.env`. ✓
- **Integrações externas:** Gemini, Resend e Z-API com chamada **real** + fallback **mock** em dev/test. ✓
- **Lacuna de segurança pontual:** `POST /users` é **público e sem guard** (ver §6, R1) — contradiz a hierarquia de criação de usuário do SDD.

---

## 2. Inventário por módulo — implementado vs. stub

> Convenção: **✅ Real/completo** · **🟡 Parcial** · **🔩 Esqueleto/stub** · **❌ Ausente**
> Nenhum módulo está em estado de stub — todos têm lógica real. As ressalvas estão marcadas 🟡.

### 2.1 `AuthModule` — ✅
- **Controller** [auth.controller.ts](../src/auth/auth.controller.ts): `POST /auth/login` (LocalAuthGuard, HTTP 200), `GET /auth/profile` (JwtAuthGuard, retorna perfil enxuto via `getProfile`), `POST /auth/change-password` (JwtAuthGuard + `ChangePasswordDto`).
- **Strategies:** `LocalStrategy` (aceita `password` ou `senha`), `JwtStrategy` (recarrega user do banco, remove `senha`).
- **JWT payload:** `{ email, sub, companyId, isMaster, mustChangePassword }`.
- 🟡 Login ainda **não tem DTO formal** (lê do `req.body`); documentado via `@ApiBody` no Swagger. Viola C1 em sentido estrito.
- 🟡 JWT em `Authorization: Bearer` (não cookie httpOnly) — T-07 do SDD **não** implementado.

### 2.2 `UsersModule` — 🟡
- **Entidade** [user.entity.ts](../src/users/entities/user.entity.ts): `id`, `nome`, `email` (unique), `senha`, `isMaster` (bool), `mustChangePassword` (bool), `company`/`companyId` (**nullable no schema** — master tem `companyId = null` por design; a migration `AddCompanyAndMasterUser` não adicionou CHECK `(isMaster OR companyId IS NOT NULL)`, então o schema aceita non-master com null. O helper `assertTenantScope` compensa: lança 403 se um non-master chegar sem companyId válido), `memberships: UserCondominium[]`. Hash via `@BeforeInsert`.
- **Service:** `create`, `findOneByEmail`, `findOneById`, `changePassword` (≥8 chars, limpa `mustChangePassword`), `getProfile`.
- ⚠️ **R1 (segurança):** `POST /users` ([users.controller.ts](../src/users/users.controller.ts)) é **público, sem guard e sem checagem de papel** — qualquer um cria usuário (sem `companyId`, sem `isMaster`). A criação "correta" segue pelo `CompaniesController`. Ver §6.
- 🟡 Sem `select: false`/`@Exclude()` na coluna `senha` (T-09/C10): a senha **não vaza** porque os fluxos deletam o campo manualmente (`delete result.senha`), mas a proteção não é estrutural.

### 2.3 `CompaniesModule` — ✅ (núcleo do multi-tenant)
- **Entidade** [company.entity.ts](../src/companies/entities/company.entity.ts): `id`, `name`, `cnpj` (unique), `createdAt`, `users[]`, `condominiums[]`.
- **Controller** [companies.controller.ts](../src/companies/companies.controller.ts) — **todo protegido por `JwtAuthGuard + MasterGuard`**:
  - `POST /companies` (cria empresa + admin inicial, devolve senha temporária)
  - `GET /companies`, `GET /companies/:id`
  - `GET /companies/:companyId/users`, `GET /companies/:companyId/condominiums`
  - `PATCH /companies/:id`, `DELETE /companies/:id` (bloqueia se houver condomínio ativo; faz limpeza manual em cascata)
  - `POST /companies/:companyId/users` (cria funcionário), `POST /companies/:companyId/users/:userId/reset-password`
- **Service:** senha temporária via `crypto.randomBytes` (12 chars), `mustChangePassword: true`, auditoria em criação/remoção/reset.

### 2.4 `CondominiumsModule` — ✅
- **Entidade** [condominium.entity.ts](../src/condominiums/entities/condominium.entity.ts): `id`, `name`, `cnpj` (unique), `company`/`companyId` (NOT NULL, FK RESTRICT), `address`, `regimentoFilename/Content(bytea, select:false)/UploadedAt`, `units[]`, `memberships[]`, `@DeleteDateColumn`.
- **Controller** [condominiums.controller.ts](../src/condominiums/condominiums.controller.ts):
  - `POST /` (MasterGuard), `GET /` (lista do usuário, paginada), `GET /:id` (RolesGuard: ADMIN/MANAGER/RESIDENT), `PATCH /:id` (ADMIN), `DELETE /:id` (MasterGuard)
  - `POST /:id/members` + `DELETE /:id/members/:userId` (ADMIN; impede remover último ADMIN)
  - `POST/GET/DELETE /:id/regimento` (upload PDF ≤5MB, ADMIN/MANAGER; download via `@Res()`)
- Soft delete ✅. Regimento PDF ✅.

### 2.5 `UnitsModule` — ✅
- **Entidade** [unit.entity.ts](../src/units/entities/unit.entity.ts): `id`, `identifier`, `ownerName`, `residentEmail?`, `residentPhone?`, `condominium` (ManyToOne), `infractions[]`, `@DeleteDateColumn`.
- Rota aninhada `/condominiums/:condominiumId/units` (CRUD). Contato do morador (email/telefone) na unidade — base do envio de notificações.

### 2.6 `InfractionsModule` — ✅ (módulo mais rico; service foi dividido)
- **Entidade** [infraction.entity.ts](../src/infractions/entities/infraction.entity.ts): `description`, `formalDescription?`, `suggestedPenalty?`, `status` (`pending→analyzed→approved→sent`), `occurrenceDate`, `updatedAt`, `approvedAt?`, `sentAt?`, `whatsappSentAt?`, `unit`, `images[]`, `@DeleteDateColumn`.
- **Entidade** [infraction-image.entity.ts](../src/infractions/entities/infraction-image.entity.ts): `filename`, `mimetype`, `sizeBytes`, `content (bytea, select:false)`, `uploadedAt`.
- **Controllers:**
  - [infractions.controller.ts](../src/infractions/infractions.controller.ts): CRUD + `export` (CSV) + `:id/analyze` (IA, throttle 10/min) + `:id/document` (PDF unitário, `@Res()`) + `:id/approve` + `:id/send` (e-mail) + `:id/send-whatsapp`. Todas as rotas `:id` protegidas por `InfractionAccessGuard`.
  - [images.controller.ts](../src/infractions/images.controller.ts): upload/list/download/delete de imagens (JPEG/PNG/WebP ≤5MB, até 10).
  - [reports.controller.ts](../src/infractions/reports.controller.ts): `GET /condominiums/:id/infractions/report.pdf` (relatório **em streaming**, ADMIN/MANAGER).
- Fluxo de aprovação, envio e reincidência completos.

### 2.7 `IaModule` (Gemini) — ✅ com ressalvas — **detalhado**
- **Service** [ia.service.ts](../src/ia/ia.service.ts).
- **Funções públicas:** `onModuleInit` (carrega client via `eval('import("@google/generative-ai")')`), `analisarInfracao(infraction, regimentoText?, reincidencias?)`, `extractRegimentoText(condominiumId)` (via `pdf-parse`).
- **Prompts versionados em arquivo:** `prompts/analyze-infraction.v1/v2/v3.md` (v1 sem regimento, v2 com regimento, v3 com regimento + reincidência). T-29 do SDD já feito.
- **Timeout configurável** (`GEMINI_TIMEOUT_MS`, default 15s) via `Promise.race`. Erros tipados (`geminiConfigError/timeoutError/upstreamError`).
- **Real x mock:** chamada real com `GEMINI_API_KEY`; fallback mock em dev/test; em produção sem key/modelo → **lança** erro (não faz fallback silencioso).
- 🟡 `eval('import(...)')` permanece (contorna CJS/ESM); frágil para análise estática.
- **Vars:** `GEMINI_API_KEY` (opcional no schema, obrigatória em prod por código), `GEMINI_API_ENDPOINT`, `GEMINI_MODEL` (default `gemini-1.5-pro`), `GEMINI_TIMEOUT_MS`.

### 2.8 `PdfModule` — ✅ — **detalhado**
- **Service** [pdf.service.ts](../src/pdf/pdf.service.ts): `gerarDocumentoInfracao` (buffer, unitário, com embed de imagens) **e** `streamInfractionReport` (streaming, relatório por condomínio). T-05 (streaming) feito.
- **Vars:** nenhuma. **Real x mock:** real (pdfkit).

### 2.9 `MailModule` (Resend) — ✅ — **[FORA DO SDD v2.0]**
- **Service** [mail.service.ts](../src/mail/mail.service.ts): `sendInfractionEmail` (HTML+texto+PDF anexado em base64). Registra `Notification` ao enviar.
- **Real x mock:** real com `RESEND_API_KEY`; sem key → mock (loga, grava notification com `mock-<ts>`).
- **Vars:** `RESEND_API_KEY` (opcional), `RESEND_FROM_EMAIL` (default `onboarding@resend.dev`).

### 2.10 `WhatsappModule` (Z-API) — ✅ — **[FORA DO SDD v2.0]**
- **Service** [whatsapp.service.ts](../src/whatsapp/whatsapp.service.ts): `sendInfractionAlert` (alerta complementar via `fetch` à Z-API), `normalizePhone` (assume BR, prefixa 55). Registra `Notification`.
- **Real x mock:** real se `ZAPI_INSTANCE_ID + ZAPI_TOKEN + ZAPI_CLIENT_TOKEN`; senão mock.
- **Vars:** `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` (todas opcionais no schema).

### 2.11 `NotificationsModule` — ✅ — **[FORA DO SDD v2.0]**
- **Entidade** [notification.entity.ts](../src/notifications/entities/notification.entity.ts): `infraction` (FK CASCADE), `channel` (email/whatsapp), `recipient`, `providerId`, `status` (sent/delivered/opened/clicked/bounced/failed), `failureReason`, timestamps.
- **Service:** `record`, `updateStatus`, `findByInfraction` (tolerante a falha — nunca quebra o fluxo principal).
- **Controllers:** `GET /infractions/:id/notifications` (JwtAuthGuard + InfractionAccessGuard); `POST /webhooks/resend` ([webhooks.controller.ts](../src/notifications/webhooks.controller.ts)) com **verificação de assinatura svix/HMAC** (`RESEND_WEBHOOK_SECRET`).

### 2.12 `AuditModule` — ✅ — **[FORA DO SDD v2.0]**
- **Entidade** [audit-log.entity.ts](../src/audit/entities/audit-log.entity.ts): `createdAt`, `userId/userEmail/userIsMaster`, `companyId` (índice), `action` (11 ações), `entity`, `entityId`, `context (jsonb)`.
- **Service** [audit.service.ts](../src/audit/audit.service.ts): `log` (fire-and-forget, não quebra fluxo), `logAsync`, `list` (paginado, escopo por empresa).
- **Controller:** `GET /audit-log` — master vê tudo (filtro opcional por `companyId`); demais só da própria empresa.

### 2.13 `DashboardModule` — ✅ — **[FORA DO SDD v2.0]**
- **Service** [dashboard.service.ts](../src/dashboard/dashboard.service.ts): `getMetrics` — total, por status, por mês (6 meses), top 5 unidades reincidentes, taxa de aprovação. Filtrado por `companyId` (master vê tudo).
- **Controller:** `GET /dashboard` (JwtAuthGuard).

### 2.14 `HealthModule` — ✅
- [health.controller.ts](../src/health/health.controller.ts): `GET /health/live` (estático) e `GET /health/ready` (Terminus `pingCheck` no Postgres). T-09 feito.

### 2.15 `common/` — ✅
- **Filtros/interceptors:** `HttpExceptionFilter`, `ResponseInterceptor` (`{ statusCode, data }`).
- **Config:** `env.schema.ts` (Joi), `require-env.ts`, `cors.ts` (`parseCorsOrigins`).
- **Guards:** `RolesGuard` (por condomínio via `user_condominium`), `MasterGuard`, `CompanyAdminGuard`, `InfractionAccessGuard` (Infraction→Unit→Condominium→companyId), `roles.guard`.
- **Decorators:** `@CurrentActor()` (extrai `Actor` do JWT), `@Roles()`.
- **DTOs:** `pagination.dto.ts`, `paginated-result.dto.ts`. **Enum:** `UserRole`.

---

## 3. Camada de boot / configuração

- [app.module.ts](../src/app.module.ts): `ConfigModule` com **`validationSchema` Joi** (T-18/T-03 ✓), `ThrottlerModule` global + `ThrottlerGuard` via `APP_GUARD` (T-08 ✓), `LoggerModule` (nestjs-pino, T-08 ✓), `TypeOrmModule.forRootAsync` (`synchronize: false`, `autoLoadEntities`).
- [setup-app.ts](../src/setup-app.ts): CORS dinâmico via `CORS_ORIGINS` (T-01 ✓), prefixo `api/v1`, pipes/filtros/interceptors globais. Extraído para ser reusável em testes e2e.
- [main.ts](../src/main.ts): bootstrap + **Swagger em `/api/docs`** (T-16 ✓) + logger pino.
- [data-source.ts](../src/data-source.ts): usa `requireEnv`/`requireEnvInt` (**sem fallbacks hard-coded** — T-02 ✓), lista 8 entidades explicitamente.

---

## 4. Banco e migrations

13 migrations em ordem cronológica (`synchronize: false`, toda mudança via migration — C4 ✓):

| Migration | O que faz |
|---|---|
| `Initial` | condominium, unit, infraction (enum status), user |
| `AddUserCondominiumRole` | tabela `user_condominium` (RBAC por condomínio) |
| `AddResidentContactToUnit` | `residentEmail`, `residentPhone` |
| `AddRegimentoToCondominium` | regimento PDF (bytea) no condomínio |
| `AddApprovedAtToInfraction` / `AddSentAtToInfraction` / `AddWhatsappSentAtToInfraction` | timestamps do fluxo |
| `AddInfractionImage` | tabela `infraction_image` (bytea) |
| `AddCompanyAndMasterUser` | tabela `company`, `user.isMaster/companyId`, FKs, **seed da Empresa Demo + master** |
| `AddAuditLog` | tabela `audit_log` |
| `AddSoftDelete` | `deletedAt` em condominium/unit/infraction |
| `AddNotificationsTable` | tabela `notification` |
| `AddMustChangePassword` | `user.mustChangePassword` |

⚠️ **Seed do master diverge do SDD** (T-04 / §2.2): o master é semeado com **hash bcrypt hard-coded** na migration `AddCompanyAndMasterUser` (`master@audicon.com` / `MasterAudicon@2026`), **não** lendo `MASTER_EMAIL`/`MASTER_PASSWORD` do ambiente. Também semeia uma "Empresa Demo Audicon" (id=1) e faz backfill de users/condomínios para ela. Ver §6 R2 e §7.

> Migrations não foram executadas nesta tarefa (T-00 é só leitura; não há `.env` real no ambiente de discovery).

---

## 5. Configuração e segredos (`.env.example` existe ✓)

Variáveis no `env.schema.ts` (Joi): `NODE_ENV`, `PORT`, `DB_*` (required), `JWT_SECRET` (≥16, required), `JWT_EXPIRATION` (required), `CORS_ORIGINS` (required), `GEMINI_*` (opcionais), `RESEND_*` (opcionais), `ZAPI_*` (opcionais), `LOG_LEVEL`.

⚠️ **`MASTER_EMAIL` e `MASTER_PASSWORD` NÃO estão no `env.schema.ts`** — coerente com o fato de o master ser semeado por hash fixo, mas **diverge do SDD T-18**, que exige essas variáveis no schema de validação.

---

## 6. Pontos de atenção / riscos

| # | Item | Risco | Observação |
|---|---|---|---|
| **R1** | `POST /users` público, sem guard nem papel | **Alto** — qualquer um cria usuário | Contradiz hierarquia de criação do SDD §2.1/T-06. Provável resquício do código v1. Avaliar remover/proteger. |
| **R2** | Master semeado com hash bcrypt hard-coded na migration | Médio — credencial fixa versionada | Diverge de T-04 (deveria ler `MASTER_EMAIL`/`MASTER_PASSWORD`). Senha conhecida em repo; trocar em prod. |
| R3 | `senha` sem `select:false`/`@Exclude()` | Baixo (hoje) | Proteção é manual (`delete senha`); não estrutural (C10 em sentido fraco). |
| R4 | IA usa `eval('import(...)')` | Baixo | Funcional; frágil para tooling. |
| R5 | Rotas binárias (`/document`, `/regimento`, `/images/:id`, `report.pdf`, `export`) usam `@Res()` cru | Aceitável | Bypass legítimo do `ResponseInterceptor` (C2) por serem binário/CSV; registrar como exceção. |
| R6 | `RolesGuard` resolve condomínio por `params.condominiumId ?? params.id` | Baixo | Em rotas sem esses params o guard nega; conferir cobertura por rota. |

Nenhum módulo é stub. Não há regressão de cobertura aparente (thresholds ativos no `package.json`).

---

## 7. Divergências SDD v2.0 vs. código real ⭐ (seção crítica)

> Esta seção é a base para **corrigir o SDD v2.0**, que foi escrito sem conhecer o estado real do código.

### 7.1 Modelo de papéis / RBAC — **divergência estrutural**

| Aspecto | SDD v2.0 (§2.1) | Código real (`master`) |
|---|---|---|
| Papéis | `MASTER`, `GERENTE`, `FUNCIONARIO` (por **empresa**) | `ADMIN`, `MANAGER`, `RESIDENT` (por **condomínio**, em `user_condominium`) + flag `isMaster` no `User` |
| Morador | "**NÃO existe** perfil de morador" | Existe papel **`RESIDENT`** (acesso de leitura no condomínio) — ver [rbac.md](./rbac.md) |
| Granularidade do tenant | Isolamento por `companyId` (C9, central) | Isolamento por `companyId` em guards (`InfractionAccessGuard`, `CompanyAdminGuard`) **+** papéis por condomínio |
| Master | Papel `MASTER` no enum | `isMaster: boolean` no `User` (não é valor de enum) |

➡️ **Decisão necessária:** o SDD deve ser atualizado para o modelo real (papéis por condomínio + `isMaster`), **ou** o código deve ser renomeado para o vocabulário do SDD. O modelo real é mais granular e já está em produção; recomendo alinhar o SDD ao código, decidindo explicitamente o destino do papel `RESIDENT`.

### 7.2 C9 (isolamento central) — ✅ **resolvido em R-05 (PR #54)**

O padrão `if (!isMaster && companyId) { qb.where(...) }` foi substituído pelo helper
`assertTenantScope(user)` em todos os 5 pontos de listagem/agregação:
`CondominiumsService.findAll`, `InfractionsService.findAll`, `InfractionsService.exportCsv`,
`DashboardService.getMetrics`, `AuditController.list`.

O helper centraliza a lógica e **lança 403** se um non-master não tiver `companyId` válido — eliminando
o risco de vazamento silencioso que existia no padrão anterior (ver §3.3 do SDD para a
especificação canônica do padrão).

### 7.3 Seed do master — **diverge de T-04 e §2.2**
Hash bcrypt fixo na migration em vez de ler `MASTER_EMAIL`/`MASTER_PASSWORD`. Essas vars não estão no `env.schema`. (Ver §4, §6 R2.)

### 7.4 JWT em header, não cookie — **T-07 não implementado**
O SDD (T-07, P1) pede migrar JWT para cookie `httpOnly`. O código mantém `Authorization: Bearer` + (presumível) `localStorage` no front. Pendente.

### 7.5 DTO de login ausente — **C1 em sentido estrito**
Login lê `req.body` sem DTO `class-validator` (documentado só no Swagger).

### 7.6 Features no código que o SDD v2.0 NÃO menciona (a **mais**)
O SDD v2.0 não previu — precisam ser **incorporados ao SDD**:
- **MailModule (Resend)** — envio de e-mail com PDF.
- **WhatsappModule (Z-API)** — alerta complementar.
- **NotificationsModule** — histórico de notificações + webhook Resend com verificação de assinatura.
- **AuditModule** — log de 11 ações sensíveis, escopo por empresa.
- **DashboardModule** — métricas.
- **Imagens de infração** (`infraction_image`, bytea).
- **Regimento PDF por condomínio** + **leitura pela IA** (`extractRegimentoText`, `pdf-parse`).
- **Reincidência** (prompts v2/v3 com histórico).
- **Fluxo de aprovação/envio** (`approvedAt`, `sentAt`, `whatsappSentAt`).
- **Export CSV** de infrações.
- **`mustChangePassword`** + reset de senha + senha temporária.

### 7.7 Tarefas do SDD §5 — situação real

| Tarefa | Status real |
|---|---|
| T-00 Discovery | ✅ (este documento) |
| T-01 CORS por env | ✅ `setup-app.ts` + `cors.ts` |
| T-02 remover fallbacks data-source | ✅ `require-env.ts` |
| T-03 validação de env | ✅ Joi `env.schema.ts` |
| T-04 seed master | 🟡 implementado, mas **diverge** (hash fixo, sem env vars) |
| T-05 RBAC | ✅ implementado, **modelo divergente** (§7.1) |
| T-06 criação hierárquica de usuário | 🟡 via `CompaniesController`; mas `POST /users` público é furo (R1) |
| T-07 JWT em cookie | ❌ não feito |
| T-08 rate limiting | ✅ Throttler global + 10/min no analyze |
| T-09 hash não vaza | 🟡 manual, não estrutural (R3) |
| T-10 paginação | ✅ `PaginationDto` em condominiums/infractions |
| T-11 idioma dos campos | 🟡 `User` ainda em PT (`nome`/`senha`); resto em EN — **não padronizado** |
| T-12 soft delete | ✅ condominium/unit/infraction |
| T-13/T-14 telas + middleware | frontend (fora deste repo) |
| T-15 CORS multi-origem | ✅ |
| T-16 Swagger | ✅ `/api/docs` |
| T-17 gen tipos front | frontend |
| T-18 validação estrita env | 🟡 ✅ em geral, mas **sem `MASTER_*`** no schema |
| T-19 deploy | ❌/externo |
| T-20 CI | ✅ `feat/t-11-ci-pipeline` mergeado |
| T-21–T-25 polish UX | frontend |
| T-26 cobertura por módulo | ✅ thresholds por módulo no `package.json` |
| T-27 logger estruturado | ✅ pino |
| T-28 IA assíncrona | ❌ (síncrono com timeout) |
| T-29 prompt versionado | ✅ `prompts/*.md` v1/v2/v3 |

---

## 8. Status das branches (mergeadas vs. pendentes)

**Mergeadas em `master`** (todas as `feat/*`, `chore/*`, `docs/*`, `fix/*` — 41 branches):
`chore/node-20-and-sdd-bump`, `chore/smoke-e2e-runner`, `chore/t-12-prettier-eol-normalization`, `docs/roadmap`, `docs/sdd-multi-tenant-update`, `docs/sync-backlog`, `feat/admin-create-employees`, `feat/audit-condominium`, `feat/audit-log`, `feat/authz-master-admin`, `feat/condominium-regimento-ai`, `feat/csv-export`, `feat/dashboard`, `feat/delete-member`, `feat/ia-reincidencia`, `feat/infraction-approval`, `feat/infraction-company-isolation`, `feat/infraction-images`, `feat/infraction-send-email`, `feat/infraction-whatsapp`, `feat/master-list-users`, `feat/multi-tenant-company-foundation`, `feat/notification-history`, `feat/pagination`, `feat/password-reset`, `feat/rate-limiting`, `feat/soft-delete`, `feat/swagger-openapi`, `feat/t-01-dynamic-cors`, `feat/t-02-strict-env-config`, `feat/t-03-env-validation-schema`, `feat/t-04-ia-prompt-timeout-errors`, `feat/t-05-pdf-report-streaming`, `feat/t-06-rbac`, `feat/t-07-coverage-thresholds`, `feat/t-08-pino-logger`, `feat/t-09-healthcheck-readiness`, `feat/t-10-docker-dev-compose`, `feat/t-11-ci-pipeline`, `feat/unit-resident-contact`, `fix/infractions-query-dto`.

**Pendentes (trabalho solto em branch, ainda NÃO em `master`):**

| Branch | Commits à frente de master | Natureza |
|---|---|---|
| `refactor/current-actor-decorator` | 1 | refactor do decorator `@CurrentActor` |
| `refactor/unique-violation-helper` | 5 | helper para tratar violação de unicidade (23505) |
| `refactor/split-infractions-service` | 6 | divisão do `InfractionsService` em services menores |

> Obs.: o tip de `master` já contém o merge do PR #44 (`refactor/current-actor-decorator`); a branch ainda aparece com 1 commit não-ancestral (provável diferença de squash/merge). Tratar as 3 como refactors em andamento.

---

## 9. Cobertura de testes

Coletada com `npm run test:cov -- --maxWorkers=2 --workerIdleMemoryLimit=512MB` (exit 0).

> ⚠️ **Nota de instabilidade:** `npm run test:cov` **sem** limite de workers falha com `FATAL ERROR: Zone Allocation failed - process out of memory` / SIGTERM nos workers (mesmo sintoma da sessão anterior). Com `--maxWorkers=2` (workaround documentado no `CLAUDE.md`) roda até o fim. A coleta abaixo é confiável.

```
Test Suites: 37 passed, 37 total
Tests:       307 passed, 307 total

Statements   : 92.21% ( 1018/1104 )
Branches     : 70.41% ( 219/311 )
Functions    : 90.55% ( 163/180 )
Lines        : 92.15% ( 952/1033 )
```

- 37 suites, **307 testes, 100% passando** (~208s com 2 workers).
- Acima dos thresholds globais do `package.json` (88/84/88/65). Thresholds por módulo ativos para `auth`, `ia`, `pdf`, `infractions`.
- Logs de erro vistos na saída (`db down`, `Gemini: upstream/timeout`) são **esperados** — testes de caminho de erro (audit fire-and-forget, IA timeout/upstream).
- Há specs e2e em `test/` (`cors.e2e-spec.ts`, `reports.e2e-spec.ts` etc.); não executados nesta coleta (exigem stack).

---

## 10. Próximos passos sugeridos (para decisão humana — não executados)

1. **Atualizar o SDD v2.0** para refletir o código real: modelo de papéis (§7.1), features extras (§7.6), e marcar tarefas já entregues (§7.7). O SDD v2.0 está, na prática, desatualizado em relação ao `master`.
2. **Decidir sobre o papel `RESIDENT`** (manter como leitura ou remover, dado que o SDD diz que morador não existe).
3. **Fechar o furo R1** (`POST /users` público) — alta prioridade de segurança.
4. **Alinhar o seed do master** (R2) ao SDD (env vars) ou ajustar o SDD à decisão de hash fixo + troca obrigatória.
5. Mergear (ou descartar) as 3 branches de refactor pendentes.
6. Itens de fato pendentes do plano: **T-07** (cookie httpOnly), **T-11** (padronizar idioma `User`), **T-19** (deploy), **T-28** (IA assíncrona, se necessário).

---

## 11. Metadados de execução

- **Branch de discovery** trazida ao nível de `master` via merge para inventariar o código real (a branch havia sido criada de um ponto antigo).
- **Documento anterior preservado:** `docs/state-of-code-2026-05-15.md`.
- **Comandos executados (somente leitura):** `git` (inspeção de branches/merge-base), `npm run test:cov -- --maxWorkers=2` (cobertura — ver §9).
- **Nenhum arquivo em `src/` ou `test/` foi modificado.**
