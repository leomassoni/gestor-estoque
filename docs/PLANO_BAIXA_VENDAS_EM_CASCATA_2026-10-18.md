# Plano de implementacao - baixa de vendas em cascata

Data: 18/10/2026
Status: IMPLEMENTADO E VALIDADO LOCALMENTE em 19/10/2026. Publicacao controlada com recurso desabilitado por padrao; piloto ainda pendente. Este documento nao autoriza baixas em dados reais.
Escopo inicial recomendado: CASA DE MI MADRE, BAR DE BAIXO, mediante ativacao controlada.

## 1. Objetivo e limites

Ao lancar vendas como saida de estoque, consumir o saldo disponivel de cada preparo e decompor somente sua falta, proporcionalmente, ate os produtos. Nesta operacao, nao criar saldo negativo de pre-preparo; produto controlado por estoque pode ficar negativo, com aviso e confirmacao.

Nao alterar receitas, custos aprovados, centros produtores, rotas, inventarios, importacoes antigas ou configuracoes de suprimentos automaticamente. A permissao existente para suprir sem saldo e uma regra separada e deve continuar funcionando.

Nao criar entradas ficticias de producao, recebimento, subproduto ou retorno ao estoque para justificar a baixa. A decomposicao automatica e um consumo teorico identificado, nao uma confirmacao de que a producao ocorreu.

## 2. Diagnostico confirmado no codigo atual

- `src/App.tsx` tem 60.520 linhas no inicio deste planejamento. O arquivo real e App.tsx, nao App.jsx.
- `buildSalesImportConsumptionsForMatchedRows` e `buildSalesImportIngredientDemandRows` calculam os componentes diretos das fichas vendidas. PRODUTO_INTERNO e consumido como o proprio item estocado.
- `buildSalesImportOperationalMovement` agrega os consumos e cria saidas, sem limitar a baixa ao saldo de preparos ou percorrer a falta pela composicao.
- `postSalesImportBatch` registra movimentos no estado local e grava status por requisicoes separadas. A nova operacao nao deve repetir esse desenho.
- `inventoryCurrentBalances` calcula os saldos no frontend, com eventos de inventario e movimentos. Inventario consolidado substitui a posicao anterior, inclusive zerando itens nao contados no centro abrangido.
- `AppSalesConsumptionRecord` possui um unico `stockMovementId`; esse campo sozinho nao representa uma demanda resolvida por varios niveis e movimentacoes.
- As fichas ja possuem `productionCenters`, `supplyRoutes`, vinculo de subproduto/retorno e equivalentes de ingredientes. Esses dados devem orientar a regra, sem inferir pelo nome da ficha ou apenas por sua empresa proprietaria.
- `server/production.js` ja usa transacoes e registro idempotente de operacao. Reaproveitar os principios e helpers compativeis, sem misturar regra de venda no modulo de producao.

## 3. Regras operacionais propostas

### 3.1 Saldo suficiente ou parcial

Para cada necessidade de um preparo:

1. Consultar seu saldo utilizavel no centro e no instante operacional pertinente.
2. Baixar no maximo o saldo positivo disponivel.
3. Decompor somente o restante pela quantidade de entrada de cada ingrediente dividida pelo rendimento final declarado da ficha.
4. Repetir o procedimento nas dependencias permitidas.
5. Ao chegar a produto, registrar sua baixa, inclusive negativa quando faltar saldo, com aviso.

Todos os itens e linhas do lote compartilham o mesmo mapa de saldos durante a simulacao. Duas vendas nao podem reutilizar a mesma quantidade disponivel. Usar ordem deterministica por data e identificador da linha, registrando o criterio adotado.

Nao confundir produto vinculado a ficha com materia-prima: continuar respeitando seu tipo de ficha. Respeitar insumos e guarnicoes ativos, `ignoreStock`, unidades, rendimentos e perdas ja cadastrados. Nao somar gramas e mililitros nem arredondar cada nivel recursivo.

