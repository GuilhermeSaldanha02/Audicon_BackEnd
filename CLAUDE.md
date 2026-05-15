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
