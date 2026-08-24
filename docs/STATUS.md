# Status do Sistema

 Ultima atualizacao: 2026-08-17

## Objetivo deste arquivo

Registrar em que pe o sistema esta hoje, por area, para consulta rapida antes de novas alteracoes.

## Situacao geral

- O projeto esta funcionalmente concentrado em um frontend React/Vite com grande parte da logica em [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx).
- O backend local existe em `server/` e hoje ja persiste varias entidades operacionais em tabelas Prisma proprias.
- O repositorio Git ja possui historico util; a tag `safe-before-apptsx-split` marca o ultimo ponto seguro antes da separacao inicial de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx).
- O projeto agora possui repositorio proprio no GitHub, `render.yaml` para deploy no Render e base Prisma preparada para PostgreSQL.
- O sistema esta em modo hibrido:
  - parte dos modulos ja grava e le por entidade no backend/Prisma;
  - parte ainda depende do snapshot global salvo em `/api/state`.
- A API publicada deve ser tratada como fonte preferencial para verificacoes operacionais de CPXVA/Macaxeira; o banco local pode estar com migracoes pendentes ou historico inconsistente.

## Migracao por entidade

### Ja migrado ou com tabela propria no backend

- `Empresas`
- `Usuarios`
- `Perfis de acesso`
- `Permissoes de estoque por perfil`
- `Centros de estoque`
- `Produtos`
- `Itens`
- `Fichas tecnicas`
- `Inventarios`
- `Contagens`
- `Movimentacoes`
- `Requisicoes`
- `Suprimentos`
- `Recebimentos`
- `Producoes`
- `Notificacoes operacionais`
- `Importacoes de vendas`
- `Consumos analiticos de vendas`
- `Desperdicio`
- `Movimentacoes pendentes`

### Importacao de vendas e simulacao Madre

- O import de vendas aceita identificador por `ID empresa` e, como fallback, por ID interno da ficha/produto de `EXECUCAO` ou `VENDA`.
- Para a simulacao de demanda da Casa de mi Madre, existe dry-run local em [`scripts/madre_demand_projection_dry_run.py`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/scripts/madre_demand_projection_dry_run.py).
- O relatorio fake final usa vendas datadas de `2026-08-12` a `2026-08-16`, com fator `0,8` sobre a projecao para compensar a margem automatica de `20%` do estoque minimo.
- Bebidas fechadas vendidas em relatorio precisam de ficha `VENDA`; na Madre ja foram criadas fichas para Coca, Coca Zero, Guarana, Guarana Zero, Corona, Agua sem gas e Agua com gas.

### Ainda sensivel ao modelo hibrido

- O snapshot global `/api/state` ainda existe e deve ser tratado como legado/compatibilidade.
- O frontend ainda mantem varios estados locais e sincroniza entidades por refresh/polling.
- Mudancas no modelo de sincronizacao continuam sendo de alto risco e devem ficar para uma etapa planejada.
- Ainda nao existe sincronizacao em tempo real entre sessoes/dispositivos. O comportamento esperado futuro e que cadastros, movimentacoes, registros e atividades gravadas no servidor sejam refletidos nas outras paginas abertas sem refresh manual, respeitando escopo de empresa/permissao. Ate la, cache/localStorage nao pode ser tratado como fonte da verdade para fluxo operacional critico.

### Ponto atual da migracao

- A fundacao por entidade ja cobre cadastros e boa parte dos fluxos operacionais.
- O proximo bloco natural nao e criar tabelas novas para esses modulos, mas reduzir dependencia de estado global no frontend, melhorar consultas e evitar cargas completas desnecessarias.
- O script [`scripts/sync-online-api-to-local.mjs`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/scripts/sync-online-api-to-local.mjs) deve ser atualizado para incluir `waste-sessions` e `waste-records`, pois o backend ja possui essas rotas.

## Cadastro de fichas tecnicas

- A escolha do tipo de ficha no formulario passou a usar abas em vez de dropdown.
- Os formularios possuem identidade visual por tipo:
  - `PREPARO`: terracota clara
  - `EXECUCAO`: dourado-palha
  - `VENDA`: salvia clara
