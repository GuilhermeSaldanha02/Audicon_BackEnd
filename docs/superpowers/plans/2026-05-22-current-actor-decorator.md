# @CurrentActor Decorator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair a lógica duplicada `toActor(req)` / `masterActor(req)` presente em 3 controllers para um único decorator NestJS `@CurrentActor()` em `src/common/decorators/current-actor.decorator.ts`.

**Architecture:** Criar um param decorator NestJS que lê `req.user` do ExecutionContext e retorna um `Actor` (interface já existente em `src/audit/audit.service.ts`). Substituir as 10 chamadas `toActor(req)` / `masterActor(req)` + `@Request() req: any` nas assinaturas dos métodos afetados. As funções locais `toActor` / `masterActor` são apagadas dos controllers.

**Tech Stack:** NestJS 10, TypeScript, Jest (unit tests existentes por controller).

---

## Arquivos

| Ação | Arquivo |
|---|---|
| **Criar** | `src/common/decorators/current-actor.decorator.ts` |
| **Criar** | `src/common/decorators/current-actor.decorator.spec.ts` |
| **Modificar** | `src/infractions/infractions.controller.ts` |
| **Modificar** | `src/condominiums/condominiums.controller.ts` |
| **Modificar** | `src/companies/companies.controller.ts` |
| **Modificar** | `src/infractions/infractions.controller.spec.ts` (ajuste de mockReq) |
| **Modificar** | `src/condominiums/condominiums.controller.spec.ts` (ajuste de mockReq) |
| **Modificar** | `src/companies/companies.controller.spec.ts` (ajuste de mockReq) |

---

## Task 1: Criar e testar o decorator `@CurrentActor()`

**Files:**
- Create: `src/common/decorators/current-actor.decorator.ts`
- Create: `src/common/decorators/current-actor.decorator.spec.ts`

- [ ] **Step 1.1: Escrever o teste com falha esperada**

Criar `src/common/decorators/current-actor.decorator.spec.ts`:

```typescript
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentActorDecorator } from './current-actor.decorator';
import { Actor } from '../../audit/audit.service';

function getParamDecoratorFactory(decorator: Function) {
  class TestController {
    handler(@decorator() _actor: Actor) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'handler');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentActor decorator', () => {
  const user = { id: 7, email: 'a@b.com', companyId: 3, isMaster: false };
  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;

  it('retorna Actor com os campos corretos', () => {
    const factory = getParamDecoratorFactory(CurrentActorDecorator);
    const actor: Actor = factory(null, mockContext);
    expect(actor).toEqual({
      userId: 7,
      email: 'a@b.com',
      isMaster: false,
      companyId: 3,
    });
  });

  it('trata isMaster ausente como false', () => {
    const factory = getParamDecoratorFactory(CurrentActorDecorator);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1, email: 'x@y.com', companyId: null } }),
      }),
    } as unknown as ExecutionContext;
    const actor: Actor = factory(null, ctx);
    expect(actor.isMaster).toBe(false);
    expect(actor.companyId).toBeNull();
  });

  it('trata companyId undefined como null', () => {
    const factory = getParamDecoratorFactory(CurrentActorDecorator);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 2, email: 'z@z.com', isMaster: true } }),
      }),
    } as unknown as ExecutionContext;
    const actor: Actor = factory(null, ctx);
    expect(actor.companyId).toBeNull();
  });
});
```

- [ ] **Step 1.2: Rodar o teste para confirmar falha**

```bash
npx jest src/common/decorators/current-actor.decorator.spec.ts --no-coverage
```

Esperado: `FAIL` — `Cannot find module './current-actor.decorator'`

- [ ] **Step 1.3: Criar o decorator**

Criar `src/common/decorators/current-actor.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Actor } from '../../audit/audit.service';

export const CurrentActorDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const req = ctx.switchToHttp().getRequest();
    return {
      userId: req.user.id,
      email: req.user.email,
      isMaster: !!req.user.isMaster,
      companyId: req.user.companyId ?? null,
    };
  },
);
```

- [ ] **Step 1.4: Rodar o teste para confirmar que passa**

```bash
npx jest src/common/decorators/current-actor.decorator.spec.ts --no-coverage
```

Esperado: `PASS` — 3 testes verdes.

- [ ] **Step 1.5: Commit**

```bash
git add src/common/decorators/current-actor.decorator.ts src/common/decorators/current-actor.decorator.spec.ts
git commit -m "feat(common): adicionar decorator @CurrentActor para extrair Actor do JWT"
```

---

## Task 2: Migrar `infractions.controller.ts`

**Files:**
- Modify: `src/infractions/infractions.controller.ts`
- Modify: `src/infractions/infractions.controller.spec.ts`

