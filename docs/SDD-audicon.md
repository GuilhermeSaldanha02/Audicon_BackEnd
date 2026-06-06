# SDD — Audicon (Backend + Web)
**Spec-Driven Development Document**
Versão: 3.3 · Última atualização: 2026-06-05
Substitui a v3.2. Esta versão registra o achado de segurança da senha do Master, a inversão da ordem do deploy, e a nova Fase de gestão de usuários (R-15 a R-17).

---

## 0. Como ler este documento

Fonte única de verdade para a continuidade do Audicon — `Audicon_BackEnd` e `Audicon_Web`. Conflito entre um pedido e o SDD → o agente **para e pergunta**, não improvisa.

**O que mudou da v3.2 para a v3.3:**
- **Ordem do deploy invertida.** A decisão foi subir o piloto só com as funcionalidades básicas completas. O R-14 (deploy) deixou de ser "o próximo passo" e passou a vir **depois** da gestão de usuários (R-15, R-16, R-17). Ver §7.
- **Achado de segurança crítico (senha do Master) — resolvido.** Descoberto durante o Discovery de infra do R-14: o Master de produção nascia com uma senha pública versionada no git (migration legada `AddCompanyAndMasterUser`); o `SeedMasterFromEnv` validava `MASTER_PASSWORD` no boot mas não a aplicava. Corrigido via migration nova `UpdateMasterPasswordFromEnv` (decisão: sobrescrever o hash pela env no mesmo release, antes do tráfego). Ver §2.2 e §5 (R-14 parte segurança, mergeado).
- **Nova Fase G — Gestão de usuários** (R-15, R-16, R-17), pré-requisito do piloto:
  - **R-15 (completo):** GERENTE cria e lista funcionários da própria empresa; listagem retorna `role`; `CompanyAccessGuard` novo. PRs Back #66 / Front #33.
  - **R-16 (em andamento):** GERENTE edita (nome/e-mail) e **desativa** (soft-delete) funcionários. Decisões travadas: soft-delete (nunca hard-delete, preserva auditoria); editar nunca toca `role`.
  - **R-17 (planejado):** MASTER promove/rebaixa o GERENTE da empresa (toca a trava de Gerente único).
- **Bug R-14 (deploy) parte código: mergeado.** Fix do `data-source.ts` (glob via `__dirname`, caminho A), script `migration:run:prod`, migration da senha do Master. PRs Back #65 / Front #32 (config de Vercel: `.env.example`, `engines`, `.nvmrc`). Falta a parte de **configuração de plataforma** (Railway/Vercel) — ver §5.
- **Dois falsos-positivos esclarecidos (não eram bugs):** a "tela preta" ao clicar Funcionários como GERENTE era um 404 nativo do Next em dark mode (link da sidebar apontava para rota inexistente `/company/employees`, criada no R-15); o "e-mail não envia" local era o modo mock esperado (sem `RESEND_API_KEY`).
- **Baseline de testes atualizada:** backend 365 unit / 46 e2e (após R-15).

**Objetivo do projeto:** MVP para uso real com clientes. Meta da próxima entrega: gestão de usuários completa (R-15→R-17), depois deploy do piloto (R-14).

---

## 1. Contexto

**Audicon** — SaaS B2B multi-tenant para gestão de infrações em condomínios, com análise por IA (Google Gemini) e geração de PDF. Vendido para **empresas de administração de condomínios**.

**Repositórios:**
- `Audicon_BackEnd` — NestJS / TypeScript / TypeORM / PostgreSQL. **Fundação completa.** 365 unit tests, 46 e2e, módulos: `auth`, `users`, `companies`, `condominiums`, `units`, `infractions`, `ia`, `pdf`, `health`, `audit`, `dashboard`, `notifications`, `mail`, `whatsapp`, `common`.
- `Audicon_Web` — Next.js 15 / React 19 / Tailwind 4 / shadcn. **13 telas funcionais** (12 do Open Design + `/company/employees` do R-15) com design system aplicado. CI mínimo: next lint + next build em PR.

**Regra de produto fundamental:** o **morador NÃO tem acesso** ao sistema. Não existe perfil de morador/inquilino/condômino como usuário.

---

## 2. Modelo de Acesso

Multi-tenant: cada empresa-cliente é um tenant isolado; dados de uma empresa nunca são vistos por outra.

### 2.1 Hierarquia de papéis

