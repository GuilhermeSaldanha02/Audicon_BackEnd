# Mini-Discovery — Remoção do papel `RESIDENT` (R-03 × R-04)

> **Tipo:** Discovery somente-leitura (nenhum código alterado).
> **Base:** `master` (commit `fcf13b7`, 2026-05-28).
> **Data:** 2026-05-28.
> **Objetivo:** mapear com precisão **onde** o `RESIDENT` aparece, **o que** cada remoção dispara, e **decidir** se R-03 e R-04 devem ser executadas separadas ou fundidas.
> **Relacionado:** [`state-of-code.md`](./state-of-code.md) · [`discovery-multitenant.md`](./discovery-multitenant.md) · SDD v3.0 §5 (R-03, R-04).

---

## TL;DR — Recomendação

**Fundir R-03 e R-04 numa única tarefa.** A R-03 isolada **não entrega valor real**: ela só remove um valor de enum cujos pontos de uso (decorators, specs, tipo no banco) são **todos eliminados pela R-04** logo em seguida. A maior parte do trabalho da R-03 (migration PG para alterar o enum, ajuste de specs, ajuste de decorators) é **imediatamente desfeita** pela R-04. Detalhamento na §3 e §4.

---

## 1. As ocorrências de `RESIDENT` no código

> O `discovery-multitenant.md` (15/05) citou "12 ocorrências" combinando código + specs + descrições em docs. Refazendo a contagem **só de código funcional** (sem comentários e sem `docs/`):

### 1.1 Ocorrências funcionais — 9 (em 5 arquivos)

| # | Arquivo | Linha | Tipo | O que é | O que acontece se removida |
|---|---|---|---|---|---|
| 1 | [`src/common/enums/user-role.enum.ts`](../src/common/enums/user-role.enum.ts) | 4 | **enum (TS)** | valor `RESIDENT = 'RESIDENT'` | enum encolhe para 2 valores. Quem referenciar `UserRole.RESIDENT` quebra compilação. |
| 2 | [`src/condominiums/condominiums.controller.ts`](../src/condominiums/condominiums.controller.ts) | 83 | **decorator** | `@Roles(ADMIN, MANAGER, RESIDENT)` em `GET /condominiums/:id` | rota passa a aceitar só ADMIN/MANAGER. Quem fosse RESIDENT do condomínio perde leitura. |
| 3 | [`src/units/units.controller.ts`](../src/units/units.controller.ts) | 49 | **decorator** | `@Roles(ADMIN, MANAGER, RESIDENT)` em `GET /condominiums/:condominiumId/units` | idem — listagem de unidades fecha para RESIDENT. |
| 4 | [`src/units/units.controller.ts`](../src/units/units.controller.ts) | 59 | **decorator** | `@Roles(ADMIN, MANAGER, RESIDENT)` em `GET /units/:id` | idem — leitura de unidade fecha para RESIDENT. |
| 5 | [`src/condominiums/condominiums.service.spec.ts`](../src/condominiums/condominiums.service.spec.ts) | 274 | **spec** | fixture: membership existente com `role: UserRole.RESIDENT` (teste "atualizar role quando membership já existe") | usa RESIDENT como valor inicial, depois atualiza para ADMIN. **Arbitrário** — qualquer valor serve. |
| 6 | [`src/condominiums/condominiums.service.spec.ts`](../src/condominiums/condominiums.service.spec.ts) | 292 | **spec** | DTO do `addMember` com `role: UserRole.RESIDENT` em teste de "user não existe" | **arbitrário**, valor podia ser qualquer um. |
| 7 | [`src/condominiums/condominiums.service.spec.ts`](../src/condominiums/condominiums.service.spec.ts) | 302 | **spec** | idem para "condomínio não existe" | **arbitrário**. |
| 8 | [`src/condominiums/condominiums.service.spec.ts`](../src/condominiums/condominiums.service.spec.ts) | 329 | **spec** | fixture: membership a remover com `role: UserRole.RESIDENT` (teste `removeMember`) | **arbitrário**. |
| 9 | [`src/migrations/1778890000000-AddUserCondominiumRole.ts`](../src/migrations/1778890000000-AddUserCondominiumRole.ts) | 8 | **migration / DB enum** | `CREATE TYPE "user_condominium_role_enum" AS ENUM('ADMIN','MANAGER','RESIDENT')` | tipo PG mantém 3 valores. Para "remover RESIDENT" é necessária **nova migration** alterando o tipo (PG não suporta `DROP VALUE` direto). |

### 1.2 Comentários não-funcionais — 2

| Arquivo | Linha | Conteúdo |
|---|---|---|
| `src/common/enums/system-role.enum.ts` | 4 | comentário "Não confundir com `UserRole` (ADMIN/MANAGER/RESIDENT)" |
| `src/migrations/1779753600000-AddUserRole.ts` (R-02) | 13 | comentário "NÃO remove RESIDENT nem user_condominium" |

