# Handoff — Audicon
**Documento de continuidade entre chats**
Última atualização: 2026-06-08

---

## O que é o Audicon

SaaS B2B multi-tenant para gestão de infrações em condomínios, com análise por IA (Google Gemini) e geração de PDF. Vendido para empresas de administração de condomínios. O morador **não tem acesso** ao sistema.

## Repositórios

- **`Audicon_BackEnd`** — NestJS / TypeScript / TypeORM / PostgreSQL. Fundação completa. 383 unit tests, 67 e2e. CI completo.
- **`Audicon_Web`** — Next.js 15 / React 19 / Tailwind 4 / shadcn. 13 telas funcionais (12 do Open Design + `/company/employees`) com design system aplicado. CI mínimo (next lint + next build em PR).
- Os dois repos estão em pastas irmãs (`C:\ProjetoAudicon\`). O Claude Code é aberto na pasta-mãe e enxerga os dois.

## Documentação canônica (nos repos)

- `Audicon_BackEnd/docs/SDD-audicon.md` (v3.4) — fonte única de verdade.
- `Audicon_BackEnd/docs/rbac.md` — guards, rotas, papéis.
- `Audicon_BackEnd/CLAUDE.md` — setup, variáveis, workflow.
- Discoveries em `Audicon_BackEnd/docs/`: `state-of-code.md`, `discovery-multitenant.md`, `discovery-resident.md`, `discovery-tenant-isolation.md` (linha 159 cita `listEmployees`, removido no R-15 — corrigir é melhoria de Fase F).
- Discovery em `Audicon_Web/docs/`: `discovery-auth-frontend.md`.
- Design de referência em `Audicon_Web/docs/Design/` (não versionado no git).

## Hierarquia de papéis (decidida e implementada)

| Papel | Quem cria | Pode fazer |
|---|---|---|
| MASTER | Seed por env (migration) | Tudo. Cria empresas, gerentes, e condomínios para qualquer empresa. |
| GERENTE | O Master | Tudo na sua empresa: CRUD de condomínios, unidades, **funcionários** (cria/lista/edita/desativa via `/company/employees`, R-15/R-16), infrações; IA; PDF. |
| FUNCIONÁRIO | O Gerente | Só infrações (criar/editar) + leitura de condomínios/unidades. |

Papel mora em `User.role` (enum `SystemRole`). `/auth/profile` expõe `role`, `companyId`, `isMaster`, `mustChangePassword`.

## Autenticação (R-08)

JWT em cookie `httpOnly`. Flags por ambiente (dev: `SameSite=Lax`, `Secure=false`; prod: `SameSite=None`, `Secure=true`). Login: `POST /auth/login` → cookie. Logout: `POST /auth/logout`. Claims via `GET /auth/profile`. Frontend: `axios` com `withCredentials:true`.

**Revogação de acesso (R-16):** a `JwtStrategy` busca o usuário a cada request; usuário desativado (`deletedAt`) é recusado em dois legs — (a) request autenticado → 401 e (b) novo login → 401 — via checagem **explícita** de `deletedAt` (não dependente do auto-filtro do TypeORM).

## O que foi feito

### Fases A, B, C — COMPLETAS
Fundação (R-01→R-07), Segurança (R-08, R-09), Frontend (R-10→R-13) + fixes de produto (profile expõe role, severity, GERENTE cria condomínio). Tudo em master. Ver SDD §5 para PRs.

### Fase G — Gestão de usuários

| ID | O que fez | Estado | PR |
|---|---|---|---|
| R-15 | GERENTE cria e lista funcionários da própria empresa; `role` na listagem; `CompanyAccessGuard` novo; remoção do `listEmployees` morto. Tela `/company/employees`. | ✅ Mergeado | Back #66 / Front #33 |
| R-16 backend | GERENTE edita (nome/e-mail) e **desativa** (soft-delete via `@DeleteDateColumn`) funcionário. Anti-escalonamento (role no body → 400). Revogação real nos 2 legs (PARADA 1). `?includeInactive=true`. Audit `EMPLOYEE_UPDATED`/`EMPLOYEE_DEACTIVATED`. E-mail preso 23505 → 409. | ✅ Mergeado | **Back #69** (o #68 foi fechado por deleção de base no merge do #67 — conteúdo idêntico recriado no #69) |
| R-16 doc-sync | Sync do SDD v3.1→v3.3 (dívida de doc de R-14/R-15, nunca commitada) | ✅ Mergeado | Back #67 |
| R-16 frontend | Tela `/company/employees` ganha editar (Dialog nome+email, sem role) e desativar (confirmação com o nome, "Desativar" não "Excluir", preserva histórico). Toggle "mostrar inativos" + badge. Tipos regenerados. | ✅ Mergeado | Front #34 |
| R-17 | MASTER promove/rebaixa o GERENTE da empresa. Migration `FixGerenteIndexSoftDelete` (índice parcial `AND "deletedAt" IS NULL`); `PATCH /companies/:companyId/users/:userId/role` (MasterGuard); badge + Promover/Rebaixar; `useApiMutation` escape-hatch `onError → true`; botão "Atribuir admin" removido. | ✅ Mergeado | Back #70 / Front #36 |

### R-14 (Deploy) — parte código MERGEADA, parte config PENDENTE
Fix do `data-source.ts` (glob `__dirname`), `migration:run:prod`, migration `UpdateMasterPasswordFromEnv` (senha do Master, CWE-798). Front: `.env.example`, `engines`, `.nvmrc`. PRs Back #65 / Front #32. **Falta só config de plataforma (Railway + Vercel) — é setting, reordenado para depois do R-17.**

## Onde parei — exatamente aqui

**Fase G completa.** R-16 (Back #69 / Front #34) e R-17 (Back #70 / Front #36) mergeados em master. Não há PRs abertos em nenhum dos dois repos.

**Próximo e único passo restante antes do piloto: R-14 config de plataforma.**
Toda a configuração do Railway (backend + Postgres) e Vercel (frontend) está detalhada no SDD §5. É trabalho de settings/painel — sem PR de código — e usa segredos de produção (`JWT_SECRET`, `MASTER_PASSWORD`, API keys). Recomendar **chat novo, Modo Opus**.

### Estado dos repos (master)
- **Backend:** 383 unit / 67 e2e / 12 suites. Lint limpo. Migrations aplicadas. Husky ativo.
- **Frontend:** `next lint` e `next build` verdes (13 páginas). CI: next lint + next build em PR.

### Suíte de QA E2E (Playwright) — 24/24 verde (R-16)
Rodada contra stack real (Postgres zerado, migrations, seed). Cobriu os 3 papéis, RBAC, isolamento de tenant, revogação de acesso. Vive na branch **descartável** `qa/r-16-e2e` do Audicon_Web (dir autocontido `e2e/` + `QA-REPORT.md`), **resgatável por cherry-pick** — candidata a adoção formal no R-20.

### Dívidas de front registradas (Fase F)
- **`RequireAuth` sem papel `gerente`** (tipo `Role = master|company`; `company` aceita funcionário). Telas gated-por-gerente têm gate manual com janela branca transitória (~0,5s em prod). Não é bug de segurança (back bloqueia, 403 provado). Dívida estrutural — R-23.
- **Papel escolhível ao criar funcionário** → feature ausente. Hoje service força `FUNCIONARIO`; escolha do papel na criação seria melhoria Fase F.

## Roadmap restante

| Fase | Tarefas | Estado |
|---|---|---|
| A — Fundação | R-01→R-07 | ✅ Completa |
| B — Segurança | R-08, R-09 | ✅ Completa |
| C — Frontend | R-10→R-13 | ✅ Completa |
| G — Gestão de usuários | R-15 | ✅ Completa |
| | R-16 (Back #69 / Front #34) | ✅ Mergeado |
| | R-17 (Back #70 / Front #36) | ✅ Mergeado |
| D — Deploy | R-14 código | ✅ Mergeado |
| | R-14 config plataforma | 🟡 **Próximo e último passo** |
| F — Incremental | R-18→R-23 | Pós-validação |

## Limitações conhecidas do soft-delete (Fase F, não bloqueiam)

- **E-mail preso:** e-mail de funcionário desativado não pode ser recriado nem reusado (unique não-parcial). Tratado parcialmente: `createEmployee` devolve 409 amigável em vez de 500.
- **Sem reativação:** não há rota nem UI para reativar funcionário desativado. Capenga em prod — melhoria de Fase F.
- **Índice de gerente vs soft-delete — RESOLVIDO no R-17:** migration `FixGerenteIndexSoftDelete` recriou o índice parcial com `AND "deletedAt" IS NULL`; gerente desativado não bloqueia mais a vaga.

## Melhorias / itens de Fase F registrados
- **Desativar empresa (soft-delete de tenant em cascata)** em vez de exclusão — resolveria o atrito de esvaziar a empresa manualmente antes de excluir. Mas exige cascata reversível em ~6 tabelas + interação com índice de gerente. Decisão de produto, não mecânica. Avaliar com piloto rodando (excluir empresa é evento raro).
- Filtro de infrações por condomínio (hoje só `unitId`); filtros de período no dashboard/audit-log; corrigir `discovery-tenant-isolation.md:159`.
- R-21 (CSRF), R-22 (conserto definitivo do seed do Master), R-19 (eliminar `delete senha` manuais), R-18 (refactors).

## Pendências de tooling (registrar no R-20)
- **Playwright** adotado **pontualmente** nesta sessão (devDependency do Web, headless próprio, sem MCP). Autorização encerrada com a sessão. Suíte 24/24 na branch `qa/r-16-e2e`. **R-20 decide adoção formal** (specs no repo, CI).
- **Browser-agent** (Claude in Chrome / browser-MCP) discutido e NÃO adotado. Congelamento de skills/MCPs segue até R-20.

## Padrões de trabalho estabelecidos

- **Dois modos de delegação ao agente:**
  - **Modo Opus (segurança/arquitetura/deploy):** Discovery → plano → aprovação → implementação. Paradas explícitas nos pontos sensíveis.
  - **Modo Sonnet autônomo (mecânico/escopo fechado):** prompt com escopo + critérios → PR → revisão no PR.
- **Revisar diff antes do commit** em schema/auth/isolamento.
- **Cada tarefa em PR próprio**, referenciando o ID (R-xx).
- **PRs empilhados:** NÃO usar `--delete-branch` na base de um stack — deletar a base antes do retarget fecha o PR de cima (aconteceu no #68 → recriado como #69). Mergear a base, deixar o GitHub retargetar, confirmar, só então deletar.
- **Docker como ambiente padrão** para testes/lint.
- **Conventional Commits**, cobertura não regride, migrations nunca `synchronize: true`.

## Stash pendente

No `Audicon_Web` há um `git stash` pendente: `stash@{0}` com pasta `design-system/`. Não é urgente. Quando voltar ao front: `git stash pop` e decidir.

## Preferências do usuário

- Respostas em português.
- Nunca validar por padrão; primeiro movimento é achar o ponto fraco.
- Quando eu apresentar ideia grande, aplicar 4 checagens: escopo mínimo viável? riscos reais? problema certo? tecnologia faz sentido?
- Meu padrão de erro é superestimar escopo.
- Não usar skills/MCPs novos no Claude Code sem autorização explícita (congelado até R-20).
- Não recomendar Open Design (ferramenta encerrada na Fase C).
- Ao guiar tarefa a tarefa: sempre dizer o que mandei e entregar o prompt pronto pro agente em seguida.

## Como usar este documento

1. No **Projeto "Audicon"** no claude.ai, substitua este handoff + o `SDD-audicon.md` v3.4.
2. Abra um chat novo dentro do projeto.
3. Primeira mensagem sugerida: "Estou retomando o Audicon. Fase G completa (R-15, R-16, R-17 mergeados — Back #66/#69/#70, Front #33/#34/#36). Próximo e único passo: R-14 config de plataforma (Railway + Vercel). Modo Opus — envolve segredos de produção e infra. Ver SDD §5 para o checklist de configuração."
4. O novo chat terá todo o contexto sem o peso do histórico anterior.
