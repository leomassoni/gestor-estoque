# Decisoes do Projeto

 Ultima atualizacao: 2026-07-13

## Objetivo deste arquivo

Registrar o que foi decidido, o que foi adiado e o que foi descartado, com foco em evitar retrabalho e duvida futura.

## Decisoes ativas

### Catalogo compartilhado deve seguir empresas vinculadas, nao grupo + produto mestre

- Decisao: o compartilhamento de `Produtos` e `Fichas tecnicas` deve seguir um modelo simplificado de `empresas vinculadas`.
- Regra:
  - o master pode vincular uma empresa a outra no painel `Empresa`
  - `Produto` e `Ficha tecnica` continuam tendo empresa de origem
  - cada cadastro pode ter `empresas compartilhadas`
  - operacao de estoque, inventario, requisicao, suprimento, recebimento e producao continua sempre separada por empresa
- Fluxo definido para cadastro em cascata:
  - se o usuario criar um produto pela ficha tecnica, o produto nasce na empresa atual
  - e pode ser compartilhado com empresas vinculadas
  - se o produto ja existir em empresa vinculada, o sistema deve oferecer reutilizar/habilitar esse cadastro em vez de criar duplicado
- Regra adicional para `PREPARO`:
  - uma ficha compartilhada pode ter centros produtores por empresa
  - compartilhar a ficha nao compartilha automaticamente o centro produtor; ele pode ser configurado para cada empresa compartilhada
- Motivo:
  - muito menor complexidade que `grupo + product master + company link`
  - encaixa melhor no sistema atual
  - preserva segregacao operacional por empresa
- Status: definido para implementacao futura.

### Usuario multiempresa deve evoluir para vinculo por empresa

- Decisao: o usuario deve manter `login unico`, mas o perfil efetivo de acesso nao deve mais ser global.
- Modelagem alvo:
  - criar `UserCompanyMembership`
  - cada vinculo guarda:
    - `userId`
    - `companyId`
    - `accessProfileId`
    - `sectors`
    - `isActive`
    - opcionalmente `defaultAfterLogin` e `lastAccessedAt`
- Regra:
  - o usuario pode escolher a empresa ao entrar
  - ao trocar de empresa, o sistema carrega o `membership` correspondente
  - `perfil`, `setores` e permissoes passam a ser resolvidos pela empresa ativa, nao pelo usuario global
- Motivo:
  - evitar espelhamento artificial de perfis entre empresas
  - permitir perfis e setores diferentes por empresa
  - reduzir bugs quando empresas vinculadas nao compartilham o mesmo catalogo de perfis/setores
- Status: decidido como proxima evolucao estrutural, ainda nao implementado.

### Formularios de ficha tecnica devem obedecer configuracoes centralizadas

- Decisao: os campos de ficha tecnica podem ser configurados como exibidos e/ou obrigatorios por tipo de ficha.
- Motivo: permitir adequacao do sistema ao uso real sem editar codigo para cada ajuste operacional.
- Status: implementado.

### O painel de configuracoes deve refletir a estrutura das fichas

- Decisao: no painel `Configuracoes`, os campos aparecem organizados por blocos equivalentes aos blocos das fichas.
- Motivo: reduzir carga cognitiva e facilitar manutencao.
- Status: implementado.

### O grupo `Cadastros` deve existir nas permissoes

- Decisao: `Cadastros` aparece como grupo visual nas permissoes, com opcoes filhas independentes.
- Motivo: a sidebar tem hierarquia visivel e a regra de acesso precisa refletir isso.
- Status: implementado.

### PREPARO principal e PREPARO aninhado devem compartilhar os mesmos blocos

- Decisao: o formulario principal de `PREPARO` e seu modal aninhado nao devem manter JSX paralelo.
- Motivo: evitar divergencia quando houver ajustes futuros na ficha.
- Status: implementado.

### O editor de modo de preparo deve manter texto em maiusculas

