# Worklog

 Ultima atualizacao: 2026-08-16

## Objetivo deste arquivo

Registrar um historico resumido do que foi feito, do que falhou e do que ficou pendente.

## 2026-08-16

### Contagem de inventario nao deve perder sessao ativa apos pausa/reload

- Investigado caso real `CASA DE MI MADRE LTDA`: `INV-0007` e `CON-0008` existem na API, estao abertos e sem itens registrados.
- Causa encontrada no frontend:
  - ao carregar/retomar a tela, os efeitos de vinculo ativo podiam persistir `inventoryId: null` e `sessionId: null` antes de a API terminar de hidratar inventarios/sessoes;
  - a validacao de sessao selecionada podia limpar a contagem restaurada antes de o inventario correspondente ser selecionado a partir da propria sessao.
- Ajustes aplicados:
  - criada trava de hidratacao especifica para dados remotos de inventario;
  - restauracao explicita de sessao ativa pelo link salvo em `inventory-active-session-links`;
  - preservacao de vinculo ativo valido enquanto inventario/contagem abertos ainda estao sendo restaurados;
  - item novo de contagem busca o proximo ID atual em `/api/inventory-counts` antes de salvar, reduzindo risco de ID local obsoleto;
  - backend passou a rejeitar sobrescrita de item de contagem quando o ID ja pertence a outro inventario/sessao/empresa.

### Copia de ficha tecnica preserva vinculos compartilhados

- Corrigida copia de ficha tecnica para preencher `Empresas vinculadas` com a mesma superficie de visibilidade da ficha original, filtrando apenas empresas invalidas para a empresa destino da copia.
- IDs internos e `ID empresa` continuam nao sendo copiados; a ficha copiada segue como cadastro novo e usa o fluxo normal de geracao/persistencia.
- No fluxo de copia direta para empresa vinculada, as dependencias tecnicas passam a ser verificadas para todos os destinos que a copia herdara.

### Perfis de acesso compartilhados entre empresas vinculadas

- Implementada visibilidade de `Perfis de acesso` pelo mesmo grafo de empresas vinculadas usado pelo catalogo compartilhado.
- Atribuicao de usuario passa a aceitar perfil cadastrado em empresa vinculada, desde que o usuario tenha `membership` ativo na empresa onde acessara o sistema.
- Perfil compartilhado nao concede acesso a empresa de origem nem a outras empresas; o escopo de dados/paineis continua vindo dos vinculos do usuario.
- A lista de perfis deduplica nomes no escopo vinculado e indica quando o cadastro pertence a outra empresa.
- Edicao, inativacao e exclusao de perfil compartilhado ficam restritas a empresa de origem do perfil.
- Permissoes de estoque associadas ao formulario do perfil sao sincronizadas para empresas vinculadas, mantendo o mesmo conjunto de permissoes quando o perfil compartilhado e atribuido em uma empresa vinculada.
- API `GET /api/access-profiles?companyId=...` passou a retornar perfis no escopo de empresas vinculadas, mantendo `GET /api/access-profiles` sem filtro como leitura completa.
- Pendente operacional desta rodada: apos deploy, consolidar duplicatas de nome entre `COMPLEXO VILA ANALIA` e empresas vinculadas, remapeando usuarios para o perfil da origem antes de excluir duplicatas.

## 2026-08-10

### Compras ignora requisicoes nao enviadas ou canceladas por planejamento

- Corrigido consolidado do painel `Compras`:
  - falta de suprimento interno entra apenas por requisicao `SENT_TO_SUPPLIES` aprovada e enviada;
  - compra direta entra apenas quando a requisicao ja foi enviada e esta `READY_TO_RECEIVE`;
  - requisicao apenas `APPROVED`, ainda nao enviada, nao alimenta a lista de compras.
- Requisicao vinculada a planejamento por ficha so entra em `Compras` se o `planningRootRequestId` ainda tiver origem ativa na fila de producao ou em producao em andamento.
- Cancelamento de planejamento por ficha e impacto de inativacao/exclusao de ficha passaram a cancelar tambem compras diretas `READY_TO_RECEIVE` ainda sem recebimento.
- `READY_TO_RECEIVE` de suprimento interno continua preservada, pois pode ter baixa de estoque do centro fornecedor.
- Validacao na API publicada de `CASA DE MI MADRE LTDA` encontrou `11` requisicoes `SENT_TO_SUPPLIES` antigas com origem de planejamento inexistente; pela nova regra elas deixam de alimentar o painel `Compras`.
- Botao `Cancelar` em `Suprimentos` passou a marcar requisicao `SENT_TO_SUPPLIES` como `CANCELLED` e persistir imediatamente na API. Antes ele devolvia para `PENDING_APPROVAL`, o que podia reativar requisicoes ja canceladas.
- Botao `Cancelar` na lista de `Requisicoes` passou a funcionar para requisicoes em `SENT_TO_SUPPLIES`, persistindo `CANCELLED` no servidor antes de atualizar a tela.
- Backend passou a bloquear reativacao de requisicao ja `CANCELLED`; clientes antigos/cache local recebem erro ao tentar salvar novamente a mesma requisicao como ativa.
- Painel `Compras`: removida restauracao de inventario operacional a partir de `localStorage` quando o servidor nao possui inventario. Contagens/sessoes/movimentos de inventario devem vir do banco; cache local antigo nao pode zerar falta de compras.
- Corrigida dependencia indevida de `Compras` em `manualProductionRequests`: requisicoes aprovadas e enviadas devem alimentar compras mesmo que a fila de producao ainda nao tenha sido carregada no frontend. Cancelamento de planejamento continua sendo responsavel por marcar as requisicoes derivadas como `CANCELLED`.
- Corrigida exibicao de volumes em `Compras` para requisicoes antigas com unidade de pedido `EMBALAGENS` e `packageId` vazio: o consolidado infere a embalagem ativa unica ou a embalagem indicada pelo rotulo da linha, calcula a base internamente e exibe a referencia em coluna `Embalagem`, deixando `Estoque atual`, `Demanda interna` e `Comprar` apenas com a quantidade, sem sufixo.

