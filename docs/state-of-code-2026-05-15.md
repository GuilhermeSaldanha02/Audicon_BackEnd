# State of Code — Audicon API

> **Tarefa:** T-00 (Discovery) · §5 do [SDD](./SDD-audicon.md)
> **Branch:** `discovery/state-of-code`
> **Commit base:** `261554c` (master)
> **Data:** 2026-05-15
> **Versão do SDD lida:** 1.0 (2026-05-15)
> **Escopo:** somente leitura e documentação. Nenhum arquivo em `src/` ou `test/` foi modificado nesta tarefa.

---

## 1. Resumo executivo

A API está mais madura do que o SDD §3.2 sugeria: existem **4 entidades** (`User`, `Condominium`, `Unit`, `Infraction`), **CRUD completo** para condomínios/unidades/infrações, **fluxo de IA** já chamando o Gemini real (com fallback mock), **geração de PDF** funcional via `pdfkit`, **JWT + Passport** (local e jwt) e os três padrões transversais que o SDD exige (`ValidationPipe` global, `HttpExceptionFilter`, `ResponseInterceptor`). A migration inicial está consistente com as entidades. A cobertura unitária é alta em controllers/services (>91% statements no total), com **gap notório no `IaService` (~62%)** por causa dos caminhos de erro/produção.

Lacunas estruturais relevantes:

1. **`User` não tem relacionamento com `Condominium`** no código atual — confirma a dúvida do SDD §3.2 sobre cardinalidade.
2. **Sem `.env.example`**, sem validação de schema do `.env`, com **fallbacks hard-coded** em `data-source.ts` e CORS hard-coded em `main.ts` (alvos de T-01/T-02/T-03).
3. **Lint quebrado**: `eslint` reporta **2.294 erros**, todos `prettier/prettier` (line endings CRLF + indentação). Provavelmente CRLF do Windows vs. Prettier sem `endOfLine: 'auto'`.
4. **`scripts/e2e-runner.mjs` está desatualizado**: usa rotas em português (`/condominios`, `/unidades`, `/infracoes`) que **não existem** mais — controllers atuais expõem rotas em inglês.
5. **`InfractionsController.generateDocument` usa `@Res()` cru** (passa por fora do `ResponseInterceptor`). Para o caso PDF isso é legítimo, mas precisa de registro porque o SDD §4 (C2) só admite com justificativa.

Próxima ação recomendada: aprovar este relatório → T-01 (CORS via `ConfigService`) e T-02 (eliminar fallbacks de `data-source.ts`) em paralelo, e abrir tarefa específica para normalizar EOL/prettier antes que vire ruído permanente no CI.

---

## 2. Inventário por módulo

> Convenção: `✓` = implementado · `⚠` = parcial / dúbio · `✗` = ausente.

### 2.1 `AuthModule` ([src/auth](../src/auth/))

| Item | Detalhe |
|---|---|
| Entidade | — (não tem entidade própria; consome `User`) |
| Controller | [auth.controller.ts](../src/auth/auth.controller.ts) |
| Endpoints | `POST /auth/login` (LocalAuthGuard, `HttpCode 200`) ✓ · `GET /auth/profile` (JwtAuthGuard) ✓ |
| DTO entrada | **✗ Sem DTO formal de login.** `LocalStrategy` aceita `email` + (`password` ou `senha`) lendo do `req.body` cru. Viola §4 C1. |
| Service | [auth.service.ts](../src/auth/auth.service.ts) — `validateUser(email, pass)`, `login(user)` ✓ |
| Strategies | [LocalStrategy](../src/auth/strategies/local.strategy.ts) (`passReqToCallback: true`, aceita `password` ou `senha`) ✓ · [JwtStrategy](../src/auth/strategies/jwt.strategy.ts) (lê `JWT_SECRET`, valida `sub` recarregando user) ✓ |
| Guards | `JwtAuthGuard`, `LocalAuthGuard` (extends `AuthGuard`) ✓ |
| Specs | `auth.controller.spec.ts`, `auth.service.spec.ts` ✓ |
| Vars env | `JWT_SECRET`, `JWT_EXPIRATION` |
| Observação | `auth.controller.ts` retorna `req.user` cru em `/profile` — passa pelo interceptor (ok). Login devolve `{ access_token }`, sem expiração explícita no payload de resposta. |