- A lista de fichas cadastradas ja possui colunas extras como `Tipo`, `Custo por rendimento`, `Valor final` e `Empresas vinculadas`, alem de ordenacao livre de colunas.
- A API de lista de fichas com `companyId` retorna tambem fichas compartilhadas visiveis para a empresa consultada.
- O ID interno de ficha tecnica deve ser gerado pelo servidor/webapp; scripts e importacoes nao devem escolher IDs.
- `ID empresa` de ficha tecnica e contextual por empresa, opcional e preenchido manualmente pelo usuario. Ele nao deve ser propagado automaticamente para empresas vinculadas.
- Copia de ficha tecnica deve abrir/preparar cadastro novo como espelho operacional da origem, incluindo empresas vinculadas validas; IDs internos e `ID empresa` continuam zerados/gerados pelo fluxo normal.
- Quando um `PREPARO` compartilhado recebe taxa de venda entre empresas, o cadastro e os receituarios exibem o percentual, o valor acrescido e a origem/destino do acrescimo. A informacao e calculada no momento de exibicao, sem gravar custo derivado na ficha.

### PREPARO

- O formulario principal de `PREPARO` existe e esta funcional.
- O modal aninhado de `PREPARO` acionado a partir do cadastro de insumo pela ficha tecnica existe e esta funcional.
- O formulario principal e o modal aninhado de `PREPARO` agora reutilizam os mesmos blocos de UI para:
  - identificacao/base
  - composicao
  - calibracao por densidade
  - meta de PH e Brix
  - resumo tecnico
  - preparo e validade
- Isso reduz risco de divergencia futura entre formulario normal e pop-up.
- Em receituarios de `PREPARO`, o campo `Acrescimo de compartilhamento` respeita o controle de visibilidade dos perfis de acesso.

### EXECUCAO

- O formulario principal de `EXECUCAO` existe e esta funcional.
- Nao existe hoje modal aninhado de ficha tecnica para `EXECUCAO`.
- As configuracoes de exibicao e obrigatoriedade atuam no formulario principal.
- Ainda nao existe uma segunda superficie de UI de `EXECUCAO` equivalente ao modal de `PREPARO` para ser compartilhada.

### VENDA

- O formulario principal de `VENDA` existe e esta funcional.
- Nao existe hoje modal aninhado de ficha tecnica para `VENDA`.
- As configuracoes de exibicao e obrigatoriedade atuam no formulario principal.
- Fichas de `VENDA` podem ser compartilhadas entre empresas vinculadas quando fizer sentido operacional, mas cada empresa deve ter seu proprio `ID empresa` se houver codigo real de PDV para aquela empresa.

## Catalogo compartilhado

- Produtos, fichas tecnicas e utensilios/recipientes possuem regra de visibilidade por empresa de origem, empresas compartilhadas e empresas vinculadas.
- Produtos usados na composicao de ficha tecnica devem ficar restritos ao escopo da empresa da ficha e de suas empresas vinculadas, evitando que fichas puxem produtos de empresas sem vinculo.
- Fichas de `PREPARO` compartilhadas continuam podendo ter centros produtores por empresa; compartilhar cadastro nao significa compartilhar movimentacao operacional.
- Taxas de compartilhamento de `PREPARO` sao aplicadas uma unica vez na fronteira de venda do item compartilhado para a empresa destino. Dependencias internas desse pre-preparo sao calculadas pelo custo base, sem taxa recursiva.
- Para o lote Macaxeira de doses de cachacas, existem 21 fichas finais `DS ... 50ML` criadas na empresa 5 e compartilhadas com empresas 8 e 9. A planilha de controle e `/home/leomassoni/Documentos/Igarapé/Projetos/CPXVA/doses_cachacas_macaxeira_2026_extraido.xlsx`.

## Painel de configuracoes de fichas tecnicas

- Existe uma secao `Configuracoes` dentro de `Cadastros`.
- O painel separa configuracoes por abas:
  - `PREPARO`
  - `EXECUCAO`
  - `VENDA`
- Os campos aparecem agrupados por blocos, refletindo a organizacao das fichas.
- Cada campo pode ser marcado como:
  - exibido
  - obrigatorio
- As configuracoes sao persistidas localmente.

## Permissoes e perfis de acesso

