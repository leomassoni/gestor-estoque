# Worklog

 Ultima atualizacao: 2026-07-13

## Objetivo deste arquivo

Registrar um historico resumido do que foi feito, do que falhou e do que ficou pendente.

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
- O build ainda mostra chunk principal grande, mas menor e com parte das dependencias pesadas separadas.

### Modularizacao

- A separacao inicial de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) foi iniciada com:
  - [`src/utils/core.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/utils/core.ts)
  - [`src/components/ExecutionPlanningList.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/ExecutionPlanningList.tsx)
  - [`src/components/LazyCodeEditor.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/LazyCodeEditor.tsx)

### Pendencias abertas

- Prioridade alta, baixo risco:
  - atualizar [`scripts/sync-online-api-to-local.mjs`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/scripts/sync-online-api-to-local.mjs) para sincronizar tambem `waste-sessions` e `waste-records`
  - mitigar a importacao XLSX atual com limites de tamanho, abas, linhas, colunas e validacao estrita da estrutura esperada
- Prioridade alta, risco medio:
  - substituir a leitura de arquivos importados por alternativa mantida, preferencialmente `read-excel-file`
  - validar a migracao com imports reais antes de desativar o parser antigo
- Prioridade media, risco medio:
  - continuar a modularizacao de [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) em passos pequenos
  - remover completamente `xlsx` substituindo tambem as exportacoes por alternativa mantida, como `write-excel-file` ou outra biblioteca validada