### 2.2 `UsersModule` ([src/users](../src/users/))

| Item | Detalhe |
|---|---|
| Entidade | [user.entity.ts](../src/users/entities/user.entity.ts): `id` (PK), `nome`, `email` (unique), `senha`. Hook `@BeforeInsert` faz `bcrypt.hash(senha, 10)`. **Sem timestamps. Sem campos de papel/role. Sem relação com `Condominium`.** |
| Controller | [users.controller.ts](../src/users/users.controller.ts) — apenas `POST /users` (sem guard, público) ✓ |
| Endpoints | `POST /users` (cria, retorna sem `senha`) ✓ · `GET/PATCH/DELETE` **✗ ausentes** |
| DTO | `CreateUserDto` com `nome`, `email`, `senha` (min 6) ✓ · `UpdateUserDto` **✗ ausente** |
| Service | `create`, `findOneByEmail`, `findOneById` ✓ |
| Specs | `users.controller.spec.ts`, `users.service.spec.ts` ✓ |
| Observação | Hashing ocorre via `@BeforeInsert`. Se algum dia for usado `repo.update(...)`, a senha **não** será re-hasheada (TypeORM `update` não dispara subscribers). Risco latente. |

### 2.3 `CondominiumsModule` ([src/condominiums](../src/condominiums/))

| Item | Detalhe |
|---|---|
| Entidade | [condominium.entity.ts](../src/condominiums/entities/condominium.entity.ts): `id`, `name`, `cnpj` (unique), `address`, `units: Unit[]` (OneToMany) ✓ |
| Controller | [condominiums.controller.ts](../src/condominiums/condominiums.controller.ts) — `@UseGuards(JwtAuthGuard)` no nível da classe ✓ |
| Endpoints | `POST/GET/GET :id/PATCH :id/DELETE :id` em `/condominiums` ✓ |
| DTOs | `CreateCondominiumDto` (name/cnpj/address) ✓ · `UpdateCondominiumDto = PartialType` ✓ |
| Service | CRUD completo. Trata `QueryFailedError 23505` (CNPJ duplicado) → `ConflictException`. `findOne` lança `NotFoundException`. ✓ |
| Specs | `condominiums.controller.spec.ts`, `condominiums.service.spec.ts` ✓ |

### 2.4 `UnitsModule` ([src/units](../src/units/))

| Item | Detalhe |
|---|---|
| Entidade | [unit.entity.ts](../src/units/entities/unit.entity.ts): `id`, `identifier`, `ownerName`, `condominium` (ManyToOne), `infractions` (OneToMany) ✓. **Sem unique constraint em `identifier`** apesar do `ConflictException` mencionar duplicidade. |
| Controller | [units.controller.ts](../src/units/units.controller.ts) — rota aninhada `/condominiums/:condominiumId/units`, `JwtAuthGuard` ✓ |
| Endpoints | `POST /condominiums/:condominiumId/units` ✓ · `GET /condominiums/:condominiumId/units` ✓ · `GET /condominiums/:condominiumId/units/:id` ✓ · `PATCH ../units/:id` ✓ · `DELETE ../units/:id` ✓ |
| DTOs | `CreateUnitDto` (identifier, ownerName) ✓ · `UpdateUnitDto = PartialType` ✓ |
| Service | Valida existência do condomínio antes do create. Mesmo padrão de `QueryFailedError 23505 → ConflictException` (mas, como dito, **não há índice unique**, então esse catch nunca dispara). |
| Specs | `units.controller.spec.ts`, `units.service.spec.ts` ✓ |
| Observação | `findOne(id)` em `Patch/Delete` **não filtra por `condominiumId`** — atualizar/deletar uma unidade de outro condomínio funciona se o ID for adivinhado. |

### 2.5 `InfractionsModule` ([src/infractions](../src/infractions/))

