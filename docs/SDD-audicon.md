# SDD — Audicon API
**Spec-Driven Development Document**
Versão: 2.0 · Última atualização: 2026-05-18

---

## 0. Como ler este documento

Este SDD é a **fonte única de verdade** para a continuidade do projeto Audicon. Toda decisão de implementação deve referenciar uma seção deste documento. Quando a especificação for ambígua, o agente (humano ou IA) **deve parar e pedir esclarecimento**, nunca improvisar.

Estrutura:
- §1–§3 → contexto invariável (não alterar sem revisão arquitetural)
- §4 → convenções obrigatórias (gates de PR)
- §5 → backlog priorizado (a parte que evolui)
- §6 → critérios de aceitação e Definition of Done
- §7 → glossário e referências

---

## 1. Contexto do Projeto

**Audicon** é um **SaaS multi-tenant** para gestão de infrações em condomínios. Administradoras (empresas) usam o sistema para que seus funcionários registrem infrações por unidade, gerem documentos com auxílio de IA, e enviem o aviso ao morador por e-mail e/ou WhatsApp.

**Hierarquia de tenancy:**
```
Master (Audicon)
  ↓ cria empresas
Company (Administradora)
  ↓ tem funcionários
User (funcionário com membership em condomínios)
  ↓ gerencia
Condominium → Unit → Morador (residentEmail/residentPhone)
                      ↓ recebe
                      Infraction (com imagens) → análise IA → aprovação humana → envio (e-mail + WhatsApp)
```

**Diferenciais técnicos:**
- **Análise por IA contextual** (Google Gemini) considerando o regimento PDF do condomínio + histórico de reincidências da unidade
- **Geração de PDF** com pdfkit (documento individual com imagens + relatório consolidado em stream)
- **Notificação dual** ao morador: e-mail (Resend) com PDF anexo + WhatsApp (Z-API) como alerta
- **Multi-tenant isolation** em duas camadas: filtro por `companyId` no banco + `InfractionAccessGuard` para acesso cross-tenant
- **Audit log** de ações sensíveis com escopo por empresa

**Forma de consumo atual:** API consumida por frontend Next.js 15 próprio (`Audicon_Web`). Existem clientes em produção (early adopters) — alterações de contrato exigem coordenação com o frontend.

---

## 2. Stack Técnica (fixa)

### 2.1 Backend (`Audicon_BackEnd`)

| Camada | Tecnologia | Observação |
|---|---|---|
| Runtime | Node.js | **≥ 20** (fixado em `.nvmrc` e `package.json#engines`) |
| Framework | NestJS 10 | Arquitetura modular |
| Linguagem | TypeScript | `strict: true` |
| Banco | PostgreSQL 16 | Em Docker (`audicon_db`) |
| ORM | TypeORM 0.3 | `synchronize: false` — **nunca alterar** |
| Auth | JWT (`@nestjs/passport`, `passport-jwt`, `passport-local`, `bcrypt`) | Claims: `sub`, `email`, `companyId`, `isMaster` |
| IA | `@google/generative-ai` | `IaModule` — Gemini 2.5-flash, prompts versionados (v1/v2/v3) |
| PDF | `pdfkit` | `PdfModule` — buffer + stream + embed de imagens |
| E-mail | `resend` | `MailModule` — modo mock sem `RESEND_API_KEY` |
| WhatsApp | Fetch direto Z-API | `WhatsappModule` — modo mock sem `ZAPI_*` |
| Upload | `@nestjs/platform-express` (multer) | Imagens em bytea (PDF regimento também) |
| Validação env | `joi` | Schema em `src/common/config/env.schema.ts` |
| Logger | `nestjs-pino` | Logger estruturado |
| Testes | Jest (unit + e2e + coverage) | Thresholds por módulo em `package.json#jest` |
| Throttle | `@nestjs/throttler` | Global 100/min + override em `/infractions/:id/analyze` |
| Containerização | Docker + docker-compose | `api` + `db` |

### 2.2 Frontend (`Audicon_Web`)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + shadcn/ui (`@base-ui/react`) + Tailwind CSS |
| Estado servidor | TanStack Query 5 |
| Forms | React Hook Form + Zod |
| HTTP | axios |
| Notifications | sonner (toasts) |

**Restrições inegociáveis:**
- Não usar bibliotecas alternativas para os papéis acima sem justificativa registrada em ADR.
- Não habilitar `synchronize: true` em hipótese alguma — toda mudança de schema passa por migration.
- Não commitar `.env`, chaves de API ou dumps de banco.
- Nunca desabilitar o `ValidationPipe` global ou `forbidNonWhitelisted: true`.