- [ ] **Step 2.1: Rodar os testes existentes para estabelecer baseline**

```bash
npx jest src/infractions/infractions.controller.spec.ts --no-coverage
```

Esperado: `PASS` (baseline antes de mudar).

- [ ] **Step 2.2: Substituir no controller**

Em `src/infractions/infractions.controller.ts`:

1. **Remover** as linhas 32–41 (import de `Actor` e a função `toActor`):
   ```typescript
   // REMOVER:
   import { Actor } from 'src/audit/audit.service';
   
   function toActor(req: any): Actor {
     return {
       userId: req.user.id,
       email: req.user.email,
       isMaster: !!req.user.isMaster,
       companyId: req.user.companyId ?? null,
     };
   }
   ```

2. **Adicionar** import do decorator (junto aos outros imports locais):
   ```typescript
   import { CurrentActorDecorator } from 'src/common/decorators/current-actor.decorator';
   import { Actor } from 'src/audit/audit.service';
   ```

3. **Em cada método** que hoje recebe `@Request() req: any` e chama `toActor(req)`, substituir pelo parâmetro decorado. Exemplo — método `create` (linha ~55):

   Antes:
   ```typescript
   create(@Request() req: any, @Body() dto: CreateInfractionDto) {
     return this.infractionsService.create(
       dto,
       req.user.companyId,
       req.user.isMaster,
       toActor(req),
     );
   }
   ```
   Depois:
   ```typescript
   create(
     @CurrentActorDecorator() actor: Actor,
     @Body() dto: CreateInfractionDto,
   ) {
     return this.infractionsService.create(
       dto,
       actor.companyId,
       actor.isMaster,
       actor,
     );
   }
   ```

4. Aplicar o mesmo padrão em todos os métodos que usam `toActor(req)`: `approve`, `send`, `sendWhatsapp`, `remove`.

5. Nos métodos que usavam `req` **só** para `toActor(req)` (sem outro uso de `req.user.*`), remover completamente `@Request() req: any` da assinatura. Verificar antes se `req.user.companyId` ou `req.user.isMaster` são usados diretamente — se sim, usar `actor.companyId` / `actor.isMaster`.

6. Remover `Request` do import de `@nestjs/common` se não for mais usado por nenhum método.

- [ ] **Step 2.3: Ajustar o spec do controller**

Em `src/infractions/infractions.controller.spec.ts`, a variável `mockReq` é passada como primeiro argumento nas chamadas do controller. Após a migração, o parâmetro deixou de ser `req` e passou a ser `actor` (injetado pelo decorator, não passado diretamente no teste unitário).

Nos testes unitários de controller NestJS, o decorator é **bypassado** — os métodos são chamados diretamente passando os argumentos na posição correta. Portanto:

- Localizar todos os `controller.create(mockReq, dto)` e equivalentes.
- Substituir `mockReq` pelo `Actor` diretamente:

```typescript
const mockActor: Actor = {
  userId: 1,
  email: 'u@x.com',
  companyId: 1,
  isMaster: false,
};

// Antes:
await controller.create(mockReq, dto);
// Depois:
await controller.create(mockActor, dto);
```

- Atualizar as asserções que verificavam `req.user.companyId` / `req.user.isMaster` usando os campos do `mockActor`.
- Remover `mockReq` se não for mais usado.
- Adicionar `import { Actor } from '../audit/audit.service';` se não existir.

- [ ] **Step 2.4: Rodar os testes após a mudança**

```bash
npx jest src/infractions/infractions.controller.spec.ts --no-coverage
```

Esperado: `PASS` — todos os testes verdes.

- [ ] **Step 2.5: Commit**

```bash
git add src/infractions/infractions.controller.ts src/infractions/infractions.controller.spec.ts
git commit -m "refactor(infractions): substituir toActor(req) por @CurrentActor decorator"
```

---

## Task 3: Migrar `condominiums.controller.ts`

**Files:**
- Modify: `src/condominiums/condominiums.controller.ts`
- Modify: `src/condominiums/condominiums.controller.spec.ts`

- [ ] **Step 3.1: Rodar os testes existentes para estabelecer baseline**

```bash
npx jest src/condominiums/condominiums.controller.spec.ts --no-coverage
```

Esperado: `PASS`.

- [ ] **Step 3.2: Substituir no controller**

Em `src/condominiums/condominiums.controller.ts`:

1. **Remover** o import de `Actor` e a função `toActor` (linhas 39–47):
   ```typescript
   // REMOVER:
   import { Actor } from '../audit/audit.service';
   
   function toActor(req: any): Actor {
     return {
       userId: req.user.id,
       email: req.user.email,
       isMaster: !!req.user.isMaster,
       companyId: req.user.companyId ?? null,
     };
   }
   ```