### Copia de produto avulso

- Adicionado icone de copiar na lista de `Produtos`.
- Produto avulso copiado abre como novo cadastro pre-preenchido, com nome sugerido `COPIA`, sem herdar `technicalSheetId`.
- `ID empresa` do produto e codigo interno opcional das embalagens ficam vazios na copia para evitar duplicar codigos operacionais manuais.
- IDs internos de produto novo passam a consumir o retorno persistido pela API; no `POST /api/products`, produto avulso segue podendo enviar `id` vazio para o servidor alocar `PRD-...`.
- Embalagens copiadas recebem novos IDs internos locais e os codigos de referencia sao reindexados dentro de cada embalagem.
- Quando a linha da lista for produto vinculado a ficha tecnica, o icone reaproveita o fluxo existente de copiar ficha tecnica.

### ID de produto avulso no servidor

- Ajustado `POST /api/products` para aceitar `id` vazio em produto avulso e alocar `PRD-...` no backend.
- Mantida a regra de ficha tecnica: produto vinculado a ficha continua usando o `productId` gerado pela ficha tecnica no servidor.
- Validacao executada: `npm run build:server` e `git diff --check`.

### Subproduto em producao de PREPARO

- Implementado fluxo minimo para subproduto de pre-preparo:
  - rascunho de producao ganhou campo persistido `byproductYield`;
  - o modal de `Entrada de producoes` exibe o subproduto vinculado e permite informar a quantidade real gerada;
  - ao confirmar a producao, o sistema registra a entrada do preparo principal e uma segunda entrada de estoque para o subproduto na mesma movimentacao;
  - se o centro produtor estiver com inventario aberto, preparo principal e subproduto ficam juntos como movimentacao pendente;
  - a fila de producao passou a resolver dependencias por subproduto, apontando para a ficha geradora;
  - a demanda por subproduto nao e abatida pelo estoque do preparo principal.
- Criada migration `20260810_production_draft_byproduct_yield` para persistir `byproductYield` em `AppProductionDraftRecord`.
- Ajustes de tipagem que bloqueavam `tsc`:
  - desestruturacao de `Map` no impacto de ficha tecnica;
  - anotacao explicita de `RequisitionRecord[]` em cancelamentos de planejamento/ficha.
- Planilha Madre atualizada:
  - `/home/leomassoni/Documentos/Igarapé/Projetos/Madre/Receitas/_nova_carta_marco_2026/Planilhas de apoio/Consolidacao_cadastro_webapp_autorais_Madre_2026-08-09_PDF_BASE.xlsx`;
  - adicionadas fichas `BAGACO DE TOMATE DO CORDIAL` e `POLPA RESIDUAL DE ABACAXI DO SHRUB`;
  - `TELHA CROCANTE DE TAPIOCA E TOMATE` e `BALA DE ABACAXI` deixaram de ser pendencias bloqueantes.
- Validacao executada:
  - `npm --prefix server run prisma:generate`;
  - `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/vite build`;
  - `git diff --check`;
  - boot local em `http://localhost:5174/` via Playwright ate a tela de login;
  - validacao da planilha confirmou `0` pendencias de produtos, pre-preparos e execucao.
- Observacao:
  - `npm run build`/`tsc -b` completo continuou muito lento no repo e foi interrompido apos varios minutos;
  - `eslint src/App.tsx src/types/domain.ts` estourou heap de Node neste arquivo grande.
  - a validacao local nao atravessou login/fluxo operacional porque o banco local esta sem a tabela `AppCatalogSharingSaleFeeRecord`; o erro e anterior a esta implementacao.

## 2026-08-10

### Painel inicial de compras