### 3.2 Onde a cascata pode continuar

- Conversao operacional local: permitir decomposicao proporcional quando sua politica estiver validada.
- Preparo produzido no proprio centro: permitir cascata local, salvo vinculo de subproduto/retorno ou outra restricao.
- Ficha compartilhada mas produzida localmente: mesma regra local; a propriedade da ficha nao determina a origem fisica.
- Preparo recebido de outro centro, mesmo da mesma empresa: parar na falta e indicar pendencia de recebimento. Nao retirar materias-primas de um centro diferente por conta propria.
- Rota ausente, conflitante ou com mais de um produtor possivel: pendencia de configuracao, sem escolher pela semelhanca do nome.
- PRODUTO_INTERNO: manter baixa do proprio item e adotar, inicialmente, somente saldo. Habilitar decomposicao por politica explicita validada, sem presumir montagem, embalagem ou recebimento nao registrados.

Prever politica por ficha e centro, com pelo menos `CASCADE_LOCAL` e `STOCK_ONLY`. Subproduto gerado e retorno ao estoque sao barreiras obrigatorias. A politica nao e uma nova permissao para fabricar ou movimentar estoque entre empresas.

### 3.3 Subprodutos e itens retornados

Consumir o saldo existente. Na falta, apontar a ficha geradora e manter pendencia, sem explodir o gerador automaticamente.

Se a producao geradora aconteceu, regularizar sua saida real com vinculacao e auditoria, sem repetir a baixa de insumos. Se nao aconteceu, usar o fluxo normal da producao geradora. Extracao de cascas antes do sumo deve seguir seu processo especifico de retorno da fruta descascada, nao uma producao ficticia de sumo.

### 3.4 Equivalentes, receitas incompletas e saldos negativos existentes

- Nao escolher ingrediente equivalente apenas porque existe saldo. Usar a composicao padrao ou distribuicao explicitamente confirmada, identificando o consumo como teorico.
- Producoes registradas com equivalentes ja baixaram seus ingredientes: consumir seu saldo de saida, sem refazer essas baixas.
- Bloquear o ramo afetado por ciclo, rendimento nao positivo, unidade incompatibilizada, ficha ausente/inativa ou vinculo invalido. Exibir caminho e causa.
- Preparo ja negativo antes da importacao deve aparecer como divergencia preexistente. Nao zerar, esconder ou sanear esse saldo automaticamente.

### 3.5 Datas e inventarios

Separar data efetiva do consumo, instante de registro e instante de consolidacao do inventario, preservando os valores originais.

Reconstruir o saldo na ordem dos eventos persistidos. Vendas cobertas por uma contagem posterior podem atualizar historico/minimos, mas nao devem gerar nova baixa na posicao atual ja consolidada. Para eventos no mesmo dia, exigir ordenacao suficientemente fundamentada; nao assumir que todas as vendas ocorreram antes ou depois da contagem.

Relatorio consolidado que atravessa o corte de inventario, sem detalhamento diario suficiente, gera pendencia de periodo. Nao distribuir quantidades por dias arbitrariamente.

Se a importacao retroativa alterar a disponibilidade usada por operacoes posteriores, apresentar conflito e exigir conciliacao explicita. Nao recalcular silenciosamente alocacoes historicas ja confirmadas. Producao registrada depois, mas realizada antes da venda, exige conferir a data real para nao baixar materia-prima duas vezes.

Com inventario aberto, persistir a intencao autorizada como aguardando consolidacao, nao como baixa concluida. Apos o fechamento, reconstruir/revalidar o plano com o estoque consolidado. A fila legada nao pode aplicar uma alocacao congelada antes da contagem. Aguardar aplicacao e um estado visivel e retomavel, inclusive apos sair do navegador.

## 4. Arquitetura sem crescimento do App.tsx

Separar arquivos so nao garante menos peso: o motor de estoque ficara no servidor, e a interface especifica sera carregada sob demanda.

Arquivos propostos, ajustaveis aos contratos encontrados durante a implementacao:

