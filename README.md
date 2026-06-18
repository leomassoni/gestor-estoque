# gestor-estoque

Sistema de gestao de estoque multiempresa para alimentos e bebidas, com foco em centro de estoque, inventario, requisicoes, suprimentos, producao e relatorios operacionais.

## Estado atual

- Frontend: React + Vite + TypeScript
- Backend: Node + Express
- ORM: Prisma
- Banco preparado para producao: PostgreSQL
- Deploy alvo: Render

## Ressalva importante

O projeto ja possui backend e schema Prisma, mas a persistencia funcional completa do app ainda nao foi migrada do `localStorage` do frontend para o banco.

Hoje, o que esta pronto para infraestrutura:

- backend Express funcionando
- Prisma configurado para PostgreSQL
- migration inicial do schema atual do backend
- `render.yaml` para deploy no Render
- `docker-compose.yml` para Postgres local

O que ainda e a proxima etapa estrutural:

- migrar o modelo real do `src/App.tsx` para o banco
- substituir o armazenamento principal em `localStorage`
- criar API de leitura/escrita para o fluxo operacional atual

Ou seja: o repositorio fica pronto para GitHub e Render agora, mas a migracao completa dos dados do app para banco ainda nao terminou.

## Estrutura

- `src/`: frontend React/Vite
- `server/`: API Express + Prisma
- `server/prisma/`: schema e migrations do backend
- `docs/`: estado atual, decisoes e historico de trabalho
- `render.yaml`: infraestrutura declarativa do Render
- `docker-compose.yml`: PostgreSQL local

## Desenvolvimento local

### 1. Instalar dependencias

```bash
npm install
```

O `postinstall` da raiz tambem instala automaticamente as dependencias de `server/`.

### 2. Subir o PostgreSQL local

```bash
docker-compose up -d
```

O banco local do projeto sobe em `localhost:5433` para nao disputar a porta `5432` com outros PostgreSQL ja instalados na maquina.

### 3. Criar o arquivo de ambiente do backend

```bash
cp server/.env.example server/.env
```

### 4. Aplicar o schema no banco

```bash
npm run db:push
```

Se voce preferir criar uma migration local nova:

```bash
npm run db:migrate
```

### 5. Subir frontend e backend

```bash
npm run dev
```

Fluxos locais:

- Frontend: `http://localhost:5174`
- API: `http://localhost:4001`

### 6. Espelhar os dados do online no ambiente local

Para validar fluxos operacionais antes de subir mudancas, sincronize a API publicada para o backend local:

```bash
npm run sync:online-to-local
```

Padroes atuais:

- origem: `https://gestor-estoque-zqw9.onrender.com/api`
- destino local: `http://localhost:4001/api`

Se precisar apontar para outro ambiente:

```bash
GESTOR_REMOTE_BASE_URL="https://outro-ambiente.onrender.com/api" \
GESTOR_LOCAL_BASE_URL="http://localhost:4001/api" \
npm run sync:online-to-local
```

### 7. Validacao local recomendada para import de vendas

Antes de sugerir ou subir mudancas nesse fluxo:

1. sincronize os dados do online para o local
2. abra o frontend local em `http://localhost:5174`
3. valide no centro consumidor:
   - `Atualizar centro de estoque`
   - `Minimo real`
   - `Entrada de producoes`
   - `Requisicao`
4. valide no centro produtor:
   - `Entrada de producoes`
   - dependencias em cascata
   - `Requisicao` de produtos e pre-preparos externos
5. confira se o `Relatorio de vendas importadas` bate com os lotes ativos e com o periodo configurado

Quando houver divergencia:

- primeiro compare o dado persistido via API local:
  - `GET /api/sales-import-batches`
  - `GET /api/sales-import-rows`
  - `GET /api/sales-consumptions`
  - `GET /api/stock-centers`
- so depois proponha mudanca no online

## Build de producao

```bash
npm run build
npm run build:server
```

Para simular o build do Render:

```bash
npm run render:build
```

## GitHub

Antes de subir:

1. Crie um repositorio novo no GitHub.
2. Garanta que `server/.env`, `node_modules`, `dist` e bancos locais nao sejam commitados.
3. Inicialize o repo dentro desta pasta, se ainda nao existir:

```bash
git init
git add .
git commit -m "chore: prepare project for database and render deploy"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

## Deploy no Render

O projeto ja possui `render.yaml`.

### O que ele cria

- 1 banco PostgreSQL no Render: `gestor-estoque-db`
- 1 web service Node: `gestor-estoque`

### Fluxo de deploy

1. Suba o repositorio no GitHub.
2. No Render, escolha `New +` -> `Blueprint`.
3. Aponte para o repositorio.
4. O Render vai ler o `render.yaml` e criar:
   - banco
   - web service
5. O build executa:

```bash
npm install && npm run render:build
```

6. O start executa:

```bash
npm start
```

### Variaveis usadas

- `DATABASE_URL`: injetada pelo banco do Render
- `NODE_ENV=production`
- `PORT`: o Render injeta automaticamente para o web service

## Endpoints uteis do backend atual

- `GET /api/health`
- `GET /api/bootstrap`

## Acompanhamento do projeto

- [`docs/STATUS.md`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/docs/STATUS.md)
- [`docs/DECISIONS.md`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/docs/DECISIONS.md)
- [`docs/WORKLOG.md`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/docs/WORKLOG.md)

## Proxima etapa recomendada

1. modelar no Prisma o estado real do app atual
2. criar endpoints para empresas, usuarios, centros, inventarios, requisicoes, producoes e relatorios
3. migrar a persistencia do frontend de `localStorage` para API + banco
4. ajustar autenticacao e sessao para producao