- Implementado painel `Compras` dentro do grupo `Estoque`.
- Regras aplicadas:
  - acesso controlado por permissao propria `Compras`;
  - perfis `Administrativo` e `Gestor` recebem acesso por padrao; `Colaborador` nao recebe acesso por padrao;
  - requisicoes de `SUPRIMENTOS` pendentes geram demanda de compra para o centro distribuidor quando o estoque dele nao cobre a demanda interna;
  - linhas `COMPRAS` diretas aprovadas ou prontas para recebimento tambem aparecem por compatibilidade;
  - o consolidado agrupa por centro a abastecer, produto, familia e subfamilia.
- Entregas:
  - busca no painel;
  - resumo de itens, centros e familias;
  - exportacao XLSX e PDF do consolidado visivel.
- Validacao:
  - `npx vite build`;
  - leitura da API publicada de `CASA DE MI MADRE LTDA` confirmou que nao havia requisicoes abertas de suprimento/compra no momento, portanto o painel atual fica vazio sem falso positivo.
- Observacao:
  - `npx tsc -b --pretty false` voltou a travar sem emitir erro e foi interrompido.

### Cancelamento de origem por ficha reaparecendo

- Causa confirmada em API:
  - o `Planejamento #11` (`AURALIA`, empresa `CASA DE MI MADRE LTDA`) estava com a requisicao vinculada ja em `CANCELLED`, mas as `5` solicitacoes manuais do `rootRequestId=11` ainda existiam em `manual-production-requests`;
  - isso explica a origem reaparecer depois do refresh: a tela estava lendo corretamente o backend, mas o backend ainda tinha as producoes pendentes.
- Ajustes aplicados:
  - `deleteManualProductionRequestsByRootOnApi` agora retorna `deletedCount`;
  - o cancelamento por ficha so exibe sucesso se `deletedCount > 0`;
  - o refresh de producoes passou a comparar o retorno da API contra o estado atual do `setState`, evitando comparacao com estado fechado antigo.

### Entrada de producoes: cancelamento, duplicacao e lista operacional

- Corrigida nova fragilidade no fluxo de `Entrada de producoes`.
- Causas encontradas:
  - producoes manuais e rascunhos ainda podiam ser restaurados do `localStorage` quando a API retornava vazio, o que poderia ressuscitar registros cancelados em navegadores antigos;
  - a confirmacao de nova entrada nao tinha trava contra duplo clique e atualizava a tela antes da confirmacao da API;
  - o calculo de dependencias podia criar uma producao dependente da propria ficha quando havia referencia circular/autorreferente na composicao.
  - producoes diretas e dependentes eram mescladas com chaves diferentes (`ROOT`/`DEPENDENCY`), entao a mesma ficha podia aparecer duas vezes no mesmo planejamento.
- Ajustes aplicados:
  - `manualProductionRequests` e `productionInProgressDrafts` passaram a iniciar vazios e carregar a fila pela API por entidade;
  - essas producoes sairam do snapshot global sincronizado por navegador;
  - a confirmacao de nova entrada grava as solicitacoes na API antes de atualizar a tela, trava reenvio e atualiza o mapa de sincronizacao apos sucesso;
  - dependencias circulares/autorreferentes sao ignoradas no gerador de planejamento;
  - entradas de producao do mesmo centro/ficha agora sao mescladas em uma unica linha, somando quantidades e preservando `isDependencyRequest=false` quando houver demanda direta;
  - `Cancelar planejamento` recarrega producoes/requisicoes da API apos a persistencia do cancelamento;
  - `Cancelar planejamento` tambem ganhou uma rota de backend por `companyId/rootRequestId`, evitando depender da lista local para descobrir quais producoes apagar;
  - a fila principal e os planejamentos por ficha foram padronizados como tabela `product-table`, no mesmo padrao visual das listas de produtos/fichas, com acao no fim da linha.
- Validacao executada:
  - `npm run build`;
  - leitura da API publicada confirmou solicitacoes manuais sem IDs duplicados;
  - foi feito backup dos registros em `backups/production-planning-fix-20260810-131026`;
  - saneamento aplicado nos roots antigos `19` e `25`: removidos apenas os registros duplicados `23` e `30`, somando suas quantidades nos registros mantidos `19` e `27`;
  - leitura final da API publicada confirmou `37` solicitacoes manuais, sem duplicatas logicas por centro/ficha dentro do mesmo planejamento.
- Observacao:
  - validacao visual local completa foi bloqueada pelo banco local inconsistente: `migrate deploy` esta travado pela migration antiga `20260618_execution_planning_tracking` e `db push` exigiria reset por coluna obrigatoria em dados legados. O build de frontend passou.

### Entrada de producoes: origem por ficha deve ser uma linha por entrada

- Causa encontrada:
  - `Origens criadas por ficha de execucao` ainda era montada filtrando producoes diretas (`!isDependencyRequest && parentRequestId === null`) e renderizando cada registro tecnico como uma origem;
  - quando uma unica entrada do usuario gerava mais de uma producao direta, a tela repetia o mesmo `Planejamento #`, como aconteceu com `Planejamento #4`.
