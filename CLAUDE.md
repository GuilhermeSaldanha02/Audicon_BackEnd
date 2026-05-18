# Audicon BackEnd — Contexto para Claude Code

## Sobre o projeto

API RESTful para gerenciamento de condomínios com análise de infrações via IA (Google Gemini) e geração de relatórios PDF. Stack: NestJS 10, TypeORM 0.3, PostgreSQL, JWT, pdfkit, nestjs-pino.

Fonte de verdade arquitetural: [`docs/SDD-audicon.md`](docs/SDD-audicon.md)
Estado inventariado: [`docs/state-of-code.md`](docs/state-of-code.md)
Matriz de permissões RBAC: [`docs/rbac.md`](docs/rbac.md)

## Fluxo de trabalho obrigatório

**Entender → Planejar → aguardar "pode seguir" → Implementar → Validar → PR**

Nunca implemente sem plano aprovado. Nunca faça auto-merge.

## Regras inegociáveis

- `synchronize: false` no TypeORM — toda mudança de schema passa por migration (`npm run migration:generate`)
- Nunca commitar `.env`, chaves de API ou dumps de banco
- Nunca desabilitar o `ValidationPipe` global ou `forbidNonWhitelisted: true`
- Toda resposta passa pelo `ResponseInterceptor` (shape `{ statusCode, data }`)
- Toda nova rota tem DTO com `class-validator`
- Commits em Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- PRs referenciam o ID da tarefa do SDD (ex.: `T-06`)

## Comandos essenciais

```bash
npm run start:dev          # Dev com hot-reload
npm run test               # Unit tests
npm run test:cov           # Coverage (thresholds ativos por módulo)
npm run lint:check         # Lint sem --fix
npm run smoke:e2e          # Smoke runner de 21 passos (requer stack Docker)
npm run migration:generate # Gerar migration após mudar entidade
npm run migration:run      # Aplicar migrations pendentes
docker compose up -d       # Subir DB + API em dev
docker compose down -v     # Derrubar e limpar volumes
```

## Arquitetura dos módulos

```
src/
├── auth/           JWT login, LocalStrategy, JwtStrategy, guards
├── users/          CRUD usuários + entidade UserCondominium (RBAC)
├── condominiums/   CRUD condomínios + endpoint /members
├── units/          CRUD unidades (nested: /condominiums/:id/units)
├── infractions/    CRUD infrações + análise IA + PDF unitário
├── ia/             Gemini AI com timeout, mock em dev/test
├── pdf/            pdfkit — buffer (unitário) e stream (relatório)
├── health/         /health/live e /health/ready (@nestjs/terminus)
└── common/         filters, interceptors, pipes, guards (RolesGuard), enums, decorators
```

## RBAC

Papéis por condomínio: `ADMIN` | `MANAGER` | `RESIDENT` (tabela `user_condominium`).
Ao criar um condomínio, o criador recebe `ADMIN` automaticamente.
Adicionar membros: `POST /condominiums/:id/members` (requer ADMIN).

## Variáveis de ambiente

Ver `.env.example` na raiz. Obrigatórias: `DB_*`, `JWT_SECRET` (min 16 chars), `JWT_EXPIRATION`, `CORS_ORIGINS`. Opcionais: `GEMINI_API_KEY`, `GEMINI_*`, `LOG_LEVEL`, `GEMINI_TIMEOUT_MS`.

## Pontos de atenção

- `esModuleInterop: true` no tsconfig é obrigatório — corrige import do pdfkit em CommonJS runtime
- Testes com `--maxWorkers=2` evitam SIGTERM por pressão de memória no Windows
- Thresholds de coverage ativos: global 88%/84%/88%/65%, por módulo ver `package.json#jest.coverageThreshold`
- Prompt da IA em arquivo versionado: `src/ia/prompts/analyze-infraction.v1.md`

## Visão completa do produto (contexto de negócio)

