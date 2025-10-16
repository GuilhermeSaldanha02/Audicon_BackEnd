# Audicon BackEnd

 API backend em NestJS + TypeORM + PostgreSQL para gestão de usuários, condomínios, unidades e infrações. Este guia foca na execução via Docker (recomendado), migrations e resolução de problemas.

## Sumário

- Requisitos
- Configuração do ambiente (.env)
- Passo a passo (Docker)
- Migrations (TypeORM)
 - Execução com Docker Compose (referência)
- Scripts úteis
- Testes
- Health Check e rotas base
- Endpoints e exemplos de chamadas
- Estrutura do projeto
- Troubleshooting

---

## Requisitos

- Node.js `>= 20`
- Docker Desktop (Windows/Mac/Linux)
- Git Bash ou outro terminal compatível

> Observação (Docker Compose): o atributo `version` no `docker-compose.yml` está deprecado nas versões recentes do Compose e é ignorado — não impede a execução.

## Configuração do ambiente (.env)

Crie o arquivo `.env` na raiz (ou renomeie `.env.example` para `.env`) com os valores abaixo. Ajuste conforme sua necessidade:

```
NODE_ENV=development
PORT=3000

DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=cqc_db

JWT_SECRET=supersecret
JWT_EXPIRATION=1d

GEMINI_API_KEY=sua_chave_secreta_do_gemini_aqui
```

- Quando executar localmente (fora do container), defina `DB_HOST=localhost`.
- Dentro do container/Compose, mantenha `DB_HOST=db`.

## Passo a passo (Docker)

1) Preparar `.env`
- Garanta o arquivo `.env` com `DB_HOST=db`, `DB_DATABASE=cqc_db`, `JWT_SECRET` e demais variáveis conforme a seção de configuração.

2) Subir o banco de dados

```
docker compose up -d db
```

3) Construir e subir a API

```
docker compose up -d --build
```

4) Aplicar migrations

```
docker compose exec api npm run migration:run
```

5) Verificar saúde da API

```
curl http://localhost:3000/api/v1/
```

6) Criar usuário inicial (admin)

```
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Administrador",
    "email": "admin@exemplo.com",
    "senha": "minimo6"
  }'
```

7) Fazer login e obter token

```
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@exemplo.com",
    "senha": "minimo6"
  }'
```
Copie o valor de `access_token` da resposta para usar como Bearer Token.

8) Validar acesso

```
curl http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer <TOKEN>"
```

9) Criar dados básicos
- Condomínio: `POST /condominiums`
- Unidade: `POST /condominiums/:condominiumId/units`
- Infração: `POST /infractions` e, depois, `POST /infractions/:id/analyze` para análise IA e `GET /infractions/:id/document` para gerar PDF.

10) Encerrar e resetar (quando necessário)

```
docker compose down          # para containers
docker compose down -v       # para e remove volumes (reset do banco)
```

### Sequência completa (copy‑paste)

```
docker compose up -d db && \
docker compose up -d --build && \
docker compose exec api npm run migration:run && \
curl http://localhost:3000/api/v1/
```

## Execução com Docker Compose (referência)

1) Subir apenas o banco

```
docker compose up -d db
```

2) Construir e subir a API (e o DB se ainda não estiver rodando)

```
docker compose up -d --build
```

- Containers
  - API: `audicon_api` (porta `3000` mapeada para o host)
  - DB: `audicon_db` (porta `5432` mapeada para o host)

- Logs

```
docker compose logs -f api
docker compose logs -f db
```

- Parar/Remover

```
docker compose down          # para containers
docker compose down -v       # para e remove volumes (reset do banco)
```

- Verificar tabelas (psql)

```
docker compose exec db psql -U postgres -d cqc_db -c "\dt"
```

## Migrations (TypeORM)

Scripts disponíveis:

```
npm run migration:run
npm run migration:revert
npm run migration:generate
```

Executar migrations dentro do container (recomendado):

```
docker compose exec api npm run migration:run
```

Gerar migrations a partir das entidades (quando houver mudanças):

```
docker compose exec api npm run migration:generate
```

Executar migrations no host (fora do container):

```
# Garanta DB_HOST=localhost no .env
npm run migration:run
```

Notas:
- Se o comando de geração indicar “No changes in database schema were found”, significa que não há alterações pendentes entre entidades e schema atual.
- O projeto usa `synchronize: false`; as alterações de schema devem ser aplicadas via migrations.


## Scripts úteis

```
npm run build                  # compila para dist/
npm run start                  # start (sem watch)
npm run start:dev              # start com watch (Nest)
npm run start:prod             # executa dist/main.js
npm run lint                   # eslint (fix)
npm run test                   # unit
npm run test:e2e               # e2e
npm run test:cov               # cobertura
npm run migration:run          # aplica migrations
npm run migration:revert       # reverte última migration
npm run migration:generate     # gera migration a partir das entidades
```

## Testes

```
npm run test
npm run test:e2e
npm run test:cov
```

## Health Check e rotas base

- Prefixo global: `api/v1`
- Health (GET):

```
curl http://localhost:3000/api/v1/
```

Exemplo de resposta:

```
{
  "statusCode": 200,
  "data": {
    "status": "online",
    "environment": "development",
    "database": "connected",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

Módulos disponíveis: `Auth`, `Users`, `Condominiums`, `Units`, `Infractions`, `Ia`, `Pdf`.

## Endpoints e exemplos de chamadas

Observações importantes:
- Prefixo global: todas as rotas começam com `api/v1`.
- Formato de resposta de sucesso é envelopado pelo interceptor:
  `{ "statusCode": <http_status>, "data": <payload> }`.
- Erros são retornados como `{ statusCode, timestamp, path, response }`.
- Rotas protegidas exigem header `Authorization: Bearer <TOKEN>` obtido no login.

### Autenticação

- Registrar usuário

```
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Administrador",
    "email": "admin@exemplo.com",
    "senha": "minimo6"
  }'