- `server/salesConsumptionPlanner.js`: motor puro de decomposicao, classificacao de barreiras, alocacao e pendencias. Sem Express, React, Prisma ou efeitos de gravacao.
- `server/inventoryLedger.js`: leitura/reconstrucao cronologica de saldos por empresa, centro, item e corte. Extrair regras existentes com testes de paridade; nao inventar um segundo conceito de saldo.
- `server/salesImports.js`: rotas autenticadas, simulacao, confirmacao, retomada, cancelamento e transacoes.
- `src/domain/salesImports.ts`: contratos de resposta, normalizacao e apresentacao do plano. Nao duplicar o motor recursivo no navegador.
- `src/hooks/useSalesImportPosting.ts`: chamadas da API, estados de carregamento/erro, confirmacao e atualizacao das entidades afetadas; extrair do App os handlers substituidos.
- `src/components/SalesImportPostingPanel.tsx`: previa, alertas, pendencias, detalhes e comandos de confirmacao/retomada/estorno. Carregamento por `lazy`/`Suspense`.
- `server/prisma/schema.prisma` e migration aditiva: operacoes, alocacoes e pendencias persistentes, com indices e restricoes unicas.
- `scripts/test-sales-consumption-planner.mjs`, `scripts/test-sales-import-posting.mjs` e `scripts/test-sales-import-browser.mjs`: testes puros, de API e de navegador, somente em banco local isolado.

`src/App.tsx` recebe apenas import/integracao, props estritamente necessarias e remocao dos trechos substituidos. Meta: reducao liquida, sem motor novo, JSX grande, polling novo ou calculo de cascata a cada digitacao/render global. `server/server.js` recebe registro pequeno do modulo, sem concentrar o novo fluxo nele.

Nao ampliar essa entrega para extrair paineis nao relacionados. Apos a migracao, remover a logica antiga substituida; nao manter dois caminhos concorrentes de lancamento para um mesmo lote.

## 5. Persistencia e contrato da operacao

### 5.1 Separar demanda comercial de baixa fisica

Preservar o historico analitico de venda/consumo que alimenta minimos, producao, requisicoes e compras. A alocacao fisica em cascata sera uma trilha separada, ligada a essa demanda. Nao substituir consumo historico de preparo por materia-prima nem somar ambas as trilhas no calculo dos minimos.

Guardar, em registros adicionais:

- Operacao: lote, empresa, centro, versao do motor, chave idempotente, estado, autor autenticado, datas e assinatura/revisao dos dados usados.
- Alocacao: linha/demanda de origem, ficha raiz, caminho e receitas/rendimentos utilizados, item efetivamente baixado, quantidade/unidade, empresa/centro, saldo anterior/posterior e vinculo dos movimentos persistidos.
- Pendencia: motivo, caminho, quantidade ainda nao atendida na unidade da demanda original, dependencias necessarias e historico de resolucao.
- Estorno: vinculo com alocacoes originais e seus movimentos inversos, sem recalcular pela receita ou saldo atual.

O progresso da demanda deve ser expresso na sua unidade original. Exemplo: nao subtrair gramas de uva da quantidade de unidades pendentes sem a conversao registrada no caminho.

Preservar compatibilidade dos campos antigos. Um unico `stockMovementId` nao sera usado como se representasse todas as novas alocacoes. Novos IDs devem ser gerados no servidor; nunca derivados de nomes ou maximos calculados no navegador.

### 5.2 API proposta

- `POST /api/sales-import-batches/:id/posting-preview`: simular a partir do banco, sem movimentar estoque.
- `POST /api/sales-import-batches/:id/posting-confirm`: confirmar com chave idempotente e versao da previa.
- `GET /api/sales-import-batches/:id/posting-details`: recuperar estado, alocacoes e pendencias persistidas.
- `POST /api/sales-import-batches/:id/posting-resume`: processar somente o residual autorizado, apos regularizacao.
- `POST /api/sales-import-batches/:id/posting-reverse`: estornar as alocacoes efetivas e cancelar o residual.