| Item | Detalhe |
|---|---|
| Entidade | [infraction.entity.ts](../src/infractions/entities/infraction.entity.ts): `id`, `description`, `formalDescription?`, `suggestedPenalty?`, `status` (enum `pending/analyzed/approved/sent`, default `pending`), `occurrenceDate` (`@CreateDateColumn`), `updatedAt` (`@UpdateDateColumn`), `unit` (ManyToOne). Comentários SQL anotados nas colunas. |
| Controller | [infractions.controller.ts](../src/infractions/infractions.controller.ts), `JwtAuthGuard` ✓ |
| Endpoints | `POST /infractions` ✓ · `GET /infractions?unitId=` ✓ · `GET /infractions/:id` ✓ · `POST /infractions/:id/analyze` ✓ · `GET /infractions/:id/document` (**PDF, usa `@Res()` cru**) ⚠ · `PATCH /infractions/:id` ✓ · `DELETE /infractions/:id` ✓ |
| DTOs | `CreateInfractionDto` (description, unitId) ✓ · `UpdateInfractionDto = PartialType` ✓ |
| Service | CRUD + `analyze(id)` (chama `IaService` e popula `formalDescription`/`suggestedPenalty`, muda status para `ANALYZED`) + `generateDocument(id)` (exige `formalDescription` setada, chama `PdfService`). ✓ |
| Specs | `infractions.controller.spec.ts`, `infractions.service.spec.ts` ✓ |
| Observação SDD §4 (C2) | `generateDocument` retorna binário via `res.end(buffer)`, fora do `ResponseInterceptor` — **caso legítimo, mas precisa registro**. |

### 2.6 `IaModule` ([src/ia](../src/ia/)) — **detalhado**

| Item | Detalhe |
|---|---|
| Service | [ia.service.ts](../src/ia/ia.service.ts) |
| Funções públicas | `onModuleInit()` (instancia client via `await eval('import("@google/generative-ai")')`) · `analisarInfracao(infraction)` |
| Funções privadas | `getModel()` · `getFallbackResponse(infraction)` · `construirPrompt(descricao)` |
| Dependências externas | `@google/generative-ai` (carregado dinamicamente via `eval('import(...)')` para contornar CJS/ESM) |
| Vars env esperadas | `GEMINI_API_KEY` (obrigatória em produção) · `GEMINI_API_ENDPOINT` (default `https://generativelanguage.googleapis.com/v1`) · `GEMINI_MODEL` (default `gemini-1.5-pro`) · `NODE_ENV` |
| Real x mock | **Chamada real ao Gemini** quando `apiKey` presente. **Fallback mock** (`getFallbackResponse`) em dev/test quando key ausente ou quando JSON do Gemini falha em parse — em produção, fallback **lança** `InternalServerErrorException`. |
| Prompt | Construído em string literal dentro do service, em PT-BR. Pede JSON com `descricao_formal` e `penalidade_sugerida`. **Não está versionado em arquivo** (T-04 do SDD prevê externalizar). |
| Cobertura | **62.31% statements · 46.34% branches** — gaps nos ramos de erro/produção (ver §8). |
| Pontos de atenção | Uso de `eval('import(...)')` é frágil para análise estática. Sem timeout configurável na chamada `model.generateContent`. Logs vazam prefixo da API key (5 caracteres). |

### 2.7 `PdfModule` ([src/pdf](../src/pdf/)) — **detalhado**

| Item | Detalhe |
|---|---|
| Service | [pdf.service.ts](../src/pdf/pdf.service.ts) |
| Funções públicas | `gerarDocumentoInfracao(infraction): Promise<Buffer>` |
| Dependências externas | `pdfkit` (default import) |
| Vars env | Nenhuma |
| Conteúdo PDF | Cabeçalho "Infraction Notice", dados do condomínio (`infraction.unit.condominium.name`), unit identifier, owner, descrição formal, penalidade sugerida, assinatura "Audicon Condominiums Administration". |
| Tipo de geração | **Buffer em memória** (`Buffer.concat(buffers)`). SDD §5 T-05 pede **streaming** — gap registrado. |
| Cobertura | 100% lines/statements; 50% branches (dois ramos `||` não exercitados). |
| Real x mock | Real. |

### 2.8 `common/` ([src/common](../src/common/))

