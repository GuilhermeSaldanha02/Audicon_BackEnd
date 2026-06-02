# RBAC — Matriz de Permissões e Guards

> Atualizado em R-09. Substitui integralmente a versão anterior (modelo ADMIN/MANAGER/RESIDENT
> por condomínio — aposentado pelo R-03+04).

---

## 1. Papéis

Os papéis são **por empresa** (campo `User.role`, enum `SystemRole`).
O morador **não tem acesso** ao sistema — essa é uma regra de produto fundamental.

| Papel | Quem cria | Escopo | Permissões resumidas |
|---|---|---|---|
| `MASTER` | Migration `SeedMasterFromEnv` | Global | Tudo. Cria empresas e o GERENTE inicial de cada uma. Bypassa todos os guards de tenant e papel. |
| `GERENTE` | O MASTER | Empresa | CRUD completo na própria empresa (condomínios, unidades, funcionários, infrações, IA, PDF). Um GERENTE por empresa (índice único parcial). |
| `FUNCIONARIO` | O GERENTE | Empresa | Escrita em infrações; leitura de condomínios e unidades. Não cria/edita condomínio, unidade ou usuário. |

---

## 2. Guards — catálogo

| Nome | Arquivo | Tipo | O que verifica |
|---|---|---|---|
| `JwtAuthGuard` | `src/auth/guards/jwt-auth.guard.ts` | Passport (`AuthGuard('jwt')`) | JWT válido no cookie httpOnly `access_token` (R-08). Popula `req.user` via `JwtStrategy`. |
| `LocalAuthGuard` | `src/auth/guards/local-auth.guard.ts` | Passport (`AuthGuard('local')`) | Credenciais e-mail/senha no body (só `POST /auth/login`). |
| `RolesGuard` | `src/common/guards/roles.guard.ts` | Custom `CanActivate` | Papel do usuário (`User.role`) vs. papéis exigidos pelo decorator `@Roles(...)`. MASTER bypassa. Requer `req.user` (populado pelo `JwtAuthGuard` antes). |
| `CondominiumAccessGuard` | `src/common/guards/condominium-access.guard.ts` | Custom `CanActivate` | Resolve o condomínio pelo parâmetro `:condominiumId` ou `:id` e compara `condominium.companyId` com `req.user.companyId`. MASTER bypassa. Requer `req.user`. |
| `InfractionAccessGuard` | `src/common/guards/infraction-access.guard.ts` | Custom `CanActivate` | Resolve a infração pelo parâmetro `:id`, percorre `infraction → unit → condominium` e compara `companyId`. MASTER bypassa. Requer `req.user`. |
| `MasterGuard` | `src/common/guards/master.guard.ts` | Custom `CanActivate` | Verifica `req.user.isMaster === true`. Sem acesso a banco. Requer `req.user`. |
| `ThrottlerGuard` | `@nestjs/throttler` (APP_GUARD global) | Global | Limite de requisições por IP (100 req/60 s globalmente; `@Throttle` sobrescreve por rota). |

### Notas de design dos guards

- **Nenhum guard lê o header `Authorization`**. A `JwtStrategy` usa `cookieExtractor` (cookie httpOnly `access_token`) desde R-08. Compatível com todos os guards acima.
- **`ThrottlerGuard` é o único `APP_GUARD` global.** Não há JWT global: cada controller/rota declara explicitamente seus guards.
- **Ordem padrão de composição:** `JwtAuthGuard` (autentica) → `RolesGuard`/`MasterGuard` (autoriza papel) → `CondominiumAccessGuard`/`InfractionAccessGuard` (isola tenant). A ordem importa porque os guards de tenant dependem de `req.user`.
- **`assertTenantScope`** é um helper (não guard) usado em controllers/services para rotas de lista/criação sem `:id` de recurso. Garante que não-master sempre veja apenas dados da própria empresa.

---

## 3. Padrão canônico de isolamento de tenant (§2.3 do SDD)

| Tipo de rota | Mecanismo |
|---|---|
| Rota com `:id` de recurso de empresa | `CondominiumAccessGuard` ou `InfractionAccessGuard` |
| Rota de lista/agregação/criação (sem `:id`) | `assertTenantScope(req.user)` no controller/service |
| Rota master-only | `MasterGuard` |

Anti-padrão proibido: `if (!isMaster && companyId)` solto em service — use o helper.

---

## 4. Matriz de rotas

### 4.1 Auth (`/auth`)

| Método | Path | Guards | Papel mínimo | Observação |
|---|---|---|---|---|
| `POST` | `/auth/login` | `LocalAuthGuard` | — (público) | Valida credenciais; seta cookie httpOnly. |
| `POST` | `/auth/logout` | `JwtAuthGuard` | Autenticado | Limpa o cookie. |
| `GET` | `/auth/profile` | `JwtAuthGuard` | Autenticado | Retorna dados do usuário da sessão. |
| `POST` | `/auth/change-password` | `JwtAuthGuard` | Autenticado | Troca a própria senha. |

### 4.2 Empresas (`/companies`) — master only

