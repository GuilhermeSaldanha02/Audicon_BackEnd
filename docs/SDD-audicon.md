# SDD — Audicon (Backend + Web)
**Spec-Driven Development Document**
Versão: 3.0 · Última atualização: 2026-05-30
Substitui a v2.0 e canoniza o backlog R-xx que vinha vivendo só em conversas e Discoveries.

---

## 0. Como ler este documento

Fonte única de verdade para a continuidade do Audicon — `Audicon_BackEnd` e `Audicon_Web`. Conflito entre um pedido e o SDD → o agente **para e pergunta**, não improvisa.

**O que mudou da v2.0 para a v3.0:**
- A v2.0 foi escrita assumindo que quase tudo estava por fazer. Três Discoverys revelaram que o backend está muito avançado.
- O plano deixa de ser "construir" e passa a ser **reconciliar** (alinhar o código real ao produto decidido).
- O backlog R-xx (que vinha sendo usado em conversas e Discoveries mas não estava canonizado em lugar nenhum) agora vive aqui, em §5.
- R-03 e R-04 originalmente separados foram **fundidos** (decisão tomada após o Discovery do RESIDENT).
- Tarefas concluídas estão marcadas com ✅ e o número do PR mergeado.

**Objetivo do projeto:** MVP para uso real com clientes. Meta da próxima entrega: sistema funcionando no padrão, publicado, para clientes-piloto testarem.

---

## 1. Contexto

**Audicon** — SaaS B2B multi-tenant para gestão de infrações em condomínios, com análise por IA (Google Gemini) e geração de PDF. Vendido para **empresas de administração de condomínios**.

**Repositórios:**
- `Audicon_BackEnd` — NestJS / TypeScript / TypeORM / PostgreSQL. Muito avançado: 325+ unit tests, 24+ e2e, cobertura ~92% statements, módulos completos incluindo `companies`, `audit`, `dashboard`, `mail`, `whatsapp`, `notifications`, `health`.
- `Audicon_Web` — Next.js 15 / React 19 / Tailwind 4 / shadcn. Menos avançado; a estrutura precisa ser construída sobre a fundação reconciliada.

**Regra de produto fundamental:** o **morador NÃO tem acesso** ao sistema. Não existe perfil de morador/inquilino/condômino como usuário. O morador é objeto do sistema (a infração é registrada contra a unidade dele), nunca usuário dele.

---

## 2. Modelo de Acesso

Multi-tenant: cada empresa-cliente é um tenant isolado; dados de uma empresa nunca são vistos por outra.

### 2.1 Hierarquia de papéis

| Papel | Quem cria | Escopo | Permissões |
|---|---|---|---|
| **MASTER** | Migration de seed (sem tela) | Global | Tudo. Cria Empresas e o Gerente de cada uma. |
| **GERENTE** | O Master | A própria empresa | Tudo na sua empresa: CRUD de condomínios, unidades, funcionários, infrações; IA; PDF. |
| **FUNCIONÁRIO** | O Gerente | A própria empresa | Escrita só em **infrações**; leitura de condomínios e unidades. Atua em todos os condomínios da empresa (sem designação). Não cria/edita condomínio, unidade ou usuário. |

Papel mora em `User.role` (enum `SystemRole` — implementado no R-02). Trava de "um GERENTE por empresa" via índice único parcial no banco.

### 2.2 Master

Criado só por migration de seed. Não existe tela nem endpoint público que crie Master. O seed lê `MASTER_EMAIL` e `MASTER_PASSWORD` do ambiente (a fazer no R-06 — atualmente ainda usa hash bcrypt fixo da migration `AddCompanyAndMasterUser`). O Master loga pela tela comum; o papel no JWT libera acesso global. A senha do Master é a chave-mestra: forte, nunca commitada.

### 2.3 Isolamento de tenant

Padrão canônico (implementado no R-05):
- **Rotas com `:id` de recurso de empresa** → `InfractionAccessGuard` ou `CondominiumAccessGuard` (resolvem `companyId` do recurso pelo `:id`).
- **Rotas sem `:id` (lista/agregação)** → `assertTenantScope(req.user)` no controller, passa `scope.companyId` para o service, service condiciona o `WHERE`.
- **Rotas master-only** → `MasterGuard` no controller.
- **Anti-padrão proibido:** `if (!isMaster && companyId)` solto em service. Use o helper.

---

## 3. Arquitetura

### 3.1 Backend — módulos

Implementados em `master`: `auth`, `users`, `companies`, `condominiums`, `units`, `infractions`, `ia`, `pdf`, `health`, `audit`, `dashboard`, `notifications` (+ webhooks), `mail` (Resend), `whatsapp` (Z-API), `common`.

Padrões transversais a manter: `HttpExceptionFilter`, `ResponseInterceptor` (envelope `{ statusCode, data }`), `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`).

### 3.2 Frontend

