# Design: Dividir InfractionsService em 3 services (CRUD / Analysis / Notification)

**Data:** 2026-05-22
**Tipo:** Refactor de arquitetura (clean code / manutenibilidade)
**Impacto externo:** Nenhum (API, DB, frontend e comportamento inalterados)

## Motivação

O `InfractionsService` tem ~398 linhas e **9 dependências** injetadas. As dependências
se concentram: a lógica de IA e notificação puxa 6 das 9 (`ia`, `pdf`, `mail`,
`whatsapp`, `images`, `audit`), enquanto o CRUD puro precisa de apenas 4 (`repo`,
`units`, `condominiums`, `audit`).

O objetivo é aplicar responsabilidade única: separar em 3 services com fronteiras
limpas, reduzindo acoplamento e simplificando os testes (hoje qualquer teste exige
montar o service com 9 mocks).

## Arquitetura

Três services, **sem dependência cruzada** entre eles. O `countByUnit` — usado
exclusivamente por `analyze` — migra para o `AnalysisService`, eliminando o único
acoplamento potencial entre os services.

| Service | Métodos | Dependências |
|---|---|---|
| `InfractionsService` (CRUD) | `create`, `findAll`, `findOne`, `update`, `remove`, `approve`, `exportCsv`, `findForReport`, `resolveCondoId` (privado) | `repo`, `unitsService`, `condominiumsService`, `auditService` (4) |
| `InfractionAnalysisService` | `analyze`, `countByUnit` | `repo`, `iaService` (2) |
| `InfractionNotificationService` | `send`, `sendWhatsapp`, `generateDocument` | `repo`, `imagesService`, `pdfService`, `mailService`, `whatsappService`, `auditService` (6) |

### Decisão: injeção direta (sem facade)

Os controllers injetam o service relevante por método. Rejeitamos a alternativa de
manter `InfractionsService` como fachada delegando aos 3, pois adicionaria uma camada
de pura delegação sem ganho e a fachada ainda carregaria as 3 deps.

### Por que `generateDocument` fica no NotificationService

`generateDocument` produz o PDF da infração e compartilha exatamente as deps
`pdfService` + `imagesService` com o método `send`. Mantê-lo junto evita duplicar
essas dependências num quarto service só para geração de documento.

## Componentes afetados

### Código

- **`src/infractions/infractions.service.ts`** (modificar): remove `analyze`,
  `countByUnit`, `send`, `sendWhatsapp`, `generateDocument`. Remove as deps
  `iaService`, `pdfService`, `mailService`, `whatsappService`, `imagesService` do
  construtor. Mantém CRUD + `exportCsv` + `findForReport` + `resolveCondoId`.
- **`src/infractions/infraction-analysis.service.ts`** (criar): `analyze` +
  `countByUnit`. Deps: `repo` (Infraction), `iaService`.
- **`src/infractions/infraction-notification.service.ts`** (criar): `send`,
  `sendWhatsapp`, `generateDocument`. Deps: `repo` (Infraction), `imagesService`,
  `pdfService`, `mailService`, `whatsappService`, `auditService`.
- **`src/infractions/infractions.controller.ts`** (modificar): injeta os 3 services.
  `analyze` → `analysisService`; `send`/`sendWhatsapp`/`generateDocument` →
  `notificationService`; demais → `infractionsService`.
- **`src/infractions/reports.controller.ts`** (inalterado): segue usando
  `InfractionsService.findForReport`.
- **`src/infractions/infractions.module.ts`** (modificar): adiciona
  `InfractionAnalysisService` e `InfractionNotificationService` aos `providers`.

### Testes

- **`src/infractions/infractions.service.spec.ts`** (modificar): mantém apenas os
  testes de CRUD, `exportCsv`, `approve`, `findForReport`. Remove os testes de
  `analyze`/`countByUnit`/`send`/`sendWhatsapp`/`generateDocument` (movidos).
- **`src/infractions/infraction-analysis.service.spec.ts`** (criar): testes de
  `analyze` e `countByUnit` movidos do spec original.
- **`src/infractions/infraction-notification.service.spec.ts`** (criar): testes de
  `send`, `sendWhatsapp`, `generateDocument` movidos do spec original.
- **`src/infractions/infractions.controller.spec.ts`** (modificar): provê os 3
  service mocks; ajusta as chamadas de `analyze`/`send`/`sendWhatsapp`/
  `generateDocument` para os novos mocks.

## Fluxo de dados (inalterado)

Exemplo `analyze`:
1. Controller → `analysisService.analyze(id)`
2. `analyze` busca a infração com relations `unit`, `unit.condominium`
3. Lê regimento via `iaService.extractRegimentoText(condominiumId)`
4. Conta reincidências via `countByUnit(unitId, infractionId)` (agora no mesmo service)
5. Chama `iaService.analisarInfracao(...)`, grava `formalDescription`,
   `suggestedPenalty`, status `ANALYZED`, salva

Os fluxos de `send`, `sendWhatsapp`, `generateDocument` e CRUD permanecem idênticos,
apenas residindo em services diferentes.

## Tratamento de erros (inalterado)

`NotFoundException`, `BadRequestException`, `ForbiddenException` continuam lançadas
exatamente nos mesmos pontos. Audit log continua disparado nos mesmos métodos.

## Testes / Verificação

- `npm run lint:check` limpo
- Suite de testes dos arquivos afetados verde (mesma contagem total de asserções,
  apenas redistribuídas entre os specs)
- Thresholds de coverage do módulo `infractions` mantidos
- Verificação manual via Swagger: rotas de criar/analisar/aprovar/enviar/CSV/PDF
  respondem igual

## Fora de escopo

- Nenhuma mudança em entidades, migrations ou DTOs
- Nenhuma mudança no `ImagesService`/`ImagesController`
- Nenhuma mudança no contrato REST ou no frontend
