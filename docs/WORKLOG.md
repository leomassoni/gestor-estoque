# Worklog

Ultima atualizacao: 2026-05-26

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
