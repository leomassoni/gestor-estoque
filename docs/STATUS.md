# Status do Sistema

 Ultima atualizacao: 2026-07-19

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

### Ainda sensivel ao modelo hibrido

- O snapshot global `/api/state` ainda existe e deve ser tratado como legado/compatibilidade.
- O frontend ainda mantem varios estados locais e sincroniza entidades por refresh/polling.
- Mudancas no modelo de sincronizacao continuam sendo de alto risco e devem ficar para uma etapa planejada.

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

### EXECUCAO

- O formulario principal de `EXECUCAO` existe e esta funcional.
- Nao existe hoje modal aninhado de ficha tecnica para `EXECUCAO`.
- As configuracoes de exibicao e obrigatoriedade atuam no formulario principal.
- Ainda nao existe uma segunda superficie de UI de `EXECUCAO` equivalente ao modal de `PREPARO` para ser compartilhada.

### VENDA

- O formulario principal de `VENDA` existe e esta funcional.
- Nao existe hoje modal aninhado de ficha tecnica para `VENDA`.
- As configuracoes de exibicao e obrigatoriedade atuam no formulario principal.

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
- Nos textos de execucao, os insumos identificados no modo de preparo exibem ao lado o valor de entrada recalculado.
- As tabelas de composicao de insumos dos receituarios nao exibem mais dados de custo; mostram apenas entrada, rendimento e % de alcool.
- Os blocos `Dados tecnicos` foram simplificados conforme decisoes recentes.
- As dependencias pesadas de exportacao e editor foram colocadas em carregamento sob demanda.

## Estoque e operacao

- O fluxo de `Importar vendas` usa historico persistido de `sales-consumptions` como fonte principal para minimos quando as linhas importadas nao preservam `MATCHED`.
- O minimo do centro consumidor, o consolidado operacional do produtor e o minimo de uso devem permanecer conceitos separados.
- `Entrada de producoes`, `Requisicoes`, `Suprimentos` e `Recebimentos` ja passaram por ajustes para respeitar essa separacao.
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

- [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) esta muito grande, o que aumenta risco de regressao.
- A ultima rodada de separacao reduziu [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) para aproximadamente 53,8 mil linhas.
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
- Imagens em `base64` ainda tendem a pressionar storage se continuarem dentro do banco/snapshot.
- O bundle web esta grande; o build gera aviso de chunk acima de 500 kB.
- O build local separa `react`, `react-dom` e `scheduler` em `react-vendor` via `manualChunks`.
  - Isso reduziu o chunk principal de aproximadamente 1,23 MB para 1,03 MB minificado.
- O frontend continua com bundle principal grande por causa da concentracao restante em [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx).
  - Isso nao bloqueia operacao nem deploy.
  - Fica como melhoria futura de performance:
    - code splitting com `dynamic import()`
    - quebrar [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) em modulos menores
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
