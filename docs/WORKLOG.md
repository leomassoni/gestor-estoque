# Worklog

 Ultima atualizacao: 2026-09-01

## Objetivo deste arquivo

Registrar um historico resumido do que foi feito, do que falhou e do que ficou pendente.

## 2026-09-01

### Correcao de roteamento de producao CPXVA/Macaxeira

- Auditados 3 casos reportados na fila de `Entrada de producoes` envolvendo `COMPLEXO VILA ANALIA` e `MACAXEIRA POIS POIS`.
- `PURE GOIABA`: havia duas fichas ativas diferentes:
  - `id=476`, origem `COMPLEXO VILA ANALIA`, produzida no `LABORATORIO`, compartilhada com Macaxeira;
  - `id=828`, origem `MACAXEIRA POIS POIS`, produzida pelos bares Macaxeira.
- Correcao aplicada para seguir a regra operacional de producao somente no laboratorio:
  - usos ativos da ficha duplicada Macaxeira foram redirecionados para o produto da ficha `id=476`;
  - ficha duplicada `id=828` foi inativada e teve `productionCenters` limpo;
  - produto tecnico `PRE-MTB6D1C9-55RSUM` foi inativado/renomeado para `PURE GOIABA - DUPLICADO INATIVO MACAXEIRA`;
  - minimo stale do centro `BAR MACAXEIRA POIS POIS` foi migrado da ficha `id=828` para `id=476` e deduplicado.
- `XAROPE DE CAJA 53.5` (`id=79`): estava produzido apenas pelos centros Macaxeira `10`, `11` e `12`; foi adicionado tambem ao `LABORATORIO` (`stockCenterId=1`), mantendo os produtores Macaxeira.
- `PINDORAMA PRE-BATCHED` Macaxeira (`id=826`): a ficha ativa estava sem o ingrediente `MACA VERDE GRANNY SMITH CLARIFICADO`; o ingrediente foi reativado/corrigido com `productId=PRE-MRFLF21B-7ZBYNH`, quantidade `600`.
- Varredura de casos semelhantes:
  - a unica dependencia de requisicao do laboratorio que nao resolvia para produtor era `XAROPE DE CAJA 53.5` via `BATIDA CAJA PRE-BATCHED`;
  - as duplicidades ativas relevantes com divergencia de ingredientes eram `PINDORAMA PRE-BATCHED` e `BOMBEIRINHO COLLINS PRE-BATCHED`; o segundo ficou apenas como observacao porque a versao Macaxeira ja usa `PRE-BATCHED NAO E PINK`, conforme correcao manual do usuario.
- Complemento da varredura apos relato de `TINTURA ALCOOLICA HIBISCO SECO`:
  - causa encontrada: a fila aceitava `producedTechnicalSheetIds` do centro como fonte de verdade alternativa a `technicalSheet.productionCenters`;
  - o centro `BAR MACAXEIRA POIS POIS` ainda tinha os IDs obsoletos `335` (`PINDORAMA PRE-BATCHED` antigo CPXVA) e `649` (`TINTURA ALCOOLICA HIBISCO SECO`) em `producedTechnicalSheetIds`, mesmo sem esses centros nos `productionCenters` das fichas;
  - limpeza online aplicada removendo `335` e `649` do centro `10`, log `#1837`;
  - ajuste de codigo: `doesCenterDirectlyProduceTechnicalSheet` passou a considerar apenas `technicalSheet.productionCenters` como fonte autoritativa da producao;
  - rechecagem online: `0` preparos ativos restantes com divergencia entre centro produtor e `productionCenters`.
- Origem de requisicao na fila de entrada de producoes:
  - detalhes de origem passam a usar a requisicao original quando houver `sourceRequisitionId`;
  - alem de usuario e horario, o detalhe mostra empresa e centro de estoque requisitor, por exemplo `Requisicao #151 de MACAXEIRA POIS POIS • BAR MACAXEIRA POIS POIS`.
- Origem de compras derivadas de producao:
  - causa encontrada: ao gerar requisicao de insumos a partir da fila de producao, as linhas de produto recebiam fallback para o centro produtor (`COMPLEXO VILA ANALIA • LABORATORIO`) em vez de herdar a origem da requisicao que abriu a producao;
  - ajuste de codigo: a fila de producao recompõe `sourceAllocations` a partir de `sourceRequisitionId` e `sourceRequisitionLineKey`, propagando empresa/centro requisitor ate as linhas de suprimentos e compras;
  - reparo online aplicado nas requisicoes `#156` e `#158`: 62 linhas em cada uma passaram a apontar para `MACAXEIRA POIS POIS • BAR MACAXEIRA POIS POIS`, log `#1847`.
  - protecao no backend: updates de requisicoes preservam `sourceAllocations` ja gravadas em linhas existentes, salvo reparo administrativo com `x-allow-source-allocation-overwrite: true`, evitando que abas antigas sobrescrevam a origem correta.
- Validacao online apos correcao:
  - `XAROPE DE CAJA 53.5` resolve para produtores `[1,10,11,12]`;
  - `MACA VERDE GRANNY SMITH CLARIFICADO` segue produzido somente no `LABORATORIO`;
  - `PURE GOIABA` ativo em Macaxeira aponta para a ficha compartilhada `id=476`, sem referencias ativas ao produto duplicado;
  - nenhuma dependencia ativa da fila do laboratorio ficou sem produtor resolvido.
- Logs online: `#1833`, `#1834`, `#1835` e `#1836` (`#1832` tambem foi gerado para a primeira migracao parcial do pure).
- Relatorios locais:
  - `auditorias/production-routing-focus-audit-20260901.json`
  - `auditorias/production-routing-dependency-problems-20260901.json`
  - `auditorias/macaxeira-cpxva-duplicate-prep-divergences-20260901.json`
  - `auditorias/macaxeira-production-routing-postfix-verification-20260901.json`
  - `auditorias/macaxeira-production-routing-cases-fix-20260901T034948Z.json`
- Script rastreavel: `scripts/fix_macaxeira_production_routing_cases.py`.

## 2026-08-30

### Correcao de contagem decimal e compra derivada de producao na Madre

- Caso auditado no online para `CASA DE MI MADRE LTDA` (`companyId=13`): o minimo de `PRE-BATCH EFFEMERA 1L` existia no `BAR DE BAIXO`, mas a requisicao ativa nao gerou linha de producao nem compra de `TIQUIRA GUAAJA CARVALHO`.
- Causa encontrada: uma contagem digitada como `1.575` no input numerico foi interpretada pelo parser geral como `1575`, gerando saldo persistido de `1.575.000 ML` para `PRE-BATCH EFFEMERA 1L`. Com esse saldo artificial, o sistema entendeu que o bar estava coberto e nao abriu a cadeia operacional ate a Tiquira.
- Foi encontrado e corrigido online o mesmo padrao em dois registros da Madre:
  - contagem `260`: `PRE-BATCH EFFEMERA 1L`, total `1.575.000 ML` -> `1.575 ML`;
  - contagem `182`: `XAROPE DE ERVAS ANDINAS`, total `1.192.000 ML` -> `1.192 ML`.
- Ajuste aplicado no codigo:
  - criado `parseNumericInputDecimal` para campos numericos digitados, preservando `parseDecimal` para textos formatados e rotulos do sistema;
  - calculos de contagem de inventario passam a interpretar `1.575` de input numerico como decimal;
  - quantidades operacionais de requisicao/compra em embalagens passam a arredondar para cima, evitando subpedido de faltas fracionarias.
- Validacao executada:
  - API online confirmou `0` contagens restantes da Madre com padrao contaminado `1.000.000`;
  - rechecagem confirmou que os registros online de `PRE-BATCH EFFEMERA 1L` no `LABORATORIO` eram contagens fisicas (`LABORATORIO`/`FREEZER`), nao movimentos operacionais com local `ENTRADA DE PRODUCAO`;
  - API online confirmou `0` movimentos operacionais de producao (`ENTRADA DE PRODUCAO`/`SAIDA PARA PRODUCAO`) envolvendo Effemera, `0` solicitacoes manuais de producao e `0` rascunhos de producao ativos para essa ficha;
  - simulacao apos correcao: minimo Effemera `9.380 ML`, saldo bar `4.150 ML`, falta `5.230 ML`, requisicao esperada `6 x 1.000 ML`; considerando saldo do laboratorio, necessidade prevista de Tiquira aproximadamente `953 ML`, ou `2` garrafas de `500 ML`;
  - `npm run build`.