| Papel | Quem cria | Escopo | Permissões |
|---|---|---|---|
| **MASTER** | Migration de seed por env (R-06) | Global | Tudo. Cria Empresas, o Gerente de cada uma, e condomínios para qualquer empresa. |
| **GERENTE** | O Master | A própria empresa | Tudo na sua empresa: CRUD de condomínios, unidades, funcionários, infrações; IA; PDF. |
| **FUNCIONÁRIO** | O Gerente (via tela `/company/employees`, R-15) | A própria empresa | Escrita só em **infrações**; leitura de condomínios e unidades. Atua em todos os condomínios da empresa. Não cria/edita condomínio, unidade ou usuário. |

Papel mora em `User.role` (enum `SystemRole`). Trava de "um GERENTE por empresa" via índice único parcial. O endpoint `/auth/profile` expõe `role`, `companyId`, `isMaster`, `mustChangePassword` — o front usa para RBAC client-side.

### 2.2 Master

Criado pela migration de seed `SeedMasterFromEnv`, que lê `MASTER_EMAIL` e `MASTER_PASSWORD` do ambiente. Idempotente: se já existe um usuário com `isMaster = true`, o seed não faz nada.

**⚠️ Achado de segurança (R-14) — resolvido.** Em produção, o Master era de fato criado pela migration legada `AddCompanyAndMasterUser`, com um hash bcrypt **fixo e público versionado no git** (senha conhecida). O `SeedMasterFromEnv` rodava depois e pulava ("Master já existe"), de modo que `MASTER_PASSWORD` era validado no boot mas **não aplicado** — o Master de prod nasceria com a senha do git (violação CWE-798 / OWASP A07).

**Correção (migration `UpdateMasterPasswordFromEnv`, timestamp posterior à legada):** lê `MASTER_PASSWORD` do ambiente, gera o hash com a mesma lib/rounds do login (`bcrypt`, custo 10), e faz `UPDATE` do hash do Master (`isMaster = true`, conta única garantida pela legada + seed idempotente). Roda no `migration:run:prod`, no mesmo release que cria o Master — este nunca fica no ar com a senha do git. `down()` é no-op documentado (reverter restauraria a senha insegura). A senha de prod é gerada externamente (`openssl rand -base64 18`), guardada em cofre (secret do Railway), nunca commitada. **Conserto definitivo do seed (remover a senha hard-coded na origem) fica para a Fase F.**

### 2.3 Isolamento de tenant (padrão canônico)

- **Rotas com `:id` de recurso de empresa** → `InfractionAccessGuard`, `CondominiumAccessGuard` ou `CompanyAccessGuard` (R-15).
- **Rotas sem `:id` (lista/agregação)** → `assertTenantScope(req.user)` no controller, passa `scope.companyId` para o service.
- **Rotas master-only** → `MasterGuard`.
- **Anti-padrão proibido:** `if (!isMaster && companyId)` solto em service. Use o helper/guard.

**`CompanyAccessGuard` (R-15):** espelha o `CondominiumAccessGuard`, mas sem lookup no banco — como o `:companyId` do path *é* o id da empresa, compara `Number(req.params.companyId) === req.user.companyId` (MASTER bypassa). Dá **403 explícito** quando o GERENTE tenta outra empresa. Usado nas rotas `POST`/`GET /companies/:companyId/users`. Nota de defesa em profundidade: o `CompanyAccessGuard` não barra um FUNCIONÁRIO na própria empresa (o `companyId` casa) — quem barra FUNCIONÁRIO é o `RolesGuard`, que **precede** no array `@UseGuards`. Há teste e2e nomeado provando "FUNCIONÁRIO na própria empresa → 403".

### 2.4 Autenticação (R-08)

JWT em cookie `httpOnly`. Flags por ambiente: dev = `SameSite=Lax`, `Secure=false`; prod = `SameSite=None`, `Secure=true`. Token extraído do cookie pela `JwtStrategy` (cookieExtractor). `Authorization: Bearer` removido (big-bang, sem dual-mode). Logout via `POST /auth/logout` (limpa cookie). Claims no front hidratados via `GET /auth/profile` (fonte única). Frontend usa `axios` com `withCredentials: true`; downloads binários usam `credentials: 'include'`.

**Ponto de atenção para o R-16 (desativação de usuário):** a `JwtStrategy` precisa recusar usuário desativado a cada request — desativar no banco não revoga o cookie/JWT já emitido, que continuaria válido até expirar. Ver R-16 (§5, PARADA 1).

