# Centralizar tratamento de UniqueViolation (23505) — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair o bloco `catch (QueryFailedError && code === '23505') → ConflictException` repetido em 4 lugares para uma única função helper `throwOnUniqueViolation(err, message)`.

**Architecture:** Helper puro em `src/common/helpers/unique-violation.helper.ts`. Cada service importa e chama `throwOnUniqueViolation(err, '<mensagem>')` no `catch`, eliminando a checagem inline. Sem mudança de comportamento de API — os status codes e mensagens permanecem iguais.

**Tech Stack:** NestJS 10, TypeORM 0.3, TypeScript, Jest.

---

## Arquivos

| Ação | Arquivo |
|---|---|
| **Criar** | `src/common/helpers/unique-violation.helper.ts` |
| **Criar** | `src/common/helpers/unique-violation.helper.spec.ts` |
| **Modificar** | `src/companies/companies.service.ts` |
| **Modificar** | `src/condominiums/condominiums.service.ts` |
| **Modificar** | `src/units/units.service.ts` |

---

## Task 1: Criar helper `throwOnUniqueViolation`

**Files:**
- Create: `src/common/helpers/unique-violation.helper.ts`
- Create: `src/common/helpers/unique-violation.helper.spec.ts`

- [ ] **Step 1.1: Escrever o teste com falha esperada**

Criar `src/common/helpers/unique-violation.helper.spec.ts`:

```typescript
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { throwOnUniqueViolation } from './unique-violation.helper';

function makeUniqueError(): QueryFailedError {
  const err = new QueryFailedError('INSERT', [], new Error('unique'));
  (err as any).driverError = { code: '23505' };
  return err;
}

describe('throwOnUniqueViolation', () => {
  it('lança ConflictException quando code === 23505', () => {
    const err = makeUniqueError();
    expect(() => throwOnUniqueViolation(err, 'Duplicado.')).toThrow(
      new ConflictException('Duplicado.'),
    );
  });

  it('re-lança o erro original quando não é 23505', () => {
    const err = new QueryFailedError('INSERT', [], new Error('outro'));
    (err as any).driverError = { code: '23000' };
    expect(() => throwOnUniqueViolation(err, 'Duplicado.')).toThrow(err);
  });

  it('re-lança erros que não são QueryFailedError', () => {
    const err = new Error('genérico');
    expect(() => throwOnUniqueViolation(err, 'Duplicado.')).toThrow(err);
  });
});
```

- [ ] **Step 1.2: Rodar para confirmar falha**

```bash
npx jest src/common/helpers/unique-violation.helper.spec.ts --no-coverage --maxWorkers=2
```

Esperado: `FAIL` — `Cannot find module './unique-violation.helper'`

- [ ] **Step 1.3: Criar o helper**

Criar `src/common/helpers/unique-violation.helper.ts`:

```typescript
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/** Relança `err` como ConflictException se for violação de unicidade (PG 23505). */
export function throwOnUniqueViolation(err: unknown, message: string): never {
  if (
    err instanceof QueryFailedError &&
    (err as any)?.driverError?.code === '23505'
  ) {
    throw new ConflictException(message);
  }
  throw err as Error;
}
```

- [ ] **Step 1.4: Rodar para confirmar que passa**

```bash
npx jest src/common/helpers/unique-violation.helper.spec.ts --no-coverage --maxWorkers=2
```

Esperado: `PASS` — 3 testes verdes.

- [ ] **Step 1.5: Commit**

```bash
git add src/common/helpers/unique-violation.helper.ts src/common/helpers/unique-violation.helper.spec.ts
git commit -m "feat(common): helper throwOnUniqueViolation para violação de unicidade PG 23505"
```

---

## Task 2: Migrar `companies.service.ts` (2 call-sites)

**Files:**
- Modify: `src/companies/companies.service.ts`

Há dois blocos a substituir.

**Bloco 1** — dentro do método `create` (por volta da linha 87):

Antes:
```typescript
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as any)?.driverError?.code === '23505'
      ) {
        throw new ConflictException('CNPJ ou e-mail do admin já cadastrados.');
      }
      throw new InternalServerErrorException('Falha ao criar empresa.');
    }
```

Depois:
```typescript
    } catch (err) {
      throwOnUniqueViolation(err, 'CNPJ ou e-mail do admin já cadastrados.');
      throw new InternalServerErrorException('Falha ao criar empresa.');
    }
```

**Bloco 2** — dentro do método `update` (por volta da linha 246):

Antes:
```typescript
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as any)?.driverError?.code === '23505'
      ) {
        throw new ConflictException('CNPJ já cadastrado.');
      }
      throw err;
    }
```

Depois:
```typescript
    } catch (err) {
      throwOnUniqueViolation(err, 'CNPJ já cadastrado.');
      throw err;
    }
```