Nomes sao proposta tecnica, nao endpoints ja existentes. Todos devem validar autenticacao, acesso a empresa/centro e permissoes de importar/lancar/cancelar; ator, quantidades e destinos nao sao confiados ao cliente.

### 5.3 Consistencia, repeticao e concorrencia

Confirmar movimentos, alocacoes, status e log master na mesma transacao. Antes de gravar, revalidar saldos, receitas, politicas, rotas, corte e pendencias. Previa desatualizada exige nova conferencia, nao aprovacao automatica de valores diferentes.

Repetir o mesmo comando deve retornar a operacao existente, sem duplicacao. Tratar perda da resposta apos commit, cliques duplos, duas abas, token vencido, falha de rede e retomada apos reinicio. Erro de autenticacao nunca vira sucesso ou gravacao apenas local.

Coordenar a concorrencia com TODOS os escritores relevantes de estoque: vendas, producao, suprimentos/recebimentos, movimentos pendentes e fechamento de inventario. Uma trava usada somente pelo importador nao protege o saldo. Mapear os caminhos atuais e fazer somente as integracoes indispensaveis, com testes de regressao e travas curtas. Reservas pendentes nao podem ser reutilizadas por outra operacao.

Nao substituir a sincronizacao das contagens nem adicionar debounce a sua persistencia. O banco e a fonte de verdade.

### 5.4 Lancamento parcial

Padrao seguro: se houver pendencia, nao apresentar a confirmacao como lancamento integral. Disponibilizar acao explicita para aplicar somente a parte resolvida, mostrando quantidades e pendencias antes da confirmacao.

Gravar a parte aceita e o residual na mesma transacao. Estado visivel: parcial com pendencias. Retomada processa apenas o residual e nao repete baixas ja feitas. No primeiro incremento tecnico, validar o caminho integral antes de habilitar o parcial.

## 6. Interface e desempenho

A previa deve mostrar empresa/centro, periodo, inventario de referencia, baixas diretas de preparos, faltas resolvidas pela composicao, produtos que ficarao negativos e pendencias. Detalhes expansivos devem permitir ler a cadeia completa sem recalcular o plano.

Prever carregando, falha, previa vencida, aguardando inventario, parcial, concluido e estornado. So mostrar sucesso apos confirmacao do servidor. Campos editaveis e decisoes devem sobreviver ao retorno de autenticacao quando pertinente, sem supor que foram salvos.

Consumo teorico deve ser identificado como tal. Nao introduzir novas garantias de custo real por lote/FIFO, pois esse controle nao faz parte desta entrega. Preservar custo/taxa de transferencias existentes, sem aplicar acrescimo repetido a cada nivel.

Buscar dados por escopo, indexar itens/receitas/eventos uma vez por simulacao e limitar consultas repetitivas. Detalhes grandes podem ser paginados. Nao carregar todas as empresas ou imagens das fichas no calculo.

Medir antes/depois: linhas de App.tsx, tamanho inicial e chunks adiados, tempo de abrir paineis, resposta de clique/digitacao e duracao de simulacao com dados representativos. Extracao deve ser real: o motor do servidor nao entra no bundle do navegador. Nenhum aumento injustificado do chunk inicial ou regressao perceptivel nos fluxos existentes sera aceito.

## 7. Fases e criterios de passagem

### Fase 1 - Congelar referencia e caracterizar

Criar fixtures locais dos cenarios e registrar saidas atuais de minimos, filas, compras e saldos. Comparar os caminhos de vendas, producao, suprimento e consolidacao. Registrar baseline de desempenho e os testes que ja existem.

Entrega: contratos, matriz de testes e ponto de restauracao de codigo/dados locais. Nenhuma mutacao online.

### Fase 2 - Extrair integracao existente sem mudar regra