Esses dois caem por consequência (atualizar o texto) — não bloqueiam nada.

### 1.3 Documentação — várias (informativas)

`docs/SDD-audicon.md`, `docs/rbac.md`, `docs/state-of-code.md`, `docs/discovery-multitenant.md`, `docs/state-of-code-2026-05-15.md` — todas descritivas. `rbac.md` precisará ser regenerado quando o modelo por empresa entrar (após R-04).

---

## 2. Dados de `RESIDENT` no banco

> Banco local subido (`docker compose up -d`) e todas as migrations aplicadas (`docker compose exec api npm run migration:run`) **durante esta Discovery** — inclui a R-02. Migration R-02 executou os 4 passos `up()` sem erro contra PG real (CREATE TYPE → ADD COLUMN com default → UPDATE master → DROP DEFAULT → CREATE UNIQUE INDEX).

Consulta `SELECT role, COUNT(*) FROM user_condominium GROUP BY role`:

```
 role | n
------+---
(0 rows)
```

E o estado do `user`:

```
 id |       email        | isMaster | role   | companyId
----+--------------------+----------+--------+-----------
  1 | master@audicon.com | t        | MASTER |
```

**Conclusões:**
- **Zero linhas em `user_condominium`.** Não há `RESIDENT` nem qualquer outro papel no banco. A inferência pelo código de seed se confirmou: a migration `1779235200000` não insere memberships; a única forma é runtime via `POST /condominiums/:id/members` — e ninguém executou.
- **Master corretamente migrado para `role = MASTER`** pela R-02 (validando o passo `UPDATE "user" SET role='MASTER' WHERE "isMaster"=true`).
- **Nenhum dado a preservar** na remoção de RESIDENT/`user_condominium` — reforça a recomendação de fundir R-03+R-04.

---

## 3. Relação estrutural R-03 ↔ R-04

### 3.1 Cadeia de dependências

```
@Roles(UserRole.RESIDENT)  (controllers)
       │
       ▼
UserRole enum (TS)  ───►  user_condominium.role  ───►  user_condominium_role_enum (tipo PG)
       │                          │                            │
       │                          ▼                            │
       │                  user_condominium (tabela)            │
       │                          │                            │
       └──────►  RolesGuard  ◄────┘                            │
                  (lê metadata @Roles + faz lookup por          │
                   condominiumId na tabela user_condominium)   │
                                                                │
              R-04 dropa a tabela ─────────────────────────────┘
              R-04 dropa o tipo PG
              R-04 reescreve ou remove RolesGuard
```

A R-04, segundo o SDD §5, **remove a tabela `user_condominium`**. Isso obriga a:
1. Dropar o tipo PG `user_condominium_role_enum`.
2. Reescrever `RolesGuard` (hoje faz `findOne` em `user_condominium` por `condominiumId`) ou removê-lo se o RBAC passa a usar `SystemRole` em `User.role` direto.
3. Atualizar todos os `@Roles(UserRole.*)` nos controllers — eles passam a usar `SystemRole` ou são removidos se a leitura deixa de ter restrição fina por condomínio.
4. Atualizar/remover os specs que dependem de `user_condominium`.

### 3.2 O que sobraria após a R-04
Se R-04 dropa `user_condominium` + reescreve guards + troca os `@Roles` por `SystemRole`, **o enum TS `UserRole` (ADMIN/MANAGER/RESIDENT) inteiro fica órfão** — não tem mais usuários no código. **R-04 elimina junto o arquivo `user-role.enum.ts`**, e com ele o `RESIDENT` desaparece automaticamente.

---

## 4. R-03 separada vs. fundida — análise

### 4.1 Se executarmos R-03 em isolamento (apenas remover `RESIDENT`)

| Mudança da R-03 isolada | Sobrevive à R-04? |
|---|---|
| Remover valor `RESIDENT` do enum TS | ❌ R-04 deleta o enum inteiro. |
| Remover `RESIDENT` dos 3 decorators `@Roles` | ❌ R-04 reescreve esses decorators (`SystemRole`) ou remove. |
| Trocar `UserRole.RESIDENT` por outro valor nas 4 specs | ❌ R-04 reescreve/remove essas specs (lógica de `user_condominium` sai). |
| Migration PG removendo `RESIDENT` do tipo `user_condominium_role_enum` | ❌ R-04 dropa o tipo inteiro. |
| Comportamento das rotas: `GET /condominiums/:id`, `GET /units`, `GET /units/:id` deixam de aceitar RESIDENT | 🟡 R-04 reescreve a regra de leitura no novo modelo — esse comportamento é provisório. |