| Método | Path | Guards (classe + método) | Papel mínimo |
|---|---|---|---|
| `POST` | `/companies` | `JwtAuthGuard`, `MasterGuard` | MASTER |
| `GET` | `/companies` | `JwtAuthGuard`, `MasterGuard` | MASTER |
| `GET` | `/companies/:id` | `JwtAuthGuard`, `MasterGuard` | MASTER |
| `GET` | `/companies/:companyId/users` | `JwtAuthGuard`, `MasterGuard` | MASTER |
| `GET` | `/companies/:companyId/condominiums` | `JwtAuthGuard`, `MasterGuard` | MASTER |
| `PATCH` | `/companies/:id` | `JwtAuthGuard`, `MasterGuard` | MASTER |
| `DELETE` | `/companies/:id` | `JwtAuthGuard`, `MasterGuard` | MASTER |
| `POST` | `/companies/:companyId/users` | `JwtAuthGuard`, `MasterGuard` | MASTER |
| `POST` | `/companies/:companyId/users/:userId/reset-password` | `JwtAuthGuard`, `MasterGuard` | MASTER |

### 4.3 Condomínios (`/condominiums`)

Classe: `@UseGuards(JwtAuthGuard)`. Guards adicionais por método:

| Método | Path | Guards adicionais | Papel mínimo | Observação |
|---|---|---|---|---|
| `POST` | `/condominiums` | `MasterGuard` | MASTER | Só Master cria condomínio. |
| `GET` | `/condominiums` | — | Autenticado | Lista filtrada por empresa via `assertTenantScope` no service. |
| `GET` | `/condominiums/:id` | `RolesGuard`, `CondominiumAccessGuard` | GERENTE ou FUNCIONARIO | |
| `PATCH` | `/condominiums/:id` | `RolesGuard`, `CondominiumAccessGuard` | GERENTE | |
| `DELETE` | `/condominiums/:id` | `MasterGuard` | MASTER | Master pode deletar qualquer condomínio. |
| `POST` | `/condominiums/:id/regimento` | `RolesGuard`, `CondominiumAccessGuard` | GERENTE | Upload do PDF de regimento. |
| `GET` | `/condominiums/:id/regimento` | `CondominiumAccessGuard` | Autenticado (qualquer papel da empresa) | Download do regimento — FUNCIONARIO também precisa. Sem `@Roles`. |
| `DELETE` | `/condominiums/:id/regimento` | `RolesGuard`, `CondominiumAccessGuard` | GERENTE | |

### 4.4 Unidades (`/condominiums/:condominiumId/units`)

Classe: `@UseGuards(JwtAuthGuard, RolesGuard, CondominiumAccessGuard)`.

| Método | Path | Papel via `@Roles` |
|---|---|---|
| `POST` | `/condominiums/:condominiumId/units` | GERENTE |
| `GET` | `/condominiums/:condominiumId/units` | GERENTE ou FUNCIONARIO |
| `GET` | `/condominiums/:condominiumId/units/:id` | GERENTE ou FUNCIONARIO |
| `PATCH` | `/condominiums/:condominiumId/units/:id` | GERENTE |
| `DELETE` | `/condominiums/:condominiumId/units/:id` | GERENTE |

### 4.5 Infrações (`/infractions`)

Classe: `@UseGuards(JwtAuthGuard)`. `InfractionAccessGuard` adicionado por método quando há `:id`.

| Método | Path | Guards adicionais | Papel mínimo | Observação |
|---|---|---|---|---|
| `POST` | `/infractions` | — | Autenticado | Tenant verificado no service via `actor.companyId`. |
| `GET` | `/infractions` | — | Autenticado | Lista filtrada por empresa via `assertTenantScope`. |
| `GET` | `/infractions/export` | — | Autenticado | CSV; tenant via `assertTenantScope`. |
| `GET` | `/infractions/:id` | `InfractionAccessGuard` | Autenticado (empresa) | |
| `POST` | `/infractions/:id/analyze` | `InfractionAccessGuard` | Autenticado (empresa) | Rate limit 10 req/min. |
| `GET` | `/infractions/:id/document` | `InfractionAccessGuard` | Autenticado (empresa) | PDF da infração. |
| `PATCH` | `/infractions/:id/approve` | `InfractionAccessGuard` | Autenticado (empresa) | |
| `POST` | `/infractions/:id/send` | `InfractionAccessGuard` | Autenticado (empresa) | Envia e-mail ao morador. |
| `POST` | `/infractions/:id/send-whatsapp` | `InfractionAccessGuard` | Autenticado (empresa) | Envia WhatsApp ao morador. |
| `PATCH` | `/infractions/:id` | `InfractionAccessGuard` | Autenticado (empresa) | |
| `DELETE` | `/infractions/:id` | `InfractionAccessGuard` | Autenticado (empresa) | |

### 4.6 Imagens de infração (`/infractions/:id/images`)

Classe: `@UseGuards(JwtAuthGuard, InfractionAccessGuard)`.