---

## 3. Arquitetura de Domínio

### 3.1 Mapa de módulos atual

```
src/
├── auth/            → AuthModule (JWT, login, JwtStrategy/LocalStrategy)
├── users/           → UsersModule (CRUD users + UserCondominium membership)
├── companies/       → CompaniesModule (master cria empresas + admin cria funcionários)
├── condominiums/    → CondominiumsModule (CRUD condomínios + members + regimento PDF)
├── units/           → UnitsModule (CRUD unidades, nested em condomínios)
├── infractions/     → InfractionsModule (CRUD + analyze + approve + send + send-whatsapp + images)
├── ia/              → IaModule (Gemini, prompts v1/v2/v3, extractRegimentoText via pdf-parse)
├── pdf/             → PdfModule (pdfkit — documento individual com imagens + report stream)
├── mail/            → MailModule (Resend; mock em dev/test sem RESEND_API_KEY)
├── whatsapp/        → WhatsappModule (Z-API; mock em dev/test sem ZAPI_*)
├── audit/           → AuditModule (log de ações sensíveis com escopo por empresa)
├── health/          → HealthModule (/health/live + /health/ready)
├── migrations/      → migrations TypeORM versionadas
└── common/          → filters, interceptors, pipes, guards (RolesGuard, MasterGuard, CompanyAdminGuard, InfractionAccessGuard), enums, dto base, config
```

### 3.2 Entidades e relacionamentos

```
Company 1 ─── N User                  (user.companyId FK; nullable para master)
Company 1 ─── N Condominium           (condo.companyId FK NOT NULL)

User N ──── N Condominium  (via UserCondominium com role ADMIN/MANAGER/RESIDENT)

Condominium 1 ─── N Unit
Condominium 1 ─── 1 regimentoContent (bytea, select:false)

Unit 1 ─── N Infraction
Unit fields: identifier, ownerName, residentEmail, residentPhone

Infraction 1 ─── N InfractionImage   (bytea, select:false; max 10/infração, 5MB cada)
Infraction status: pending → analyzed → approved → sent
Infraction fields: approvedAt, sentAt, whatsappSentAt (canal paralelo)

AuditLog N (independente; entries com userId, companyId, action, entity, entityId, context jsonb)
```

### 3.3 Guards e controle de acesso

| Guard | Onde | O que valida |
|---|---|---|
| `JwtAuthGuard` | Quase tudo | Token JWT válido |
| `RolesGuard` | `/condominiums/:id/members`, edição/remoção de condomínio | `@Roles(...)` por membership |
| `MasterGuard` | `/companies/*` | `user.isMaster === true` |
| `CompanyAdminGuard` | `/companies/me/users/*` | User tem membership ADMIN em pelo menos um condomínio da empresa |
| `InfractionAccessGuard` | `/infractions/:id/*` e `/infractions/:id/images/*` | Infraction.unit.condominium.companyId === user.companyId (master bypassa) |

**Multi-tenant isolation** acontece em dois lugares:
- **Guards** validam acesso por ID em rotas `/:id/*`
- **Services** filtram listas por `companyId` (CondominiumsService.findAll, InfractionsService.findAll)

### 3.4 Padrões transversais

- **HttpExceptionFilter customizado** — normaliza erros.
- **ResponseInterceptor** — envelopa sucesso em `{ statusCode, data }`.
- **ValidationPipe global** com `whitelist: true` + `forbidNonWhitelisted: true`.
- **AuditService.log(actor, action, entity, entityId, context)** — fire-and-forget, instrumentado em 9 pontos críticos.
- **Actor pattern**: controllers constroem `Actor = { userId, email, isMaster, companyId }` via helper `toActor(req)` e passam aos services. Sem AsyncLocalStorage.

Qualquer nova rota **deve respeitar** esses padrões. Não criar formatos paralelos de resposta.

### 3.5 Hierarquia de papéis (RBAC)

| Papel | Escopo | Pode |
|---|---|---|
| **Master** (`isMaster=true`) | Global | Criar empresas, ver audit de tudo, bypassa isolation |
| **ADMIN** (de condomínio, em UserCondominium) | Por condomínio | Editar condomínio, adicionar/remover membros, criar funcionários da empresa via `/companies/me/users` |
| **MANAGER** | Por condomínio | Operar infrações no condomínio (criar, analisar, aprovar, enviar) |
| **RESIDENT** | Por condomínio | Histórico — não usado pelo frontend atual (moradores não logam, recebem por e-mail/WhatsApp) |

> Funcionário pode ser ADMIN em um condomínio e MANAGER em outro da mesma empresa.