- Ajustes aplicados:
  - a lista de origens passou a agrupar `manualProductionRequests` por `rootRequestId`;
  - cada `rootRequestId` vira uma unica linha cancelavel, enquanto a coluna `Producoes` mostra quantas solicitacoes tecnicas ainda pertencem ao planejamento;
  - ao iniciar uma producao planejada, a solicitacao tecnica correspondente agora e removida explicitamente da API antes da atualizacao local;
  - o botao `Produzir` da fila operacional recebeu o icone `▶`.
- Validacao executada:
  - `npx vite build`;
  - leitura da API publicada de `CASA DE MI MADRE LTDA` confirmou roots de execucao com varios registros tecnicos sob uma unica origem esperada, por exemplo `AURALIA` com `5` registros e `NOCTILIA` com `2`.
- Observacao:
  - `npx tsc -b --pretty false` ficou travado sem emitir erro e foi interrompido; a validacao de build executada nesta rodada foi pelo Vite.

## 2026-08-09

### Impacto e cancelamento em Entrada de producoes

- Corrigido o cancelamento de producoes/planejamentos criados pela `Entrada de producoes`.
- Causa encontrada:
  - a fila agrupava producoes por `rootRequestId`, mas o cancelamento por linha usava o `id` da solicitacao manual como se ele fosse sempre o proprio root;
  - em planejamentos com varias producoes, uma linha podia ter `id` diferente do `rootRequestId`, entao o aviso aparecia como cancelado mas o grupo continuava na fila;
  - o cancelamento tambem dependia apenas do efeito posterior de sincronizacao, abrindo janela para polling recarregar registros antigos do servidor.
- Ajuste aplicado:
  - o cancelamento por linha agora resolve o `rootRequestId` real antes de remover o grupo;
  - `Cancelar producao` e `Cancelar planejamento` persistem deletes/updates na API durante a confirmacao e atualizam os mapas de sincronizacao local para evitar reentrada por polling;
  - requisicoes/suprimentos vinculados a planejamentos sao marcados como `CANCELLED` quando ainda estao em estado reversivel.
- A inativacao/exclusao de ficha tecnica passou a avisar impactos ligados a `Entrada de producoes`:
  - planejamentos pendentes afetados;
  - requisicoes/suprimentos vinculados que serao cancelados ou que ja avancaram e permanecerao ativos;
  - producoes em andamento, que bloqueiam a inativacao/exclusao ate serem finalizadas.
- Validacao executada:
  - `./node_modules/.bin/vite build`;
  - `./node_modules/.bin/eslint src/types/domain.ts`;
  - `git diff --check`;
  - leitura da API publicada de `CASA DE MI MADRE LTDA` confirmou grupo `rootRequestId=47` com IDs `[49, 47, 48]`: antes, cancelar pela linha `49` deixaria `3` solicitacoes; com a nova regra, deixa `0`;
  - a mesma leitura confirmou que a ficha `TELLURIA` impacta `1` planejamento, `3` solicitacoes de producao e `1` requisicao cancelavel.
- Observacao: `tsc` completo e `eslint src/App.tsx` excederam 180s sem emitir erro nesta execucao.

## 2026-08-06

### Exibicao de acrescimo em PREPARO compartilhado

- Implementada exibicao do `Acrescimo de compartilhamento` quando a taxa de venda entre empresas altera o custo de um `PREPARO` compartilhado.
- A informacao mostra:
  - percentual configurado;
  - valor acrescido em reais;
  - empresa de origem e empresa de destino.
- Pontos atualizados:
  - resumo tecnico do cadastro de ficha de `PREPARO`;
  - `Dados tecnicos` do receituario de pre-preparo;
  - exportacao XLSX de receituarios de pre-preparo;
  - `Dados tecnicos` da entrada de producao.
- A informacao do receituario entrou no controle de visibilidade dos perfis de acesso como `Acrescimo de compartilhamento`.
- Validacao executada:
  - `./node_modules/.bin/vite build`;
  - `./node_modules/.bin/eslint src/domain/technicalSheets.ts src/types/domain.ts`;
  - `git diff --check`;
  - leitura da API publicada confirmou `BATIDA PEQUI PRE-BATCHED`: origem `COMPLEXO VILA ANALIA`, destino `BOTECO MACAXEIRA`, taxa `30%`, custo base `R$ 12,73`, acrescimo `R$ 3,82`, custo final `R$ 16,54`.
- Observacao: `tsc` completo e `eslint src/App.tsx` ficaram lentos/travados nesta execucao e foram interrompidos; o build Vite completou com sucesso.

## 2026-08-05

### Confirmado / implementado desde a ultima atualizacao

- Cadastro e compartilhamento por empresas vinculadas foram reforcados no codigo publicado:
  - produtos e fichas passaram a respeitar melhor o escopo da empresa ativa e das empresas vinculadas;
  - utensilios/recipientes tambem passaram a ser compartilhados entre empresas vinculadas;
  - a lista de fichas passou a retornar fichas criadas na empresa e fichas compartilhadas visiveis para a empresa consultada.