- Existe controle de acesso por perfil.
- Perfis de acesso cadastrados sao visiveis para empresas vinculadas, no mesmo escopo simplificado usado pelo catalogo compartilhado.
- Perfil compartilhado funciona como modelo reutilizavel de permissoes; ele nao concede acesso a empresa de origem do perfil nem a outras empresas vinculadas. O usuario continua acessando apenas empresas onde possui vinculo ativo.
- Atribuicao de usuarios aceita perfil de empresa vinculada quando esse perfil esta no escopo da empresa do vinculo.
- A lista de perfis deduplica nomes dentro do escopo vinculado e mostra a origem quando o perfil pertence a outra empresa.
- Edicao, inativacao e exclusao de perfil compartilhado devem ser feitas na empresa de origem.
- A organizacao visual das permissoes acompanha a sidebar.
- `Cadastros` aparece como grupo com filhos:
  - `Fichas Tecnicas`
  - `Produtos`
  - `Utensilios e Recipientes`
  - `Configuracoes`
- O comportamento atual de `Cadastros` e:
  - todas as filhas desmarcadas: menu some
  - algumas filhas marcadas: acesso parcial
  - todas as filhas marcadas: acesso completo

## Editor de modo de preparo

- O problema de cursor pulando para o fim ao editar no meio do texto foi resolvido.
- O texto do editor permanece em maiusculas.
- A logica de destaque e sugestao de insumos foi restaurada e melhorada.
- O autocomplete considera os produtos cadastrados na ficha tecnica atual.

## Painel de receitas / receituarios

- O painel atualiza valores em tempo real conforme quantidade de receitas e rendimento desejado.
- Nos textos de execucao, os insumos identificados no modo de preparo exibem ao lado a quantidade operacional recalculada quando existir; se nao existir, exibem `manipulado`; se tambem nao existir, exibem `entrada`.
- O matching do modo de preparo considera insumos e guarnicoes cadastrados na ficha.
- As tabelas de composicao de insumos dos receituarios nao exibem mais dados de custo; mostram apenas entrada, rendimento e % de alcool.
- Os blocos `Dados tecnicos` foram simplificados conforme decisoes recentes.
- As dependencias pesadas de exportacao e editor foram colocadas em carregamento sob demanda.

## Estoque e operacao