Extrair os handlers de lancamento/estorno e a superficie afetada para hook/componente. Criar testes de caracterizacao da logica de saldo a ser reutilizada pelo servidor. Preservar importacao analitica, de-para, aliases, ignoreStock e calculo de minimos.

Passagem: testes de paridade aprovados, App.tsx menor, fluxo atual funcional e sem regressao de desempenho. Nao publicar uma extracao intermediaria sem as mesmas validacoes operacionais.

### Fase 3 - Motor e previa somente leitura

Implementar decomposicao, saldo parcial, regras de localidade/barreiras, datas e rastreio. Adicionar simulacao sem baixa. Auditar as politicas propostas por ficha/centro e validar as excecoes antes de ativacao.

Passagem: casos numericos e barreiras aprovados; simulacao nao altera saldos nem minimos.

### Fase 4 - Persistencia e baixa integral

Migration aditiva, IDs gerados no servidor, operacao idempotente e commit atomico. Integrar concorrencia com os demais escritores. Incluir historico, autenticacao, corte de inventario e estorno exato. So entao substituir o lancamento legado para lotes novos habilitados.

Passagem: nenhuma duplicidade ou gravacao parcial invisivel, inclusive nas falhas induzidas.

### Fase 5 - Excecoes, parcial e inventario aberto

Implementar residual retomavel, resolucao de pendencias, fila ligada ao inventario e revalidacao depois de sua consolidacao. Impedir exclusao/reprocessamento que abandone movimentos de uma operacao. Manter o tratamento legado dos lotes antigos, sem migracao operacional automatica.

Passagem: sair/reentrar, fechar inventario e retomar preservam operacoes e contagens de todos os usuarios; nenhum residual e perdido ou aplicado duas vezes.

### Fase 6 - Validacao integrada

Rodar matriz automatizada e navegador desktop/mobile em banco local isolado. Comparar a cadeia completa: venda -> posicao de estoque -> minimo -> requisicao -> producao -> compras -> suprimentos/recebimento.

Passagem: comandos obrigatorios e regressao operacional aprovados. Falha em qualquer etapa bloqueia deploy.

### Fase 7 - Publicacao e piloto controlado

Publicar com recurso desabilitado por padrao. Conferir bundle online e autenticacao. Habilitar somente o escopo aprovado da Casa de Mi Madre, primeiro em simulacao. Conferir a previa de um lote real antes de qualquer baixa autorizada. Expandir somente apos conferencia do saldo e dos logs.

Passagem: evidencia de previa x movimentos x saldo x estorno e nenhuma alteracao automatica em outras empresas ou importacoes antigas.

## 8. Matriz minima de testes