2. **Adicionar** imports:
   ```typescript
   import { CurrentActorDecorator } from '../common/decorators/current-actor.decorator';
   import { Actor } from '../audit/audit.service';
   ```

3. **Método `create`** — trocar `@Request() req: any` por `@CurrentActorDecorator() actor: Actor` e `toActor(req)` por `actor`.

4. **Método `remove`** — mesmo padrão.

5. Remover `Request` do import de `@nestjs/common` se não restar nenhum uso.

- [ ] **Step 3.3: Ajustar o spec**

Em `src/condominiums/condominiums.controller.spec.ts`, substituir `mockReq` / `req` pelos campos do `Actor` da mesma forma que na Task 2:

```typescript
const mockActor: Actor = {
  userId: 1,
  email: 'a@b.com',
  companyId: 1,
  isMaster: false,
};
```

- [ ] **Step 3.4: Rodar os testes após a mudança**

```bash
npx jest src/condominiums/condominiums.controller.spec.ts --no-coverage
```

Esperado: `PASS`.

- [ ] **Step 3.5: Commit**

```bash
git add src/condominiums/condominiums.controller.ts src/condominiums/condominiums.controller.spec.ts
git commit -m "refactor(condominiums): substituir toActor(req) por @CurrentActor decorator"
```

---

## Task 4: Migrar `companies.controller.ts`

**Files:**
- Modify: `src/companies/companies.controller.ts`
- Modify: `src/companies/companies.controller.spec.ts`

- [ ] **Step 4.1: Rodar os testes existentes para estabelecer baseline**

```bash
npx jest src/companies/companies.controller.spec.ts --no-coverage
```

Esperado: `PASS`.

- [ ] **Step 4.2: Substituir no controller**

Em `src/companies/companies.controller.ts`:

1. **Remover** o import de `Actor` e a função `masterActor` (linhas 15–23):
   ```typescript
   // REMOVER:
   import { Actor } from '../audit/audit.service';
   
   function masterActor(req: any): Actor {
     return {
       userId: req.user.id,
       email: req.user.email,
       isMaster: !!req.user.isMaster,
       companyId: req.user.companyId ?? null,
     };
   }
   ```

2. **Adicionar** imports:
   ```typescript
   import { CurrentActorDecorator } from '../common/decorators/current-actor.decorator';
   import { Actor } from '../audit/audit.service';
   ```

3. **Método `remove`** (linha ~129): trocar `@Request() req: any` por `@CurrentActorDecorator() actor: Actor` e `masterActor(req)` por `actor`.

4. **Método `createEmployee`** (linha ~142): mesmo padrão.

5. **Método `resetPassword`** (linha ~165): mesmo padrão.

6. **Atenção**: o método `create` (linha ~60) usa `@Request() req: any` mas chama `req.user.companyId` diretamente (não `masterActor`). Esse método **não** precisa ser migrado para `@CurrentActorDecorator()` agora — deixar como está.

7. Remover `Request` do import de `@nestjs/common` apenas se **todos** os métodos que o usavam foram migrados. Se `create` ainda usa `@Request()`, manter o import.

- [ ] **Step 4.3: Ajustar o spec**

Em `src/companies/companies.controller.spec.ts`, substituir `mockReq` nos métodos `remove`, `createEmployee` e `resetPassword` pelo `Actor` diretamente.

- [ ] **Step 4.4: Rodar os testes após a mudança**

```bash
npx jest src/companies/companies.controller.spec.ts --no-coverage
```

Esperado: `PASS`.

- [ ] **Step 4.5: Commit**

```bash
git add src/companies/companies.controller.ts src/companies/companies.controller.spec.ts
git commit -m "refactor(companies): substituir masterActor(req) por @CurrentActor decorator"
```

---

## Task 5: Validação final e PR

- [ ] **Step 5.1: Rodar toda a suite de testes**

```bash
npm run test -- --no-coverage
```

Esperado: `PASS` sem regressões. Se algum teste falhar, corrigir antes de prosseguir.

- [ ] **Step 5.2: Lint**

```bash
npm run lint:check
```

Esperado: sem erros.

- [ ] **Step 5.3: Verificar que nenhum `toActor\|masterActor` local sobrou**

```bash
grep -r "function toActor\|function masterActor" src/
```

Esperado: sem saída (nenhuma ocorrência).

- [ ] **Step 5.4: Push e PR**

```bash
git push
gh pr create \
  --title "refactor(common): @CurrentActor decorator — eliminar toActor/masterActor duplicados" \
  --body "Extrai a lógica duplicada toActor()/masterActor() de 3 controllers para um único param decorator @CurrentActor(). 10 call-sites migrados. Testes ajustados."
```