- [HttpExceptionFilter](../src/common/filters/http-exception.filter.ts): global, normaliza shape `{ statusCode, timestamp, path, response }`. ✓
- [ResponseInterceptor](../src/common/interceptors/response.interceptor.ts): global, envolve resposta em `{ statusCode, data }`. ✓

### 2.9 `AppController` / `AppService`

- `GET /` retorna `{ status: 'online', environment, database: 'connected', timestamp }`. Note: `database` é **string hard-coded `'connected'`**, não há health-check real (gap futuro T-09).

---

## 3. Camada transversal — pontos para T-01..T-03

### [src/main.ts](../src/main.ts)

```ts
const app = await NestFactory.create(AppModule, {
  cors: {
    origin: 'http://localhost:4173', // ← hard-coded · alvo T-01
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  },
});
app.setGlobalPrefix('api/v1');
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalInterceptors(new ResponseInterceptor());
app.useGlobalPipes(new ValidationPipe({
  whitelist: true, forbidNonWhitelisted: true, transform: true,
}));
await app.listen(process.env.PORT ?? 3000);
```

- Prefixo global `api/v1` ✓
- `ValidationPipe` global com whitelist+forbid ✓ (§4 C1)
- CORS hard-coded → **T-01**
- `PORT` lido direto de `process.env` (sem `ConfigService`) — pequeno desvio do princípio de §4 C5.

### [src/data-source.ts](../src/data-source.ts)

```ts
host: process.env.DB_HOST || 'localhost',
port: +(process.env.DB_PORT || 5432),
username: process.env.DB_USERNAME || 'postgres',
password: process.env.DB_PASSWORD || 'postgres',
database: process.env.DB_DATABASE || 'audicon',
```

Cinco fallbacks → **T-02**. `synchronize: false` ✓.

### [src/app.module.ts](../src/app.module.ts)

- `ConfigModule.forRoot({ isGlobal: true })` — **sem `validationSchema`** → T-03.
- `TypeOrmModule.forRootAsync` lê `DB_*` via `ConfigService` (sem fallbacks aqui — diferente de `data-source.ts`).
- `autoLoadEntities: true`, `synchronize: false` ✓.

---

## 4. Banco e migrations

Única migration: [src/migrations/1761765454776-Initial.ts](../src/migrations/1761765454776-Initial.ts).

| Tabela | Colunas (resumo) | PK | Unique | FK |
|---|---|---|---|---|
| `condominium` | `id`, `name`, `cnpj`, `address` | `id` | `cnpj` | — |
| `unit` | `id`, `identifier`, `ownerName`, `condominiumId` | `id` | — | `condominiumId → condominium.id` |
| `infraction` | `id`, `description`, `formalDescription`, `suggestedPenalty`, `status` (enum), `occurrenceDate`, `updatedAt`, `unitId` | `id` | — | `unitId → unit.id` |
| `user` | `id`, `nome`, `email`, `senha` | `id` | `email` | — |
| ENUM | `infraction_status_enum` = `pending/analyzed/approved/sent` | | | |

- FKs sem cascade (`ON DELETE NO ACTION`) — deletar condomínio com unidades falhará na FK. Comportamento intencional ou esquecido? Registrar para discussão.
- Não foi possível rodar `npm run migration:run` end-to-end: **sem `.env` no repo**, e (por política da T-00) não foi criado um.

---

## 5. Configuração e segredos

**Variáveis referenciadas no código:**

| Variável | Onde | Default no código | Obrigatória? |
|---|---|---|---|
| `DB_HOST` | `data-source.ts`, `app.module.ts` | `'localhost'` (só em data-source) | Sim |
| `DB_PORT` | idem | `5432` (só em data-source) | Sim |
| `DB_USERNAME` | idem | `'postgres'` (só em data-source) | Sim |
| `DB_PASSWORD` | idem | `'postgres'` (só em data-source) | Sim |
| `DB_DATABASE` | idem | `'audicon'` (só em data-source) | Sim |
| `JWT_SECRET` | `auth.module.ts`, `jwt.strategy.ts` | — | Sim |
| `JWT_EXPIRATION` | `auth.module.ts` | — | Sim |
| `GEMINI_API_KEY` | `ia.service.ts` | — | Em produção, sim |
| `GEMINI_API_ENDPOINT` | `ia.service.ts` | `https://generativelanguage.googleapis.com/v1` | Não |
| `GEMINI_MODEL` | `ia.service.ts` | `gemini-1.5-pro` | Não |
| `NODE_ENV` | `ia.service.ts`, `app.service.ts` | `'development'` | Recomendada |
| `PORT` | `main.ts` | `3000` | Não |