- T01: saldo suficiente de preparo -> baixa somente do preparo; nenhuma materia-prima descontada novamente.
- T02: preparo sem saldo -> cascata local ate produto, sem entrada de producao ficticia.
- T03: saldo parcial em varios niveis -> decompor apenas a falta em cada nivel.
- T04: Pewen -> 2 unidades = 500 / 63 * 2 = aproximadamente 15,87301587 G de uva; com 1 unidade em saldo, apenas aproximadamente 7,93650794 G seguem pela falta.
- T05: varias vendas e fichas consomem o mesmo preparo/produto -> um mapa de saldo; nenhum reaproveitamento indevido.
- T06: materia-prima insuficiente -> saldo negativo informado e confirmado; preparo nao recebe nova baixa negativa.
- T07: preparo ja negativo -> divergencia explicita, sem zeramento automatico.
- T08: outro centro/empresa -> falta gera pendencia; nenhum insumo de origem movimentado pelo importador do destino.
- T09: ficha compartilhada com producao local -> permite cascata conforme politica do centro, sem confundir posse e producao.
- T10: subproduto/retorno sem saldo -> pendencia; sem duplicar tomate ou gerar sumo ficticio.
- T11: equivalentes -> nao substituir automaticamente; honrar composicao/confirmacao e producoes ja registradas.
- T12: aliases PDV e linhas com codigos diferentes -> consolidacao correta, preservando politica de duplicatas; nao descartar vendas legitimas.
- T13: EXECUCAO, VENDA/combo e PRODUTO_INTERNO -> respeitar regras de composicao e a politica de estoque de cada tipo.
- T14: decimais `0.125`, `0,125`, `1.000`, valores negativos, escalas G/ML/UN e perdas -> quantidades corretas e sem conversao de massa para volume nao cadastrada.
- T15: ignoreStock e ingredientes/guarnicoes inativos -> sem baixa fisica indevida; historico/minimos preservados conforme regra existente.
- T16: ciclo, ficha ausente, rendimento zero e unidade invalida -> pendencia clara, sem sucesso falso ou recursao infinita.
- T17: venda anterior/posterior/no mesmo dia do inventario e semana que atravessa corte -> sem dupla baixa; ambiguidade fica explicita.
- T18: inventario aberto -> intencao persistida; depois do fechamento, replanejar e aplicar uma vez, sem modificar contagens individuais.
- T19: duas abas, dois lotes concorrentes, producao e suprimento simultaneos -> mesmo saldo nao pode ser alocado duas vezes pela nova regra.
- T20: receita/rota/saldo mudam entre previa e confirmacao -> rejeitar previa vencida e pedir nova conferencia.
- T21: resposta perdida apos commit, retry e reinicio -> mesma operacao, mesmos IDs e nenhuma duplicacao.
- T22: 401, 403 e falha no meio da transacao -> nenhum sucesso falso; banco e trilha consistentes.
- T23: parcial, regularizacao, retomada e cancelamento -> residual correto, sem repetir baixas ou recalcular estorno pela receita atual.
- T24: legado -> lotes antigos, minimos, cancelamento e permissoes de suprimento continuam acessiveis; divergencia de legado exige conferencia, nao correcao automatica.
- T25: abrir/selecionar inventario, iniciar/continuar, contar, sair/voltar, resumo e consolidacao com dois usuarios -> todos os registros persistidos e preservados.
- T26: fluxo completo ate compras/suprimentos, taxas entre empresas, painel master e exportacoes -> mesma demanda analitica, movimentos novos corretamente discriminados.
- T27: desktop/mobile, navegacao e digitacao -> sem nova lentidao, perda de letras ou atualizacoes globais por tecla.

## 9. Comandos obrigatorios e evidencias

Antes de publicar, executar e registrar:

- `npx tsc -p tsconfig.app.json --noEmit --pretty false`
- `node --check server/server.js` e verificacao equivalente dos novos modulos do servidor.
- `git diff --check`
- `npx vite build`
- Geracao do Prisma e validacao/aplicacao da migration em banco local isolado.
- Testes novos puros/API/browser e regressao de producao ja existente.
- Smoke multiusuario de inventario/contagem e fluxo operacional completo afetado.

Registrar causa, arquivos, regras, resultado dos testes, desempenho, pendencias e rollback em `docs/WORKLOG.md`. Preparar copia de seguranca antes de operacao real autorizada. Gerar evidencia editavel de previa, alocacoes, pendencias e conferencias quando houver auditoria de dados reais.

## 10. Compatibilidade e rollback

Migration somente aditiva; nenhuma exclusao ou reclassificacao automatica de contagens e lotes existentes. Identificar operacoes novas por versao do motor.

Cancelar/reprocessar/excluir um lote novo deve passar pelo servico de operacoes, nunca pelo CRUD legado que poderia deixar movimentos orfaos. Preservar as rotas antigas para leitura/compatibilidade onde forem seguras, bloqueando bypass para lotes gerenciados pelo motor novo.

Na desativacao do recurso, bloquear novas baixas desse motor, mas manter consulta, resolucao e estorno de operacoes ja gravadas. Nao encaminhar um lote novo parcialmente aplicado ao lancamento legado. Nao apagar migrations/tabelas com operacoes existentes nem restaurar `/api/state` ou um backup completo sobre contagens novas.