- IDs internos de fichas tecnicas passaram a ser gerados no servidor, com trava de criacao, para reduzir risco de colisao entre usuarios e evitar scripts/importacoes escolhendo IDs manualmente.
- O campo `ID empresa` de ficha tecnica passou a ser contextual por empresa:
  - e preenchido manualmente pelo usuario;
  - e opcional;
  - nao deve ser propagado automaticamente para empresas vinculadas;
  - o mapa contextual e usado em previas e retornos da API.
- O cadastro de ficha tecnica foi protegido contra transformacao indevida em produto orfao:
  - produtos orfaos de fichas tecnicas foram bloqueados;
  - cadastros vinculados de ficha passaram a ter geracao segura de produto/ficha pelo servidor.
- Receituarios e modo de preparo foram ajustados para exibicao operacional:
  - `quantidade operacional` tem prioridade de exibicao;
  - se ela nao existir, usa `manipulado`;
  - se nenhum dos dois existir, usa `entrada`;
  - guarnicoes entram no matching do receituario.
- Foi adicionada taxa de venda para pre-preparos compartilhados em configuracao de compartilhamento.
- Corrigida a regra da taxa de venda de pre-preparos compartilhados:
  - a taxa passou a ser aplicada somente no `PREPARO` que e item direto de compartilhamento para a empresa destino;
  - dependencias internas desse pre-preparo passaram a calcular custo base, sem taxa recursiva;
  - validacao com dados publicados: `BATIDA PEQUI PRE-BATCHED` em `COMPLEXO VILA ANALIA` custa `R$ 12,73`; no `BOTECO MACAXEIRA`, com taxa de `30%`, custa `R$ 16,54`.
- Foram aplicadas correcoes de cache/local state relacionadas ao acesso a fichas em navegadores diferentes.
- Foi feita a consolidacao das fichas de venda de doses de cachacas Macaxeira:
  - 21 fichas finais `DS ... 50ML` ficaram criadas na empresa 5 e compartilhadas com empresas 8 e 9;
  - 42 duplicatas de fichas/produtos criadas por empresa foram removidas;
  - a planilha `/home/leomassoni/Documentos/Igarapé/Projetos/CPXVA/doses_cachacas_macaxeira_2026_extraido.xlsx` foi atualizada com os IDs finais e resultado da consolidacao;
  - as 3 linhas de `CARACUIPE OURO CARVALHO FRANCES` permanecem como `NAO CADASTRAR`.

### Corrigido nesta rodada

- Corrigida a prioridade da `Entrada de producoes` quando a fila contem fichas vindas de pedido manual ou planejamento por ficha que nao estavam em `producedTechnicalSheetIds` do centro.
- Causa encontrada:
  - a fila exibia essas fichas porque havia pedido manual/rascunho;
  - mas o grafo de prioridade era montado apenas com as fichas cadastradas como produzidas pelo centro;
  - com isso, dependencias reais da fila podiam aparecer com prioridade `0` e a ordenacao caia para ordem alfabetica dentro do grupo.
- Ajuste aplicado:
  - `buildPreparationDemandContext` agora aceita IDs adicionais da propria fila;
  - `Entrada de producoes` passa os IDs de pedidos manuais e rascunhos do centro selecionado para o grafo de demanda;
  - a regra de prioridade por dependencias foi preservada.
- Validacao executada:
  - `npm run build`;
  - comparacao de dados da API publicada mostrou que, no Laboratorio da empresa 13, 14 fichas que antes ficavam mascaradas como prioridade `0` passam a receber prioridade `1` ou `2` quando a propria fila entra no grafo.
- Apos validacao em navegador real, foi feito ajuste adicional:
  - `Entrada de producoes` tambem passou a carregar requisicoes, pois o calculo desconta demandas ja enviadas ao produtor;
  - a tabela recebeu resumo de quantidade total e distribuicao por prioridade para evitar que a virtualizacao esconda visualmente as etapas seguintes;
  - validacao local com dados publicados confirmou, em `COMPLEXO VILA ANALIA > LABORATORIO`, 53 producoes na fila e distribuicao `0: 30; 1: 14; 2: 8; 3: 1`;
  - buscando `ASIA`, a tela mostra `ASIA CLARIFICACAO` com prioridade `1` e `PRE-BATCHED ASIA` com prioridade `2`.
- Apos revisao da exigencia operacional, a `Entrada de producoes` deixou de virtualizar linhas e passou a usar paginacao explicita de 20 producoes por pagina, com navegacao por setas e numeros acima e abaixo da tabela. A ordenacao por prioridade, filtros, resumo e acoes existentes foram mantidos.
- Validacao desktop/mobile em navegador real com dados publicados:
  - `COMPLEXO VILA ANALIA > LABORATORIO` exibe 53 producoes, distribuicao `0: 30; 1: 14; 2: 8; 3: 1`, pagina 1 com 20 linhas, pagina 2 com 20 linhas e pagina 3 com 13 linhas;
  - no mobile, a navegacao de paginas fica responsiva, sem overflow horizontal da pagina;
  - buscando `ASIA`, a tela mostra `ASIA CLARIFICACAO` e `PRE-BATCHED ASIA`, com prioridades `1` e `2`.

