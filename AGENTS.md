# Instrucoes do Projeto Gestor Estoque

## Regra principal

Este sistema e usado em operacao real. Mudancas novas nao podem quebrar fluxos que ja estavam funcionando.

Antes de alterar codigo, leia o contexto local relevante, confira o fluxo afetado e mantenha a mudanca no menor escopo possivel.

## App.tsx e performance

- Nao aumentar `src/App.tsx` para novas funcionalidades.
- Novas telas, paineis e fluxos devem ser criados em componentes, dominios, hooks ou modulos separados.
- Se for inevitavel tocar em `App.tsx`, a mudanca deve ser uma integracao pequena: import, estado minimo, chamada de componente ou remocao de codigo antigo.
- Mudancas que aumentem bundle, render global ou custo de digitacao/clique precisam de justificativa tecnica e validacao antes de deploy.
- Preferir `lazy`/`Suspense` para paineis pesados que nao precisam entrar no bundle inicial.

## Fluxos criticos

Trate como criticos:

- login/autenticacao/permissoes;
- inventario e sessoes de contagem;
- consolidacao de inventario;
- requisicoes;
- entrada de producao;
- suprimentos entre estoques;
- compras e suprimentos de compras;
- importacao de vendas;
- cadastros de produtos, fichas tecnicas e centros de estoque;
- auditoria/logs do painel master.

Para qualquer mudanca nesses fluxos:

1. Identifique o comportamento atual antes de alterar.
2. Confirme a causa raiz no codigo ou nos dados.
3. Preserve compatibilidade com dados existentes.
4. Garanta que estado salvo no banco nao sera apagado, sobrescrito ou escondido por fallback local.
5. Nao troque uma regra operacional por uma inferencia visual.
6. Registre no `docs/WORKLOG.md` causa, ajuste, validacao e pendencias.

## Smoke tests obrigatorios

Antes de publicar alteracoes que toquem inventario/contagem, validar no minimo:

1. abrir ou selecionar inventario aberto;
2. iniciar ou continuar contagem;
3. registrar item contado;
4. sair e voltar para a contagem;
5. confirmar que a contagem aparece na lista/resumo;
6. confirmar que a sessao de outro usuario nao e descartada;
7. confirmar que rotas protegidas seguem exigindo autenticacao.

Antes de publicar alteracoes em compras/requisicoes/producao/suprimentos, validar o fluxo operacional afetado de ponta a ponta ou declarar exatamente o que nao foi possivel validar.

## Validacoes minimas antes de deploy

Rodar e relatar:

- `npx tsc -p tsconfig.app.json --noEmit --pretty false`
- `node --check server/server.js`
- `git diff --check`
- `npx vite build`

Se qualquer validacao falhar, nao publicar.

## Deploy

- Commits devem conter apenas arquivos relacionados ao ajuste atual.
- Nao misturar auditorias, backups, scripts soltos ou artefatos locais antigos.
- Depois do push, confirmar qual bundle esta rodando online.
- Quando houver hardening de autenticacao, conferir que rotas sensiveis sem token retornam `401`.

## Dados e seguranca operacional

- Em dados reais, nunca inventar IDs internos.
- Quando o webapp define ID automatico, usar o gerador do webapp/API.
- Nao confiar em `/api/state` como fonte principal quando endpoints por entidade existirem.
- Em inventario/contagem, o banco online e a fonte de verdade; `localStorage` e apenas apoio/fallback.
- Nunca apagar, reabrir, consolidar ou cancelar registros operacionais sem confirmar escopo de empresa, centro e data.
