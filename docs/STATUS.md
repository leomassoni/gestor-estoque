# Status do Sistema

Ultima atualizacao: 2026-05-19

## Objetivo deste arquivo

Registrar em que pe o sistema esta hoje, por area, para consulta rapida antes de novas alteracoes.

## Situacao geral

- O projeto esta funcionalmente concentrado em um frontend React/Vite com grande parte da logica em [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx).
- O backend local existe em `server/`, mas o acompanhamento recente de produto aconteceu principalmente no frontend.
- Nao ha historico Git util neste diretorio no momento; este arquivo passa a ser a referencia manual de progresso.

## Cadastro de fichas tecnicas

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
- O projeto ainda depende fortemente de estado local e renderizacao centralizada.
- Nao existe ainda um historico estruturado de releases, tarefas e regressos anteriores fora destes arquivos em `docs/`.
- O bundle web esta grande; o build gera aviso de chunk acima de 500 kB.
- Ainda nao existe integracao com relatorios de venda / ponto de venda externo.
  - Isso limita relatorios mais avancados de consumo teorico vs venda, CMV real por periodo e comparacoes entre estoque e venda.
- Ha uma regressao aberta no cadastro de `Centros de estoque` produtores:
  - apos a ultima atualizacao houve relato de tela em branco ao salvar um centro marcado como `PRODUTOR`
  - os `PREPARO` continuam nao aparecendo corretamente como opcao para incluir na lista de producoes do centro
- Ha uma pendencia de regra no roteamento de requisicoes de `PREPARO` quando existir mais de um centro produtor valido para o mesmo item.
- Ainda nao existe um construtor de relatorios customizados pelo usuario final.
  - A ideia de um "Power BI facil" interno foi levantada como direcao futura para o modulo `Estoque`.

## Proximos candidatos naturais

- Criar um fluxo aninhado real para `EXECUCAO` e/ou `VENDA`, se isso fizer sentido de produto.
- Continuar quebrando [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) em componentes menores.
- Criar o submenu `Relatorios` dentro de `Estoque`, com relatorios operacionais, gerenciais e analiticos.
- Definir estrategia futura de integracao com dados de venda externos.
- Desenhar um construtor de relatorios customizados com filtros, colunas, agrupamentos e exportacao.
- Manter este arquivo atualizado sempre que uma decisao mudar o estado real do sistema.