## 2026-08-29

### Correcao de Entrada de producoes sem requisicao no Laboratorio CPXVA

- Bug confirmado no online para `COMPLEXO VILA ANALIA` (`companyId=2`): `/api/requisitions`, `/api/manual-production-requests` e `/api/production-drafts` nao tinham registros ativos da empresa, mas a tela de `Entrada de producoes` ainda podia exibir demandas do `LABORATORIO`.
- Causa no frontend: o contexto operacional de producao somava o minimo/historico de centros consumidores externos (`externalUseMinimum`) como demanda direta do centro produtor. Isso fazia o `LABORATORIO` herdar minimo de bares consumidores mesmo sem requisicao ativa.
- Regra corrigida:
  - a fila operacional de `Entrada de producoes` usa historico/minimo proprio do centro, solicitacoes manuais e requisicoes ativas;
  - minimo/historico de outro centro consumidor continua podendo aparecer em consolidado/relatorios, mas nao cria entrada operacional no centro produtor sem requisicao.
- Ajuste aplicado em [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx): `buildPreparationDemandContext` ganhou a opcao `includeExternalUseMinimum`; a fila de producao e a geracao de requisicao de insumos do centro produtor passam `false`.
- Validacao executada:
  - leitura da API online confirmou `0` requisicoes, `0` solicitacoes manuais de producao e `0` rascunhos de producao para `companyId=2`;
  - `npm run build`.

### Importacao fake de vendas para minimo do Bar Macaxeira Pois Pois

- A planilha `/home/leomassoni/Downloads/Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).xlsx` foi tratada como relatorio fake de vendas para gerar minimo de estoque do centro `BAR MACAXEIRA POIS POIS` (`companyId=5`, `stockCenterId=10`).
- Criada na propria planilha a aba `Importacao vendas`, com as colunas `DATA`, `ID interno`, `Quantidade` e `Ficha origem resumo`, preservando os IDs internos `VEN-*`/`EXE-*` como fallback do fluxo natural de importacao de vendas.
- O import foi aplicado no online como consumo da semana passada, usando data `2026-08-23` para representar a semana `2026-08-17` a `2026-08-23`.
- Resultado online validado:
  - lote de importacao `7`, codigo `IMP-C5-CE10-20260829-0007`;
  - 225 linhas importadas, 0 sem match, 0 duplicadas e 0 invalidas;
  - 763 consumos analiticos registrados;
  - 122 minimos sugeridos no centro, sendo 78 de `PRODUTO` e 44 de `PREPARO`;
  - log de auditoria `1599`.
- As 7 linhas sem `Quantidade de venda` na aba `Resumo` foram omitidas do import:
  - `AQUA LOCALE COM GAS`
  - `AQUA LOCALE SEM GAS`
  - `CERVEJA CORONA 330 ML VENDA`
  - `CERVEJA CORONA CERO 330 ML VENDA`
  - `CERVEJA ORIGINAL 600ML VENDA`
  - `CERVEJA SPATEN 600ML VENDA`
  - `CERVEJA STELLA PURE GOLD 600 VENDA`
- Backup online salvo em [`backups/online-before-macaxeira-fake-sales-import-20260829T015839`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/online-before-macaxeira-fake-sales-import-20260829T015839).
- Backup da planilha salvo em `/home/leomassoni/Downloads/Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).backup-before-sales-import-sheet-20260829T015839.xlsx`.
- Relatorios salvos em:
  - [`auditorias/macaxeira-fake-sales-import-20260829T015825.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-fake-sales-import-20260829T015825.json)
  - [`auditorias/macaxeira-fake-sales-import-20260829T015839.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-fake-sales-import-20260829T015839.json)

### Cadastro complementar de fichas de venda de doses Macaxeira

- A planilha `/home/leomassoni/Downloads/Bebidas sistema rancho macaxeira-pois pois 2026.xlsx` foi usada para cadastrar as fichas de venda de doses que faltavam na lista enviada pelo usuario.
- Todas as fichas foram cadastradas/validadas com origem em `MACAXEIRA POIS POIS` (`ownerCompanyId=5`) e compartilhadas com `FAZENDA MACAXEIRA` e `BOTECO MACAXEIRA` (`sharedCompanyIds=[8,9]`).
- Nenhum produto base novo precisou ser cadastrado nesta rodada; os produtos ja existiam no online ou ja estavam mapeados pela aba `Cadastro venda garrafas`.
- A ficha `DS ANISIO DE SANTIAGO BALSAMO 50ML` ja existia e foi mantida.
- Foram criadas 16 fichas novas de dose e, em seguida, reparadas para garantir leitura da faixa correta de doses da `Planilha1`: ingrediente `50 ML`, preco de venda da dose e CMV calculado pelo custo da embalagem existente.
- Observacao pendente: o produto base `CACHACA SANTA TEREZINHA SASSAFRAS` existe, mas segue com custo de embalagem vazio/zerado; a ficha foi criada com `CMV desejado` padrao `40` ate validacao/correcao desse custo.
- A aba `Resultado cadastro doses` foi criada/atualizada na planilha com IDs reais, acao aplicada, produto base, preco, volume e observacoes.
- Backups online:
  - [`backups/online-before-macaxeira-missing-dose-sale-sheets-20260829T010624`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/online-before-macaxeira-missing-dose-sale-sheets-20260829T010624)
  - [`backups/online-before-repair-macaxeira-dose-sale-sheets-20260829T010859`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/online-before-repair-macaxeira-dose-sale-sheets-20260829T010859)
- Relatorios:
  - [`auditorias/macaxeira-missing-dose-sale-sheets-20260829T010624.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-missing-dose-sale-sheets-20260829T010624.json)
  - [`auditorias/macaxeira-dose-sale-sheet-values-repair-20260829T010859.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-dose-sale-sheet-values-repair-20260829T010859.json)
- Validacao posterior por API: as 17 fichas-alvo aparecem para as empresas `5`, `8` e `9`, sem divergencia de origem, compartilhamento, tipo, status ativo, preco ou quantidade.

### Preenchimento de IDs internos em resumo Macaxeira

- A planilha `/home/leomassoni/Downloads/Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).xlsx` teve a coluna `ID interno` da aba `Resumo` preenchida com os IDs internos das fichas visiveis para `MACAXEIRA POIS POIS` (`companyId=5`).
- Foram preenchidas 233 linhas:
  - 98 fichas de `VENDA`;
  - 135 fichas de `EXECUCAO`.
- A correspondencia foi feita por nome normalizado contra `/api/technical-sheets?companyId=5`, priorizando ficha ativa com origem na empresa 5 quando aplicavel.
- Resultado da conferencia: 0 linhas sem ID, 0 divergencias contra a API e 0 divergencias contra as abas individuais da propria planilha.
- Duas fichas do resumo sao visiveis em Macaxeira por compartilhamento a partir do `COMPLEXO VILA ANALIA`, nao por origem Macaxeira:
  - `CAJU AMIGO` (`EXE-MQLKMSLX-DN6TXK`)
  - `NAO E PINK LIMONADE` (`EXE-MQ19JG1E-Y6PTED`)
- Backup da planilha salvo em `/home/leomassoni/Downloads/Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).backup-before-fill-internal-ids-20260829T013646.xlsx`.
- Relatorios salvos em:
  - [`auditorias/macaxeira-summary-internal-ids-20260829T013646.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-summary-internal-ids-20260829T013646.json)
  - [`auditorias/macaxeira-summary-internal-ids-validation-20260829T013746.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-summary-internal-ids-validation-20260829T013746.json)

### Preenchimento de quantidades de venda em resumo Macaxeira