| Método | Path | Papel mínimo |
|---|---|---|
| `POST` | `/infractions/:id/images` | Autenticado (empresa) |
| `GET` | `/infractions/:id/images` | Autenticado (empresa) |
| `GET` | `/infractions/:id/images/:imageId` | Autenticado (empresa) |
| `DELETE` | `/infractions/:id/images/:imageId` | Autenticado (empresa) |

### 4.7 Relatório PDF por condomínio

Classe: `@UseGuards(JwtAuthGuard, RolesGuard, CondominiumAccessGuard)`, `@Roles(GERENTE, FUNCIONARIO)`.

| Método | Path | Papel mínimo |
|---|---|---|
| `GET` | `/condominiums/:condominiumId/infractions/report.pdf` | GERENTE ou FUNCIONARIO |

### 4.8 Notificações (`/infractions/:id/notifications`)

Classe: `@UseGuards(JwtAuthGuard)`.

| Método | Path | Guards adicionais | Papel mínimo |
|---|---|---|---|
| `GET` | `/infractions/:id/notifications` | `InfractionAccessGuard` | Autenticado (empresa) |

### 4.9 Audit Log (`/audit-log`)

Classe: `@UseGuards(JwtAuthGuard)`.

| Método | Path | Papel mínimo | Observação |
|---|---|---|---|
| `GET` | `/audit-log` | Autenticado | MASTER vê tudo (filtra por `companyId` opcional); demais veem apenas da própria empresa via `assertTenantScope`. |

### 4.10 Dashboard (`/dashboard`)

Classe: `@UseGuards(JwtAuthGuard)`.

| Método | Path | Papel mínimo | Observação |
|---|---|---|---|
| `GET` | `/dashboard` | Autenticado | MASTER vê métricas globais; não-master filtrado por empresa via `assertTenantScope`. |

### 4.11 Usuários (`/users`)

| Método | Path | Guards | Papel mínimo |
|---|---|---|---|
| `POST` | `/users` | `JwtAuthGuard`, `MasterGuard` | MASTER |

> Nota: criação de FUNCIONARIO/GERENTE de uma empresa é feita via `POST /companies/:companyId/users` (seção 4.2), não via `/users`. A rota `/users` é legado para criação direta de usuário master.

### 4.12 Webhooks (`/webhooks`)

| Método | Path | Guards | Observação |
|---|---|---|---|
| `POST` | `/webhooks/resend` | — (público) | Protegido por assinatura HMAC svix, não JWT. Se `RESEND_WEBHOOK_SECRET` estiver configurado, verifica assinatura; caso contrário aceita (dev). Intencional. |

### 4.13 Health (`/health`)

| Método | Path | Guards | Observação |
|---|---|---|---|
| `GET` | `/health/live` | — (público) | Liveness check. |
| `GET` | `/health/ready` | — (público) | Readiness check (ping DB). |

### 4.14 Status (`/`)

| Método | Path | Guards | Observação |
|---|---|---|---|
| `GET` | `/` | — (público) | Retorna `{ status, environment, timestamp }` — sem dados de tenant. Intencional. |

---

## 5. Resultado da auditoria R-09

### Guards auditados

1. `JwtAuthGuard` — usado em todos os controllers de negócio (classe ou método). Sem referência a `Authorization` header; lê cookie via `JwtStrategy.cookieExtractor`. Compatível com R-08.
2. `LocalAuthGuard` — usado exclusivamente em `POST /auth/login`. Correto.
3. `RolesGuard` — usado com `@Roles(...)` nas rotas que exigem papel mínimo. MASTER bypassa. Sem acesso a banco.
4. `CondominiumAccessGuard` — lê `:condominiumId` ou `:id`, consulta DB, compara `companyId`. MASTER bypassa. Compatível com R-08 (lê `req.user`, não header).
5. `InfractionAccessGuard` — percorre `infraction → unit → condominium` para comparar `companyId`. MASTER bypassa. Compatível com R-08.
6. `MasterGuard` — verifica `req.user.isMaster`. Sem acesso a banco. Compatível com R-08.
7. `ThrottlerGuard` (global, via `APP_GUARD`) — rate limiting. Não é guard de autenticação/autorização.

### Inconsistências encontradas

**Nenhuma inconsistência real de segurança.** O que foi encontrado:

- **`docs/rbac.md` totalmente desatualizado** (modelo ADMIN/MANAGER/RESIDENT por condomínio via tabela `user_condominium` — aposentado pelo R-03+04). Corrigido neste PR.
- `GET /condominiums/:id/regimento` não tem `@Roles` (qualquer papel autenticado da empresa pode baixar o regimento). Correto por design: FUNCIONARIO também precisa acessar o regimento para o fluxo de análise de IA. Registrado como nota, não corrigido.
- Anotações `@ApiBearerAuth()` ainda presentes em controllers que agora usam cookie (R-08). Cosmético — Swagger não bloqueia, apenas documenta incorretamente. Registrado como nota, não corrigido neste PR (escopo de R-10/R-13 ou tarefa de documentação Swagger dedicada).
- Nenhum guard órfão.
- Nenhum guard incompatível com R-08 (nenhum lê header `Authorization` diretamente).
