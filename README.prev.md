# Audicon BackEnd

API backend em NestJS + TypeORM + PostgreSQL para gestão de usuários, condomínios, unidades e infrações. Este guia cobre a configuração, execução com Docker e localmente, migrations e resolução de problemas.

## Sumário

- Requisitos
- Configuração do ambiente (.env)
- Execução com Docker Compose (recomendado)
- Migrations (TypeORM)
- Desenvolvimento sem Docker
- Scripts úteis
- Testes
- Health Check e rotas base
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

## Execução com Docker Compose (recomendado)

1. Subir apenas o banco

```
docker compose up -d db
```

2. Construir e subir a API (e o DB se ainda não estiver rodando)

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

## Desenvolvimento sem Docker

1. Instalar dependências

```
npm ci
```

2. Subir somente o banco com Docker (opção mais simples)

```
docker compose up -d db
```

3. Ajustar `.env` para desenvolvimento local

```
DB_HOST=localhost
```

4. Rodar a API em modo watch

```
npm run start:dev
```

API disponível em `http://localhost:3000/api/v1`.

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
