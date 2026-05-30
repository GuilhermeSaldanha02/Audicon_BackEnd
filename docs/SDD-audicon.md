# SDD — Audicon (Backend + Web)
**Spec-Driven Development Document**
Versão: 3.1 · Última atualização: 2026-05-30
Substitui a v3.0. Esta versão fecha a Fase A.

---

## 0. Como ler este documento

Fonte única de verdade para a continuidade do Audicon — `Audicon_BackEnd` e `Audicon_Web`. Conflito entre um pedido e o SDD → o agente **para e pergunta**, não improvisa.

**O que mudou da v3.0 para a v3.1:**
- **Fase A completa.** R-06 (seed master por env) e R-07 (senha estrutural) mergeados.
- Narrativa do R-07 corrigida com base no que foi descoberto na inspeção: a proposta original de "remover os 3 `delete result.senha`" estava tecnicamente errada. Só 1 dos 3 era de fato removível. Os outros 2 protegem caminhos diferentes que `select: false` não cobre. Ver §5 / R-07 para a explicação completa.
- Novo R-19 no backlog (Fase F): eliminar os 2 `delete` restantes via projeção/DTO, tornando o sistema *incapaz* de vazar senha por esquecimento.

**Objetivo do projeto:** MVP para uso real com clientes. Meta da próxima entrega: sistema funcionando no padrão, publicado, para clientes-piloto testarem.

---

## 1. Contexto

**Audicon** — SaaS B2B multi-tenant para gestão de infrações em condomínios, com análise por IA (Google Gemini) e geração de PDF. Vendido para **empresas de administração de condomínios**.

**Repositórios:**
- `Audicon_BackEnd` — NestJS / TypeScript / TypeORM / PostgreSQL. **Fundação completa.** 345 unit tests, 24 e2e, módulos: `auth`, `users`, `companies`, `condominiums`, `units`, `infractions`, `ia`, `pdf`, `health`, `audit`, `dashboard`, `notifications`, `mail`, `whatsapp`, `common`.
- `Audicon_Web` — Next.js 15 / React 19 / Tailwind 4 / shadcn. Estrutura a construir; visual será refeito com Open Design depois.

**Regra de produto fundamental:** o **morador NÃO tem acesso** ao sistema. Não existe perfil de morador/inquilino/condômino como usuário.

---

## 2. Modelo de Acesso

Multi-tenant: cada empresa-cliente é um tenant isolado; dados de uma empresa nunca são vistos por outra.

### 2.1 Hierarquia de papéis

| Papel | Quem cria | Escopo | Permissões |
|---|---|---|---|
| **MASTER** | Migration de seed por env (R-06) | Global | Tudo. Cria Empresas e o Gerente de cada uma. |
| **GERENTE** | O Master | A própria empresa | Tudo na sua empresa: CRUD de condomínios, unidades, funcionários, infrações; IA; PDF. |
| **FUNCIONÁRIO** | O Gerente | A própria empresa | Escrita só em **infrações**; leitura de condomínios e unidades. Atua em todos os condomínios da empresa. Não cria/edita condomínio, unidade ou usuário. |

Papel mora em `User.role` (enum `SystemRole`). Trava de "um GERENTE por empresa" via índice único parcial.

### 2.2 Master

Criado pela migration de seed `SeedMasterFromEnv`, que lê `MASTER_EMAIL` e `MASTER_PASSWORD` do ambiente. Idempotente: se já existe um usuário com `isMaster = true`, o seed não faz nada. A senha do Master é a chave-mestra: gerada externamente (`openssl rand -base64 18`), forte, nunca commitada. Validação em duas camadas — `requireEnv` na migration + Joi no boot da aplicação.

### 2.3 Isolamento de tenant (padrão canônico)

- **Rotas com `:id` de recurso de empresa** → `InfractionAccessGuard` ou `CondominiumAccessGuard`.
- **Rotas sem `:id` (lista/agregação)** → `assertTenantScope(req.user)` no controller, passa `scope.companyId` para o service.
- **Rotas master-only** → `MasterGuard`.
- **Anti-padrão proibido:** `if (!isMaster && companyId)` solto em service. Use o helper.

---

## 3. Arquitetura

### 3.1 Backend

Módulos listados em §1. Padrões transversais a manter: `HttpExceptionFilter`, `ResponseInterceptor` (envelope `{ statusCode, data }`), `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`).

### 3.2 Frontend

Next.js 15 (App Router), React 19, Tailwind 4, shadcn/ui, TanStack Query, axios, react-hook-form/zod. **Visual será refeito com Open Design depois.** A estratégia atual é construir a **estrutura/lógica** (telas funcionais respeitando RBAC) sem polir o visual antes da remodelagem.