### Pendencias / cuidados

- O banco local estava com historico de migracoes inconsistente e nao foi resetado. A validacao operacional foi feita por leitura na API publicada.
- Sempre que scripts fizerem cadastros, eles nao devem escolher `id` interno de produto/ficha. O ID interno deve vir da API/webapp.
- `ID empresa` deve continuar sendo dado operacional/manual do cliente, por empresa, e nao um valor gerado ou propagado por script.

## 2026-05-13

### Confirmado / implementado

- Reconstituido o contexto recente do projeto a partir do estado atual dos arquivos.
- Ajustado o editor de `modo de preparo` para evitar salto do cursor para o fim do texto.
- Restaurado comportamento de texto em maiusculas no editor.
- Corrigido problema de espaco no meio do texto que produzia efeito semelhante a seta para a direita.
- Restaurada e melhorada a busca com sugestao/autocomplete baseada nos produtos da ficha tecnica atual.
- Adicionada exibicao de valores de entrada dos insumos dentro dos textos de execucao no painel de receitas.
- Ajustadas exibicoes de `Dados tecnicos` nos receituarios conforme definicoes recentes.
- Removidas informacoes de custo das tabelas de composicao de insumos nos receituarios.
- Reorganizada a sidebar, com `Receituarios` acima de `Cadastros`.
- Criado o painel `Configuracoes` dentro de `Cadastros`, com abas por tipo de ficha tecnica.
- Aplicadas regras de exibicao e obrigatoriedade das configuracoes nos formularios de ficha tecnica.
- Reorganizado o painel de permissoes de perfis de acesso para refletir a sidebar.
- Agrupadas permissoes de `Cadastros` e seus filhos no cadastro de perfil.
- Refatorado `PREPARO` para compartilhamento de blocos entre formulario principal e modal aninhado.
- Ajustado o tipo de `pendingNestedTechnicalSheetKind` para refletir o fluxo real: apenas `PREPARO`.
- Criada a pasta `docs/` com arquivos de acompanhamento.

### Problemas encontrados no caminho

- O editor de `modo de preparo` teve regressao ao corrigir o cursor:
  - uma versao voltou a ser sensivel a caixa em pontos indevidos
  - outra gerou problema com espacos no meio do texto
- Foi necessario iterar ate estabilizar cursor, maiusculas e autocomplete ao mesmo tempo.

### Confirmacoes importantes

- Existe modal aninhado de ficha tecnica apenas para `PREPARO`.
- Nao existe hoje modal aninhado equivalente para `EXECUCAO` ou `VENDA`.

### Pendencias abertas

- Decidir se `EXECUCAO` e `VENDA` precisam ou nao de fluxo aninhado real.
- Continuar modularizacao de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx).
- Passar a registrar novas alteracoes nestes arquivos `docs/`.
- Definir a regra de prioridade/desempate quando um mesmo `PREPARO` tiver mais de um centro produtor possivel para envio de requisicao.

## 2026-05-19

### Pendencias abertas

- Depois da ultima atualizacao, houve relato de tela em branco ao salvar centro produtor; o comportamento precisa ser reproduzido e corrigido diretamente na interface.
- Os `PREPARO` continuam nao aparecendo corretamente como opcao para incluir como producao de um centro de estoque marcado como `PRODUTOR`, mesmo apos ajustes de filtro no codigo.
- O modulo `Estoque` ainda nao possui integracao com relatorios de venda / PDV externo; isso ficou marcado para avaliacao futura.
- Foi levantada a necessidade futura de um construtor de relatorios customizados para o usuario final, em uma linha de "Power BI facil" interno.

## 2026-05-26

### Confirmado / implementado

- Projeto preparado para GitHub com repositorio proprio.
- Projeto preparado para deploy no Render com `render.yaml`.
- Backend Prisma ajustado para PostgreSQL.
- Migration inicial do schema atual do backend criada e validada localmente.
- Deploy no Render concluido com sucesso.

### Melhorias futuras registradas

- Logs do Render confirmaram que o bundle principal do frontend continua grande.
- Isso nao bloqueou o deploy, mas ficou registrado como melhoria futura de performance.
- Direcoes anotadas:
  - code splitting com `dynamic import()`
  - modularizacao maior de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx)
  - avaliacao de `manualChunks` no build

## 2026-06-02

### Confirmado / implementado

- A migracao hibrida para persistencia por entidade avancou ate:
  - `Empresas`
  - `Usuarios`
  - `Perfis de acesso`
  - `Permissoes de estoque por perfil`
  - `Centros de estoque`
  - `Produtos`
  - `Itens`
  - `Fichas tecnicas`