- O fluxo de `Importar vendas` usa historico persistido de `sales-consumptions` como fonte principal para minimos quando as linhas importadas nao preservam `MATCHED`.
- O minimo do centro consumidor, o consolidado operacional do produtor e o minimo de uso devem permanecer conceitos separados.
- `Entrada de producoes`, `Requisicoes`, `Suprimentos` e `Recebimentos` ja passaram por ajustes para respeitar essa separacao.
- O painel `Compras` existe como visao consolidada das faltas de centros distribuidores: ele agrupa produtos que precisam ser comprados para abastecer o distribuidor antes que ele atenda requisicoes internas de suprimentos.
- Compras nao deve nascer diretamente da necessidade final de um centro produtor/consumidor quando houver centro distribuidor responsavel. A cadeia correta e: centro solicitante -> suprimento do distribuidor -> falta do distribuidor -> compras para abastecer o distribuidor -> suprimento ao solicitante.
- `Compras` deve considerar requisicoes aprovadas e enviadas como obrigacao operacional propria. Compra direta so entra no consolidado quando esta `READY_TO_RECEIVE`; requisicao apenas `APPROVED`, ainda nao enviada, nao entra.
- Requisicoes de `Compras` nao devem depender da fila de `Entrada de producoes` continuar carregada no frontend. Se um planejamento for cancelado, o cancelamento deve marcar as requisicoes derivadas como `CANCELLED`; enquanto a requisicao estiver `SENT_TO_SUPPLIES`/`READY_TO_RECEIVE`, ela deve aparecer no fluxo correspondente.
- `Compras` agora possui aba `Suprimentos` para enviar produtos comprados aos centros solicitantes. Esse envio move as quantidades escolhidas para `READY_TO_RECEIVE` sem registrar recebimento externo de fornecedor nem baixar estoque do centro distribuidor; envio parcial mantem residual pendente.
- Linhas antigas de requisicao podem ter sido salvas com `requestUnitLabel = EMBALAGENS` e `packageId` vazio. No consolidado de `Compras`, quando houver uma embalagem ativa unica ou uma embalagem que corresponda ao rotulo salvo da linha, a quantidade deve ser calculada em unidade base internamente, mas exibida para o comprador em embalagens. A referencia da embalagem aparece em coluna propria `Embalagem`; as colunas `Estoque atual`, `Demanda interna` e `Comprar` exibem apenas a quantidade.
- Em `Suprimentos`, cancelar requisicao `SENT_TO_SUPPLIES` deve gravar `CANCELLED` no servidor. O fluxo nao deve reabrir a requisicao como pendente.
- Uma requisicao ja `CANCELLED` nao pode ser reativada por sincronizacao de cliente antigo/cache local; a API deve bloquear essa sobrescrita.
- Em `Requisicoes feitas`, aprovadores podem selecionar requisicoes pendentes/aprovadas para aprovar ou enviar em lote. O envio individual e em lote deve respeitar a mesma permissao de aprovacao/envio do centro.
- A exclusao em lote de requisicoes `CANCELLED` fica restrita a usuarios que podem aprovar requisicoes dos centros correspondentes e remove apenas os registros cancelados visiveis/elegiveis.
- Novas requisicoes `PENDING_APPROVAL` geradas no mesmo dia para a mesma empresa, mesmo centro solicitante e mesmo destino operacional devem ser anexadas a uma pendente compatível, somando linhas por chave semantica. Requisicoes aprovadas, enviadas, recebidas, canceladas ou vinculadas a planejamento de producao nao devem ser consolidadas.
- Inventario operacional usado por `Compras` deve vir do banco. O navegador nao deve restaurar contagens/sessoes/movimentos locais quando o servidor estiver vazio.
- Vinculos ativos de inventario/contagem nao devem ser gravados como `null` durante a hidratacao inicial por API. A tela deve preservar inventario e sessao abertos ate que o estado remoto confirme que eles foram fechados/removidos.
- Inventario permanece separado por centro de estoque. A alternativa de inventario consolidado por empresa/data com contagens de varios centros esta registrada em `DECISIONS.md` como `a decidir`, mas nao esta implementada.
- A prioridade da `Entrada de producoes` e calculada por dependencias de producao. A camada `0` representa itens que precisam ser feitos primeiro por nao dependerem de outro preparo da mesma fila. Quando a fila contem pedidos manuais/planejamento por ficha, esses itens tambem entram no grafo para evitar que dependencias fiquem mascaradas como prioridade `0`.
- `PREPARO` com `Destino da diferenca = Subproduto` agora fecha o fluxo operacional minimo:
  - a finalizacao da producao mostra o subproduto vinculado e pede a quantidade real gerada;
  - a mesma movimentacao de `ENTRADA DE PRODUCAO` registra o preparo principal e uma entrada adicional do subproduto;
  - se houver inventario aberto, ambos entram como movimentacao pendente;
  - a fila de `Entrada de producoes` considera que fichas consumidoras do subproduto dependem da ficha geradora;
  - a demanda por subproduto nao e abatida pelo estoque atual do preparo principal, pois estoque pronto nao gera subproduto novo.
- A tela de `Entrada de producoes` carrega requisicoes junto com producoes, pois requisicoes pendentes reduzem a necessidade a produzir no centro produtor.
- A lista de `Entrada de producoes` nao deve usar virtualizacao invisivel. Ela e uma fila operacional e deve usar paginacao explicita de 20 producoes por pagina, com setas e numeros visiveis para navegar pela lista. A tela tambem exibe resumo de total e distribuicao por prioridade acima da lista.
- Cancelamentos de producao/planejamento devem remover o grupo inteiro pelo `rootRequestId` real e persistir a remocao/cancelamento na API durante a confirmacao, antes que o polling possa recarregar registros antigos.
- O cancelamento de planejamento por ficha deve apagar producoes no backend por `companyId/rootRequestId`; o frontend nao deve depender apenas de IDs derivados do estado local para remover o planejamento.
- O cancelamento de planejamento por ficha so pode exibir sucesso se a API confirmar `deletedCount > 0`; `deletedCount = 0` deve ser tratado como falha e recarregar dados, pois do contrario a origem some localmente e reaparece no refresh.
- `Origens criadas por ficha de execucao` deve exibir uma linha por entrada do usuario (`rootRequestId`), nao uma linha por producao tecnica gerada. Uma entrada pode gerar varias producoes diretas/dependentes, mas continua sendo um unico planejamento cancelavel.
- `Origens criadas por ficha de execucao` permite selecionar planejamentos por checkbox e cancelar selecionados em lote. O lote deve usar a mesma regra do cancelamento individual: excluir producoes pendentes pelo `rootRequestId` real no backend e cancelar requisicoes/suprimentos vinculados apenas quando ainda forem reversiveis.
- Ao iniciar uma producao que veio de planejamento manual, a solicitacao tecnica consumida deve ser removida da API antes da tela atualizar a fila; a origem por ficha desaparece somente quando nao restar solicitacao pendente daquele `rootRequestId`.
- Producoes manuais e rascunhos de producao nao devem ser restaurados do snapshot/localStorage do navegador. A fila operacional deve carregar pela API por entidade, pois restaurar cache local pode ressuscitar cancelamentos ou duplicar planejamentos.
- O gerador de planejamento nao deve criar producao dependente quando a ficha de preparo ja esta na pilha de dependencias do calculo; ciclos/autorreferencias devem ser ignorados para nao somar producao duplicada.
- A mesma ficha/centro dentro de um planejamento de producao deve aparecer uma unica vez, mesmo que seja demanda direta e dependencia de outra producao do mesmo planejamento; nesse caso, as quantidades devem ser somadas.
- Inativar ou excluir ficha tecnica deve mostrar impactos em `Entrada de producoes`, incluindo planejamentos pendentes, requisicoes/suprimentos vinculados e producoes em andamento. Producao em andamento bloqueia a inativacao/exclusao ate ser finalizada.
- `Desperdicio` possui entidades proprias:
  - `wasteSessions`
  - `wasteRecords`