### 3.3 Integração backend ↔ frontend

Dev: backend 3000, frontend 3001, via `NEXT_PUBLIC_API_URL`. Contrato via Swagger/OpenAPI; frontend gera tipos com `openapi-typescript`. Prod: backend + Postgres gerenciado; frontend na Vercel; CORS por env.

---

## 4. Convenções obrigatórias

| # | Regra |
|---|---|
| C1 | Toda rota nova tem DTO com `class-validator`. |
| C2 | Toda resposta passa pelo `ResponseInterceptor`. |
| C3 | Toda exceção previsível usa `HttpException`/subclasses. |
| C4 | Mudança de schema gera migration. Nunca `synchronize: true`. |
| C5 | Zero segredo hard-coded — tudo via `ConfigService`; variáveis novas no `.env.example`. |
| C6 | Cobertura de testes não regride (baseline atual: 345 unit / 24 e2e). |
| C7 | Conventional Commits. |
| C8 | PR referencia o ID da tarefa (ex.: `R-08`). |
| C9 | Isolamento de tenant respeitado em toda query de negócio. Master ignora. Padrão canônico em §2.3. |
| C10 | Senha/hash nunca retornada em nenhuma rota. Estrutura: `select: false` na coluna; `addSelect` apenas no caminho de login; `delete` manual *apenas* nos 2 pontos onde a senha entra em memória por motivo legítimo (auth.service após `addSelect`, users.controller após `save()`) — esses dois cobertos por testes que falham se o `delete` for removido. R-19 (Fase F) eliminará esses 2 `delete` via projeção/DTO. |
| C11 | Mudança de contrato da API → tipos do frontend regenerados no mesmo ciclo. |
| C12 | Hotfix/correção isolada em branch e PR próprios, separados de docs e features. |
| C13 | `npm run lint:check` e `npm test` rodam dentro do Docker (`docker compose exec api ...`). Exceção: pre-commit hook (husky) roda local — paridade garantida pelo lockfile (`prettier` pinado em versão exata). |

---

## 5. Plano de Reconciliação — Tarefas

### Fase A — Reconciliação (fundação) — COMPLETA

| ID | Tarefa | Modelo | Status | PR |
|---|---|---|---|---|
| R-01 | Hotfix `POST /users` (master-only) | Opus | Mergeado | #48 |
| R-02 | Enum `SystemRole` + trava de gerente único | Opus | Mergeado | #50/#52 |
| R-03+04 | Aposentar modelo papel-por-condomínio (RESIDENT + user_condominium + RolesGuard reescrito + CondominiumAccessGuard) | Opus | Mergeado | #51/#52 |
| R-05 | `assertTenantScope` helper + cobertura cross-tenant | Opus | Mergeado | #54 |
| Infra | Pre-commit hook (husky + lint-staged) + pin prettier | Sonnet | Mergeado | #55 |
| R-06 | Seed do Master por ambiente | Opus | Mergeado | #57 |
| R-07 | Senha estrutural (`select: false`) | Opus | Mergeado | #58 |

**Nota sobre o R-07 — narrativa corrigida.** A proposta original do SDD v2.0/v3.0 dizia "remover os 3 `delete result.senha` manuais". A inspeção do R-07 mostrou que isso estava tecnicamente errado: `select: false` afeta apenas leitura via `SELECT`, e dois dos três `delete` operam sobre entidades que carregam a senha por outro caminho — `auth.service.validateUser` (o `addSelect` do login traz a senha de volta para o `bcrypt.compare`) e `users.controller.create` (o `save()` devolve a entity em memória com o hash recém-calculado pelo `@BeforeInsert`). Removê-los faria os specs falharem — eles provam que fazem trabalho real. Apenas o `delete` do `jwt.strategy.ts` era de fato redundante (`findOneById` sem `addSelect` já não traz a senha). Os outros 2 `delete` ficam, com cobertura de teste que falha se forem removidos por engano. Eliminá-los completamente requer refatoração (projeção/DTO) — fica como **R-19** na Fase F.

### Fase B — Segurança restante

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-08 | JWT em cookie `httpOnly + Secure + SameSite` (toca os dois repos no mesmo ciclo) | P1 | ambos | Opus |
| R-09 | Revisão de guards pós-reconciliação; atualizar `docs/rbac.md` | P2 | back | Opus |

### Fase C — Frontend (estrutura, sem polir visual)

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-10 | Telas dos fluxos que o backend já expõe (condomínios, unidades, infrações, análise IA, PDF), respeitando RBAC | P1 | front | Sonnet |
| R-11 | `middleware.ts` de proteção de rotas | P1 | front | Sonnet |
| R-12 | Tipos gerados a partir do OpenAPI (`openapi-typescript`) | P1 | front | Sonnet |
| R-13 | CORS por env multi-origem | P1 | back | Sonnet |

