# Mapa estrutural para modularizacao do App.tsx - 2026-08-24

## Ponto seguro

- Backup completo do servidor criado em `backups/full-server-backup-20260824T205650Z`.
- Fonte do backup: `https://gestor-estoque-zqw9.onrender.com/api`.
- Manifesto do backup: `backups/full-server-backup-20260824T205650Z/manifest.json`.
- Backup da tentativa descartada de buffer de inputs: `backups/refactor-input-buffer-attempt-20260824/failed-input-buffer-attempt.patch`.
- O online deve permanecer sem deploy durante a refatoracao e validacao offline.

## Contagem do backup

- Empresas: 13.
- Usuarios: 11.
- Perfis de acesso: 5.
- Centros de estoque: 14.
- Produtos: 1331.
- Itens/utensilios: 100.
- Fichas tecnicas listadas: 639.
- Fichas tecnicas completas baixadas por ID: 639.
- Inventarios: 11.
- Sessoes de contagem: 8.
- Itens de contagem: 273.
- Requisicoes: 6.
- Entradas manuais/planejadas de producao: 51.
- Lotes de importacao de vendas: 6.
- Linhas de importacao de vendas: 4321.
- Consumos de venda: 16374.
- Sessoes de desperdicio: 1.
- Registros de desperdicio: 0.
- Auditoria: 1492 registros.

## Diagnostico da rodada

- A tentativa de melhorar apenas os inputs nao gerou melhora perceptivel para o usuario.
- O servidor local mostrou aviso do Babel: `src/App.tsx` excede 500KB e a geracao de codigo foi desotimizada.
- O problema deve ser tratado como gargalo estrutural: estados de digitacao, formularios e filtros ainda disparam re-render do componente raiz grande demais.
- A proxima frente nao deve insistir em hacks de input; deve reduzir o custo de renderizacao do `App.tsx` por extracao de telas/painéis e isolamento de estado local.

## Funcionalidades com risco de regressao

### Busca por digitacao e autocomplete

- Onde aparece: Produtos, Itens, Fichas Tecnicas, Receituarios, Centros de Estoque, Inventarios, Requisicoes, Suprimentos, Compras, Producoes, Relatorios, Auditoria.
- Comportamento esperado:
  - texto digitado deve permanecer em maiusculas e sem acentos;
  - ponteiro de digitacao deve permitir edicao no inicio, meio e fim;
  - `datalist`, `SingleValueAutocomplete` e `MultiSelectChips` devem continuar fazendo match normalizado;
  - filtros devem poder ficar vazios sem esconder cabecalho/controles da tabela.
- Validacao:
  - digitar no meio de um texto ja existente em busca e em campo de cadastro;
  - selecionar sugestao por clique e por Enter;
  - limpar filtro depois de uma tabela ficar sem resultados.

### Cadastros

- Fluxos: Produtos, Itens, Fichas Tecnicas, Configuracoes de ficha, Empresa, Usuarios, Perfis.
- Comportamento esperado:
  - IDs internos automaticos continuam gerados pelo fluxo/API existente;
  - ID empresa nao pode quebrar fallback de importacao de vendas;
  - textos de cadastro continuam normalizados;
  - compartilhamento entre empresas vinculadas continua respeitado;
  - fichas PREPARO/EXECUCAO/VENDA mantem ingredientes, insumos, itens de servico, centros produtores e taxas.
- Validacao:
  - abrir cadastro existente, editar texto no meio, salvar e reabrir;
  - criar rascunho e cancelar sem alterar registro persistido;
  - copiar ficha tecnica para empresa vinculada sem duplicar dependencias.

### Estoque e inventario

- Fluxos: Centros de estoque, Inventarios, Sessoes de contagem, Itens contados, Locais de armazenamento, Movimentos pendentes.
- Comportamento esperado:
  - contagem em celular deve permitir sair/voltar sem perder itens ja registrados;
  - item de contagem salva por API e nao pode reutilizar ID antigo;
  - saldos continuam calculados a partir das contagens e movimentos confirmados;
  - inventarios fechados continuam auditaveis.