- Decisao: a digitacao no editor permanece em maiusculas.
- Motivo: padrao operacional solicitado para os textos de preparo.
- Status: implementado.

### O editor de modo de preparo nao pode quebrar a edicao no meio do texto

- Decisao: priorizar estabilidade do cursor e da selecao durante a digitacao.
- Motivo: o comportamento anterior inviabilizava pequenas correcoes em textos longos.
- Status: implementado.

### O autocomplete do modo de preparo deve sugerir insumos da ficha atual

- Decisao: as sugestoes devem se basear nos produtos cadastrados na propria ficha tecnica em edicao.
- Motivo: o objetivo e acelerar a montagem do texto de preparo com os insumos efetivamente usados.
- Status: implementado.

### Desperdicio deve ser entidade propria, separada de inventario

- Decisao: `Desperdicio` nao deve reaproveitar `Inventario`, `Contagem`, `inventoryId`, `inventoryCountSessions` ou `inventoryCounts` como estrutura de origem.
- Regra:
  - iniciar desperdicio cria `wasteSession`
  - registrar item cria `wasteRecord`
  - finalizar desperdicio transforma os itens em saida operacional de estoque
  - se houver inventario aberto no centro, a saida vira pendencia para aplicacao no fechamento do inventario
- Motivo:
  - inventario estabelece nova posicao de estoque
  - desperdicio e perda operacional, ou seja, retirada do estoque existente
- Status: implementado.

### Minimo do centro e consolidado operacional devem permanecer separados

- Decisao: o minimo gerado por importacao de vendas pertence ao centro consumidor que recebeu o import.
- Regra:
  - o centro consumidor guarda o `minimo real` do proprio consumo
  - o centro produtor nao deve receber esse minimo como minimo proprio
  - a necessidade do produtor deve ser calculada como consolidado operacional das demandas dos centros atendidos
- Motivo:
  - evita confundir consumo do bar com demanda de producao do laboratorio
  - preserva requisicao/suprimento entre centros como ponte operacional
- Status: implementado como regra atual dos fluxos de minimo, producao, requisicao e suprimento.

### Importacao de vendas deve ser historico de consumo do centro

- Decisao: imports ativos sao aditivos e formam historico de consumo por centro e periodo; eles nao substituem imports anteriores.
- Regra:
  - import ativo dentro da janela configurada deve contar automaticamente
  - reprocessamento deve ser excecao para reconstruir dados legados, de/para alterado ou lote corrigido
  - quando `sales-import-rows` nao preservarem `MATCHED`, `sales-consumptions` persistidos devem ser a fonte principal do historico
- Motivo:
  - o dado importante e o consumo trazido pelos imports, nao o lote em si
  - evita minimos incorretos quando rows antigas nao guardam mais informacao suficiente
- Status: implementado.

### Producao por ficha deve ter origem rastreavel e cancelavel

- Decisao: producoes criadas a partir de ficha de execucao devem ter uma origem de planejamento rastreavel.
- Regra:
  - a fila normal continua mostrando as producoes em si
  - o bloco de planejamentos por ficha mostra a origem funcional da demanda
  - cancelar a origem deve cancelar apenas producoes, requisicoes e suprimentos ainda reversiveis
  - registros ja movidos, recebidos ou avancados operacionalmente devem ser preservados
- Motivo:
  - permitir desfazer uma simulacao/planejamento sem apagar movimentos ja executados
  - manter auditoria clara entre demanda por ficha, producao, requisicao e suprimento
- Status: implementado.

### Performance deve evoluir primeiro por mudancas de baixo risco

- Decisao: antes de alterar sincronizacao ou persistencia, melhorar performance com mudancas que nao mudem regra de negocio.
- Ja aplicado:
  - evitar `setState` redundante em refreshes
  - pausar polling com aba oculta
  - restringir polling por secao ativa
  - lazy load de dependencias pesadas de PDF, XLSX e editor
  - virtualizacao de tabelas grandes em imports, relatorios, requisicoes, suprimentos, recebimento e entrada de producoes