**Adicionar** import junto aos outros imports locais:
```typescript
import { throwOnUniqueViolation } from '../common/helpers/unique-violation.helper';
```

**Remover** `QueryFailedError` do import de `typeorm` se não for mais usado em nenhum outro lugar do arquivo.

- [ ] **Step 2.1: Rodar spec baseline antes de alterar**

```bash
npx jest src/companies/companies.service.spec.ts --no-coverage --maxWorkers=2
```

Esperado: PASS.

- [ ] **Step 2.2: Aplicar as mudanças acima**

- [ ] **Step 2.3: Rodar lint**

```bash
npm run lint:check
```

Esperado: sem erros.

- [ ] **Step 2.4: Rodar spec após mudança**

```bash
npx jest src/companies/companies.service.spec.ts --no-coverage --maxWorkers=2
```

Esperado: PASS — mesma contagem de testes.

- [ ] **Step 2.5: Commit**

```bash
git add src/companies/companies.service.ts
git commit -m "refactor(companies): substituir blocos 23505 por throwOnUniqueViolation"
```

---

## Task 3: Migrar `condominiums.service.ts` (1 call-site)

**Files:**
- Modify: `src/condominiums/condominiums.service.ts`

**Bloco** — dentro do método `create` (por volta da linha 48):

Antes:
```typescript
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any)?.driverError?.code === '23505'
      ) {
        throw new ConflictException(
          'A condominium with this CNPJ already exists.',
        );
      }
```

Depois:
```typescript
    } catch (error) {
      throwOnUniqueViolation(error, 'A condominium with this CNPJ already exists.');
```

**Adicionar** import:
```typescript
import { throwOnUniqueViolation } from '../common/helpers/unique-violation.helper';
```

**Remover** `QueryFailedError` do import de `typeorm` se não usado em outro lugar.

- [ ] **Step 3.1: Rodar spec baseline**

```bash
npx jest src/condominiums/condominiums.service.spec.ts --no-coverage --maxWorkers=2
```

Esperado: PASS.

- [ ] **Step 3.2: Aplicar as mudanças**

- [ ] **Step 3.3: Rodar spec após mudança**

```bash
npx jest src/condominiums/condominiums.service.spec.ts --no-coverage --maxWorkers=2
```

Esperado: PASS.

- [ ] **Step 3.4: Commit**

```bash
git add src/condominiums/condominiums.service.ts
git commit -m "refactor(condominiums): substituir bloco 23505 por throwOnUniqueViolation"
```

---

## Task 4: Migrar `units.service.ts` (1 call-site)

**Files:**
- Modify: `src/units/units.service.ts`

**Bloco** — dentro do método `create` (por volta da linha 28):

Antes:
```typescript
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as any)?.driverError?.code === '23505'
      ) {
        throw new ConflictException(
          'A unit with this identifier already exists.',
        );
      }
```

Depois:
```typescript
    } catch (error) {
      throwOnUniqueViolation(error, 'A unit with this identifier already exists.');
```

**Adicionar** import:
```typescript
import { throwOnUniqueViolation } from '../common/helpers/unique-violation.helper';
```

**Remover** `QueryFailedError` do import de `typeorm` se não usado em outro lugar.

- [ ] **Step 4.1: Rodar spec baseline**

```bash
npx jest src/units/units.service.spec.ts --no-coverage --maxWorkers=2
```

Esperado: PASS.

- [ ] **Step 4.2: Aplicar as mudanças**

- [ ] **Step 4.3: Rodar spec após mudança**

```bash
npx jest src/units/units.service.spec.ts --no-coverage --maxWorkers=2
```

Esperado: PASS.

- [ ] **Step 4.4: Commit**

```bash
git add src/units/units.service.ts
git commit -m "refactor(units): substituir bloco 23505 por throwOnUniqueViolation"
```

---

## Task 5: Validação final + PR

- [ ] **Step 5.1: Confirmar que nenhum bloco 23505 inline restou**

```bash
grep -r "driverError.*code.*23505\|23505.*driverError" src/ --include="*.ts"
```

Esperado: sem saída nos services (só pode aparecer no helper).

- [ ] **Step 5.2: Rodar suite completa**

```bash
npm run test -- --no-coverage --maxWorkers=2
```

Esperado: PASS, sem regressões.

- [ ] **Step 5.3: Lint**

```bash
npm run lint:check
```

Esperado: limpo.

- [ ] **Step 5.4: Push + PR**

```bash
git push
gh pr create --title "refactor(common): centralizar tratamento de UniqueViolation 23505" \
  --body "Extrai os 4 blocos catch QueryFailedError 23505 para helper throwOnUniqueViolation. Sem mudança de comportamento."
```
