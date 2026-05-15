# RBAC — Matriz de Permissões

## Papéis

| Papel | Descrição |
|---|---|
| `ADMIN` | Administrador do condomínio (síndico/gestor principal). Acesso total no condomínio. |
| `MANAGER` | Funcionário/gerente. Pode criar e gerenciar infrações e unidades, mas não excluir condomínios. |
| `RESIDENT` | Morador. Acesso de leitura dentro do condomínio. |

Os papéis são **por condomínio** (tabela `user_condominium`). Um usuário pode ser `ADMIN` no condomínio A e `RESIDENT` no condomínio B.

## Modelo de dados

```
user_condominium
  id             PK
  userId         FK → user.id  (CASCADE DELETE)
  condominiumId  FK → condominium.id (CASCADE DELETE)
  role           ENUM('ADMIN', 'MANAGER', 'RESIDENT')
  UNIQUE (userId, condominiumId)
```

## Atribuição automática

Ao criar um condomínio (`POST /condominiums`), o usuário autenticado recebe automaticamente o papel `ADMIN` nesse condomínio.

## Matriz de permissões

### Condomínios

| Endpoint | JWT | ADMIN | MANAGER | RESIDENT |
|---|:---:|:---:|:---:|:---:|
| `POST /condominiums` | ✅ | — | — | — |
| `GET /condominiums` | ✅ | — | — | — |
| `GET /condominiums/:id` | — | ✅ | ✅ | ✅ |
| `PATCH /condominiums/:id` | — | ✅ | ❌ | ❌ |
| `DELETE /condominiums/:id` | — | ✅ | ❌ | ❌ |
| `POST /condominiums/:id/members` | — | ✅ | ❌ | ❌ |

> `GET /condominiums` retorna apenas os condomínios nos quais o usuário é membro.

### Unidades

| Endpoint | ADMIN | MANAGER | RESIDENT |
|---|:---:|:---:|:---:|
| `POST /condominiums/:id/units` | ✅ | ✅ | ❌ |
| `GET /condominiums/:id/units` | ✅ | ✅ | ✅ |
| `GET /condominiums/:id/units/:unitId` | ✅ | ✅ | ✅ |
| `PATCH /condominiums/:id/units/:unitId` | ✅ | ✅ | ❌ |
| `DELETE /condominiums/:id/units/:unitId` | ✅ | ❌ | ❌ |

### Relatórios PDF

| Endpoint | ADMIN | MANAGER | RESIDENT |
|---|:---:|:---:|:---:|
| `GET /condominiums/:id/infractions/report.pdf` | ✅ | ✅ | ❌ |

### Infrações

As rotas de infrações (`/infractions/**`) usam apenas autenticação JWT (sem verificação de papel por condomínio), pois o `condominiumId` não está disponível diretamente no parâmetro de rota. RBAC granular para infrações é escopo de iteração futura.

## Endpoint de membros

```
POST /condominiums/:id/members
Authorization: Bearer <token>  (requer papel ADMIN no condomínio)

Body:
{
  "email": "novo@usuario.com",
  "role": "MANAGER" | "RESIDENT" | "ADMIN"
}
```

Se o usuário já for membro, o papel é atualizado. Se não existir usuário com esse e-mail, retorna 404.