```

Resposta (201 Created):

```
{
  "statusCode": 201,
  "data": {
    "id": 1,
    "nome": "Administrador",
    "email": "admin@exemplo.com"
  }
}
```

- Login

```
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@exemplo.com",
    "senha": "minimo6"
  }'
```

Resposta (201/200):

```
{
  "statusCode": 201,
  "data": {
    "access_token": "<JWT>"
  }
}
```

- Perfil (requer Bearer Token)

```
curl http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer <TOKEN>"
```

### Condomínios

- Criar condomínio

```
curl -X POST http://localhost:3000/api/v1/condominiums \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Condomínio Central",
    "cnpj": "12.345.678/0001-90",
    "address": "Rua das Flores, 100"
  }'
```

- Listar todos

```
curl http://localhost:3000/api/v1/condominiums \
  -H "Authorization: Bearer <TOKEN>"
```

- Buscar por ID

```
curl http://localhost:3000/api/v1/condominiums/1 \
  -H "Authorization: Bearer <TOKEN>"
```

- Atualizar

```
curl -X PATCH http://localhost:3000/api/v1/condominiums/1 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "address": "Av. Principal, 200" }'
```

- Remover

```
curl -X DELETE http://localhost:3000/api/v1/condominiums/1 \
  -H "Authorization: Bearer <TOKEN>"
```

### Unidades

Base: `condominiums/:condominiumId/units`

- Criar unidade em um condomínio

```
curl -X POST http://localhost:3000/api/v1/condominiums/1/units \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "A-101",
    "ownerName": "Fulano de Tal"
  }'
```

- Listar todas as unidades de um condomínio

```
curl http://localhost:3000/api/v1/condominiums/1/units \
  -H "Authorization: Bearer <TOKEN>"
```

- Buscar por ID

```
curl http://localhost:3000/api/v1/condominiums/1/units/1 \
  -H "Authorization: Bearer <TOKEN>"
```

- Atualizar

```
curl -X PATCH http://localhost:3000/api/v1/condominiums/1/units/1 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "ownerName": "Ciclano de Tal" }'
```

- Remover

```
curl -X DELETE http://localhost:3000/api/v1/condominiums/1/units/1 \
  -H "Authorization: Bearer <TOKEN>"
```

### Infrações

- Criar infração

```
curl -X POST http://localhost:3000/api/v1/infractions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Barulho após horário",
    "unitId": 1
  }'
```

- Listar todas as infrações (opcional: filtrar por unidade)

```
curl http://localhost:3000/api/v1/infractions \
  -H "Authorization: Bearer <TOKEN>"

# filtro por unidade
curl "http://localhost:3000/api/v1/infractions?unitId=1" \
  -H "Authorization: Bearer <TOKEN>"
```

- Buscar por ID

```
curl http://localhost:3000/api/v1/infractions/1 \
  -H "Authorization: Bearer <TOKEN>"
```

- Analisar infração via IA

```
curl -X POST http://localhost:3000/api/v1/infractions/1/analyze \
  -H "Authorization: Bearer <TOKEN>"
```

- Gerar documento (PDF) da infração

```
curl -L -o infraction-1.pdf \
  http://localhost:3000/api/v1/infractions/1/document \
  -H "Authorization: Bearer <TOKEN>"
```

- Atualizar infração

```
curl -X PATCH http://localhost:3000/api/v1/infractions/1 \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "description": "Barulho alto após as 22h" }'
```

- Remover infração

```
curl -X DELETE http://localhost:3000/api/v1/infractions/1 \
  -H "Authorization: Bearer <TOKEN>"
```

### Dicas
- Para testar com `curl` no Windows (PowerShell), substitua `<TOKEN>` diretamente ou guarde em uma variável: `$token = '<TOKEN>'` e use `-H "Authorization: Bearer $token"`.
- Todos os endpoints respeitam validação (`ValidationPipe`) e podem retornar erros de validação com detalhes em `response`.

## Estrutura do projeto

```
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── .env
├── package.json
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── data-source.ts
│   ├── common/
│   ├── auth/
│   ├── users/
│   ├── condominiums/
│   ├── units/
│   ├── infractions/
│   ├── ia/
│   └── pdf/
└── test/
```

## Troubleshooting

- Docker não inicia / erro de conexão com Docker Engine
  - Abra o Docker Desktop e aguarde ficar “Running”.

- `DB_HOST` incorreto
  - Host: use `DB_HOST=localhost`.
  - Container: use `DB_HOST=db`.

- Portas em uso (`3000`, `5432`)
  - Feche processos que estejam ocupando as portas ou ajuste `PORT` e mapeamentos no Compose.

- “No migrations were found” ou “cannot generate a migration”
  - Não há mudanças entre entidades e schema; gere migrations apenas quando houver alterações.

- Compose mostra aviso “version: obsolete”
  - É apenas deprecação; a execução continua normalmente.

- Reset do banco
  - `docker compose down -v` remove volumes e dados.

- Logs vazios da API
  - Use `docker logs audicon_api` ou `docker compose logs -f api`.

---

> Dúvidas ou melhorias? Abra uma issue ou contribua com PRs.