### Fase D — Deploy

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-14 | Publicar para clientes-piloto: backend + Postgres gerenciado; frontend Vercel; migrations + seed Master no deploy; healthcheck verde; CORS prod | P0 | ambos | Opus |

### Fase E — Visual com Open Design (depois do MVP no ar)

Remodelagem visual com Open Design. Não polir aparência antes dessa fase.

### Fase F — Incremental (pós-validação)

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-15 | Reconciliar módulos extras no SDD (Mail, WhatsApp, Audit, Dashboard, Notifications — documentação) | P2 | back | Sonnet |
| R-16 | Análise IA assíncrona se latência incomodar | P2 | back | Opus |
| R-17 | Prompt do Gemini versionado em arquivo (não em string solta) | P3 | back | Sonnet |
| R-18 | Refactors pendentes (`refactor/current-actor-decorator`, `refactor/unique-violation-helper`, `refactor/split-infractions-service`) | P2 | back | Sonnet |
| **R-19** | **Eliminar `delete senha` manuais via projeção/DTO.** Refatorar `auth.validateUser` para retornar uma projeção (campos mínimos de login) em vez da entity, e `users.controller.create` para devolver via `findOneById` ou DTO montado a dedo. Objetivo: tornar o sistema *incapaz* de vazar senha por esquecimento, removendo os 2 `delete` restantes. **Não foi feito junto do R-07** porque os 2 `delete` remanescentes estão em caminhos quentes (login, criação de usuário) com cobertura que falha se removidos por engano; o ganho marginal não justificava mexer em dois fluxos críticos na última tarefa da Fase A. | P2 | back | Opus |
| R-20 | Avaliar skills/MCPs instalados (brainstorming, executing-plans, serena, etc.) e adotar o que fizer sentido | P3 | — | — |

---

## 6. Definition of Done (toda tarefa)

1. Respeita as convenções §4.
2. Testes do caso feliz e de ao menos um caso de erro.
3. `lint`, `test` (e `test:e2e` se aplicável) passam **dentro do Docker** (`docker compose exec api ...`), com `--maxWorkers=2` se houver OOM.
4. Documentação atualizada se houve mudança de contrato.
5. Mudança de contrato de API → tipos do frontend regenerados (C11).
6. PR com descrição, ID da tarefa, evidência. Hotfix/correção em PR isolado (C12).
7. Revisão humana aprovou. Sem auto-merge.
8. Pre-commit hook não bloqueou — se bloqueou, foi corrigido (não pulado com `--no-verify`).

---

## 7. Ordem recomendada e estado

**Concluído:** Fase A inteira (R-01 → R-02 → R-03+04 → R-05 → Pre-commit → R-06 → R-07).

**Próximo:** **Fase B — R-08 (JWT em cookie httpOnly).** Primeira tarefa que toca os dois repositórios no mesmo ciclo. Recomendação: começar por Discovery do frontend (até agora pouco inspecionado) para mapear como o token é armazenado/enviado hoje, antes de planejar a transição. Cuidado especial: a transição não pode ter janela onde o login fica quebrado — exige sequência coordenada (back aceita ambos os modos transitoriamente, front migra, back remove o modo antigo) ou um deploy atômico bem orquestrado.

**Depois:** R-09 (revisão de guards) → Fase C (estrutura do front) → Fase D (deploy) → Fase E (Open Design) → Fase F (incremental).

---

## 8. Glossário

- **Tenant:** empresa-cliente isolada.
- **Reconciliação:** alinhar o código real ao produto decidido — diferente de "construir do zero".
- **Discovery:** inspeção só-leitura. Cinco já feitos: `state-of-code.md`, `discovery-multitenant.md`, `discovery-resident.md`, `discovery-tenant-isolation.md`, mais a inspeção do R-07 que ficou inline na conversa.
- **Padrão canônico de isolamento de tenant:** ver §2.3.
- **Opus/Sonnet:** modelos do Claude Code. Não confundir com Gemini (IA do produto).

**Changelog:**
- v3.1 — Fase A marcada como completa; R-06 e R-07 mergeados; narrativa do R-07 corrigida (só 1 dos 3 `delete` saiu, com explicação técnica em §5); R-19 adicionado à Fase F; convenção C10 atualizada para refletir o estado real; baseline de testes atualizada para 345 unit.
- v3.0 — Backlog R-xx canonizado no SDD; tarefas mergeadas marcadas com ✅; Fase E redefinida para Open Design; convenção C13 sobre Docker.
- v2.0, v1.0 — obsoletas.