---

## 3. Arquitetura

### 3.1 Backend

Módulos listados em §1. Padrões transversais: `HttpExceptionFilter`, `ResponseInterceptor` (envelope `{ statusCode, data }`), `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`). Cookie parsing via `cookie-parser`. Helper `buildAuthCookieOptions(config)` centraliza flags por ambiente. Swagger usa `@ApiCookieAuth`. Migrations resolvidas via glob `__dirname` (`*.{ts,js}`) — funciona em dev (ts-node) e prod (JS compilado).

### 3.2 Frontend

Next.js 15 (App Router), React 19, Tailwind 4, shadcn/ui, TanStack Query, axios, react-hook-form/zod. Design system aplicado — tokens do Open Design mapeados no Tailwind 4 (`@theme` em globals.css). AppShell com sidebar navy 240px, nav por papel, responsivo (drawer mobile <1024px). Middleware.ts verifica presença do cookie (server-side); `<RequireAuth>` verifica papel (client-side). Tela `/company/employees` (R-15) espelha o padrão de condomínios.

### 3.3 Integração backend ↔ frontend

Dev: backend 3000, frontend 3001, via `NEXT_PUBLIC_API_URL`. Swagger/OpenAPI em `/api/docs-json` (fora do prefix `api/v1`). Frontend gera tipos com `openapi-typescript` (`npm run generate:types`). Prod: backend + Postgres gerenciado (Railway); frontend na Vercel; CORS por env (`CORS_ORIGINS`, `credentials: true`).

### 3.4 Infração — modelo de dados

Campos principais: `description`, `formalDescription`, `suggestedPenalty`, `status` (enum `InfractionStatus`: `pending`/`analyzed`/`approved`/`sent`), `severity` (enum `InfractionSeverity`: `LEVE`/`MEDIA`/`GRAVE`), `occurrenceDate`, `images[]`, `unit`. A IA recebe `severity` como contexto no prompt.

**Correção (R-16) — `Infraction` NÃO tem FK para `User`.** A v3.2 afirmava que a remoção de funcionário é soft-delete "para não orfanar o histórico, pois a infração aponta para o autor". Isso está **errado e foi verificado no código**: `Infraction` referencia apenas `Unit` (`@ManyToOne(() => Unit)`), não o usuário criador; e o `audit_log` é **denormalizado** (`userId`/`userEmail` são colunas simples, sem FK). Logo, **nada orfanaria** ao remover um usuário. A decisão de usar soft-delete (R-16) continua correta, mas pelos motivos reais: (1) **revogação reversível** — desativar é a operação, não destruir; (2) **reativação futura** (Fase F); (3) **consistência** com `Condominium`/`Unit`/`Infraction`, que já usam `@DeleteDateColumn`; (4) **preservar o registro** do usuário. Mecanismo: `User.deletedAt` (`@DeleteDateColumn`), migration `AddUserSoftDelete`, backfill trivial (coluna nasce NULL = ativo).

**Limitações conhecidas do soft-delete de `User` (Fase F, fora do R-16):**
- **E-mail preso.** Com `@DeleteDateColumn` + `unique` não-parcial em `email`, o e-mail de um usuário desativado não pode ser recriado nem reusado: o check de duplicidade em `createEmployee` usa `findOne` (que não enxerga soft-deleted), passa do check, e a constraint `unique` do banco estoura um `23505` cru (erro feio em vez de `ConflictException`). **Decisão consciente do R-16: não tratar o 23505 agora** (inflaria a tarefa).
- **Sem reativação.** Não há rota nem UI para reativar um funcionário desativado. Em produção isso é capenga (gerente desativa por engano → sem saída via produto). Vira melhoria de Fase F.

---

## 4. Convenções obrigatórias