- `Centros de estoque` passaram a ter persistencia propria no backend e sincronizacao bidirecional com `Fichas tecnicas` de `PREPARO`.

### Onde a migracao parou

- Os modulos operacionais de estoque ainda nao foram migrados para leitura/gravação transacional por entidade.
- O sistema ainda depende do `snapshot` global para:
  - `Requisicoes`
  - `Suprimentos`
  - `Recebimentos`
  - `Producoes`
  - `Inventarios`
  - `Movimentacoes`
  - estados auxiliares e rascunhos operacionais

### Pendencias registradas

- Montar um plano de migracao `Render DB -> Neon` e `imagens -> Cloudflare R2` sem quebrar o ambiente online.
- Medir o que mais consome storage hoje no ambiente publicado.
- Tirar imagens do banco/snapshot e guardar apenas URL.
- Revisar consultas pesadas para listagens e relatorios com:
  - paginacao
  - filtros no servidor
  - selecao de colunas necessarias

## 2026-06-03

### Confirmado / decidido

- O plano de compartilhamento por `grupo + produto mestre + liberacao por empresa` foi abandonado antes da implementacao.
- Foi definido um modelo mais simples de compartilhamento entre `empresas vinculadas`.
- Regra escolhida:
  - o master vincula empresas entre si no painel `Empresa`
  - `Produtos` e `Fichas tecnicas` passam a ter empresa de origem + empresas compartilhadas
  - o cadastro em cascata da ficha continua existindo
  - quando o usuario criar um produto pela ficha, ele nasce na empresa atual e pode ser compartilhado com empresas vinculadas
  - se o cadastro ja existir em empresa vinculada, o sistema deve oferecer reutilizar/habilitar em vez de duplicar
  - `PREPARO` compartilhado pode ter centros produtores configurados por empresa compartilhada
- A segregacao operacional continua por empresa:
  - estoque
  - inventario
  - requisicao
  - suprimento
  - recebimento
  - producao

### Nova modelagem planejada para usuario multiempresa

- Foi definida a necessidade de evoluir o usuario multiempresa para `membership por empresa`.
- Direcao escolhida:
  - manter `login unico`
  - continuar com escolha de empresa apos login e `Trocar empresa`
  - mover `perfil de acesso` e `setores` para um vinculo por empresa
- Estrutura alvo registrada:
  - `UserCompanyMembership`
  - campos principais:
    - `userId`
    - `companyId`
    - `accessProfileId`
    - `sectors`
    - `isActive`
    - opcionais `defaultAfterLogin` e `lastAccessedAt`
- Motivo:
  - hoje perfis e setores podem divergir legitimamente entre empresas vinculadas
  - espelhamento automatico de perfil/setor resolve o curto prazo, mas nao o modelo estrutural

### Pendencia aberta

- Transformar essa modelagem simplificada em implementacao no codigo, incluindo:
  - vinculacao entre empresas
  - compartilhamento de `Produtos`
  - compartilhamento de `Fichas tecnicas`
  - comportamento dos pop-ups de cadastro em cascata
  - configuracao de centros produtores por empresa em fichas `PREPARO` compartilhadas
- Registrar como refinamento futuro do modulo `Importar vendas` a possibilidade de `acoes em lote` no historico, sem tratar isso como prioridade imediata.

## 2026-06-30

### Confirmado / implementado

- O fluxo de importacao de vendas foi consolidado para usar o historico persistido de `sales-consumptions` como fonte principal quando as linhas `MATCHED` nao estiverem disponiveis.
- O minimo do centro consumidor foi separado do consolidado operacional usado por centros produtores.
- `Entrada de producoes`, `Requisicoes`, `Suprimentos` e `Recebimentos` foram ajustados para operar sobre a cadeia correta de centro consumidor, centro produtor e dependencias.
- `Desperdicio` foi separado estruturalmente de inventario e contagem:
  - `wasteSessions`
  - `wasteRecords`
- Foi criado o relatorio de desperdicio consolidado e o relatorio de lancamentos de desperdicio.
- Foi criado o fluxo de `Producao por ficha`, com rastreio da origem e cancelamento de planejamentos ainda reversiveis.
- A lista de fichas tecnicas recebeu melhorias de leitura e operacao:
  - coluna `Tipo`
  - coluna `Custo por rendimento`
  - coluna `Valor final`
  - coluna `Empresas vinculadas`
  - movimentacao livre de colunas
- A exportacao de fichas tecnicas passou a nomear arquivos por ficha ou empresa ativa, com data.
- Seletores de ficha tecnica em exportacao, nova producao e producao por ficha passaram a pesquisar ao digitar.
- Foi criada a tag `safe-before-apptsx-split` para marcar o ultimo ponto seguro antes da separacao inicial de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx).

### Performance