**Gap:** `.env.example` **não existe**. T-01/T-02/T-03 criarão.

`docker-compose.yml` referencia `${DB_USERNAME}`, `${DB_PASSWORD}`, `${DB_DATABASE}` via `env_file: .env`.

---

## 6. Cobertura de testes (executada)

Comando: `npx jest --coverage` (via `rtk proxy`). 13 suites · **84 testes · 100% passando**.

```
Statements   : 91.43% ( 299/327 )
Branches     : 63.63% ( 42/66 )
Functions    : 95.38% ( 62/65 )
Lines        : 90.47% ( 266/294 )
```

Por arquivo:

| Arquivo | Stmts | Branches | Funcs | Lines |
|---|---:|---:|---:|---:|
| `app.controller.ts` | 100% | 100% | 100% | 100% |
| `app.service.ts` | 100% | 100% | 100% | 100% |
| `auth/auth.controller.ts` | 83.33% | 100% | 33.33% | 80% |
| `auth/auth.service.ts` | 100% | 100% | 100% | 100% |
| `condominiums/condominiums.controller.ts` | 100% | 100% | 100% | 100% |
| `condominiums/condominiums.service.ts` | 100% | 100% | 100% | 100% |
| **`ia/ia.service.ts`** | **62.31%** | **46.34%** | **83.33%** | **61.19%** |
| `infractions/infractions.controller.ts` | 100% | 100% | 100% | 100% |
| `infractions/infractions.service.ts` | 100% | 100% | 100% | 100% |
| `pdf/pdf.service.ts` | 100% | 50% | 100% | 100% |
| `units/units.controller.ts` | 100% | 100% | 100% | 100% |
| `units/units.service.ts` | 100% | 100% | 100% | 100% |
| `users/users.controller.ts` | 100% | 100% | 100% | 100% |
| `users/users.service.ts` | 100% | 100% | 100% | 100% |

> `coveragePathIgnorePatterns` exclui `main.ts`, `app.module.ts` e `data-source.ts` — exatamente os arquivos com mais lógica de configuração crítica (alvos T-01/T-02/T-03). Verificar se é apropriado ou se deveria entrar quando esses arquivos forem refatorados.

E2E (`npx jest --config ./test/jest-e2e.json`): **1 suite · 1 teste · passou** (apenas `GET /` ping). Não há e2e para auth, condominiums, units, infractions.

---

## 7. Lint

Comando: `npx eslint "{src,test}/**/*.ts" --no-fix` (o script `npm run lint` original usa `--fix`, o que modificaria código — fora do escopo da T-00).

Resultado: **2.294 erros · 0 warnings · todos `prettier/prettier`**. Padrões dominantes:

- `Delete ␍` (line endings CRLF — Windows + Prettier sem `endOfLine: 'auto'`)
- `Replace ········ with ····` (tabs/4-spaces nos arquivos vs. 2-spaces no Prettier)

A regra está em [.prettierrc](../.prettierrc) (não inspecionado aqui em detalhe — verificar). Sugestão: criar tarefa pequena (fora T-01..T-03) para configurar `.gitattributes` com `* text eol=lf` + `prettier --write` em PR isolado.

---

## 8. Lacunas vs. SDD §3 (relacionamentos)

- **`User ↔ Condominium`: não existe no código.** SDD §3.2 já marca como dúvida; confirmado: `User` não tem FK nem coluna que conecte a `Condominium`. Logo:
  - Não há multi-tenancy real hoje.
  - Endpoints CRUD de `Condominium` exigem JWT, mas qualquer usuário autenticado pode listar/criar qualquer condomínio.
  - T-06 (RBAC) depende dessa decisão.
- **Sem coluna `role`/`papel` em `User`.** Modelo precisa ser estendido para suportar `ADMIN/MANAGER/RESIDENT` previstos no T-06.

