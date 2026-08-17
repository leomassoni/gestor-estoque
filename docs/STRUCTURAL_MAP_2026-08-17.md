# Mapa estrutural para modularizacao do App.tsx - 2026-08-17

## Ponto seguro

- Backup completo do servidor criado em `backups/full-server-backup-20260817T215955Z`.
- Fonte do backup: `https://gestor-estoque-zqw9.onrender.com/api`.
- O online deve permanecer sem deploy durante a refatoracao.
- A entrega desta rodada deve ser testada offline e subir depois como uma unica atualizacao.

## Objetivo da rodada

Reduzir o tamanho e o custo de manutencao de `src/App.tsx` sem alterar regra operacional. A prioridade e mover blocos isolados, puros ou presentacionais, mantendo os fluxos criticos com o mesmo comportamento observavel.

## Shell atual do App.tsx

`src/App.tsx` ainda concentra:

- boot remoto e estado local;
- login, sessao e escolha de empresa;
- navegacao principal e menus de Cadastros/Estoque;
- estado global de produtos, fichas, itens, centros, inventario, requisicoes, compras, producao, importacao de vendas, relatorios, usuarios e empresa;
- polling por grupo de entidades;
- calculos derivados de estoque, minimo, compra, requisicao, producao e relatorios;
- renderizacao das telas principais.

## Secoes funcionais

### Shell e acesso

- Entradas: usuarios, empresas, perfis de acesso, sessao local.
- Grava: auth local, empresa ativa, usuarios, empresas, perfis.
- Endpoints principais: `/api/users`, `/api/companies`, `/api/access-profiles`, `/api/stock-module-settings`.
- Riscos: acesso multiempresa, permissoes efetivas por empresa, menus visiveis.

### Cadastros

- Secoes: Produtos, Itens, Fichas Tecnicas, Configuracoes.
- Entradas: produtos, itens, fichas, perfis sensoriais, configuracoes de ficha.
- Grava: produtos, itens, fichas, perfis, configuracoes.
- Endpoints principais: `/api/products`, `/api/service-items`, `/api/technical-sheets`, `/api/flavor-profiles`.
- Riscos: IDs internos, compartilhamento entre empresas, custo, fichas vinculadas.

### Receituarios

- Entradas: fichas, produtos, itens, taxas de compartilhamento.
- Grava: preferencia visual/exportacao; nao deve alterar estoque.
- Endpoints principais: `/api/technical-sheets`, `/api/products`, `/api/service-items`, `/api/catalog-sharing-sale-fees`.
- Riscos: composicao de PREPARO/EXECUCAO/VENDA, PDF/XLSX, imagem.

### Estoque - inventario

- Entradas: centros, inventarios, sessoes de contagem, contagens, locais, movimentos pendentes.
- Grava: inventarios, sessoes, contagens, links ativos, movimentos pendentes.
- Endpoints principais: `/api/inventories`, `/api/inventory-count-sessions`, `/api/inventory-counts`, `/api/inventory-active-*`, `/api/pending-inventory-movements`.
- Riscos: saldo corrente, snapshots fechados, movimentos operacionais, localStorage de rascunhos.

### Estoque - requisicoes e suprimentos

- Entradas: centros, minimos, saldos, requisicoes, notificacoes.
- Grava: requisicoes, status, recebimentos, notificacoes, movimentos de estoque.
- Endpoints principais: `/api/requisitions`, `/api/requisition-notifications`, `/api/inventory-counts`.
- Riscos: cancelamento, recebimento, suprimento parcial/maior, empresa solicitante vs empresa supridora.

### Estoque - compras

- Entradas: requisicoes aprovadas/enviadas, produtos, embalagens, saldos.
- Grava: status de requisicoes e movimentos associados quando aplicavel.
- Endpoints principais: `/api/requisitions`, `/api/products`, `/api/inventory-counts`.
- Riscos: requisicoes canceladas nao podem gerar necessidade ativa; quantidade deve aparecer em embalagem quando houver embalagem de compra.

### Estoque - producao

- Entradas: fichas PREPARO, centros produtores, requisicoes para producao, entradas manuais, rascunhos, saldos.
- Grava: entradas de producao, saidas para producao, requisicoes de dependencia, rascunhos.
- Endpoints principais: `/api/manual-production-requests`, `/api/production-drafts`, `/api/requisitions`, `/api/inventory-counts`.
- Riscos: explosao de insumos, producao entre empresas, centro produtor correto, evitar duplicacao de demanda.

### Importacao de vendas

- Entradas: templates, lotes, linhas importadas, fichas de venda/execucao, centro de estoque.
- Grava: lotes, linhas, consumos, baixas operacionais.
- Endpoints principais: `/api/sales-import-*`, `/api/sales-consumptions`, `/api/inventory-counts`.
- Riscos: match por ID empresa ou fallback por ID interno; batch cancelado deve ser auditavel e reversivel.

### Relatorios e desperdicio

- Entradas: saldos, movimentos, inventarios, desperdicios, modelos salvos.
- Grava: desperdicios e modelos de relatorio.
- Endpoints principais: `/api/waste-sessions`, `/api/waste-records`, `/api/inventory-counts`.
- Riscos: performance em listas grandes e consistencia de agregacao.

## Ordem tecnica desta rodada

1. Extrair componentes/helpers presentacionais e utilitarios puros.
2. Extrair normalizadores menos acoplados, em subfases.
3. Isolar calculos pesados em modulos de dominio, preservando assinaturas.
4. Evitar alterar sync, persistencia, endpoints ou modelo de dados nesta rodada.
5. Validar build a cada bloco relevante.

## Checklist offline obrigatorio

- Build Vite/TypeScript conclui.
- Login abre.
- Troca de empresa abre sem erro.
- Receituarios abre e lista fichas.
- Produtos abre e filtros/ordenacao continuam funcionando.
- Fichas Tecnicas abre e edicao basica carrega.
- Inventario abre saldos e historico.
- Requisicoes abre historico e rascunho.
- Suprimentos abre requisicoes enviadas.
- Compras abre demanda e grupos.
- Entrada de producoes abre fila.
- Importar vendas abre historico de lotes.
- Relatorios abre posicao de estoque.
- Refresh em uma secao protegida nao perde estado confirmado.

## Criterio de rollback

Se qualquer fluxo critico acima falhar no offline sem correcao rapida, voltar ao commit anterior a esta rodada e manter o online sem deploy.