Para lotes antigos sem trilha completa, conferir os movimentos persistidos antes de qualquer estorno ou migracao; nao reconstruir automaticamente como se tivessem sido calculados pela regra nova.

## 11. Decisoes para validar antes do piloto

1. Politicas por ficha/centro: validar a lista proposta de conversoes e preparos locais, com STOCK_ONLY como padrao seguro onde houver duvida. Nao classificar em massa pelo nome.
2. PRODUTO_INTERNO: recomendacao inicial STOCK_ONLY; excecoes de montagem local precisam de aprovacao explicita.
3. Relatorios sem data diaria suficiente: manter pendencia se atravessarem um inventario; nao ratear vendas arbitrariamente.
4. Lancamento parcial: acao separada e explicita, com residual visivel; nunca apresentar o lote como integralmente baixado.

Essas decisoes nao impedem implementar e testar o motor em copia local. Nenhum piloto deve modificar estoque real sem a previa e o escopo aprovados.

## 12. Estado da entrega original de planejamento (18/10)

- Plano registrado no projeto e copia DOCX para conferencia.
- Codigo da aplicacao/servidor, banco online, saldos, receitas e configuracoes nao alterados.
- Nenhum deploy realizado.
- Validacao desta etapa: leitura do codigo/configuracoes, integridade do documento e verificacao do diff documental. Builds e testes operacionais ficam para a implementacao; nao sao apresentados como executados nesta etapa.

## 13. Implementacao (19/10)

- Motor, livro de saldos, API transacional, operacoes persistentes e painel lazy implementados em modulos separados. App.tsx reduzido de 60.520 para 60.225 linhas.
- Consumir saldo de preparo primeiro; decompor somente a falta local permitida; produtos negativos exigem confirmacao. Rotas externas, subprodutos/retornos, dados invalidos e cortes ambiguos ficam pendentes.
- Historico analitico/minimos mantidos separados das alocacoes fisicas. IDs de novos lotes/linhas/consumos e movimentos gerados no servidor, sem sobrescrever IDs existentes.
- Intencao durante inventario aberto e residual parcial persistem. Apos regularizacao/fechamento, o usuario deve reabrir a conferencia, simular e confirmar; nao ha aplicacao automatica de plano antigo.
- Confirmacao, movimentos, status e auditoria sao atomicos. A gravacao inicial das linhas de importacao ainda usa requisicoes separadas: importacao incompleta bloqueia a confirmacao de estoque e exige concluir/reprocessar antes de lancar.
- Feature desabilitada por padrao em todos os centros. Lotes antigos nao sao migrados nem recalculados automaticamente.
- Validacoes e fronteira de publicacao devem ser consultadas no registro de implementacao em docs/WORKLOG.md.
- Antes do piloto: validar politicas/rotas das fichas reais, periodo da importacao, eventuais negativos preexistentes e previa do lote. Nenhuma autorizacao de postagem real foi presumida.

## 14. Regra esclarecida pelo usuario - conversoes sem fila (19/10)

- Ausencia de centro produtor pode ser intencional para ocultar uma ficha de conversao da fila; nao e, por si so, uma barreira a cascata.
- Nao significa saldo zero: consultar o saldo persistido, consumir somente o disponivel e decompor apenas a falta pela composicao.
- PREPARO sem nenhum centro produtor pode continuar automaticamente pela composicao, sem alterar cadastro, gerar entrada ficticia ou aparecer na fila. Isso tambem vale em centro nao produtor e ficha compartilhada visivel no escopo autorizado.
- Rotas para outro centro, produtor explicitamente em outro centro, subprodutos/retornos, bloqueio STOCK_ONLY e divergencias negativas anteriores permanecem barreiras.
- PRODUTO_INTERNO continua somente saldo por padrao; nenhuma liberacao automatica foi ampliada para esse tipo.
- Regra `CASCADE_V1.1_COMPOSITION_ONLY` participa da assinatura da previa e da auditoria. Uma previa antiga precisa ser atualizada apos a publicacao.