- Validacao:
  - abrir inventario, registrar item, atualizar pagina e confirmar permanencia;
  - abrir resumo e historico de contagem;
  - filtrar resumo e limpar filtro.

### Requisicoes, suprimentos e compras

- Fluxos: nova requisicao, historico, aprovar, cancelar, excluir canceladas, receber, suprir, compras e suprimentos vindos de compras.
- Comportamento esperado:
  - aprovar envia para o fluxo correto sem etapa manual desnecessaria;
  - cancelar requisicao remove demanda ativa de suprimentos/compras/producao;
  - pedidos de compra derivados de requisicao cancelada nao aparecem como ativos;
  - quantidades de requisicao e compra aparecem em unidade de embalagem arredondada;
  - suprimento pode atender parcial, total ou acima do pedido.
- Validacao:
  - criar requisicao pequena, aprovar, conferir destino e cancelar;
  - confirmar que compra/suprimento/producao nao mantem demanda ativa apos cancelamento;
  - conferir arredondamento de pedido.

### Producoes e explosao de insumos

- Fluxos: Entrada de producoes, producao manual, producao gerada por requisicao, dependencias de PREPARO, producao entre empresas vinculadas.
- Comportamento esperado:
  - demanda do centro solicitante gera entrada no centro produtor correto;
  - PREPARO compartilhado com centro produtor em outra empresa gera demanda de suprimento entre empresas;
  - explosao de insumos respeita estoque ja contado;
  - cancelamento de requisicao remove entradas de producao geradas por ela;
  - entradas manuais nao ressuscitam por snapshot/localStorage.
- Validacao:
  - requisitar PREPARO produzido em laboratorio;
  - confirmar entrada de producao e dependencias;
  - cancelar requisicao e verificar que entrada desaparece.

### Importacao de vendas

- Fluxos: templates, preview, match por ID empresa, fallback por ID interno, lote, linhas, consumo e cancelamento.
- Comportamento esperado:
  - venda promocional/valor zero continua consumindo estoque;
  - lote cancelado fica auditavel/reversivel;
  - importacao gera minimo somente no centro informado;
  - fichas EXECUCAO/VENDA continuam sendo a fonte do consumo.
- Validacao:
  - abrir tela de importar vendas;
  - carregar template existente;
  - gerar preview com linha casada e linha sem match;
  - nao aplicar importacao durante teste estrutural sem decisao explicita.

### Relatorios, desperdicio e auditoria

- Fluxos: Posicao de estoque, historico de movimentos, modelos salvos, desperdicio, logs.
- Comportamento esperado:
  - filtros, ordenacao e colunas continuam disponiveis mesmo com zero resultado;
  - desperdicio aparece conforme permissao do perfil;
  - exportacoes PDF/XLSX continuam usando os dados visiveis.
- Validacao:
  - abrir relatorio de estoque e filtrar;
  - abrir desperdicio com perfil permitido;
  - abrir auditoria e buscar registro.

## Ordem tecnica recomendada

1. Nao mexer em persistencia, endpoints, sync ou modelo de dados nesta rodada.
2. Extrair primeiro componentes de tabela, busca e shells de tela que nao gravam dados.
3. Depois extrair paineis de cadastro com estado local de formulario e callbacks explicitos de salvar/cancelar.
4. Manter `App.tsx` inicialmente como orquestrador de estado global e permissoes.
5. Somente depois mover calculos derivados pesados para hooks/modulos por dominio.
6. Validar build apos cada bloco.

## Criterio de rollback

Se o build falhar ou qualquer fluxo critico acima quebrar no offline sem correcao rapida, restaurar o commit anterior a esta rodada e usar `backups/full-server-backup-20260824T205650Z` como referencia de recuperacao de dados.