| # | Regra |
|---|---|
| C1 | Toda rota nova tem DTO com `class-validator`. |
| C2 | Toda resposta passa pelo `ResponseInterceptor`. |
| C3 | Toda exceção previsível usa `HttpException`/subclasses. |
| C4 | Mudança de schema gera migration. Nunca `synchronize: true`. |
| C5 | Zero segredo hard-coded — tudo via `ConfigService`; variáveis novas no `.env.example` (back e front). |
| C6 | Cobertura de testes não regride (baseline atual: 365 unit / 46 e2e). |
| C7 | Conventional Commits. |
| C8 | PR referencia o ID da tarefa (ex.: `R-16`). |
| C9 | Isolamento de tenant respeitado em toda query de negócio. Master ignora. Padrão canônico em §2.3. |
| C10 | Senha/hash nunca retornada em nenhuma rota. `select: false` na coluna; `addSelect` só no login; `delete` manual só nos 2 pontos legítimos (cobertos por testes). R-19 (Fase F) eliminará via projeção/DTO. |
| C11 | Mudança de contrato da API → tipos do frontend regenerados no mesmo ciclo, com evidência no PR. |
| C12 | Hotfix/correção isolada em branch e PR próprios. |
| C13 | `npm run lint:check` e `npm test` rodam dentro do Docker. Exceção: pre-commit hook (husky) local. |
| C14 | Cookie httpOnly: flags por ambiente via ConfigService. Nome do cookie = constante `access_token`. |

---

## 5. Plano de Reconciliação — Tarefas