---

## 4. Convenções obrigatórias (gates de PR)

| # | Regra | Justificativa |
|---|---|---|
| C1 | Toda rota nova tem DTO de entrada com `class-validator` | ValidationPipe já está global |
| C2 | Toda resposta passa pelo `ResponseInterceptor` (não retornar shape paralelo) | Contrato uniforme |
| C3 | Toda exceção previsível usa `HttpException` (ou subclasses Nest) | Filtro normaliza |
| C4 | Toda mudança de schema gera migration via `npm run migration:generate` | `synchronize: false` |
| C5 | Nenhum segredo hard-coded — tudo via `ConfigService` | Pontos de melhoria do relatório |
| C6 | Cobertura de testes não pode cair em PR | CI deve falhar se cair |
| C7 | Commits seguem Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`) | Rastreabilidade |
| C8 | PRs referenciam o ID da tarefa do backlog (ex.: `T-04`) | Rastreabilidade |

---

## 5. Backlog

> **Convenção:** cada tarefa tem `ID`, `Prioridade` (P0–P3) e `Status` (✅ done · 🔄 em andamento · ⏳ pending).

### 5.1 Já entregue (resumo)

| ID | Título | Status |
|---|---|---|
| T-00 | Discovery + state-of-code | ✅ |
| T-01 | CORS dinâmico via ConfigService | ✅ |
| T-02 | Eliminar fallbacks em data-source.ts | ✅ |
| T-03 | Validação Joi do .env no bootstrap | ✅ |
| T-04 | Fluxo de análise de infração via IA | ✅ |
| T-05 | Geração de relatório PDF | ✅ |
| T-06 | RBAC (UserCondominium + RolesGuard) | ✅ |
| T-07 | Cobertura mínima por módulo no CI | ✅ |
| T-08 | Logger estruturado (pino) | ✅ |
| T-09 | Healthcheck (`@nestjs/terminus`) | ✅ |
| T-10 | Dockerfile + docker-compose | ✅ |
| T-11 | Pipeline CI (lint + test + coverage) | ✅ |
| T-IA-01 | Regimento PDF por condomínio + IA contextual | ✅ |
| T-IA-02 | Reincidências como contexto da IA (prompt v3) | ✅ |
| T-AP-01 | Fluxo de aprovação humana (ANALYZED → APPROVED) | ✅ |
| T-NT-01 | Envio por e-mail (Resend) com PDF anexo | ✅ |
| T-NT-02 | Envio por WhatsApp (Z-API) — canal complementar | ✅ |
| T-IMG-01 | Upload de imagens da infração (galeria + embed no PDF) | ✅ |
| T-MT-01 | Multi-tenant foundation (Company + master) | ✅ |
| T-MT-02 | Frontend master panel (/master/companies) | ✅ |
| T-MT-03 | ADMIN cria funcionários da empresa (/companies/me/users) | ✅ |
| T-MT-04 | Isolation de infrações por empresa (InfractionAccessGuard) | ✅ |
| T-AUDIT-01 | Audit log com escopo por empresa (9 ações instrumentadas + UI /audit-log) | ✅ |

### 5.2 Pendente

| ID | Prioridade | Título | Esforço |
|---|---|---|---|
| T-SD-01 | P2 | Soft delete (deletedAt) em Condominium/Unit/Infraction | ~1 dia |
| T-DOCS | P3 | Atualizar SDD/CLAUDE.md a cada release maior | contínuo |
| T-DASH | P3 | Dashboard de métricas (infrações/mês, % aprovadas, top reincidentes) | ~2 dias |
| T-RST | P2 | Reset/troca de senha (admin perdeu temp; user trocar 1º acesso) | ~1 dia |
| T-CSV | P3 | Exportação CSV de infrações filtradas | ~0.5 dia |
| T-DOM-RESEND | P2 | Verificar domínio próprio no Resend (sair do sandbox) | config externa |
| T-ZAPI-REAL | P2 | Criar conta Z-API + setar `ZAPI_*` em prod | config externa |
| T-FRONT-MISC | P3 | Polishes: ordenação de colunas, filtros adicionais no audit | ad-hoc |

### 5.3 Especificações antigas (referência histórica — T-00 a T-11)

> As T-00 a T-11 originais foram entregues. As especificações detalhadas estão no Git em PRs históricas (#1 a #22). Mantidas em forma resumida para preservar o registro do que foi feito antes da virada multi-tenant.

#### Fase 0 — Discovery (obrigatória antes de qualquer implementação)

#### T-00 · [P0 · Discovery] Inventário do estado real do código
**Objetivo:** mapear o que de fato está implementado versus o que existe só como esqueleto.

**Critérios de aceitação:**
- Gerar `docs/state-of-code.md` contendo, por módulo:
  - Entidades existentes (com campos e relacionamentos reais lidos do código)
  - Endpoints expostos (verbo + rota + DTO + guard)
  - Services implementados vs. stubs
  - Cobertura de testes atual (`npm run test:cov`)
- Para `IaModule` e `PdfModule` especificamente: listar funções públicas, dependências externas configuradas (chaves de API esperadas), e indicar se há chamada real ou mock.
- Não modificar código nesta fase. **Apenas leitura e documentação.**

**DoD:** arquivo `docs/state-of-code.md` commitado em branch `discovery/state-of-code`, PR aberto para revisão humana.

---

### Fase 1 — Refatorações dos pontos fracos identificados no relatório

#### T-01 · [P1 · Refactor] CORS dinâmico via ConfigService
**Problema atual:** `app.enableCors({ origin: 'http://localhost:4173' })` hard-coded em `main.ts`.

**Critérios de aceitação:**
- `CORS_ORIGINS` adicionado ao `.env.example` como string CSV (ex.: `http://localhost:4173,https://app.audicon.com.br`).
- `main.ts` lê via `ConfigService`, faz split por vírgula, trim em cada item, e passa array para `enableCors`.
- Se `CORS_ORIGINS` estiver vazio ou ausente, comportamento deve ser **falhar a inicialização com erro explícito** (não cair em fallback silencioso).
- Adicionar teste e2e que faz preflight `OPTIONS` e verifica header `Access-Control-Allow-Origin`.