- Regra:
  - mudancas no modelo de sincronizacao continuam sendo de alto risco
  - modularizacao deve seguir em passos pequenos e testaveis
- Status: em andamento.

### Separacao do App.tsx deve ser incremental

- Decisao: [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) deve ser quebrado aos poucos.
- Regra:
  - comecar por helpers puros e componentes presentacionais
  - evitar extrair persistencia, sync ou regras criticas em passos grandes
  - manter a tag `safe-before-apptsx-split` como referencia do ultimo ponto seguro antes da separacao inicial
- Motivo:
  - reduzir risco de regressao em um arquivo muito grande
  - preservar funcionamento enquanto a arquitetura melhora
- Status: iniciado.

### XLSX deve ser tratado como entrada nao confiavel

- Decisao: arquivos XLSX importados por usuario devem ser tratados como entrada nao confiavel.
- Motivo:
  - a dependencia `xlsx` possui vulnerabilidades conhecidas sem correcao disponivel no pacote atual
  - o sistema usa XLSX para importacoes e exportacoes, mas importacao e a superficie de maior risco
- Direcao:
  - limitar tamanho e quantidade de linhas processadas
  - validar extensao, estrutura e tipos antes de consolidar dados
  - considerar migracao futura para alternativa mantida ou processamento isolado no backend
- Status: risco conhecido, mitigacao planejada.

## Decisoes de escopo atual

### EXECUCAO e VENDA ainda nao tem modal aninhado de ficha tecnica

- Decisao: por enquanto, nao assumir que existem fluxos aninhados equivalentes ao de `PREPARO`.
- Motivo: o codigo atual nao oferece esse fluxo; fingir que existe criaria uma falsa sensacao de cobertura.
- Status: mantido como esta.

### Nao criar agora um sistema complexo de tracking interno

- Decisao: usar arquivos simples em `docs/` em vez de implantar agora ferramenta mais pesada de acompanhamento.
- Motivo: baixo custo, alta clareza e nenhuma dependencia externa.
- Status: implementado.

## Coisas adiadas

### Resolver ambiguidade quando um PREPARO tem mais de um centro produtor valido

- Decisao: adiar a regra final de desempate para envio de requisicoes de `PREPARO` quando existir mais de um centro produtor possivel para o mesmo item.
- Motivo: o fluxo atual ja separa remessas por centro produtor, mas ainda exige destino univoco por item para evitar envio incorreto.
- Status: adiado.

### Refatoracao ampla de `src/App.tsx`

- Decisao: evitar uma quebra ampla de uma vez; seguir por modularizacao incremental.
- Motivo: prioridade e reduzir risco enquanto se diminui o tamanho do arquivo.
- Risco aceito: manutencao ainda e lenta ate a modularizacao avancar.

### O bundle grande do frontend fica como melhoria futura, nao como bloqueio de deploy

- Decisao: manter o deploy atual mesmo com aviso de chunk acima de 500 kB, e continuar tratando isso como melhoria incremental de performance.
- Motivo: o sistema ja conseguiu build e deploy com sucesso no Render; o problema e de carregamento/otimizacao, nao de funcionalidade.
- Ja aplicado:
  - `dynamic import()` para PDF, XLSX e editor
  - virtualizacao de tabelas grandes
- Direcao futura:
  - quebrar [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx) em partes menores
  - avaliar `manualChunks`
- Status: em andamento.

### Criar modais aninhados para EXECUCAO e VENDA

- Decisao: nao implementar isso agora sem demanda funcional clara.
- Motivo: hoje so `PREPARO` usa esse fluxo de forma real.
- Status: adiado.

### Integracao com vendas externas antes de relatorios cruzados mais avancados

- Decisao: adiar relatorios que dependam de venda / consumo teorico cruzado com PDV ate existir uma integracao confiavel com fonte externa de vendas.
- Motivo: o sistema ainda nao opera como ponto de venda e nao deve simular dados que nao possui.
- Status: adiado.