- `Desperdicio` nao deve ser tratado como inventario nem como contagem; ao finalizar, vira saida operacional ou pendencia se houver inventario aberto.
- Existe fluxo de `Producao por ficha`, que cria planejamentos rastreaveis a partir de fichas de execucao e permite cancelamento da origem enquanto os registros derivados ainda estiverem reversiveis.

## Sidebar

- Ordem atual:
  - `Receituarios`
  - `Cadastros`
  - `Empresa`
  - `Usuarios`
- Dentro de `Cadastros`:
  - `Fichas Tecnicas`
  - `Produtos`
  - `Utensilios e Recipientes`
  - `Configuracoes`

## Riscos e limitacoes atuais

- [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) esta muito grande, o que aumenta risco de regressao e lentidao de manutencao.
- A contagem atual de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) esta em aproximadamente 57,2 mil linhas.
- A separacao inicial de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) ja comecou com:
  - [`src/utils/core.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/utils/core.ts)
  - [`src/components/ExecutionPlanningList.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/ExecutionPlanningList.tsx)
  - [`src/components/LazyCodeEditor.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/LazyCodeEditor.tsx)
  - [`src/components/common.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/common.tsx)
  - [`src/config/performance.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/config/performance.ts)
  - [`src/types/domain.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/types/domain.ts)
  - [`src/storage/localStorage.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/storage/localStorage.ts)
  - [`src/domain/technicalSheets.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/domain/technicalSheets.ts)
  - [`src/components/PreparationModeInput.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/PreparationModeInput.tsx)
  - [`src/utils/preparationMode.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/utils/preparationMode.ts)
- O projeto ainda depende fortemente de estado local e renderizacao centralizada.
- O snapshot global ainda duplica parte dos dados que ja existem em tabelas por entidade.
- Persistencia em navegador/localStorage ainda existe para estados auxiliares e compatibilidade; cadastros e fluxos operacionais criticos devem priorizar API/banco e expor falhas de salvamento.
- Imagens em `base64` ainda tendem a pressionar storage se continuarem dentro do banco/snapshot.
- O bundle web esta grande; o build gera aviso de chunk acima de 500 kB.
- O build local separa `react`, `react-dom` e `scheduler` em `react-vendor` via `manualChunks`.
  - Isso reduziu o chunk principal de aproximadamente 1,23 MB para 1,03 MB minificado.
- O frontend continua com bundle principal grande por causa da concentracao restante em [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx).
  - Isso nao bloqueia operacao nem deploy.
  - Fica como melhoria futura de performance:
    - code splitting com `dynamic import()`
    - quebrar [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) em modulos menores
- Antes de uma separacao estrutural maior de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx), o trabalho deve incluir obrigatoriamente:
  - backup total dos dados do servidor, com registro de data, origem e destino do arquivo;
  - registro detalhado das funcionalidades existentes, incluindo entradas, saidas, tabelas/endpoints usados, permissoes, dependencias entre modulos, uso permitido de localStorage/cache e criterios de validacao;
  - checklist de regressao por fluxo antes e depois de cada bloco extraido;
  - plano de rollback usando o backup, caso haja perda de dados ou regressao operacional.