**DoD:** PR mergeado, e2e passando, `.env.example` atualizado.

---

#### T-02 · [P1 · Refactor] Eliminar fallbacks em `data-source.ts`
**Problema atual:** valores como `'postgres'` e `'audicon'` aparecem como fallback no `data-source.ts` usado pelas migrations.

**Critérios de aceitação:**
- Substituir todos os fallbacks por validação estrita: se variável de ambiente faltar, lançar erro com nome da variável faltante.
- Variáveis envolvidas (confirmadas na Discovery T-00): `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.
- Criar utilitário `requireEnv(name: string): string` em `src/common/config/` para reuso.
- Atualizar `.env.example` listando todas as variáveis exigidas com comentário.

**DoD:** rodar `npm run migration:run` sem `.env` deve falhar com mensagem clara; com `.env` correto, deve funcionar.

---

#### T-03 · [P2 · Refactor] Validação de schema do `.env` no bootstrap
**Objetivo:** prevenir start da aplicação com configuração inválida.

**Critérios de aceitação:**
- Usar `Joi` (já comum em Nest) ou `zod` para validar `process.env` no `ConfigModule.forRoot({ validationSchema })`.
- Schema cobre: variáveis de DB (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`), `JWT_SECRET`, `JWT_EXPIRATION` (confirmado na Discovery T-00 — código real usa `JWT_EXPIRATION`, não `JWT_EXPIRES_IN`), `CORS_ORIGINS`, `GEMINI_API_KEY` (opcional), `GEMINI_API_ENDPOINT`, `GEMINI_MODEL`, `NODE_ENV`, `PORT`.
- Teste unitário do schema com casos válido / inválido.

**DoD:** `npm run start:dev` falha com `.env` incompleto e mensagem indicando a variável faltante.

---

### Fase 2 — Features novas

> ⚠️ A especificação detalhada das tarefas T-04+ depende do resultado da T-00. As entradas abaixo são **placeholders estruturais** — o conteúdo final será preenchido após Discovery.

#### T-04 · [P1 · Feature] Fluxo completo de análise de infração via IA
**Pré-requisito:** T-00 concluída. Estado de `IaModule` documentado.

**Escopo provisório** (a refinar):
- Endpoint `POST /infractions/:id/analyze` que dispara análise da infração no Gemini.
- Prompt template versionado (em arquivo, não em string solta no service).
- Persistir resultado da análise vinculado à infração (campo `aiAnalysis` ou tabela `infraction_analyses` — decidir na Discovery).
- Tratamento de erros: rate limit, timeout, falha de API → resposta 502 padronizada via filtro.
- Não bloquear a request por tempo indefinido — definir timeout em ConfigService.

**Critérios de aceitação:** a detalhar após T-00.

---

#### T-05 · [P1 · Feature] Geração de relatório PDF de infrações
**Pré-requisito:** T-00 concluída. Estado de `PdfModule` documentado.