### Fase A — Fundação — COMPLETA
R-01→R-07. Mergeado (#48, #50/#52, #51/#52, #54, #55, #57, #58). Ver v3.1/v3.2 para detalhes.

### Fase B — Segurança — COMPLETA
R-08 (JWT cookie httpOnly), R-09 (auditoria de guards + rbac.md). Mergeado (Back #60/#61, Front #24).

### Fase C — Frontend — COMPLETA
R-10 (12 telas), R-11 (middleware.ts), R-12 (tipos OpenAPI + Swagger), R-13 (CORS, absorvido). Mergeado (#62, #26, #27/#29/#30, #25). Fixes de produto: profile expõe role (#63/#28), severity (#64/#31), GERENTE cria condomínio (#64).

### Fase G — Gestão de usuários — pré-requisito do piloto

| ID | Tarefa | Modelo | Status | PR |
|---|---|---|---|---|
| R-15 | GERENTE cria e lista funcionários da própria empresa; `role` na listagem; `CompanyAccessGuard` novo; remoção do `listEmployees` morto | Opus | **Mergeado** | Back #66 / Front #33 |
| R-16 | GERENTE edita (nome/e-mail) e **desativa** (soft-delete) funcionários | Opus | **Backend implementado (PR aberto); front pós-PARADA 2** | — |
| R-17 | MASTER promove/rebaixa o GERENTE da empresa | Opus | Planejado | — |

**Detalhes R-15 (mergeado):** rotas `POST`/`GET /companies/:companyId/users` abertas a MASTER+GERENTE via `RolesGuard` + `CompanyAccessGuard` + `@Roles`. Defesa em profundidade: 2 e2e nomeados "FUNCIONÁRIO na própria empresa → 403". Escalonamento bloqueado: `role` forçado a FUNCIONARIO no service; `role` no body → 400 (whitelist). `listUsersOfCompany` retorna `role`. `CompanyUserResponseDto`/`CreatedEmployeeResponseDto` para o OpenAPI; tipos do front regenerados. Tela `/company/employees` (espelha condomínios) — resolve o 404/"tela preta". Removido `listEmployees` (código morto sem call-site, lia por `where { companyId }` sem guard — risco de vazamento cross-tenant se plugado em rota futura).

**Detalhes R-16 (em andamento) — decisões travadas:**
- "Remover" = **soft-delete (desativar)**. Registro permanece; acesso revogado; infrações do funcionário continuam íntegras (preserva auditoria). NUNCA hard-delete.
- "Editar" = **nome e e-mail apenas**. `role` nunca editável (seria escalonamento). Whitelist barra extras → 400.
- **PARADA 1 (crítica, backend) — RESOLVIDA.** Revogação real em **dois legs com checagem explícita** (não dependente do auto-filtro de soft-delete do TypeORM, que é versão-dependente): (a) **login** — `auth.service.validateUser` rejeita `if (user.deletedAt) return null` → 401; (b) **request autenticado** — `JwtStrategy.validate` rejeita `if (!user || user.deletedAt)` → 401 (o `findOneById`/`findOneBy` já auto-filtra; o `|| deletedAt` é defesa em profundidade gratuita). Sem custo de query novo: a `JwtStrategy` já fazia lookup do user por request. Mecanismo escolhido: **`@DeleteDateColumn`** (fail-safe — esconder/rejeitar o desativado é o padrão automático; vazar exige `.withDeleted()` explícito) sobre flag `isActive`. Migration `AddUserSoftDelete` escrita à mão (a auto-gerada vinha poluída e dropava a trava de Gerente único — descartada).
- **Rotas (backend):** `PATCH /companies/:companyId/users/:userId` (editar nome/e-mail) e `DELETE /companies/:companyId/users/:userId` (desativar), ambas com `RolesGuard` + `CompanyAccessGuard` + `@Roles(MASTER, GERENTE)` (mesma blindagem do R-15). `UpdateEmployeeDto { nome?, email? }` sem `role` (whitelist → 400). Listagem ganhou `?includeInactive=true` (`withDeleted`) e `deletedAt` no `CompanyUserResponseDto`. Audit: ações novas `EMPLOYEE_UPDATED` e `EMPLOYEE_DEACTIVATED`.
- **PARADA 2 (design, frontend):** espelhar padrão de condomínios; ação "Desativar" (não "Excluir"), com confirmação; editar sem campo `role`. **Aguardando OK antes de tocar o front.**
- Escopo de alvo: GERENTE/MASTER só edita/desativa **FUNCIONÁRIO** da própria empresa (não a si, não outro GERENTE/MASTER) — aplicado no service (`findManageableEmployee`).

**Detalhes R-17 (planejado):** MASTER concede/revoga o papel de GERENTE de uma empresa. Toca a trava de "um GERENTE por empresa" (índice único parcial) + RBAC. Modo Opus, Discovery antes. Por último por ser a mais sensível.

> ⚠️ **Armadilha herdada do R-16 (anotada enquanto fresca):** a trava "um GERENTE por empresa" é um **índice único PARCIAL no banco** (`UQ_user_one_gerente_per_company ... WHERE role = 'GERENTE'`). Esse índice enxerga a **linha física**, não o soft-delete do TypeORM: um GERENTE **soft-deleted ainda ocupa a vaga** do índice. Não morde no R-16 (o alvo de editar/desativar é só FUNCIONARIO), mas é armadilha direta no R-17 quando o MASTER trocar de Gerente — desativar o Gerente atual e tentar promover outro vai colidir no índice (`23505`) porque o desativado continua contando. O R-17 precisará lidar com isso (ex.: índice parcial que também exija `deletedAt IS NULL`, ou hard-handover transacional).

### Fase D — Deploy

| ID | Tarefa | Prioridade | Repo | Modelo | Status |
|---|---|---|---|---|---|
| R-14 | Publicar para clientes-piloto: Railway (backend + Postgres) + Vercel (frontend); migrations + seed Master no deploy; healthcheck; CORS prod; cookie flags prod | P0 | ambos | Opus | **Parte código mergeada; falta config de plataforma** |

**R-14 — parte código (mergeada):** fix do `data-source.ts` (glob `__dirname` `{ts,js}`, caminho A); script `migration:run:prod` (`typeorm migration:run -d dist/data-source.js`, sem ts-node); migration `UpdateMasterPasswordFromEnv` (§2.2). Front: `.env.example`, `engines.node ">=20"`, `.nvmrc`, exceção `!.env.example` no `.gitignore`. PRs Back #65 / Front #32.

**R-14 — parte config de plataforma (pendente, sem PR — é setting):**
- Railway: serviço backend + plugin Postgres; `DB_*` mapeados para `${{Postgres.PG*}}`; Pre-Deploy Command = `migration:run:prod`; Start Command = `start:prod`; Health Check Path = `/api/v1/health/live`.
- Variáveis de prod (backend): `NODE_ENV=production`, `PORT` ($PORT do Railway), `DB_*` (refs Postgres), `JWT_SECRET` (novo, secret), `JWT_EXPIRATION=1h`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, `CORS_ORIGINS` (URL Vercel), `MASTER_EMAIL`, `MASTER_PASSWORD` (secret), opcionais (`GEMINI_*`, `RESEND_*`, `ZAPI_*` — mock se ausentes).
- Vercel: `NEXT_PUBLIC_API_URL` (build-time) = URL do backend Railway + `/api/v1`. Sem `vercel.json`.
- CORS: origem de produção da Vercel (sem wildcard — incompatível com `credentials: true`).
- **Ordem:** backend primeiro (input caro `NEXT_PUBLIC_API_URL` é build-time; CORS é runtime, ajustável depois sem rebuild).
- **Decisão pendente:** e-mail real no piloto (configurar `RESEND_API_KEY`) ou mock.

### ~~Fase E — Visual com Open Design~~ — ABSORVIDA NA FASE C

### Fase F — Incremental (pós-validação)

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-15b | Reconciliar módulos extras no SDD (Mail, WhatsApp, Audit, Dashboard, Notifications — documentação) | P2 | back | Sonnet |
| R-16b | Análise IA assíncrona se latência incomodar | P2 | back | Opus |
| R-17b | Prompt do Gemini versionado em arquivo | P3 | back | Sonnet |
| R-18 | Refactors pendentes | P2 | back | Sonnet |
| R-19 | Eliminar `delete senha` manuais via projeção/DTO | P2 | back | Opus |
| R-20 | Avaliar skills/MCPs instalados | P3 | — | — |
| R-21 | Avaliar proteção CSRF (cookie `SameSite=None` em prod) | P2 | back | Opus |
| R-22 | Conserto definitivo do seed do Master (remover senha hard-coded da migration legada na origem; forçar troca no 1º login) | P2 | back | Opus |

**Melhorias de UX identificadas (não bloqueiam):** filtro de infrações por condomínio (hoje só `unitId`); filtros de período no dashboard e audit-log; filtro `includeInactive` na listagem de usuários (avaliado no R-16); atualizar `docs/discovery-tenant-isolation.md:159` (cita `listEmployees`, removido no R-15).

---

## 6. Definition of Done (toda tarefa)

1. Respeita as convenções §4.
2. Testes do caso feliz e de ao menos um caso de erro.
3. `lint`, `test` (e `test:e2e` se aplicável) passam dentro do Docker.
4. Documentação atualizada se houve mudança de contrato.
5. Mudança de contrato de API → tipos do frontend regenerados (C11), com evidência no PR.
6. PR com descrição, ID da tarefa, evidência. Hotfix/correção em PR isolado (C12).
7. Revisão humana aprovou. Sem auto-merge.
8. Pre-commit hook não bloqueou — se bloqueou, foi corrigido (não pulado com `--no-verify`).

---

## 7. Ordem recomendada e estado

**Concluído:** Fase A (R-01→R-07), Fase B (R-08, R-09), Fase C (R-10→R-13) + fixes de produto. R-14 parte código (segurança da senha do Master + infra de migration prod). R-15 (gestão de funcionários — GERENTE cria/lista).

**Em andamento:** R-16 (editar/desativar funcionário — soft-delete). Aguardando PARADA 1 (plano de revogação de acesso + guards) antes da implementação.

**Próximo:** R-16 → R-17 (Master gerencia papel de Gerente) → **R-14 parte config de plataforma** (subir o piloto no Railway + Vercel).

**Cuidado com escopo:** a ordem foi deliberadamente reordenada para subir o piloto só com as funcionalidades básicas de gestão de usuários completas. Não inflar R-16/R-17; não antecipar Fase F. Deploy é o último passo antes do piloto.

**Depois:** Fase F (incremental, pós-validação com clientes-piloto).

---

## 8. Glossário

- **Tenant:** empresa-cliente isolada.
- **Reconciliação:** alinhar o código real ao produto decidido.
- **Discovery:** inspeção só-leitura.
- **Soft-delete:** desativar um registro (marca inativo) sem removê-lo do banco — preserva histórico/auditoria. Padrão para remoção de usuário no Audicon (R-16).
- **Padrão canônico de isolamento de tenant:** ver §2.3.
- **Opus/Sonnet:** modelos do Claude Code. Não confundir com Gemini (IA do produto).
- **Open Design:** ferramenta usada na Fase C para gerar o design system e as 12 telas de referência. Trabalho encerrado — telas novas espelham o design system já no código.

**Changelog:**
- v3.3 — ordem do deploy invertida (R-14 depois de R-15/16/17); achado/correção da senha do Master (CWE-798) registrado em §2.2; Fase G (gestão de usuários: R-15 mergeado, R-16 em andamento, R-17 planejado); R-14 parte código mergeada, parte config de plataforma detalhada; `CompanyAccessGuard` em §2.3; soft-delete em §3.4 e glossário; falsos-positivos (tela preta = 404 dark mode, e-mail = mock) esclarecidos; R-22 (conserto do seed) na Fase F; baseline 365 unit / 46 e2e.
- v3.2 — Fases B e C completas; Fase E absorvida; R-08→R-13; fixes de produto; R-21 (CSRF); baseline 362/36.
- v3.1 — Fase A completa; R-06/R-07; baseline 345 unit.
- v3.0, v2.0, v1.0 — obsoletas.