---

## 9. Pontos de atenção / riscos detectados

| # | Item | Risco | Onde tratar |
|---|---|---|---|
| R1 | CORS hard-coded em `main.ts` | Bloqueio em deploys além de localhost:4173 | **T-01** |
| R2 | Fallbacks em `data-source.ts` | Migrations rodam contra DB errado se `.env` ausente | **T-02** |
| R3 | Sem validação de schema do `.env` | App sobe com config inválida | **T-03** |
| R4 | Lint 100% quebrado por EOL/indentação | Não há barreira de estilo no CI | Tarefa nova (sugestão T-12) |
| R5 | `scripts/e2e-runner.mjs` referencia rotas inexistentes (`/condominios`, etc.) | Script enganoso para QA manual | Tarefa nova (ou remover) |
| R6 | `User` sem relação com `Condominium` nem `role` | Bloqueia T-06; potencial vazamento de dados entre condomínios | Decisão arquitetural antes de T-06 |
| R7 | `Unit.identifier` sem unique no DB, mas service trata `23505` | Catch nunca dispara | T-04+ |
| R8 | `Units.findOne(id)` não filtra por `condominiumId` no PATCH/DELETE | IDOR (cross-condominium update/delete) | Pequeno fix dedicado |
| R9 | `IaService` usa `eval('import(...)')` | Frágil, dificulta análise estática | Resolver em T-04 (refatoração do prompt/cliente) |
| R10 | `IaService` sem timeout configurável | Pode bloquear request indefinidamente — exatamente o que SDD T-04 alerta | T-04 |
| R11 | `IaService` loga prefixo da API key | Vazamento parcial em logs | Pequeno fix |
| R12 | `PdfService` bufferiza em memória | Contraria T-05 (streaming) | T-05 |
| R13 | `User.senha` rehash só em `@BeforeInsert` | `repo.update` futuro não rehasheia | Cuidar quando endpoint update for criado |
| R14 | `InfractionsController.generateDocument` usa `@Res()` cru | Bypass do `ResponseInterceptor` | Documentar exceção legítima (PDF binário) na próxima revisão do SDD |
| R15 | `coveragePathIgnorePatterns` exclui `main.ts`, `app.module.ts`, `data-source.ts` | Áreas críticas sem cobertura | Reavaliar após T-01..T-03 |
| R16 | Sem `.env.example` | Onboarding manual e propenso a erro | T-01/T-02/T-03 |
| R17 | `app.service.getStatus()` retorna `database: 'connected'` hard-coded | Falso positivo em monitoramento | T-09 (healthcheck) |

---

## 10. Próximos passos sugeridos

1. Aprovar este relatório (PR T-00).
2. Em sequência, idealmente nesta ordem:
   - **T-02** primeiro (eliminar fallbacks de `data-source.ts` + criar `requireEnv` + esboço inicial de `.env.example`).
   - **T-03** logo depois (schema validation usa `requireEnv` ou Joi/Zod sobre o `.env`).
   - **T-01** (CORS dinâmico) — depende do `.env.example` já ter o slot pronto.
3. Tarefa adjacente "T-12" sugerida: normalizar EOL (`.gitattributes` + `prettier --write` em PR único, sem `--fix` no lint para evitar churn diário).
4. Antes de T-06 (RBAC), trazer decisão sobre `User ↔ Condominium`.

---

## 11. Metadados de execução

- **Comandos executados (somente leitura/relatório):**
  - `npm ci` (necessário porque `node_modules` ausente)
  - `npx jest --coverage` → 84/84 passou, summary acima
  - `npx jest --config ./test/jest-e2e.json` → 1/1 passou
  - `npx eslint "{src,test}/**/*.ts" --no-fix` → 2.294 erros prettier
  - `npm run migration:run` → **não executado** (sem `.env`, política T-00 não cria)
- **Arquivos modificados nesta tarefa:**
  - Movido: `SDD-audicon.md` → `docs/SDD-audicon.md`
  - Criado: `docs/state-of-code.md` (este arquivo)
  - Nenhum arquivo dentro de `src/` ou `test/` foi tocado.
