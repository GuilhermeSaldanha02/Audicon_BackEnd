# SDD — Audicon API
**Spec-Driven Development Document**
Versão: 1.1 · Última atualização: 2026-05-15

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

**Audicon** é uma API RESTful para gerenciamento de condomínios com diferencial em análise de infrações via IA e geração de relatórios PDF.

**Domínios principais:** Usuários, Condomínios, Unidades habitacionais, Infrações.
**Diferenciais:** Análise por IA (Google Generative AI) e exportação de PDF consolidado.
**Forma de consumo atual:** Backend-only. Frontend será desenvolvido em fase posterior — toda decisão de API deve assumir que clientes ainda não existem, portanto há margem para ajustes de contrato sem custo de breaking change externo.

---

## 2. Stack Técnica (fixa)

| Camada | Tecnologia | Observação |
|---|---|---|
| Runtime | Node.js | **≥ 20** (fixado em `.nvmrc` e `package.json#engines`). Node 18 não suportado: `@nestjs/typeorm` v11 usa `crypto.randomUUID()` global ausente nessa versão. |
| Framework | NestJS | Arquitetura modular padrão |
| Linguagem | TypeScript | `strict: true` esperado |
| Banco | PostgreSQL | |
| ORM | TypeORM | `synchronize: false` — **nunca alterar** |
| Auth | JWT (`@nestjs/passport`, `passport-jwt`, `passport-local`, `bcrypt`) | |
| IA | `@google/generative-ai` | Encapsulado em `IaModule` |
| PDF | `pdfkit` | Encapsulado em `PdfModule` |
| Testes | Jest (unit + e2e + coverage) | Infraestrutura pronta |

**Restrições inegociáveis:**
- Não usar bibliotecas alternativas para os papéis acima sem justificativa registrada em ADR.
- Não habilitar `synchronize: true` em hipótese alguma — toda mudança de schema passa por migration.
- Não commitar `.env`.

---

## 3. Arquitetura de Domínio

### 3.1 Mapa de módulos confirmados pelo relatório

```
src/
├── auth/            → AuthModule  (JWT, login, validação de token)
├── users/           → UsersModule (CRUD de usuários)
├── condominiums/    → CondominiumsModule (CRUD de condomínios)
├── units/           → UnitsModule (CRUD de unidades, FK → condominium)
├── infractions/     → InfractionsModule (CRUD de infrações, FK → unit)
├── ia/              → IaModule (análise de infrações via Gemini)
├── pdf/             → PdfModule (geração de relatórios)
└── common/          → filtros, interceptors, pipes globais
```

### 3.2 Relacionamentos esperados (a confirmar na Discovery)

```
User ─┬─ (autentica) ─► JWT
      └─ (gerencia, papel a definir) ─► Condominium

Condominium 1 ─── N Unit
Unit         1 ─── N Infraction
Infraction   N ─── 1 Unit
Infraction   ──► IaService  (análise)
Infraction[] ──► PdfService (relatório consolidado)
```

> ⚠️ As cardinalidades de **User ↔ Condominium** (síndico, administrador, morador) **não foram especificadas no relatório-fonte**. A Fase 0 (Discovery) deve mapear isso a partir do código real.

### 3.3 Padrões transversais já implementados

- **HttpExceptionFilter customizado** — normaliza erros.
- **ResponseInterceptor** — envelopa sucesso em `{ statusCode, data }`.
- **ValidationPipe global** com `whitelist: true` + `forbidNonWhitelisted: true`.

Qualquer nova rota **deve respeitar** esses padrões. Não criar formatos paralelos de resposta.

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

## 5. Backlog priorizado

> **Convenção:** cada tarefa tem `ID`, `Prioridade` (P0 = bloqueador, P1 = essencial, P2 = importante, P3 = nice-to-have), `Tipo`, `Critérios de Aceitação` e `DoD` (Definition of Done).

### Fase 0 — Discovery (obrigatória antes de qualquer implementação)

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

### 1.1 — 2026-05-15

- §2: Node fixado em ≥ 20 (Node 18 não suporta `crypto` global usado por `@nestjs/typeorm` v11).
- §5 T-02: nomes de variáveis confirmados na Discovery — `DB_USERNAME` (não `DB_USER`) e `DB_DATABASE` (não `DB_NAME`).
- §5 T-03: nome correto da variável de expiração é `JWT_EXPIRATION` (não `JWT_EXPIRES_IN`); lista de variáveis cobertas expandida com `NODE_ENV`, `GEMINI_API_ENDPOINT`, `GEMINI_MODEL`.

### 1.0 — 2026-05-15

- Versão inicial.