- A coluna `Quantidade de venda` da aba `Resumo` da planilha `/home/leomassoni/Downloads/Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).xlsx` foi preenchida a partir da coluna correspondente da aba `Resumo` da planilha `/home/leomassoni/Downloads/Para devolver Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-27.xlsx`.
- Foram preenchidas 226 linhas:
  - 197 por correspondencia exata de nome;
  - 16 por correspondencia de dose com nome base (`DS ... 50ML` para a linha original da dose);
  - 8 sucos de `EXECUCAO` usando o primeiro bloco da planilha devolvida, com quantidade `200`;
  - 5 aliases claros (`DS INSINUANTE UMBURANA 50ML` e doses de licor da casa).
- Permaneceram 7 linhas vazias porque nao havia linha correspondente na planilha devolvida:
  - `AQUA LOCALE COM GAS`
  - `AQUA LOCALE SEM GAS`
  - `CERVEJA CORONA 330 ML VENDA`
  - `CERVEJA CORONA CERO 330 ML VENDA`
  - `CERVEJA ORIGINAL 600ML VENDA`
  - `CERVEJA SPATEN 600ML VENDA`
  - `CERVEJA STELLA PURE GOLD 600 VENDA`
- Backups da planilha salvos em:
  - `/home/leomassoni/Downloads/Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).backup-before-fill-sales-quantity-20260829T014206.xlsx`
  - `/home/leomassoni/Downloads/Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).backup-before-fill-sales-quantity-aliases-20260829T014248.xlsx`
- Relatorios salvos em:
  - [`auditorias/macaxeira-summary-sales-quantity-from-returned-20260829T014206.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-summary-sales-quantity-from-returned-20260829T014206.json)
  - [`auditorias/macaxeira-summary-sales-quantity-aliases-20260829T014248.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-summary-sales-quantity-aliases-20260829T014248.json)

## 2026-08-27

### Cadastro online de fichas de venda de garrafas Macaxeira

- Criada a aba `Cadastro venda garrafas` na planilha `/home/leomassoni/Downloads/Bebidas sistema rancho macaxeira-pois pois 2026.xlsx` para organizar os cadastros das bebidas em garrafa a partir da linha 298.
- Criado no online o produto base `CACHACA DOM TAPPARO EXTRA PREMIUM 10 ANOS CARVALHO AMERICANO` com ID `PRD-MTB4PO1S-RY1382`, embalagem `750 MILLILITER` e custo de referencia `295,80`.
- Criadas no online 36 fichas de venda em garrafa para `MACAXEIRA POIS POIS`, compartilhadas com `FAZENDA MACAXEIRA` e `BOTECO MACAXEIRA`.
- Puladas 5 fichas de empório porque ja existiam no sistema.
- Relatorio de execucao salvo em [`auditorias/macaxeira-bottle-sale-sheets-20260827T031608.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-bottle-sale-sheets-20260827T031608.json).
- Planilha atualizada com os IDs reais na aba `Cadastro venda garrafas` e com a aba `Resultado cadastro online`.

### Correcao parcial de escopo de preparos Macaxeira

- A planilha corrigida `/home/leomassoni/Downloads/macaxeira_auditoria_escopo_execucao_venda_2026-08-25_revisada(1).xlsx` foi aplicada apenas nos pontos de `PREPARO` combinados:
  - preparos marcados como `macaxeiras` ou `macaxeiras pois pois` foram criados/remapeados para origem `MACAXEIRA POIS POIS`;
  - preparos marcados como `analia` foram mantidos no `COMPLEXO VILA ANALIA` com centro produtor `LABORATORIO`.
- Foram criados 7 preparos novos Macaxeira e retomado 1 preparo parcialmente criado na primeira tentativa, totalizando 8 preparos Macaxeira validados.
- Foram remapeadas 26 fichas consumidoras Macaxeira para usar os novos produtos `PRE-...` da Macaxeira.
- Foram ajustados 21 preparos Analia para garantir centro produtor `LABORATORIO` e manter compartilhamento necessario quando havia consumo Macaxeira.
- Apos conferencia no online, foram inativadas 6 fichas antigas de `PREPARO` no `COMPLEXO VILA ANALIA` que ja tinham versao Macaxeira ativa e nao tinham mais consumidores ativos:
  - `BOMBEIRINHO COLLINS PRE-BATCHED`
  - `INVASAO TROPICAL PRE-BATCHED`
  - `PINDORAMA PRE-BATCHED`
  - `PRE-BATCHED CARAVELA AFUNDADA`
  - `PURE GOIABA`
  - `REFRESCO DO SERTAO PRE-BATCHED`
- Mantidas temporariamente ativas no `COMPLEXO VILA ANALIA`, por ainda terem consumidores ativos no proprio Complexo:
  - `XAROPE DE CAJA`, consumida por `BATIDA CAJA PRE-BATCHED` e `TACAMA`
- A ficha de execucao `LISBOA E NOSSA` do `COMPLEXO VILA ANALIA`, marcada como `inativar` na planilha corrigida, foi excluida junto com seu produto vinculado `EXE-MRI0H8G0-5G4UNO`.
- Depois dessa exclusao, `LISBOA E NOSSA PRE-BATCHED` ficou sem consumidores ativos e foi inativada junto com seu produto vinculado `PRE-MRFPNXGB-MJ4H19`.
- Nao foram tratadas nesta rodada as duplicatas comerciais com divergencia de preco/composicao nem as lacunas de dependencia das fichas `todas as casas`.
- Backup dos endpoints publicado antes da aplicacao salvo em [`backups/online-before-macaxeira-corrected-prep-scope-20260827T040140`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/online-before-macaxeira-corrected-prep-scope-20260827T040140).
- Relatorio aplicado salvo em [`auditorias/macaxeira-corrected-prep-scope-20260827T040140.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-corrected-prep-scope-20260827T040140.json).
- Relatorio da inativacao complementar salvo em [`auditorias/inactivate-old-complexo-macaxeira-preps-20260827T040940.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/inactivate-old-complexo-macaxeira-preps-20260827T040940.json).
- Relatorio da exclusao de `LISBOA E NOSSA` e inativacao de `LISBOA E NOSSA PRE-BATCHED` salvo em [`auditorias/delete-lisboa-e-nossa-inactivate-prebatch-20260827T041516.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/delete-lisboa-e-nossa-inactivate-prebatch-20260827T041516.json).
- Corrigido `NECTAR DE MARACUJA`, marcado como `todas as casas`, para ficar compartilhado com todas as casas do grupo Vila Analia (`5,6,7,8,9,10,11,12`) e produzido nos centros produtores canonicos do grupo (`1,2,3,4,10,11,12,14`).
- O centro duplicado `13` do Boteco nao foi incluido; o centro canonico usado no fluxo Macaxeira e `11`.
- Relatorio da correcao salvo em [`auditorias/fix-nectar-maracuja-all-houses-20260827T042852.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/fix-nectar-maracuja-all-houses-20260827T042852.json).
- Corrigidos os outros 11 preparos marcados como `todas as casas` para ficarem compartilhados com todas as casas do grupo Vila Analia (`5,6,7,8,9,10,11,12`) e produzidos nos centros produtores canonicos (`1,2,3,4,10,11,12,14`).
- O ajuste sincronizou os dois lados do cadastro: `productionCenters` nas fichas e `producedTechnicalSheetIds` nos centros produtores.
- Backup dos endpoints antes da correcao salvo em [`backups/online-before-fix-all-houses-prep-centers-20260827T044309`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/online-before-fix-all-houses-prep-centers-20260827T044309).
- Relatorio da correcao salvo em [`auditorias/fix-all-houses-prep-centers-20260827T044309.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/fix-all-houses-prep-centers-20260827T044309.json).
- Validacao posterior por API salva em [`auditorias/fix-all-houses-prep-centers-20260827T044325.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/fix-all-houses-prep-centers-20260827T044325.json), com `beforeIssues: 0`.
- Corrigida a planilha `/home/leomassoni/Downloads/relatorio fake venda estoque minimo atualizado.xlsx` para remover IDs de produto `PRD-...` da lista de venda minima.
- Regra consolidada: a planilha de venda minima deve conter apenas fichas de `EXECUCAO` ou `VENDA`; produtos avulsos/garrafas de cadastro nao entram nessa base.
- Foram removidas 52 linhas de produto/garrafa sem ficha, normalizadas 5 linhas de venda que estavam marcadas como `Garrafa` e adicionadas 36 fichas de venda de garrafa na aba `Itens faltantes`, com `quantidade venda` vazia.
- Backup da planilha salvo em `/home/leomassoni/Downloads/relatorio fake venda estoque minimo atualizado.backup-before-remove-product-ids-20260827T045527.xlsx`.
- Relatorio da correcao salvo em [`auditorias/macaxeira-minimum-sales-remove-product-ids-20260827T045527.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/auditorias/macaxeira-minimum-sales-remove-product-ids-20260827T045527.json).