**Conclusão:** 100% do trabalho de schema/código da R-03 isolada é **descartado** pela R-04. O único "ganho" intermediário é uma janela temporária em que rotas de leitura excluem RESIDENT — mas, como o banco está vazio de RESIDENTs (§2), esse ganho é semântico, não real.

### 4.2 Custo extra da R-03 isolada

- **Migration PG não-trivial:** Postgres não suporta `DROP VALUE` em um enum. Para "remover RESIDENT" é preciso: criar novo tipo enum sem RESIDENT, alterar a coluna `user_condominium.role` para o novo tipo (`ALTER COLUMN ... USING ::text::new_enum`), dropar o tipo antigo. **Esse trabalho de migration é todo desfeito pela R-04** (que dropa a tabela e o tipo).
- **Risco de regressão dobrado:** dois PRs tocando RBAC seguidos, dois ciclos de revisão, duas janelas de risco.
- **Ordem temporária inconsistente:** R-03 deixa a base em um estado "fim do per-condo sem o per-company" que nunca é o estado-alvo.

### 4.3 Custo extra da fusão R-03+R-04

- **PR maior:** mais arquivos em um único review.
- **Mitigação:** dividir em **commits atômicos dentro do mesmo PR** (1 commit drop enum value, 1 commit drop tabela + tipo, 1 commit reescrever RolesGuard, 1 commit trocar decorators, 1 commit specs) — cada commit revisável separado, ainda em um PR coeso.

### 4.4 Argumentos para manter separado (e por que perdem)

| Argumento | Análise |
|---|---|
| "SDD §5 lista como tarefas separadas" | O SDD v3.0 é plano, não dogma. A própria nota da §1 e §7 prevê passos pequenos como **mitigação de risco**, não como fim em si. Se o passo pequeno não tem valor isolado, fundir é mais seguro, não menos. |
| "PR menor, revisão mais fácil" | Compensável com commits atômicos dentro do PR fundido. |
| "Isolar risco" | A R-03 isolada introduz **novo risco** (migration PG de alteração de enum) que a R-04 não teria que fazer. Fundir reduz risco total. |

---

## 5. Recomendação fundamentada

**Fundir R-03 e R-04 em uma única tarefa "R-03+04 — Remover modelo de papel por condomínio (RESIDENT, user_condominium, RolesGuard)."**

Razões, em ordem:
1. **R-03 isolada não tem produto.** 100% do seu output (enum encolhido, decorators sem RESIDENT, migration de enum) é descartado pela R-04. É churn puro.
2. **Migration PG dupla é custo gratuito.** Alterar o tipo `user_condominium_role_enum` em R-03 e depois dropá-lo em R-04 é fazer duas migrations destrutivas onde uma basta.
3. **A unidade de mudança real é "sair do modelo por condomínio".** RESIDENT é só um dos valores desse modelo; tratá-lo separado é arbitrário.
4. **Estado intermediário inexistente.** Não há "produção rodando com RESIDENT-removido-mas-user_condominium-ainda-viva" que faça sentido manter — é só um instante entre dois PRs.
5. **Banco demo, vazio de RESIDENTs.** Nenhum dado real exige a remoção em etapa.

**Se você ainda preferir separar por higiene de revisão**, a alternativa menos custosa é:
- R-03 ≡ commit atômico zero-schema: só remover `RESIDENT` do enum TS e dos decorators, ajustar specs. **Não** rodar migration. Aceitar que o banco mantém o valor `RESIDENT` no tipo enum até a R-04 dropá-lo.
- R-04 faz toda a parte de schema (drop tabela, drop tipo, reescrever guard).

Essa variante mata o custo da "migration PG dupla" mas mantém os outros pontos do churn. Ainda assim, **fundir é melhor**.

---

## 6. O que precisa decidir agora

1. **Fundir ou separar?** (recomendação: fundir.)
2. **Se fundir:** renomear a tarefa no SDD para `R-03+04 — Remover modelo por condomínio` e seguir.
3. **Antes de qualquer migration:** dump/backup do banco (mesmo demo) — política firmada em R-02.
4. **Em paralelo (não bloqueante):** decidir o destino das rotas que hoje davam leitura a `RESIDENT` (`GET /condominiums/:id`, `GET /units`, `GET /units/:id`). No modelo por empresa, leitura passa para `GERENTE` e `FUNCIONARIO`. Sem RolesGuard por condomínio, basta `JwtAuthGuard` + isolamento por `companyId` (central — R-05).

---

## Metadados

- Branch: `discovery/resident-removal` (off `master` atualizado, commit `fcf13b7`).
- Comandos: `git`, `grep`, leitura de arquivos; `docker compose up -d` (subir stack); `docker compose exec api npm run migration:run` (aplicar migrations); `psql` só-leitura para as duas consultas da §2. Nenhum arquivo de `src/` ou `test/` modificado.
- DB: acessível durante esta Discovery; dados em §2.