- Foram aplicadas melhorias de baixo risco:
  - evitar `setState` redundante em refreshes
  - pausar polling com aba oculta
  - restringir polling por secao ativa
  - lazy load de dependencias pesadas de PDF, XLSX e editor
  - virtualizacao de tabelas grandes em imports, relatorios, requisicoes, suprimentos, recebimento e entrada de producoes
  - separacao de `react`, `react-dom` e `scheduler` em `react-vendor` via `manualChunks`
- O build ainda mostra chunk principal grande, mas menor e com parte das dependencias pesadas separadas.
  - Antes do `manualChunks`: `index` com aproximadamente 1,23 MB minificado.
  - Depois do `manualChunks`: `index` com aproximadamente 1,03 MB minificado e `react-vendor` com aproximadamente 193 kB.

### Modularizacao

- A separacao inicial de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) foi iniciada com:
  - [`src/utils/core.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/utils/core.ts)
  - [`src/components/ExecutionPlanningList.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/ExecutionPlanningList.tsx)
  - [`src/components/LazyCodeEditor.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/LazyCodeEditor.tsx)
  - [`src/components/common.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/common.tsx)
  - [`src/config/performance.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/config/performance.ts)
- Nesta rodada, foram movidos componentes genericos, helpers puros de formatacao/decimal/data/IDs e constantes de polling/virtualizacao.
- Na continuacao da modularizacao, tambem foram movidos:
  - tipos de dominio para [`src/types/domain.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/types/domain.ts)
  - chaves/helper de snapshot local para [`src/storage/localStorage.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/storage/localStorage.ts)
  - calculos puros de fichas/produtos para [`src/domain/technicalSheets.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/domain/technicalSheets.ts)
  - componente e helpers de modo de preparo para [`src/components/PreparationModeInput.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/PreparationModeInput.tsx) e [`src/utils/preparationMode.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/utils/preparationMode.ts)
- Cada subfase foi validada com `npm run build`; arquivos extraidos foram validados tambem com lint direcionado.

### Pendencias abertas

- Prioridade alta, baixo risco:
  - mitigar a importacao XLSX atual com limites de tamanho, abas, linhas, colunas e validacao estrita da estrutura esperada
  - manter checklist de validacao de boot/carregamento inicial apos mudancas de performance
- Prioridade alta, risco medio:
  - substituir a leitura de arquivos importados por alternativa mantida, preferencialmente `read-excel-file`
  - validar a migracao com imports reais antes de desativar o parser antigo
  - continuar a modularizacao de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) e o isolamento de calculos pesados em passos pequenos
- Prioridade media, risco medio:
  - revisar relatorios e listas grandes para paginacao, filtros no servidor e queries mais enxutas
  - remover completamente `xlsx` substituindo tambem as exportacoes por alternativa mantida, como `write-excel-file` ou outra biblioteca validada
  - virtualizar apenas novas tabelas grandes ou tabelas remanescentes em que a lentidao seja confirmada em uso real
  - revisar polling por secao quando novos modulos forem criados, preservando carga inicial unica dos dados essenciais

## 2026-07-16

### Modularizacao e UX de autocompletes

- Progresso registrado da modularizacao segura de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx):
  - tipos de dominio extraidos para [`src/types/domain.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/types/domain.ts)
  - helpers de storage/snapshot local extraidos para [`src/storage/localStorage.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/storage/localStorage.ts)
  - calculos puros de fichas/produtos extraidos para [`src/domain/technicalSheets.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/domain/technicalSheets.ts)
  - modo de preparo extraido para [`src/components/PreparationModeInput.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/PreparationModeInput.tsx) e [`src/utils/preparationMode.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/utils/preparationMode.ts)
- Mantido no `a fazer`:
  - extrair normalizadores de entidade em subfases menores
  - depois separar hooks/paineis por fluxo, comecando pelos modulos menos acoplados
  - validar cada subfase com `npm run build` e lint direcionado
- UX aplicada:
  - `SingleValueAutocomplete` e `MultiSelectChips` agora aceitam navegacao por teclado com `ArrowDown`, `ArrowUp`, `Enter` e `Escape`.
  - Isso atende os campos de busca ao digitar usados em cadastros de produtos, fichas e fluxos relacionados.
- Validacao executada:
  - `npx eslint src/components/common.tsx`
  - `npm run build`

## 2026-07-13

### Revisao do `a fazer`

- A lista de prioridades foi revisada contra o estado atual do codigo.
- Removida a pendencia de sync local de `waste-sessions` e `waste-records`, pois [`scripts/sync-online-api-to-local.mjs`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/scripts/sync-online-api-to-local.mjs) ja cobre esses endpoints.
- A frente de performance de baixo risco foi reclassificada como acompanhamento:
  - `setState` redundante
  - polling por aba visivel/secao ativa
  - lazy load de dependencias pesadas
  - virtualizacao de tabelas grandes principais
  - `manualChunks` conservador para dependencias estaveis do React
- Mantidas como prioridades reais:
  - mitigar/substituir `xlsx`
  - modularizar [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) e isolar calculos pesados em passos pequenos
  - medir storage antes de migracoes de infraestrutura