Next.js 15 (App Router), React 19, Tailwind 4, shadcn/ui, TanStack Query, axios, react-hook-form/zod. Identidade visual: navy `#0F172A` + CTA blue `#0369A1`, Plus Jakarta Sans. **Visual será refeito com Open Design depois** — portanto a estratégia atual é construir a **estrutura/lógica** (telas funcionais respeitando RBAC), e não polir o visual antes da remodelagem.

### 3.3 Integração backend ↔ frontend

Dev: backend 3000, frontend 3001, via `NEXT_PUBLIC_API_URL`. Contrato: backend tem Swagger/OpenAPI — frontend deve gerar tipos a partir dele (`openapi-typescript`). Prod: backend + Postgres gerenciado; frontend na Vercel; CORS por env.

---

## 4. Convenções obrigatórias

| # | Regra |
|---|---|
| C1 | Toda rota nova tem DTO com `class-validator`. |
| C2 | Toda resposta passa pelo `ResponseInterceptor`. |
| C3 | Toda exceção previsível usa `HttpException`/subclasses. |
| C4 | Mudança de schema gera migration. Nunca `synchronize: true`. |
| C5 | Zero segredo hard-coded — tudo via `ConfigService`; variáveis novas no `.env.example`. |
| C6 | Cobertura de testes não regride (baseline atual: 325 unit / 24 e2e). |
| C7 | Conventional Commits. |
| C8 | PR referencia o ID da tarefa (ex.: `R-06`). |
| C9 | Isolamento de tenant respeitado em toda query de negócio. Master ignora. Padrão canônico em §2.3. |
| C10 | Senha/hash nunca retornada em nenhuma rota. Implementação estrutural a fazer no R-07. |
| C11 | Mudança de contrato da API → tipos do frontend regenerados no mesmo ciclo. |
| C12 | Hotfix/correção isolada em branch e PR próprios, separados de docs e features. |
| C13 | `npm run lint:check` e `npm test` rodam dentro do Docker (`docker compose exec api ...`). Exceção: pre-commit hook (husky) roda local — paridade garantida pelo lockfile (`prettier` pinado em versão exata). |

---

## 5. Plano de Reconciliação — Tarefas

> Cada tarefa: `ID · Prioridade · Repo · Modelo recomendado · Status`.
> **Modelo Opus/Sonnet:** modelos do Claude Code, sem relação com o Gemini (IA do produto). Opus para arquitetura, segurança, schema; Sonnet para execução mecânica.

### Fase A — Reconciliação (fundação)

| ID | Tarefa | Prioridade | Repo | Modelo | Status | PR |
|---|---|---|---|---|---|---|
| R-01 | Hotfix `POST /users` (master-only) | P0 | back | Opus | ✅ Mergeado | #48 |
| R-02 | Enum `SystemRole` + trava de gerente único | P0 | back | Opus | ✅ Mergeado | #50/#52 |
| R-03+04 | Aposentar modelo papel-por-condomínio (RESIDENT + user_condominium + RolesGuard reescrito + CondominiumAccessGuard) | P0 | back | Opus | ✅ Mergeado | #51/#52 |
| **R-05** | **`assertTenantScope` helper + cobertura cross-tenant** | **P0** | **back** | **Opus** | **✅ Mergeado** | **#54** |
| Infra | Pre-commit hook (husky + lint-staged) + pin prettier | P1 | back | Sonnet | ✅ Mergeado | #55 |
| **R-06** | **Seed do Master por ambiente (`MASTER_EMAIL`/`MASTER_PASSWORD`)** | **P0** | **back** | **Opus** | **🟡 Próxima** | — |
| **R-07** | **Senha estrutural: `select: false` na entity + remover `delete senha` manuais** | **P1** | **back** | **Sonnet** | **🟡 Pendente** | — |

#### R-06 (próxima) — Seed do Master por ambiente
Trocar o hash bcrypt fixo na migration `AddCompanyAndMasterUser` por um seed que lê `MASTER_EMAIL` e `MASTER_PASSWORD` do ambiente. Idempotente (não duplica se já existe). Adicionar as variáveis ao `.env.example` com aviso de segurança ("chave-mestra; gerar forte; nunca commitar"). Adicionar ao schema de validação de env (`Joi`/`zod`) se houver. Documentar no `CLAUDE.md`/`README` o procedimento para o setup inicial.

Critérios de aceitação:
- Migration de seed lê de env, não tem hash fixo;
- Sem variáveis de ambiente, o boot ou o seed falham com erro claro;
- Idempotente: rodar duas vezes não duplica usuário;
- `.env.example` atualizado;
- Documentação atualizada.

#### R-07 (pendente) — Senha estrutural (C10)
Hoje a proteção da senha depende de 3 `delete result.senha` manuais espalhados (`auth.service.ts`, `jwt.strategy.ts`, `users.controller.ts`). Se alguém criar uma rota nova e esquecer o `delete`, a senha vaza.

Tarefa: `select: false` na coluna `senha` da entity `User`; `addSelect('user.senha')` no `findOneByEmail` (que precisa da senha para o bcrypt do login); `findOneById` fica sem `addSelect` (a `JwtStrategy` não precisa da senha); remover os 3 `delete result.senha` que se tornam desnecessários. Sem migration (só código).