### Construtor de relatorios customizados fica como segunda fase do modulo de relatorios

- Decisao: primeiro estruturar relatorios prontos do modulo `Estoque`; depois evoluir para um construtor customizado pelo usuario final.
- Motivo: entregar valor rapido com relatorios mais pedidos e, so depois, abrir flexibilidade analitica maior.
- Status: adiado.

### A arquitetura-alvo do sistema e gravacao transacional por entidade

- Decisao: o sistema deve sair gradualmente do `snapshot global` como persistencia principal e migrar para gravacao/consulta por entidade no backend.
- Motivo:
  - reduzir risco de sobrescrita entre usuarios
  - melhorar consistencia em ambiente multiusuario
  - reduzir dependencia de `localStorage`
  - preparar relatorios e consultas mais eficientes
- Status: em andamento.

### Banco e arquivos devem seguir responsabilidades separadas

- Decisao: o banco relacional deve guardar dados transacionais e cadastrais; imagens e arquivos devem migrar para object storage.
- Motivo:
  - evitar crescimento rapido do banco
  - reduzir custo
  - melhorar estrategia de backup e restauracao
- Direcao escolhida para estudo/execucao:
  - `Render DB -> Neon`
  - `imagens -> Cloudflare R2`
- Status: planejado.

### O plano `grupo + produto mestre + liberacao por empresa` foi descartado

- Decisao: nao seguir com a modelagem de `CompanyGroup + ProductMaster + CompanyProductLink` como proxima evolucao do cadastro compartilhado.
- Motivo:
  - custo de implantacao alto para o estagio atual do sistema
  - impacto grande em `Produtos`, `Fichas`, `Estoque`, `Requisicoes`, `Producoes` e historico
  - existe alternativa funcionalmente suficiente e mais simples com `empresas vinculadas`
- Status: descartado.

### Otimizacao de consultas e saudavel e nao deve ser tratada como opcional

- Decisao: listas, historicos e relatorios devem evoluir para filtros, paginacao e selecao de colunas no servidor, em vez de cargas massivas desnecessarias.
- Motivo:
  - preservar desempenho
  - reduzir consumo de memoria e banda
  - baixar pressao sobre banco e custo operacional
- Regra de seguranca:
  - aplicar isso primeiro em listagens e relatorios
  - nao mudar cegamente fluxos que ainda dependem de carga total local sem antes migrar a logica correspondente
- Status: planejado.

### `Acoes em lote` no historico de `Importar vendas` ficam como refinamento futuro

- Decisao: nao tratar `acoes em lote` como prioridade imediata do modulo de `Importar vendas`.
- Exemplos que ficam registrados como evolucao futura:
  - lancar saida para varios lotes `READY_TO_POST`
  - cancelar varios lotes analiticos/pendentes
  - reprocessar varios lotes
  - exportar inconsistencias de varios lotes
- Motivo:
  - primeiro consolidar bem o fluxo `lote a lote`
  - reduzir risco de operacao pesada ou erro em massa
- Status: planejado para refinamento futuro.

## Coisas que deram errado e viraram regra

### Corrigir o cursor do editor sem perder o comportamento existente

- Problema: uma correcao do cursor reintroduziu efeitos colaterais no editor, incluindo comportamento ruim com espacos e perda de consistencia em maiusculas/sugestoes.
- Regra extraida: qualquer ajuste no editor de `modo de preparo` precisa validar ao menos:
  - digitacao no meio do texto
  - espacos consecutivos
  - maiusculas
  - autocomplete
  - destaque de insumos

### Assumir que EXECUCAO e VENDA tinham pop-ups equivalentes

- Problema: havia percepcao de que talvez os outros tipos de ficha tambem tivessem aninhamento equivalente.
- Regra extraida: antes de afirmar cobertura estrutural, confirmar no codigo se o fluxo realmente existe.