### Perfil de usuario e atribuicao de acessos

- Diagnosticado que o perfil `ADMINISTRATIVO` existia no online, ativo, mas nao aparecia para Rafael Welbert no cadastro de usuarios.
- Causa: o frontend ainda tratava `role` como hierarquia fixa e ocultava perfis `Administrativo`/`Gestor` para usuarios internos cujo papel efetivo nao fosse `Gestor`, mesmo quando eles tinham permissao de acessar `Usuarios`.
- Ajustado o cadastro de usuarios para que qualquer usuario com acesso a `Usuarios` possa ver e atribuir qualquer perfil ativo disponivel no escopo da empresa.
- Mantida a configuracao de permissoes por perfil como fonte real de acesso; os nomes/papeis `Administrativo`, `Gestor` e `Colaborador` deixam de bloquear a selecao no fluxo de cadastro de usuarios.
- Validacao executada:
  - `npm run build`

## 2026-08-26

### Requisicao do Laboratorio e minimo operacional

- Retomada feita apos interrupcao da sessao anterior causada por desligamento do computador.
- Corrigido diagnostico sobre ponto de milhar:
  - o parser decimal global em [`src/utils/core.ts`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/utils/core.ts) ja interpreta `1.000` como `1000`;
  - o problema estava em um parser especifico de quantidade operacional em [`src/App.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/App.tsx), usado para embalagens/preparos arredondados, que tratava `1.000` como decimal e retornava `1`;
  - removida essa excecao para o fluxo usar a mesma regra decimal consolidada.
- Corrigido calculo de demanda de produtor:
  - `buildPreparationDemandContext` agora soma ao minimo efetivo a demanda operacional consolidada do centro produtor;
  - essa demanda usa o maior valor entre cobertura potencial externa e requisicoes ja enviadas ao produtor, evitando ignorar demanda de centros consumidores e evitando duplicar o mesmo consumo quando ja existe requisicao enviada;
  - a geracao de requisicao de centro produtor passa a calcular falta de insumos a partir desse minimo efetivo, mesmo quando o Laboratorio nao tem minimo manual proprio.
- Ajustado relatorio de minimo real para exibir `Demanda operacional` separada de `Requisicoes` e `Dependencias`.
- Validacao executada:
  - `npm run build`
- Validacao pendente/limitada:
  - `npm run lint` e `NODE_OPTIONS=--max-old-space-size=4096 npx eslint src/App.tsx` falharam por estouro de memoria do Node/ESLint no arquivo monolitico, sem apontar erro de lint.

### Requisicao manual e origem da fila de producao

- A aba `Requisicao` passou a permitir incluir manualmente itens abasteciveis que nao apareceram como sugestao automatica.
- A inclusao manual reaproveita o mesmo montador de linhas e as mesmas regras de destino operacional (`COMPRAS`, `SUPRIMENTOS`, `PRODUCOES`) usadas pela sugestao do sistema.
- O fluxo de edicao de requisicao pendente tambem recebeu o mesmo bloco `Adicionar item abastecivel`.
- A tabela `Entrada de producoes` ganhou colunas visiveis por padrao:
  - `Origem`, com resumo como `Historico + 2 requisicoes` em linhas mistas;
  - `Entrada`, com data/hora mais recente conhecida.
- As duas novas colunas usam detalhes expansiveis para mostrar historico, requisicoes/pedidos, usuario responsavel e data/hora quando o dado existir.
- Validacao executada:
  - `npm run build`

### Compras: detalhes de suprimentos e compra manual

- A coluna `Itens em compra` do painel `Compras > Suprimentos` passou a exibir apenas a quantidade de itens, abrindo um modal com a lista detalhada quando acionada.
- O modal `Enviar suprimento aos centros` passou a permitir adicionar produto comprado fora da lista original da requisicao, mantendo o envio para `Receber`.
- Itens adicionados fora da lista original sao identificados como `Compra manual / extra` no rascunho de envio.
- Criada a acao `Nova entrada manual de compra`, que gera uma requisicao avulsa em `READY_TO_RECEIVE` para conferencia antes de somar saldo ao estoque.
- A entrada manual de compra registra usuario, data/hora e auditoria, sem lancamento direto no saldo.
- Durante a validacao local, corrigida a migracao automatica de contagens para nao atribuir `inventoryId` a registros operacionais de `RECEBIMENTO DE REQUISICAO`, evitando retries 409 entre cache local e backend.
- Validacao executada:
  - `npm run build`
  - `npm run build:server`
  - teste local no navegador em `Compras > Suprimentos`, incluindo popup de `78 itens`, item extra no envio e compra manual avulsa em `READY_TO_RECEIVE`.

## 2026-08-25

### Preco de venda por empresa em fichas compartilhadas

- Criado backup dos endpoints publicados antes da mudanca:
  - [`backups/online-before-company-sale-prices-20260825T181853Z`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/online-before-company-sale-prices-20260825T181853Z)
- Adicionado campo `finalSalePricesByCompanyId` nas fichas tecnicas, mantendo `finalSalePrice` como preco padrao/fallback.
- Fichas `EXECUCAO` e `VENDA` compartilhadas podem ter valores de venda especificos por empresa sem duplicar a composicao.
- O formulario de ficha comercial passa a exibir `Valores de venda da ficha compartilhada` quando houver empresas compartilhadas.
- Calculo de CMV, coluna de valor final e ordenacao usam o preco da empresa ativa quando preenchido.
- Validacao executada:
  - `npm run build`
  - `npm run build:server`
  - `npm --prefix server run prisma:generate`

### Exclusao configuravel de produtos e fichas tecnicas

- Adicionadas permissoes especificas em perfis de acesso para excluir `Produtos` e `Fichas tecnicas`.
- O comportamento antigo foi preservado como fallback:
  - `MASTER` continua podendo excluir;
  - perfis antigos de `Administrativo` herdam permissao ativa;
  - perfis antigos de `Gestor` e `Colaborador` herdam permissao desativada;
- Os botoes e a confirmacao de exclusao de produto/ficha passaram a validar essas permissoes especificas, sem alterar a regra de inativacao.
- Validacao executada:
  - `npm run build`

## 2026-08-24

### Preparacao para nova quebra do App.tsx

- Criado backup completo do servidor antes da nova rodada estrutural:
  - [`backups/full-server-backup-20260824T205650Z`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/full-server-backup-20260824T205650Z)
  - manifesto em [`backups/full-server-backup-20260824T205650Z/manifest.json`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/full-server-backup-20260824T205650Z/manifest.json)
- Criado mapa funcional de risco para a modularizacao:
  - [`docs/STRUCTURAL_MAP_2026-08-24.md`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/docs/STRUCTURAL_MAP_2026-08-24.md)
- A tentativa de resolver a lentidao apenas com buffer/caret em campos de texto nao melhorou a experiencia reportada pelo usuario.
- A tentativa foi revertida do codigo e preservada apenas como patch de referencia:
  - [`backups/refactor-input-buffer-attempt-20260824/failed-input-buffer-attempt.patch`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/backups/refactor-input-buffer-attempt-20260824/failed-input-buffer-attempt.patch)
- Diagnostico atual:
  - o gargalo principal continua sendo estrutural;
  - o `App.tsx` grande demais causa re-render caro em digitacao, busca e formularios;
  - o servidor local confirmou aviso do Babel para `src/App.tsx` acima de 500KB.
- Decisao operacional:
  - nao subir deploy online durante esta refatoracao;
  - manter o online como esta ate validar offline os fluxos do mapa;
  - iniciar a quebra por componentes/telas com menor risco, sem alterar persistencia, endpoints, sincronizacao ou modelo de dados.

### Primeira extracao de input normalizado

- Criado componente isolado [`src/components/NormalizedTextField.tsx`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/src/components/NormalizedTextField.tsx).
- O componente mantem rascunho local durante a digitacao, preserva a selecao/cursor apos normalizar texto e permite tres modos de commit:
  - imediato;
  - debounce para buscas;
  - `blur`/Enter para campos de cadastro.
- Aplicado nos principais campos de busca de listas/tabelas e em campos centrais de Produto, Item e Ficha Tecnica.
- Campos decimais usam normalizador proprio para preservar virgula, ponto e sinal.
- Textareas de ficha tecnica usam normalizacao de texto livre para preservar pontuacao e quebras de linha.
- Validacao executada:
  - `npm run build`
- Resultado:
  - build aprovado;
  - chunk principal ainda grande, entao a rodada deve continuar com extracao de telas/paineis e calculos pesados.

## 2026-08-17

### Projecao Madre e vendas fake para estoque minimo

- Implementado fallback no import de vendas: a coluna de identificador continua aceitando `ID empresa`, mas tambem faz match por `productId` interno da ficha (`EXE-*`/`VEN-*`) ou pelo ID numerico da ficha quando o ID empresa nao existir.
- Criado dry-run [`scripts/madre_demand_projection_dry_run.py`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/gestor-estoque/scripts/madre_demand_projection_dry_run.py) para ler a planilha de abertura da Madre, consultar a API publicada, resolver empresa/centro/fichas/produtos, calcular consumo projetado e gerar XLSX auditavel de importacao.
- O fake de vendas foi gerado para `2026-08-12` a `2026-08-16`, com fator `0,8` aplicado sobre as quantidades projetadas porque o webapp acrescenta `20%` de margem ao calcular estoque minimo.
- Criadas via API as fichas `VENDA` de bebidas fechadas que faltavam: `COCA LATA`, `COCA ZERO LATA`, `GUARANA LATA`, `GUARANA ZERO LATA`, `CORONA`, `AGUA SEM GAS` e `AGUA COM GAS`.
- Cada ficha `VENDA` de fechado consome uma embalagem normalizada do produto rastreavel correspondente.
- Relatorio final gerado em `auditorias/madre-demand-projection-20260817T050315Z.xlsx` e `.json`, com `145` linhas importaveis, `simulation_id=madre-demand-projection-20260817T050315Z` e `0` inconsistencias.

### Compras envia suprimentos aos centros solicitantes

- `Compras` ganhou abas `Demanda` e `Suprimentos`.
- A aba `Demanda` preserva o consolidado de faltas dos centros distribuidores.
- A aba `Suprimentos` lista requisicoes `SENT_TO_SUPPLIES` que alimentam o consolidado de compras e permite enviar quantidades aos centros solicitantes.
- O envio vindo de compras move os itens enviados para `READY_TO_RECEIVE` no centro solicitante, sem registrar recebimento externo de fornecedor nem baixar estoque do centro distribuidor.
- Quando o usuario envia menos que a quantidade original, o residual permanece pendente em `SENT_TO_SUPPLIES`; quando envia igual ou mais, a linha deixa a pendencia.

### Tentativa revertida: inventario consolidado com multiplas contagens por centro

- A hipotese testada foi transformar `Inventario` em ciclo consolidado por empresa/data, mantendo o centro real em cada sessao de contagem e item contado.
- A implementacao exigia `AppInventoryRecord.stockCenterId` opcional, inferencia de centros cobertos por sessoes/itens/movimentacoes pendentes, ajustes em fechamento, saldo e relatorios, e migration `inventory_multi_center`.
- A migration aplicou corretamente em banco limpo de validacao, mas a direcao foi descartada por risco de confusao operacional para o usuario.
- O codigo foi revertido para o modelo vigente: um inventario por centro de estoque.
- A ideia ficou registrada em `docs/DECISIONS.md` como `a decidir`, nao como implementada.

## 2026-08-16

### Cancelamento em lote de planejamentos por ficha

- `Origens criadas por ficha de execucao` ganhou selecao por checkbox e botao `Cancelar selecionados`.
- O cancelamento em lote reutiliza o fluxo por `rootRequestId`: remove producoes pendentes no backend e cancela requisicoes/suprimentos vinculados somente quando ainda nao avancaram.
- O modal de confirmacao informa quantos planejamentos, producoes e requisicoes/suprimentos reversiveis serao afetados, mantendo itens ja movidos/recebidos ativos.

### Acoes em lote e consolidacao de requisicoes pendentes

- `Requisicoes feitas` ganhou selecao por checkbox para aprovar e enviar requisicoes em lote.
- O envio individual e o envio em lote passam a respeitar a permissao de aprovacao/envio do centro da requisicao.
- Aprovadores podem excluir em lote requisicoes `CANCELLED` elegiveis na lista atual.
- Novas requisicoes pendentes do mesmo dia, mesma empresa, mesmo centro solicitante e mesmo destino operacional passam a ser anexadas a requisicoes pendentes compatíveis, somando linhas por chave semantica.
- A consolidacao nao se aplica a requisicoes aprovadas, enviadas, recebidas, canceladas ou vinculadas a planejamento de producao.

### Planejamento de sincronizacao e modularizacao segura

- Registrada pendencia de sincronizacao em tempo real entre sessoes/dispositivos: alteracoes confirmadas no servidor devem aparecer para outros usuarios/paginas sem refresh manual, respeitando empresa ativa e permissoes.
- Registrada regra operacional para a proxima separacao estrutural de `src/App.tsx`: antes de mover blocos criticos, fazer backup total dos dados do servidor e criar mapa funcional detalhado com comportamento esperado, comunicacao entre modulos e checklist de regressao.
- Reforcado que navegador/localStorage nao deve ser fonte da verdade para dados operacionais criticos; deve ficar restrito a rascunhos antes do salvamento ou compatibilidade temporaria controlada.

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

## 2026-08-30

### Requisicao do BAR MACAXEIRA POIS POIS

- Investigado o rascunho de requisicao da empresa `MACAXEIRA POIS POIS` (`companyId=5`) para o centro `BAR MACAXEIRA POIS POIS` (`stockCenterId=10`).
- `NAO E PINK LIMONADE` permanece ficha `EXECUCAO` (`id=81`) e nao aparece como minimo direto do centro 10; o minimo atual relacionado e do preparo `PRE-BATCHED NAO E PINK` (`id=80`), produzido no proprio centro.
- Corrigido o escopo das fichas de preparo `CASCAS DE LIMAO SICILIANO` (`id=13`) e `CASCAS DE LARANJA BAHIA` (`id=15`):
  - adicionadas como compartilhadas com a empresa 5;
  - adicionadas ao `productionCenters` com `stockCenterId=10`;
  - adicionadas ao `producedTechnicalSheetIds` do centro 10.
- Causa raiz: as cascas eram produtos vinculados a fichas `PREPARO`, mas as fichas nao estavam visiveis para a empresa 5 nem marcadas como produzidas no centro 10. Assim, a geracao de requisicao resolvia a dependencia como `PRODUTO`, sem exibicao de `quantidade x porcao base`.
- Validacao por API: apos a correcao, as fichas 13 e 15 aparecem em `/api/technical-sheets?companyId=5`, resolvem como `PREPARO` para o centro 10 e nao sao elegiveis como linha direta de requisicao; os produtos vinculados tambem nao sao elegiveis como produto direto porque possuem `technicalSheetId`.
- Backup local dos registros afetados: `backups/online-before-macaxeira-bar-cascas-production-scope-20260830T034537Z/affected-records.json`.
- Complemento:
  - `NAO E PINK LIMONADE` ainda aparecia porque era ingrediente da ficha `BOMBEIRINHO COLLINS PRE-BATCHED` (`id=823`) e o calculo de falta de producao ainda permitia produto vinculado a ficha tecnica como produto avulso;
  - o usuario corrigiu o cadastro da ficha `BOMBEIRINHO COLLINS PRE-BATCHED` (`id=823`) para usar `PRE-BATCHED NAO E PINK`;
  - ajustado o frontend para que falta de producao trate como produto avulso apenas produtos sem `technicalSheetId`;
  - `XAROPE DE CAJA 53.5` (`id=79`) estava em Complexo Vila Analia com porcao base correta de `1000 ml`, mas nao estava compartilhado com a empresa 5; foi compartilhado com a empresa 5 mantendo producao no `LABORATORIO` (`stockCenterId=1`);
  - validacao por API: `XAROPE DE CAJA 53.5` agora resolve como `PREPARO` para o centro 10 com unidade de requisicao `1000 ml`; `NAO E PINK LIMONADE` nao passa mais como produto avulso no calculo corrigido;
  - backup local do xarope: `backups/online-before-macaxeira-xarope-caja-535-scope-20260830T040228Z/technical-sheet-79-before.json`;
  - validacao local: `npm run build`.
- Matriz de composicao aplicada no cadastro de fichas:
  - `PREPARO` pode compor `PREPARO` ou `EXECUCAO`, mas nao `VENDA`;
  - `EXECUCAO` pode compor `VENDA`, mas nao `PREPARO` nem outra `EXECUCAO`;
  - `VENDA` pode compor outra `VENDA` apenas quando a ficha mae usa `COMBO`, e nao pode compor `PREPARO` nem `EXECUCAO`.
- O frontend passou a usar a mesma matriz na lista de ingredientes disponiveis e na validacao antes de salvar a ficha tecnica.
- Auditoria online encontrou 10 ocorrencias em 9 fichas `VENDA` ativas ja cadastradas com `PREPARO` direto antes da trava: `COMPOTA DE CAJU MACAXEIRA EMPORIO`, `DS LICOR CAMBUCI`, `DS LICOR DE GOIABA`, `DS LICOR DE MEL`, `DS LICOR DOCE DE LEITE`, `LICOR DE CAMBUCI MACAXEIRA EMPORIO 700ML`, `LICOR DE GOIABA EMPORIO 700ML`, `LICOR DE MEL E CAJUINA MACAXEIRA EMPORIO 700ML`, `LICOR DOCE DE LEITE EMPORIO 700ML`.
- Import de vendas e requisicao do `BAR MACAXEIRA POIS POIS`:
  - validado no online que o lote `IMP-C5-CE10-20260829-0007` gerou consumos e minimos sugeridos para produtos de fichas `VENDA`, incluindo `COCA COLA LATA 350ML`, `COCA COLA ZERO LATA 350ML`, tonicas, aguas e doses;
  - o centro `ESTOQUE` da empresa 5 esta ativo como distribuidor, com `distributesAllProducts=true` e `suppliedCenterIds=[10]`;
  - causa raiz: a montagem de requisicao/compra considerava apenas produtos geridos pela empresa do centro, mas varios produtos consumidos por fichas de venda da Macaxeira usam cadastros compartilhados do `COMPLEXO VILA ANALIA` (`companyId=2`);
  - ajustado o frontend para aceitar produtos visiveis/compartilhados nos minimos de centro, rascunho de requisicao, demanda do distribuidor, painel de compras e opcao manual de compra;
  - mantida a exclusao de produtos vinculados a ficha tecnica (`technicalSheetId`) e de `COMBO` como produto avulso, inclusive na geracao futura de minimos por import de vendas.
  - regra de roteamento validada: produto direto consumido por ficha `VENDA`/`EXECUCAO`, como `COCA COLA LATA 350ML`, `COCA COLA ZERO LATA 350ML` e `TONICA ANTARTICA ZERO 350ML`, fica com destino `ESTOQUE` da Macaxeira; preparo produzido por centro externo, como `XAROPE DE CAJA 53.5`, resolve para o `LABORATORIO` do `COMPLEXO VILA ANALIA` quando houver demanda.
- Reset online para novo teste do fluxo:
  - criado backup antes da operacao em `backups/online-before-cancel-macaxeira-cpxva-requisitions-20260831T000728Z/backup.json`;
  - canceladas as requisicoes abertas das empresas `COMPLEXO VILA ANALIA` e `MACAXEIRA POIS POIS`: `#100`, `#101`, `#103`, `#105` e `#107`;
  - a requisicao `#10` de `MACAXEIRA POIS POIS` foi mantida porque ja estava `RECEIVED`;
  - validacao pos-cancelamento: as entradas de producao vinculadas as requisicoes canceladas cairam de `41` para `0`, sem rascunhos de producao vinculados restantes;
  - validacao pos-cancelamento: nao restou requisicao aberta nao recebida para as empresas 2 e 5.
- Complemento do reset:
  - a requisicao `#10` foi identificada como teste antigo de `BATIDA CAJA` e removida do online a pedido do usuario;
  - antes de excluir, foi criado backup em `backups/online-before-delete-received-requisition-10-20260831T001543Z/backup.json`;
  - a requisicao `#10` foi marcada como `CANCELLED` e depois excluida via API, restando apenas marcador em `/api/deleted-requisitions`;
  - validacao: nao havia `inventory-count-session`, `inventory-count` nem `pending-inventory-movement` ligado ao `receiptSessionId=84`; nao houve entrada de estoque remanescente a remover.
- Exclusao das requisicoes canceladas:
  - criado backup antes da exclusao em `backups/online-before-delete-cancelled-macaxeira-cpxva-requisitions-20260831T001729Z/backup.json`;
  - excluidas as requisicoes canceladas `#105`, `#107`, `#100`, `#101` e `#103`;
  - validacao: nao restou nenhuma requisicao em `/api/requisitions` para `COMPLEXO VILA ANALIA` nem `MACAXEIRA POIS POIS`;
  - validacao: entradas e rascunhos de producao vinculados permaneceram em `0`.
- Auditoria do relatorio fake da Macaxeira:
  - comparada a planilha `/home/leomassoni/Downloads/Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).xlsx` contra as fichas `VENDA` e `EXECUCAO` ativas online da empresa 5;
  - o `Resumo` contem as `232` fichas ativas esperadas, sem falta e sem linha extra;
  - a aba `Importacao vendas` contem `225` linhas porque `7` fichas estavam com `Quantidade de venda` vazia no `Resumo`: `AQUA LOCALE COM GAS`, `AQUA LOCALE SEM GAS`, `CERVEJA CORONA 330 ML VENDA`, `CERVEJA CORONA CERO 330 ML VENDA`, `CERVEJA ORIGINAL 600ML VENDA`, `CERVEJA SPATEN 600ML VENDA` e `CERVEJA STELLA PURE GOLD 600 VENDA`;
  - conclusao: ausencia dessas aguas na requisicao nao e bug do fluxo; faltou quantidade no relatorio importado;
  - observacao de cadastro: `AGUA POTAVEL` e `POLPA CAJU FRUTA DA FAZENDA` tiveram consumo analitico por receitas importadas, mas estao marcadas como `ignoreStock=true`, portanto nao geram minimo/requisicao por regra de cadastro;
  - arquivo de auditoria gerado: `auditorias/auditoria_relatorio_fake_macaxeira_pois_pois_2026-08-31.xlsx`.
- Correcao de cadastro de fichas `VENDA` unitarias da Macaxeira:
  - regra validada: produto rastreavel pode ser controlado por `ML` e ter embalagem ativa com volume (`350 ml`, `500 ml` etc.), mas a composicao da ficha de venda unitaria precisa consumir o volume total da embalagem vendida, nao `1 ml`;
  - casos identificados no online com quantidade de composicao `1`: `COCA COLA LATA 350ML VENDA`, `COCA COLA ZERO LATA 350ML VENDA`, `GUARANA ANTARTICA LATA 350ML VENDA`, `GUARANA ANTARTICA ZERO LATA 350ML VENDA`, `H2O LIMONETO 500ML VENDA`, `RED BULL TRADICIONAL LATA 250ML VENDA`, `TONICA ANTARTICA 350ML VENDA` e `TONICA ANTARTICA ZERO 350ML VENDA`;
  - observacao: `H2O LIMAO 500ML VENDA` ja estava correto no online, consumindo `500` do produto;
  - correcao aplicada no online: as 8 fichas foram atualizadas para consumir o volume da embalagem ativa (`350`, `500` ou `250`) tambem em `yieldQuantity`;
  - backup da operacao: `backups/online-before-macaxeira-unit-sale-sheet-volume-fix-20260831T115057Z`;
  - o lote fake antigo `7` foi excluido e reimportado a partir da mesma planilha para recalcular consumos e minimos com as fichas corrigidas;
  - relatorio da reimportacao: `auditorias/macaxeira-fake-sales-import-20260831T085129.json`;
  - validacao online: lote `7` recriado com `225` linhas e `763` consumos; nao restou ficha `VENDA` ativa da Macaxeira com composicao `1` para produto com embalagem em `ml` maior que `1`;
  - minimos validados no centro 10 apos reimportacao: `GUARANA ANTARCTICA LATA 350ML` `20160 ml`, `GUARANA ANTARCTICA ZERO LATA 350ML` `15120 ml`, `H2OH LIMAO PET 500ML` `28800 ml` e `H2O LIMONETO PET 500ML` `28800 ml`;
  - pendencia operacional: requisicoes `#118`, `#119` e `#121` foram criadas antes da correcao de cadastro e precisam ser canceladas/regeneradas para refletir os minimos corrigidos.
- Reset de requisicoes apos correcao de cadastro unitario:
  - criado backup antes da operacao em `backups/online-before-cancel-delete-cpxva-macaxeira-requisitions-20260831T121634Z`;
  - canceladas e excluidas as requisicoes de `MACAXEIRA POIS POIS`: `#118`, `#119` e `#121`;
  - canceladas e excluidas as requisicoes de `COMPLEXO VILA ANALIA`: `#123` e `#125`;
  - validacao online: nao restou requisicao em `/api/requisitions` para as empresas 2 e 5;
  - validacao online: nao restou solicitacao manual de producao nem rascunho de producao vinculado aos grupos cancelados/excluidos.

## 2026-08-31

### Auditoria de inativacoes diretas e indiretas

- Problema identificado: algumas acoes administrativas com impacto operacional executavam `PUT`/`DELETE` e alteravam `isActive`, mas nao registravam evento no painel master.
- Ajustado o frontend para registrar auditoria consolidada apos confirmacao bem-sucedida de:
  - ativacao, inativacao e exclusao direta de produto;
  - inativacao e exclusao de produto com resolucao de impactos em fichas tecnicas;
  - ativacao, inativacao e exclusao direta de ficha tecnica;
  - inativacao e exclusao de ficha tecnica com impactos em fichas maes, planejamentos de producao e requisicoes/suprimentos vinculados;
  - ativacao, inativacao e exclusao direta de item;
  - inativacao e exclusao de centro de estoque com resumo dos impactos em fichas, rotas, minimos e requisicoes/suprimentos;
  - exclusao de familia/subfamilia com substituicao ou inativacao dos cadastros impactados.
- Os eventos gravam ator, empresa ativa, alvo, acao, severidade, resumo de impacto e `details` com IDs dos cadastros afetados quando disponiveis.
- Validacao local: `npm run build`.

### Ativacao de fichas inativas da Macaxeira

- Ativadas no online as fichas inativas pertencentes a `MACAXEIRA POIS POIS`:
  - `CHOPE BRAHMA 300ML` (`id=625`, `VENDA`);
  - `CHOOPE BRAHAMA CLARA` (`id=765`, `EXECUCAO`).
- Complemento de escopo: o fluxo foi ampliado para considerar fichas visiveis/necessarias para a Macaxeira mesmo quando a origem e outra empresa.
- Ativadas no online as fichas inativas visiveis para `MACAXEIRA POIS POIS`, mas originarias do `COMPLEXO VILA ANALIA`:
  - `PRE-BATCHED GAJU AMIGO` (`id=125`, `PREPARO`);
  - `REFAZER A FICHA` (`id=400`, `PREPARO`).
- Ativados os produtos vinculados ainda inativos na cadeia tecnica:
  - `BATIDA CAJA PRE-BATCHED` (`PRE-MRVHTDWC-WBUHRF`, ficha `id=332`);
  - `PRE-BATCHED GAJU AMIGO` (`PRE-MRI88FIU-ZPW2RB`, ficha `id=125`);
  - `REFAZER A FICHA` (`PRE-MRS8I95D-GTEI14`, ficha `id=400`).
- Backups:
  - `backups/online-before-activate-inactive-macaxeira-sheets-20260831T210758Z`;
  - `backups/online-before-activate-macaxeira-visible-subsheet-chain-20260831T211026Z`.
- Auditoria criada no online: logs `#1758` e `#1759`.
- Validacao online: nao restou ficha tecnica inativa visivel para a empresa 5 nem produto vinculado inativo usado por ficha ativa visivel da Macaxeira.

### Cancelamento de requisicoes para novo teste Macaxeira/Complexo

- Criado backup antes da operacao em `backups/online-before-cancel-cpxva-macaxeira-requisitions-20260831T211520Z`.
- Canceladas no online as requisicoes abertas das empresas `MACAXEIRA POIS POIS` e `COMPLEXO VILA ANALIA`:
  - `#127`, `#128` e `#130` da empresa 5;
  - `#132` e `#134` da empresa 2.
- Todas estavam em `SENT_TO_SUPPLIES` antes do cancelamento.
- Auditoria criada no online: log `#1760`.
- Validacao online: nao restou requisicao aberta nao recebida para as empresas 2 e 5; nao restou solicitacao manual de producao nem rascunho de producao vinculado aos grupos cancelados.
- Complemento de exclusao:
  - criado backup antes da exclusao em `backups/online-before-delete-cancelled-cpxva-macaxeira-requisitions-20260831T212011Z`;
  - excluidas as requisicoes canceladas `#127`, `#128`, `#130`, `#132` e `#134`;
  - auditoria criada no online: log `#1761`;
  - validacao online: nao restou requisicao das empresas 2 e 5; nao restou solicitacao manual de producao nem rascunho de producao vinculado aos grupos excluidos.

### Atualizacao do relatorio fake de vendas da Macaxeira

- Comparada a planilha `/home/leomassoni/Downloads/atualizado Para devolver Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-27.xlsx` com o lote fake ativo do centro `BAR MACAXEIRA POIS POIS` (`companyId=5`, `stockCenterId=10`).
- A planilha atualizada tinha layout diferente do arquivo anterior: `Resumo!A=ficha`, `Resumo!B=ID interno`, `Resumo!C=tipo`, `Resumo!D=quantidade`, `Resumo!E=und`.
- A coluna `ID interno` foi preenchida na planilha atualizada para as linhas que casaram com fichas `VENDA` ou `EXECUCAO`; foi criada/substituida a aba `Importacao vendas`.
- Foi preservado o lote anterior como base e aplicada a atualizacao valida da nova planilha, para nao remover fichas de dose que ainda existiam no lote importado mas nao apareciam no arquivo atualizado.
- Lote antigo `#7` (`Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-29(1).xlsx`) cancelado no online: `225` linhas e `763` consumos passaram para `CANCELLED`.
- Novo lote `#8` criado no online a partir da planilha atualizada:
  - `230` linhas importadas;
  - `768` consumos analiticos;
  - `5` novas fichas incluidas: `CERVEJA CORONA 330 ML VENDA`, `CERVEJA CORONA CERO 330 ML VENDA`, `CERVEJA ORIGINAL 600ML VENDA`, `CERVEJA SPATEN 600ML VENDA` e `CERVEJA STELLA PURE GOLD 600 VENDA`;
  - `17` grupos de duplicata/segunda projecao consolidados por ficha e data;
  - `13` linhas positivas eram produtos avulsos sem ficha `VENDA`/`EXECUCAO` correspondente e foram deixadas fora do import: `Aperol`, `Per se`, `Campari`, `Single Fin`, `Tanqueray london dry`, `43`, `Cointreau`, `Carpano classico`, `Jim beam black`, `Jim beam white`, `Jack Daniels N.7`, `Jhonnie Walker Black Label` e `Jhonnie Walker Red Label`.
- Regra operacional reforcada: relatorio fake de vendas deve importar somente fichas de `VENDA` ou `EXECUCAO`; ID de produto (`PRD-*`) nao cabe nesse arquivo.
- Centro 10 recalculado no online: `127` minimos sugeridos por venda (`83` produtos e `44` preparos).
- Backups e auditoria:
  - backup remoto: `backups/online-before-macaxeira-fake-sales-refresh-20260831T184945`;
  - backup da planilha: `/home/leomassoni/Downloads/atualizado Para devolver Fichas tecnicas - MACAXEIRA POIS POIS - 2026-08-27.backup-before-fake-sales-refresh-20260831T184945.xlsx`;
  - relatorio local: `auditorias/macaxeira-fake-sales-refresh-20260831T184945.json`;
  - logs online: `#1762` para cancelamento do lote antigo e `#1763` para criacao do lote novo.

### Exportacao da fila de entrada de producoes

- Adicionado botao `Exportar` no painel `Entrada de producoes`.
- A primeira versao exporta apenas a fila visivel do centro produtor selecionado, respeitando o vinculo do usuario, a busca ativa e as linhas exibidas no painel.
- O modal permite escolher `PDF` ou `XLSX`.
- Campos exportados: centro produtor, pre-preparo, ID interno, familia, prioridade, estoque atual, minimo de uso, demanda operacional, sugestao, origem, detalhes da origem, entrada, detalhes da entrada, status e quantidade de insumos em falta.
- Validacao local: `npm run build`.

### Auditoria da fila do LABORATORIO para atender Macaxeira

- Verificada a fila online de `Entrada de producoes` do `LABORATORIO` em `COMPLEXO VILA ANALIA`, gerada a partir da requisicao `#136` de `BAR MACAXEIRA POIS POIS`.
- Estado encontrado:
  - `47` entradas de producao no laboratorio;
  - `39` fichas unicas na fila;
  - nenhuma ficha atualmente na fila estava sem vinculo de producao com o laboratorio;
  - nenhuma dependencia que o sistema ja considera produzida pelo laboratorio ficou fora da fila.
- Lacuna de cadastro encontrada: existem dependencias de pre-preparo necessarias para producoes da fila que nao resolvem para o laboratorio e tambem nao tem saldo registrado no laboratorio:
  - `TINTURA FRUTAS VERMELHAS` (`id=115`), usada por `LICOR FRUTAS VERMELHAS LISBOA E NOSSA`, demanda estimada `1.052,63 ml`, sem centro produtor, sem rota de suprimento e sem registro de estoque no laboratorio;
  - `NECTAR ABACAXI` (`id=119`), usada por `BATIDA PEQUI PRE-BATCHED` e `INVASAO TROPICAL CLARIFICADO`, demanda estimada `2,95 ml`, produzida hoje apenas por `BAR URU` e `BAR TRATTORIA`, sem rota explicita para o laboratorio e sem registro de estoque no laboratorio.
- Conclusao: a lista nao esta omitindo subproducoes ja marcadas como feitas pelo laboratorio, mas pode esconder necessidade real nesses dois casos por falta de configuracao de produtor/rota.
- Relatorio local: `auditorias/auditoria-fila-producao-laboratorio-cpxva-macaxeira-20260831.json`.

### Correcao de produtor do LABORATORIO para Tintura e Nectar

- Confirmado operacionalmente que `TINTURA FRUTAS VERMELHAS` (`id=115`) e `NECTAR ABACAXI` (`id=119`) tambem sao produzidos pelo `LABORATORIO` de `COMPLEXO VILA ANALIA`.
- Online corrigido via script rastreavel `scripts/fix_cpxva_lab_producer_gaps.py`:
  - adiciona `stockCenterId=1` em `productionCenters` das fichas `115` e `119`;
  - adiciona as fichas `115` e `119` em `producedTechnicalSheetIds` do centro `LABORATORIO`;
  - cria entradas complementares da fila atual para a requisicao `#136`: `TINTURA FRUTAS VERMELHAS` `1.052,63 ml`, `NECTAR ABACAXI` `2.375,78 ml` por `BATIDA PEQUI PRE-BATCHED` e `NECTAR ABACAXI` `571,43 ml` por `INVASAO TROPICAL CLARIFICADO`.
- Observacao de escala: a primeira auditoria subestimou o `NECTAR ABACAXI` porque o calculo externo nao reproduziu o `parseDecimal` do app; no app, `17.000` e `3.000` sao milhar, nao decimal.
- Logs online gerados: `#1772` a `#1775`.
- Backups online: `backups/online-before-cpxva-lab-producer-gaps-20260901T003339Z`.
- Relatorio aplicado: `auditorias/cpxva-lab-producer-gaps-fix-20260901T003343Z.json`.

### Origem da fila de producao do LABORATORIO

- Bug identificado na tela `Entrada de producoes`: uma requisicao recebida pelo centro produtor podia aparecer duas vezes na linha da fila, uma vez pela demanda operacional pendente e outra vez pelo `manualProductionRequest` materializado a partir da propria requisicao.
- O mesmo painel podia mostrar historico de centros consumidores externos (`BAR ARAIS`, `BAR MII`) como detalhe de origem mesmo quando `includeExternalUseMinimum` estava desabilitado para a fila de producao.
- Corrigido em `src/App.tsx`:
  - a sugestao automatica da linha agora desconta a quantidade ja materializada em `manualProductionRequests` vinculados a `sourceRequisitionId`;
  - os detalhes de historico da fila de producao nao incluem minimo externo de centros consumidores quando a fila deve ser alimentada por requisicao.
- Validacao com dados online: `CORDIAL DE CAMBUCI AMERICA DO SUL` ficou com demanda pendente da requisicao `#136` de `7.000 ml`, entrada manual da propria `#136` de `7.000 ml`, residuo automatico `0` e origem visivel apenas como `1 requisicao`.
- Validacao tecnica: `npm run build`.

### Exportacao detalhada da fila de producao

- Ajustado o exportador de `Entrada de producoes`: no PDF/XLSX, as colunas `Origem` e `Entrada` passam a trazer os detalhes completos diretamente, porque o arquivo exportado nao tem expansao de resumo.
- Removidas as colunas redundantes `Detalhes da origem` e `Detalhes da entrada` da exportacao.

### Conferencia parcial de suprimentos

- Ajustado o fluxo de suprimentos internos entre estoques: o centro distribuidor passa a conferir a quantidade enviada por linha antes de mandar para recebimento.
- O envio interno agora aceita separacao parcial:
  - apenas itens marcados como conferidos seguem para `READY_TO_RECEIVE`;
  - itens nao marcados permanecem pendentes em suprimentos;
  - quando a quantidade enviada e menor que o pedido original, o saldo restante fica em uma requisicao residual de suprimentos.
- A baixa de estoque do centro distribuidor usa somente as linhas e quantidades enviadas.
- A mesma mecanica de conferencia por icone foi aplicada ao suprimento de compras, eliminando a necessidade de zerar itens que nao serao enviados naquele momento.
- As linhas enviadas e residuais preservam `sourceAllocations` proporcionais a quantidade, mantendo o rastreio de origem da demanda para compras e auditoria.
- Validacao tecnica: `npm run build` e `git diff --check`.
- Complemento: a conferencia de suprimentos internos passa a exibir a coluna `Estoque origem`, calculada pelo saldo atual do centro distribuidor para o item movimentado e apresentada na mesma unidade visual do envio.