Critérios de aceitação:
- Todos os testes verdes;
- Teste que prova que `JSON.stringify(user)` ou serialização direta nunca inclui `senha`;
- Os 3 `delete` removidos.

### Fase B — Segurança restante

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-08 | JWT em cookie `httpOnly + Secure + SameSite` (toca os dois repos no mesmo ciclo) | P1 | ambos | Opus |
| R-09 | Revisão de guards pós-reconciliação (`MasterGuard`, `CompanyAdminGuard` (já removido), `RolesGuard`, `InfractionAccessGuard`, `CondominiumAccessGuard`); atualizar `docs/rbac.md` | P2 | back | Opus |

### Fase C — Frontend (estrutura, sem polir visual)

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-10 | Telas dos fluxos que o backend já expõe (condomínios, unidades, infrações, análise IA, PDF), respeitando RBAC | P1 | front | Sonnet |
| R-11 | `middleware.ts` de proteção de rotas | P1 | front | Sonnet |
| R-12 | Tipos gerados a partir do OpenAPI (`openapi-typescript`) | P1 | front | Sonnet |
| R-13 | CORS por env multi-origem | P1 | back | Sonnet |

### Fase D — Deploy (marco "pronto para validação")

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-14 | Publicar para clientes-piloto: backend + Postgres gerenciado; frontend Vercel; migrations + seed Master no deploy; healthcheck verde; CORS prod | P0 | ambos | Opus |

### Fase E — Visual com Open Design (depois do MVP no ar)

A estratégia escolhida é construir a estrutura/lógica do front primeiro, deixar o **visual** para uma remodelagem com Open Design depois. Não polir aparência antes dessa remodelagem — é retrabalho garantido.

### Fase F — Incremental (pós-validação)

| ID | Tarefa | Prioridade | Repo | Modelo |
|---|---|---|---|---|
| R-15 | Reconciliar os módulos extras no SDD conforme uso (Mail, WhatsApp, Audit, Dashboard, Notifications — documentação) | P2 | back | Sonnet |
| R-16 | Análise IA assíncrona se a latência incomodar | P2 | back | Opus |
| R-17 | Prompt do Gemini versionado em arquivo (não em string solta) | P3 | back | Sonnet |
| R-18 | Refactors pendentes (`refactor/current-actor-decorator`, `refactor/unique-violation-helper`, `refactor/split-infractions-service`) | P2 | back | Sonnet |
| R-19 | Avaliar skills/MCPs instalados (brainstorming, executing-plans, serena, etc.) e adotar o que fizer sentido | P3 | — | — |

---

## 6. Definition of Done (toda tarefa)

1. Respeita as convenções §4.
2. Testes do caso feliz e de ao menos um caso de erro.
3. `lint`, `test` (e `test:e2e` se aplicável) passam **dentro do Docker** (`docker compose exec api ...`), com `--maxWorkers=2` se houver OOM.
4. Documentação atualizada se houve mudança de contrato.
5. Mudança de contrato de API → tipos do frontend regenerados (C11).
6. PR com descrição, ID da tarefa, evidência. Hotfix/correção em PR isolado (C12).
7. Revisão humana aprovou. Sem auto-merge.
8. Pre-commit hook (husky/lint-staged) não bloqueou — se bloqueou, foi corrigido (não pulado com `--no-verify`).

---

## 7. Ordem recomendada e estado

Concluído: **R-01 → R-02 → R-03+04 → R-05 → Pre-commit hook.**
Próximo: **R-06 (seed master) → R-07 (senha estrutural)**, fechando a Fase A.
Depois: **R-08** (JWT em cookie, Fase B) → Fase C (estrutura do front) → Fase D (deploy) → Fase E (visual com Open Design).

Risco principal restante: **R-08 (JWT em cookie)** toca os dois repos no mesmo ciclo — planejar com cuidado.

---

## 8. Glossário

- **Tenant:** empresa-cliente isolada.
- **Reconciliação:** alinhar o código real ao produto decidido — diferente de "construir do zero".
- **Discovery:** inspeção só-leitura. Quatro feitos: `state-of-code.md` (master), `discovery-multitenant.md`, `discovery-resident.md`, `discovery-tenant-isolation.md`.
- **Padrão canônico de isolamento de tenant:** ver §2.3.
- **Opus/Sonnet:** modelos do Claude Code. Não confundir com Gemini (IA do produto).

**Changelog:**
- v3.0 — promoção do backlog R-xx para o SDD (deixa de viver só em conversas); R-01 a R-05 marcados como ✅ com PRs; R-06 (seed master) detalhado; R-07 (senha estrutural) adicionado a partir do findings de C10; Fase E redefinida para visual com Open Design; convenção C13 sobre Docker adicionada.
- v2.0 — reescrita para arquitetura multi-tenant, RBAC de 3 papéis, inclusão do frontend (obsoleta).
- v1.0 — versão inicial (obsoleta).
