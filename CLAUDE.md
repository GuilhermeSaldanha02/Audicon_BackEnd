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

## Backlog pendente (ordem de valor)

### Alta prioridade — fluxo principal do produto

- [ ] **Dados de contato do morador na Unit** — adicionar `residentEmail` e `residentPhone` (desbloqueia notificações)
- [ ] **Upload de imagens da infração** — armazenamento (S3 / disco local) + relação Infraction ↔ Image
- [ ] **IA lê o regimento do prédio** — cada Condominium tem PDF de regimento, IA usa como contexto na análise
- [ ] **Contagem de reincidências** — service que conta infrações anteriores do morador/unidade no mesmo tipo
- [ ] **Fluxo de aprovação** — novo status `PENDING_APPROVAL` antes de `SENT`; funcionário revisa e aprova
- [ ] **Envio de e-mail** — integração SendGrid/Resend, template do documento
- [ ] **Envio de WhatsApp** — integração Twilio/Z-API
- [ ] **Multi-tenant (entidade Company)** — empresa master no topo da hierarquia; isola dados entre empresas; refatoração estrutural (impacta JWT, RBAC, filtros)

### Média prioridade — qualidade/manutenção

- [ ] **RBAC nas rotas de infrações** — hoje `/infractions/**` é só JWT; criar `InfractionRolesGuard` que resolve `condominiumId` via DB lookup (infraction → unit → condominium)
- [ ] **Soft delete** em Condominium, Unit, Infraction (auditoria, recovery)
- [ ] **Audit log** — registro de quem fez o quê (criou infração, aprovou, enviou)

### Baixa prioridade — features adicionais

- [ ] Dashboard com métricas (infrações por condomínio/mês/tipo)
- [ ] Exportação CSV de infrações
- [ ] Histórico de notificações enviadas (status: entregue, lida, etc.)

## Frontend (em paralelo)

Frontend está sendo desenvolvido em paralelo ao backend. Backend atual é estável o suficiente para consumir os fluxos:

- Login/cadastro
- CRUD de condomínios (com paginação)
- CRUD de unidades
- Criar infração → analisar via IA → baixar PDF
- Adicionar/remover membros do condomínio

Quando o backend evoluir (imagens, multi-tenant, notificações), o frontend integra incrementalmente.