**Escopo provisório:**
- Endpoint `GET /condominiums/:id/infractions/report.pdf` com filtros por período.
- Geração via `pdfkit` em stream (não bufferizar tudo em memória).
- Header `Content-Type: application/pdf` e `Content-Disposition: attachment; filename=...`.
- Conteúdo: cabeçalho com dados do condomínio, lista de infrações com data, unidade, descrição, análise da IA (se houver).

**Critérios de aceitação:** a detalhar após T-00.

---

#### T-06 · [P2 · Feature] Papéis e autorização (RBAC)
**Pré-requisito:** confirmação na Discovery sobre como `User` se relaciona com `Condominium`.

**Escopo provisório:**
- Papéis: `ADMIN`, `MANAGER` (síndico), `RESIDENT` — confirmar.
- Guard `RolesGuard` + decorator `@Roles(...)`.
- Matriz de permissões documentada em `docs/rbac.md`.

---

### Fase 3 — Qualidade e operação (a planejar depois)

- T-07 · Cobertura mínima de testes por módulo (P2)
- T-08 · Logger estruturado (`pino` ou `winston`) substituindo `console` (P2)
- T-09 · Healthcheck e readiness (`@nestjs/terminus`) (P2)
- T-10 · Dockerfile + docker-compose para dev (P3)
- T-11 · Pipeline CI (lint + test + build + migration check) (P2)

---

## 6. Definition of Done (geral, aplicável a toda tarefa)

Uma tarefa só é considerada **Done** quando:

1. Código respeita todas as convenções §4.
2. Testes novos cobrindo o caso feliz **e** ao menos um caso de erro.
3. `npm run test`, `npm run test:e2e`, `npm run lint` passam localmente.
4. Documentação atualizada se houve mudança de contrato (este SDD e/ou `docs/`).
5. PR aberto contém: descrição, ID da tarefa, prints/evidência quando aplicável.
6. Revisão humana aprovou (não fazer auto-merge).

---

## 7. Glossário e referências

- **ADR (Architecture Decision Record):** documento curto registrando uma decisão arquitetural relevante. Criar em `docs/adr/NNNN-titulo.md`.
- **Discovery:** fase de leitura/inventário sem modificação de código.
- **Fonte-relatório:** relatório técnico inicial do projeto (anexado à conversa de origem deste SDD).

**Mudanças neste documento:** seguem PR, com bump de versão no topo e changelog ao final.

---

## Changelog

### 2.0 — 2026-05-18

**Major revisão pós-virada multi-tenant + integrações reais.** Mudanças estruturais desde a 1.1:

- **§1 Contexto**: produto agora é SaaS multi-tenant (Master → Company → User → Condominium → Unit → Infraction). Frontend Next.js 15 existe e está em uso.
- **§2 Stack**: adicionados `resend` (e-mail), Z-API (WhatsApp via fetch direto), `nestjs-pino`, `joi`, `pdf-parse`, `multer`. Frontend documentado.
- **§3 Arquitetura**: adicionados módulos `companies`, `audit`, `mail`, `whatsapp`. Entidades `Company`, `InfractionImage`, `AuditLog`. Guards `MasterGuard`, `CompanyAdminGuard`, `InfractionAccessGuard`. Hierarquia RBAC explicitada.
- **§5 Backlog**: T-04 a T-11 antigas concluídas. Novas tarefas entregues: T-IA-01/02, T-AP-01, T-NT-01/02, T-IMG-01, T-MT-01..04, T-AUDIT-01. Pendentes recentes adicionadas.
- **Multi-tenant isolation** em dois níveis: filtro de companyId em listas + guard de acesso em `:id`.
- **Audit log** com 9 pontos instrumentados (INFRACTION_CREATED/APPROVED/SENT/WHATSAPP_SENT/DELETED + CONDOMINIUM_CREATED/DELETED + COMPANY_CREATED + EMPLOYEE_CREATED).
- **Master user** criado via migration: `master@audicon.com` / `MasterAudicon@2026` (dev).

### 1.1 — 2026-05-15

- §2: Node fixado em ≥ 20 (Node 18 não suporta `crypto` global usado por `@nestjs/typeorm` v11).
- §5 T-02: nomes de variáveis confirmados na Discovery — `DB_USERNAME` (não `DB_USER`) e `DB_DATABASE` (não `DB_NAME`).
- §5 T-03: nome correto da variável de expiração é `JWT_EXPIRATION` (não `JWT_EXPIRES_IN`); lista de variáveis cobertas expandida com `NODE_ENV`, `GEMINI_API_ENDPOINT`, `GEMINI_MODEL`.

### 1.0 — 2026-05-15

- Versão inicial.