Audicon é um **SaaS multi-tenant** para gestão de infrações em condomínios. Hierarquia:

```
Empresa (tenant master, ex.: Audicon)
  └── Funcionários da empresa
        └── Condomínios gerenciados pela empresa
              └── Unidades → Moradores (com email + telefone)
```

**Fluxo principal (visão de funcionário):**
1. Login → seleciona condomínio (puxa dados do prédio automaticamente)
2. Seleciona unidade do morador
3. Faz upload de imagens da infração (opcional)
4. Descreve brevemente o ocorrido
5. **IA analisa**: lê o regimento do prédio → encontra a regra violada → verifica reincidência → determina a ação cabível
6. IA gera documento detalhado (advertência/multa) para o morador
7. Funcionário revisa e dá "ok" para envio
8. Sistema envia notificação para o morador via:
   - E-mail cadastrado
   - WhatsApp cadastrado

## Backlog

### ✅ Entregue (resumo do que está em produção)

**Fluxo principal do produto:**
- Dados de contato do morador na Unit (`residentEmail`, `residentPhone`)
- Upload de imagens da infração (bytea, max 10/infração 5MB cada, galeria + lightbox + embed no PDF)
- IA lê regimento do prédio (PDF por condomínio; `extractRegimentoText` via pdf-parse; prompt v2)
- Contagem de reincidências (12 meses + total; prompt v3 inclui histórico para escalonar penalidade)
- Fluxo de aprovação (status `analyzed → approved` com `approvedAt`; override opcional de campos)
- Envio de e-mail (Resend com PDF anexado incluindo imagens; mock em dev)
- Envio de WhatsApp (Z-API como alerta complementar; mock em dev)
- **Multi-tenant** completo: Master → Company → Funcionários; isolation via guards + filtro de companyId

**Qualidade:**
- RBAC fino em `/infractions/**` (`InfractionAccessGuard` — lookup Infraction → Unit → Condominium → companyId)
- Audit log com 9 ações instrumentadas (escopo por empresa; UI em `/audit-log`)

### ⏳ Pendente

| Prioridade | Item | Esforço |
|---|---|---|
| Média | Soft delete em Condominium/Unit/Infraction | ~1 dia |
| Média | Reset de senha (admin perdeu temp; user trocar no 1º acesso) | ~1 dia |
| Média | Verificar domínio próprio no Resend (sair do sandbox) | config externa |
| Média | Criar conta Z-API + setar `ZAPI_*` em prod | config externa |
| Baixa | Dashboard de métricas (infrações/mês, % aprovadas, top reincidentes) | ~2 dias |
| Baixa | Exportação CSV de infrações filtradas | ~0.5 dia |
| Baixa | Histórico de notificações com status (entregue, lida) | ~2 dias |

## Frontend (Audicon_Web)

Next.js 15 + React 19 + shadcn/ui (`@base-ui/react`) + Tailwind + TanStack Query + React Hook Form + Zod + axios + sonner.

**Páginas implementadas:**
- `/login`
- `/master/companies` (master only) — gestão de empresas
- `/company/employees` (admin) — gestão de funcionários da empresa
- `/condominiums` — lista
- `/condominiums/:id` — detalhe + unidades + regimento PDF
- `/condominiums/:id/units/:unitId/infractions` — lista de infrações com badge "Nª ocorrência"
- `/condominiums/:id/units/:unitId/infractions/:infractionId` — detalhe + galeria de imagens + aprovação + envio (e-mail/WhatsApp) + PDF
- `/audit-log` — histórico de ações (master vê tudo + filtro; admin vê só da empresa)

## Master de dev

```
email: master@audicon.com
senha: MasterAudicon@2026
```

Criado via migration em `1779235200000-AddCompanyAndMasterUser`. **Trocar em produção.**

Quando o backend evoluir (imagens, multi-tenant, notificações), o frontend integra incrementalmente.