- Ainda nao existe integracao com relatorios de venda / ponto de venda externo.
  - Isso limita relatorios mais avancados de consumo teorico vs venda, CMV real por periodo e comparacoes entre estoque e venda.
- Ha uma pendencia de regra no roteamento de requisicoes de `PREPARO` quando existir mais de um centro produtor valido para o mesmo item.
- Ainda nao existe um construtor de relatorios customizados pelo usuario final.
  - A ideia de um "Power BI facil" interno foi levantada como direcao futura para o modulo `Estoque`.
- `xlsx` continua como dependencia sensivel: ha vulnerabilidade conhecida sem fix disponivel no pacote atual; importacoes devem ser tratadas como entrada nao confiavel.

## Proximos candidatos naturais

- Evoluir o modelo de usuario multiempresa para vinculo por empresa:
  - criar `UserCompanyMembership`
  - guardar `accessProfileId` por empresa
  - guardar `sectors` por empresa
## 2026-08-24

- Nova rodada estrutural de performance iniciada por causa de lentidao persistente em digitacao, buscas e formularios.
- Tentativa de correcoes locais em inputs foi descartada: nao houve melhora perceptivel e o ponteiro de digitacao continuou indo para o fim do texto.
- Codigo voltou ao baseline anterior; a tentativa descartada ficou arquivada em `backups/refactor-input-buffer-attempt-20260824/failed-input-buffer-attempt.patch`.
- Backup completo online concluido antes de mexer no `App.tsx`:
  - `backups/full-server-backup-20260824T205650Z`
  - `backups/full-server-backup-20260824T205650Z/manifest.json`
- Mapa funcional/regressao criado:
  - `docs/STRUCTURAL_MAP_2026-08-24.md`
- Estado de decisao:
  - seguir com modularizacao do `App.tsx`;
  - nao alterar backend, APIs, persistencia, sincronizacao ou modelo de dados nesta rodada;
  - validar offline antes de qualquer deploy online.
- Primeira subfase concluida:
  - `src/components/NormalizedTextField.tsx` extraido;
  - buscas principais usam commit com debounce;
  - campos centrais de Produto, Item e Ficha Tecnica usam estado local e commit em `blur`/Enter;
  - `npm run build` aprovado.
- Proximo passo recomendado:
  - testar digitacao no offline;
  - se ainda houver lentidao perceptivel, extrair paineis inteiros de cadastro/tabela para reduzir a arvore renderizada pelo `App.tsx`.

  - manter login unico e escolha de empresa apos o login
  - carregar permissoes efetivas a partir da empresa ativa, nao do usuario global
- Implementar compartilhamento simplificado de cadastro entre empresas vinculadas:
  - master vincula empresas no painel `Empresa`
  - `Produtos` passam a ter empresa de origem + empresas compartilhadas
  - `Fichas tecnicas` passam a ter empresa de origem + empresas compartilhadas
  - `PREPARO` compartilhado pode receber centros produtores por empresa compartilhada
  - operacao continua separada por empresa
- A fazer, por prioridade:
  - prioridade alta, baixo risco:
    - mitigar imediatamente a importacao XLSX atual:
      - limitar tamanho maximo do arquivo
      - limitar quantidade de abas, linhas e colunas
      - rejeitar estrutura inesperada antes de processar
      - processar apenas os campos esperados
      - tratar arquivo importado como entrada nao confiavel
    - manter checklist de validacao de boot/carregamento inicial apos mudancas de performance:
      - login
      - escolha de empresa
      - abertura de `Receituarios`, `Cadastros`, `Estoque`, `Importar vendas` e `Relatorios`
      - refresh de pagina em secao protegida
    - medir o que mais consome storage hoje:
      - snapshot global
      - imagens
      - duplicacao entre snapshot e tabelas por entidade
  - prioridade alta, risco medio:
    - planejar e implementar sincronizacao em tempo real por entidade:
      - servidor deve publicar eventos apos gravacoes confirmadas no banco;
      - frontend deve invalidar/recarregar apenas as entidades afetadas e no escopo da empresa/permissao ativa;
      - abas do mesmo navegador podem usar `BroadcastChannel` como complemento, mas o servidor continua sendo a fonte da verdade;
      - cache/localStorage deve ficar restrito a rascunhos antes do usuario confirmar o salvamento ou a compatibilidade temporaria;
      - validar em desktop e mobile com dois usuarios/sessoes abertos.
    - implementar tratamento de imagem no cadastro de fichas tecnicas:
      - ao subir imagem, abrir etapa de ajuste antes de salvar
      - sugerir automaticamente corte quadrado com foco central no drink/produto
      - permitir ao usuario reposicionar e ajustar zoom do corte sugerido
      - aplicar limite de tamanho em dimensao e peso do arquivo antes de persistir
      - gerar imagem otimizada para exibicao no webapp, preferencialmente quadrada
      - manter compatibilidade com imagens antigas em `base64` ou caminhos ja cadastrados
      - validar impacto em cadastro, edicao, receituarios, exportacao PDF/XLSX e sincronizacao online/local
    - substituir a leitura de arquivos importados por alternativa mantida, preferencialmente `read-excel-file`
    - manter exportacoes com `xlsx` apenas temporariamente, enquanto a leitura de usuario deixa de depender dele
    - validar a migracao com imports reais de vendas antes de remover o parser antigo
    - continuar quebrando [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) e isolando calculos pesados em passos pequenos, sempre com build e teste de fluxo antes de avançar
    - antes da proxima rodada estrutural dessa modularizacao, criar backup total do servidor e mapa funcional detalhado para evitar regressao/perda de dados
    - extrair normalizadores de entidade em subfases menores, comecando pelos menos acoplados
    - separar hooks/paineis por fluxo apenas depois dos normalizadores e calculos estarem isolados
  - prioridade media, risco medio:
    - revisar relatorios e listas grandes para paginacao, filtros no servidor e queries mais enxutas
    - remover completamente `xlsx` substituindo tambem exportacoes por alternativa mantida, como `write-excel-file` ou outra biblioteca validada
    - virtualizar apenas novas tabelas grandes ou tabelas remanescentes em que a lentidao seja confirmada em uso real
    - revisar polling por secao quando novos modulos forem criados, preservando carga inicial unica dos dados essenciais
    - desenhar um construtor de relatorios customizados com filtros, colunas, agrupamentos e exportacao
  - prioridade media/baixa, depende de desenho:
    - definir estrategia futura de integracao com dados de venda externos
    - montar e executar um plano de migracao `Render DB -> Neon` e `imagens -> Cloudflare R2`, sem quebrar o ambiente online
    - tirar imagens do banco/snapshot e guardar apenas URL do objeto
- Performance de baixo risco ja aplicada e deve virar acompanhamento, nao frente aberta generica:
  - evitar `setState` redundante nos refreshes por API
  - pausar polling com aba oculta
  - carregar/pollar dados por tela ativa
  - aplicar `lazy load` em dependencias pesadas de PDF, XLSX e editor
  - virtualizar tabelas grandes em imports, relatorios, requisicoes, suprimentos, recebimentos e entrada de producoes
- UX de cadastro aplicada:
  - buscas ao digitar em `SingleValueAutocomplete` e `MultiSelectChips` permitem selecionar sugestoes com setas do teclado e confirmar com `Enter`.
  - `Escape` fecha a lista de sugestoes.
- Avaliar `acoes em lote` no historico de `Importar vendas` como refinamento, nao como prioridade imediata:
  - reprocessar multiplos lotes ja possui selecao em lote para lotes reprocessaveis
  - ainda podem virar melhoria futura:
    - lancar saida para multiplos lotes `READY_TO_POST`
    - cancelar multiplos lotes analiticos/pendentes
    - exportar inconsistencias de multiplos lotes
- Manter este arquivo atualizado sempre que uma decisao mudar o estado real do sistema.

## Cadastro via API

- `POST /api/technical-sheets` aloca `id` numerico e `productId` interno da ficha no servidor.
- `POST /api/products` aceita produto avulso com `id` vazio e aloca `PRD-...` no servidor.
- Cargas de catalogo nao devem inventar IDs internos; devem consumir o registro retornado pela API.
- A lista de `Produtos` permite copiar produto avulso como novo cadastro pre-preenchido. A copia nao reaproveita ID interno, ID de embalagem nem `technicalSheetId`; linha vinculada a ficha tecnica usa o fluxo de copiar ficha tecnica.
