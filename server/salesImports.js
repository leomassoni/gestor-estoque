const crypto = require('node:crypto')
const { lockedTransaction, nextInventoryMovementId } = require('./production')
const { planSalesConsumption, ENGINE_VERSION } = require('./salesConsumptionPlanner')
const { parseStockDecimal, stockDecimal, isStockDateKey } = require('./inventoryLedger')

function fail(message, statusCode = 409) { throw Object.assign(new Error(message), { statusCode }) }
function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value, (_key, entry) => {
    if (['updatedAt', 'createdAt', 'createdAtRecord'].includes(_key)) return undefined
    if (typeof entry === 'bigint') return entry.toString()
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]]))
    }
    return entry
  })).digest('hex')
}
function normalizeTiming(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {}
  return { dayEndConfirmed: value.dayEndConfirmed === true, aggregate: value.aggregate === true,
    periodStart: isStockDateKey(value.periodStart) ? value.periodStart : '',
    periodEnd: isStockDateKey(value.periodEnd) ? value.periodEnd : '' }
}

async function audit(tx, auth, batch, action, details) {
  const last = await tx.appAuditLogRecord.aggregate({ _max: { id: true } })
  await tx.appAuditLogRecord.create({ data: {
    id: (last._max.id ?? 0) + 1, companyId: batch.companyId, actorUserId: auth.user?.id ?? null,
    actorUserName: auth.user?.fullName ?? 'ADMINISTRADOR DO SISTEMA', actorUsername: auth.user?.username ?? auth.username ?? '',
    actorRole: auth.user?.role ?? 'MASTER', actorKind: auth.kind === 'systemAdmin' ? 'SYSTEM_ADMIN' : 'APP_USER',
    module: 'IMPORTAR_VENDAS', actionKey: action, actionLabel: 'Baixa de vendas em cascata',
    targetType: 'SALES_IMPORT_BATCH', targetId: String(batch.id), targetLabel: batch.fileName,
    summary: `${action}: ${batch.fileName}.`, impactSummary: 'Operacao de estoque registrada no servidor com trilha de alocacoes.',
    severity: 'HIGH', result: 'SUCCESS', relatedCompanyIds: [], occurredAt: new Date().toISOString(), details,
  } })
}

function registerSalesImportRoutes(app, prisma, helpers) {
  const { userCanAccessCompany, getCompanyCatalogScopeIds, isTechnicalSheetRecordVisibleForCompany,
    normalizeInventoryCountPayload, normalizeInventoryCountSessionPayload, normalizeSalesImportBatchPayload,
    normalizeSalesImportRowPayload, normalizeSalesConsumptionPayload,
    serializeBigIntForJson: serialize } = helpers

  function authorizeCenter(request, batch, center) {
    if (!center || center.companyId !== batch.companyId) fail('Centro do lote nao pertence a empresa.', 400)
    if (request.auth?.kind !== 'systemAdmin') {
      const user = request.auth?.user
      const membership = user?.memberships?.find((m) => m.companyId === batch.companyId && m.isActive)
      const sections = membership?.sectionAccess ?? user?.sectionAccess ?? {}
      if (!user || !userCanAccessCompany(user, batch.companyId) || !sections.ConfiguracoesEstoque) {
        fail('Sem permissao de importar vendas neste centro e empresa.', 403)
      }
    }
  }

  async function authorize(db, request, batchId) {
    const batch = await db.appSalesImportBatchRecord.findUnique({ where: { id: batchId } })
    if (!batch) fail('Lote de vendas nao encontrado.', 404)
    const center = await db.appStockCenterRecord.findUnique({ where: { id: batch.stockCenterId } })
    authorizeCenter(request, batch, center)
    return { batch, center }
  }

  async function load(db, request, batchId, requestedTiming) {
    const { batch, center } = await authorize(db, request, batchId)
    const catalogCompanyIds = await getCompanyCatalogScopeIds(batch.companyId, db)
    const where = { companyId: batch.companyId, stockCenterId: center.id }
    const [operation, settings, consumptions, inventories, sessions, counts, pendingMovements, catalogSheets, template] = await Promise.all([
      db.appSalesPostingOperationRecord.findUnique({ where: { batchId } }),
      db.appSalesPostingSettingsRecord.findUnique({ where: { stockCenterId: center.id } }),
      db.appSalesConsumptionRecord.findMany({ where: { sourceBatchId: batchId, stockPostingStatus: { not: 'CANCELLED' } }, orderBy: { id: 'asc' } }),
      db.appInventoryRecord.findMany({ where, orderBy: { id: 'asc' } }),
      db.appInventoryCountSessionRecord.findMany({ where, orderBy: { id: 'asc' } }),
      db.appInventoryCountRecord.findMany({ where, orderBy: { id: 'asc' } }),
      db.appPendingInventoryMovementRecord.findMany({ where, orderBy: { id: 'asc' } }),
      db.appTechnicalSheetRecord.findMany({ where: { OR: [{ ownerCompanyId: batch.companyId }, { companyId: batch.companyId }, { sharedCompanyIds: { has: batch.companyId } }] },
        select: { id: true, companyId: true, ownerCompanyId: true, sharedCompanyIds: true, productId: true, kind: true, name: true,
          outputQuantity: true, outputUnit: true, ingredients: true, garnishIngredients: true, productionCenters: true,
          supplyRoutes: true, yieldDifferenceDestination: true, yieldDifferenceByproductTechnicalSheetId: true, isActive: true, updatedAt: true },
        orderBy: { id: 'asc' } }),
      batch.templateId ? db.appSalesImportTemplateRecord.findUnique({ where: { id: batch.templateId } }) : null,
    ])
    const sheets = catalogSheets.filter((sheet) => isTechnicalSheetRecordVisibleForCompany(sheet, batch.companyId, catalogCompanyIds))
    const products = await db.appProductRecord.findMany({ where: {
      OR: [{ ownerCompanyId: { in: catalogCompanyIds } }, { companyId: { in: catalogCompanyIds } }],
    }, select: { id: true, companyId: true, ownerCompanyId: true, name: true, controlUnit: true, ignoreStock: true, technicalSheetId: true,
      isActive: true, updatedAt: true }, orderBy: { id: 'asc' } })
    const timing = normalizeTiming(requestedTiming ?? operation?.timing)
    const aggregateRequired = template?.dateMode === 'FIXED_CELL' || batch.summary?.dateMode === 'FIXED_CELL'
    if (aggregateRequired) timing.aggregate = true
    if (operation?.allocations?.length && digest(timing) !== digest(operation.timing)) {
      fail('O periodo de uma baixa ja iniciada nao pode ser alterado. Estorne o lote antes de trocar o corte.')
    }
    if (consumptions.some((c) => c.companyId !== batch.companyId || c.stockCenterId !== center.id)) {
      fail('Ha consumos de outro centro/empresa neste lote; confira a integridade antes de lancar.')
    }
    const originalDemands = operation?.originalDemands ?? consumptions.map((c) => ({
      id: c.id, productId: c.ingredientProductId, quantity: parseStockDecimal(c.quantityConsumed),
      unit: c.unit, consumedAt: c.consumedAt.slice(0, 10), sourceTechnicalSheetId: c.sourceTechnicalSheetId,
    }))
    const demands = operation ? operation.residual : originalDemands
    if (demands.length > 20000) fail('Lote muito grande para conferencia unica. Divida-o em lotes menores.', 400)
    const plan = planSalesConsumption({ companyId: batch.companyId, center, sheets, products, inventories, sessions,
      counts, pendingMovements, demands, policyOverrides: settings?.policies ?? {}, timing, catalogCompanyIds, validateSources: true })
    plan.timing = timing
    plan.aggregateRequired = aggregateRequired
    plan.settings = { enabled: settings?.enabled ?? false, policies: settings?.policies ?? {}, canManage: request.auth.kind === 'systemAdmin' }
    plan.operation = operation ? { id: operation.id, status: operation.status, revision: operation.revision,
      allocations: operation.allocations, residual: operation.residual, covered: operation.covered } : null
    plan.batchId = batch.id
    plan.fileName = batch.fileName
    const centerRevision = { id: center.id, companyId: center.companyId, name: center.name,
      isActive: center.isActive, isProducer: center.isProducer, userIds: center.userIds }
    plan.revision = digest({ batch, center: centerRevision, operation, settings, consumptions, inventories, sessions,
      counts, pendingMovements, sheets, products, timing, catalogCompanyIds })
    return { batch, center, operation, settings, consumptions, originalDemands, plan, timing }
  }

  async function saveMovements(tx, auth, batch, allocations, reverse = false) {
    const byDate = new Map()
    for (const allocation of allocations) {
      if (!byDate.has(allocation.consumedAt)) byDate.set(allocation.consumedAt, [])
      byDate.get(allocation.consumedAt).push(allocation)
    }
    const savedAllocations = []
    for (const [date, entries] of byDate) {
      const id = await nextInventoryMovementId(tx)
      const timestamp = new Date(`${date}T23:59:59.000-03:00`).toISOString()
      const session = normalizeInventoryCountSessionPayload({ id, inventoryId: null, companyId: batch.companyId,
        stockCenterId: batch.stockCenterId, countedAt: date, isClosed: true, startedAt: timestamp, closedAt: timestamp,
        startedByUserId: auth.user?.id ?? null, closedByUserId: auth.user?.id ?? null,
        startedByUserName: auth.user?.fullName ?? 'ADMINISTRADOR DO SISTEMA', closedByUserName: auth.user?.fullName ?? 'ADMINISTRADOR DO SISTEMA' })
      await tx.appInventoryCountSessionRecord.create({ data: session })
      const records = []
      for (const [index, allocation] of entries.entries()) {
        const record = normalizeInventoryCountPayload({ id: id + index + 1, inventoryId: null, sessionId: id,
          companyId: batch.companyId, stockCenterId: batch.stockCenterId, countedAt: date,
          storageLocation: reverse ? 'ESTORNO DE VENDAS IMPORTADAS' : 'SAIDA POR VENDAS IMPORTADAS',
          technicalSheetId: allocation.technicalSheetId, productId: allocation.technicalSheetId ? '' : allocation.productId,
          serviceItemId: '', packageId: null, technicalSheetName: allocation.name, technicalSheetKind: allocation.kind,
          recipientItemId: '', recipientLabel: `${reverse ? 'ESTORNO' : 'VENDAS'} ${ENGINE_VERSION} - LOTE ${batch.id}`,
          closedItemsQuantity: stockDecimal((reverse ? 1 : -1) * allocation.quantity), hasOpenItems: false,
          openItemsGrossWeight: '', openItemsContainerQuantity: '', openItemsNetQuantity: '',
          totalCountedQuantity: stockDecimal((reverse ? 1 : -1) * allocation.quantity), totalCountedUnit: allocation.unit,
          createdByUserId: auth.user?.id ?? null, createdByUserName: auth.user?.fullName ?? 'ADMINISTRADOR DO SISTEMA' })
        if (!record || !session) fail('Nao foi possivel normalizar a movimentacao calculada.', 400)
        records.push(record)
        savedAllocations.push({ ...allocation, movementSessionId: id, movementRecordId: record.id })
      }
      await tx.appInventoryCountRecord.createMany({ data: records })
    }
    return savedAllocations
  }

  const route = (handler) => async (request, response) => {
    try {
      const batchId = Number(request.params.id)
      if (request.params.id !== undefined && (!Number.isSafeInteger(batchId) || batchId <= 0)) fail('Lote invalido.', 400)
      response.json(serialize(await handler(request, batchId)))
    } catch (error) {
      console.error('Sales posting:', error.message)
      response.status(error.statusCode ?? 500).json({ error: error.statusCode ? error.message : 'Falha na operacao de vendas. Nenhum sucesso foi confirmado.' })
    }
  }

  app.post('/api/sales-import-batches', route(async (request) => lockedTransaction(prisma, async (tx) => {
    const [batchMax, operationMax] = await Promise.all([
      tx.appSalesImportBatchRecord.aggregate({ _max: { id: true } }),
      tx.appSalesPostingOperationRecord.aggregate({ _max: { batchId: true } }),
    ])
    const allocated = request.body?.__serverAllocateIds === true
    const id = allocated ? Math.max(batchMax._max.id ?? 0, operationMax._max.batchId ?? 0) + 1 : Number(request.body?.id)
    if (!Number.isSafeInteger(id) || id <= 0) fail('ID de lote invalido.', 400)
    if (await tx.appSalesImportBatchRecord.findUnique({ where: { id } }) ||
        await tx.appSalesPostingOperationRecord.findUnique({ where: { batchId: id } })) fail('ID ja utilizado; atualize a pagina antes de importar.')
    const batch = normalizeSalesImportBatchPayload({ ...request.body, id })
    if (!batch) fail('Payload de importacao invalido.', 400)
    const center = await tx.appStockCenterRecord.findUnique({ where: { id: batch.stockCenterId } })
    authorizeCenter(request, batch, center)
    if (batch.status === 'POSTED' || batch.status === 'CANCELLED') fail('Lote novo nao pode nascer lancado ou cancelado.', 400)
    batch.summary = { ...batch.summary, serverAllocatedIds: allocated,
      importCode: `IMP-C${batch.companyId}-CE${batch.stockCenterId}-${batch.importedAt.slice(0, 10).replace(/-/g, '')}-${String(id).padStart(4, '0')}` }
    return { batch: await tx.appSalesImportBatchRecord.create({ data: batch }) }
  })))
  for (const [path, model, normalize, envelope] of [
    ['sales-import-rows', 'appSalesImportRowRecord', normalizeSalesImportRowPayload, 'row'],
    ['sales-consumptions', 'appSalesConsumptionRecord', normalizeSalesConsumptionPayload, 'consumption'],
  ]) app.post(`/api/${path}`, route(async (request) => lockedTransaction(prisma, async (tx) => {
    const allocated = request.body?.__serverAllocateIds === true
    const maximum = allocated ? await tx[model].aggregate({ _max: { id: true } }) : null
    const data = normalize({ ...request.body, id: allocated ? (maximum._max.id ?? 0) + 1 : request.body?.id })
    if (!data) fail('Linha/consumo de importacao invalido.', 400)
    const batchId = data.batchId ?? data.sourceBatchId
    const { batch } = await authorize(tx, request, batchId)
    if (data.companyId !== batch.companyId || data.stockCenterId !== batch.stockCenterId) fail('Linha fora do escopo do lote.', 400)
    if (await tx.appSalesPostingOperationRecord.findUnique({ where: { batchId } })) fail('Lote ja gerenciado pelo motor de cascata.')
    if (await tx[model].findUnique({ where: { id: data.id } })) fail('ID ja utilizado; atualize o lote antes de repetir.')
    return { [envelope]: await tx[model].create({ data }) }
  })))

  app.get('/api/sales-import-batches/:id/posting-details', route(async (request, batchId) => {
    return prisma.$transaction(async (tx) => ({ plan: (await load(tx, request, batchId)).plan }),
      { isolationLevel: 'RepeatableRead', timeout: 20000 })
  }))
  app.post('/api/sales-import-batches/:id/posting-preview', route(async (request, batchId) => {
    return prisma.$transaction(async (tx) => ({ plan: (await load(tx, request, batchId, request.body?.timing)).plan }),
      { isolationLevel: 'RepeatableRead', timeout: 20000 })
  }))
  app.put('/api/sales-import-batches/:id/posting-settings', route(async (request, batchId) => {
    if (request.auth.kind !== 'systemAdmin') fail('Somente master pode habilitar ou alterar a politica.', 403)
    return lockedTransaction(prisma, async (tx) => {
      const { batch, center } = await authorize(tx, request, batchId)
      const policies = request.body?.policies
      if (!policies || typeof policies !== 'object' || Array.isArray(policies) ||
          Object.entries(policies).some(([key, value]) => !/^\d+$/.test(key) || !['CASCADE_LOCAL', 'STOCK_ONLY'].includes(value))) fail('Politicas invalidas.', 400)
      const value = { companyId: batch.companyId, stockCenterId: center.id, enabled: request.body.enabled === true, policies }
      const before = await tx.appSalesPostingSettingsRecord.findUnique({ where: { stockCenterId: center.id } })
      const settings = await tx.appSalesPostingSettingsRecord.upsert({ where: { stockCenterId: center.id }, create: value, update: value })
      await audit(tx, request.auth, batch, 'CONFIGURE_SALES_CASCADE', { before, after: settings })
      return { settings }
    })
  }))

  for (const action of ['confirm', 'resume']) app.post(`/api/sales-import-batches/:id/posting-${action}`, route(async (request, batchId) => {
    const key = request.body?.idempotencyKey
    if (typeof key !== 'string' || key.length < 16 || key.length > 120) fail('Chave de confirmacao invalida.', 400)
    return lockedTransaction(prisma, async (tx) => {
      const context = await load(tx, request, batchId, request.body?.timing)
      const { batch, center, operation, settings, plan, timing, originalDemands } = context
      if (operation?.status === 'REVERSED' || batch.status === 'CANCELLED') fail('Lote cancelado; nao e possivel lancar novamente.')
      const previous = Object.hasOwn(operation?.receipts ?? {}, key) ? operation.receipts[key] : null
      if (previous) return previous
      if (operation?.status === 'POSTED') return { plan, operation, replayed: true }
      if (!settings?.enabled && !operation) fail('A baixa em cascata ainda nao foi habilitada pelo master para este centro.')
      if (!operation && context.consumptions.some((c) => c.stockMovementId || c.stockPostingStatus === 'POSTED')) {
        fail('Este lote ja possui lancamento legado. Confira os movimentos antes de qualquer migracao.')
      }
      if (!originalDemands.length) fail('Lote sem consumos calculados para lancamento.', 400)
      if (!operation && batch.summary?.serverAllocatedIds) {
        const rows = await tx.appSalesImportRowRecord.findMany({ where: { batchId }, orderBy: { id: 'asc' } })
        const roots = await tx.appTechnicalSheetRecord.findMany({ where: { id: { in: rows.map((row) => row.matchedTechnicalSheetId).filter(Boolean) } },
          select: { id: true, kind: true, ingredients: true, garnishIngredients: true } })
        const rootById = new Map(roots.map((sheet) => [sheet.id, sheet]))
        const seen = new Set()
        let expected = 0
        for (const row of rows.filter((row) => row.status === 'MATCHED')) {
          const key = `${row.consumedAt}:${row.companyProductId}`
          if (center.salesImportSettings?.duplicateRowPolicy === 'SKIP' && seen.has(key)) continue
          seen.add(key)
          const root = rootById.get(row.matchedTechnicalSheetId)
          expected += root?.kind === 'PRODUTO_INTERNO' ? 1 : [...(root?.ingredients ?? []), ...(root?.garnishIngredients ?? [])]
            .filter((item) => item.isActive && item.productId).length
        }
        if (rows.length !== batch.summary.totalRows || context.consumptions.length !== expected) {
          fail('A importacao esta incompleta. Reprocesse/conclua a gravacao antes de lancar o estoque.')
        }
      }
      if (request.body.revision !== plan.revision) fail('A previa mudou. Confira novamente saldos, receitas e periodo antes de confirmar.')
      const waiting = plan.pending.length > 0 && plan.pending.every((p) => p.reason === 'OPEN_INVENTORY')
      if (plan.pending.length && !waiting && request.body.allowPartial !== true) fail('Existem pendencias. Regularize ou confirme explicitamente o lancamento parcial.')
      if (plan.warnings.length && request.body.confirmNegativeProducts !== true) fail('Confirme os produtos que ficarao com estoque negativo.')
      const allocations = await saveMovements(tx, request.auth, batch, plan.allocations)
      const allAllocations = [...(operation?.allocations ?? []), ...allocations]
      const covered = [...(operation?.covered ?? []), ...plan.covered]
      const residual = plan.pending.map(({ reason, message, path, ...demand }) => demand)
      const status = waiting ? 'WAITING_INVENTORY' : residual.length ? 'PARTIAL' : 'POSTED'
      const values = { companyId: batch.companyId, stockCenterId: center.id, engine: ENGINE_VERSION, status,
        originalDemands, residual, allocations: allAllocations, covered, timing, revision: (operation?.revision ?? 0) + 1 }
      let saved = await tx.appSalesPostingOperationRecord.upsert({ where: { batchId },
        create: { batchId, ...values, receipts: {} }, update: values })
      await tx.appSalesImportBatchRecord.update({ where: { id: batchId }, data: {
        status: status === 'POSTED' ? 'POSTED' : 'POST_QUEUED', postingMode: 'POST_PENDING',
        summary: { ...batch.summary, postingEngine: ENGINE_VERSION, postingStatus: status },
      } })
      const residualIds = residual.map((d) => d.id)
      await tx.appSalesConsumptionRecord.updateMany({ where: { sourceBatchId: batchId, stockPostingStatus: { not: 'CANCELLED' }, id: { notIn: residualIds } },
        data: { stockPostingStatus: 'POSTED', stockMovementId: null, postedAt: new Date().toISOString() } })
      if (residualIds.length) await tx.appSalesConsumptionRecord.updateMany({ where: { sourceBatchId: batchId, id: { in: residualIds } },
        data: { stockPostingStatus: 'PENDING', stockMovementId: null, postedAt: '' } })
      await audit(tx, request.auth, batch, `SALES_CASCADE_${action.toUpperCase()}`, {
        operationId: saved.id, revision: saved.revision, status, allocations, pending: plan.pending, covered: plan.covered, timing,
      })
      const result = { operation: { ...saved, receipts: undefined }, plan }
      await tx.appSalesPostingOperationRecord.update({ where: { batchId }, data: {
        receipts: { ...(operation?.receipts ?? {}), [key]: { operation: { id: saved.id, status, revision: saved.revision }, replayed: true } },
      } })
      return result
    })
  }))

  app.post('/api/sales-import-batches/:id/posting-reverse', route(async (request, batchId) => lockedTransaction(prisma, async (tx) => {
    const { batch, operation } = await load(tx, request, batchId)
    if (!operation) fail('Lote nao usa o motor de cascata.')
    if (operation.status === 'REVERSED') return { operation, replayed: true }
    // Effective dates are preserved: later inventory snapshots must not gain stock on cancellation.
    const reversed = await saveMovements(tx, request.auth, batch, operation.allocations, true)
    const saved = await tx.appSalesPostingOperationRecord.update({ where: { batchId }, data: {
      status: 'REVERSED', residual: [], revision: operation.revision + 1,
      receipts: { ...operation.receipts, reversal: { allocations: reversed, at: new Date().toISOString() } },
    } })
    await tx.appSalesImportBatchRecord.update({ where: { id: batchId }, data: {
      status: 'CANCELLED', summary: { ...batch.summary, postingStatus: 'REVERSED' },
    } })
    await tx.appSalesConsumptionRecord.updateMany({ where: { sourceBatchId: batchId }, data: { stockPostingStatus: 'CANCELLED', postedAt: '' } })
    await audit(tx, request.auth, batch, 'SALES_CASCADE_REVERSE', { operationId: saved.id, reversed })
    return { operation: saved }
  })))

  // Stop old tabs and background entity synchronization from bypassing an already managed operation.
  app.use('/api', async (request, response, next) => {
    try {
      if (!['PUT', 'POST', 'DELETE'].includes(request.method)) return next()
      const match = request.path.match(/^\/(sales-import-batches|sales-import-rows|sales-consumptions|inventory-counts|inventory-count-sessions)\/?(\d+)?$/)
      if (!match) return next()
      const [ , resource, rawId] = match
      const id = Number(rawId ?? request.body?.id)
      let batchId = resource === 'sales-import-batches' ? id : request.body?.batchId ?? request.body?.sourceBatchId
      if (['inventory-counts', 'inventory-count-sessions'].includes(resource)) {
        const model = resource === 'inventory-counts' ? prisma.appInventoryCountRecord : prisma.appInventoryCountSessionRecord
        const existing = Number.isSafeInteger(id) ? await model.findUnique({ where: { id } }) : null
        const managed = resource === 'inventory-counts'
          ? /^(VENDAS|ESTORNO) CASCADE_V1 - LOTE /.test(existing?.recipientLabel ?? '')
          : existing && await prisma.appInventoryCountRecord.findFirst({ where: {
            sessionId: id, OR: [{ recipientLabel: { startsWith: 'VENDAS CASCADE_V1 - LOTE ' } }, { recipientLabel: { startsWith: 'ESTORNO CASCADE_V1 - LOTE ' } }],
          }, select: { id: true } })
        if (managed) {
          const normalize = resource === 'inventory-counts' ? normalizeInventoryCountPayload : normalizeInventoryCountSessionPayload
          const normalized = normalize(request.body)
          if (request.method === 'PUT' && normalized && Object.entries(normalized).every(([key, value]) =>
            JSON.stringify(serialize(existing?.[key])) === JSON.stringify(serialize(value)))) {
            return response.json({ [resource === 'inventory-counts' ? 'inventoryCount' : 'inventoryCountSession']: serialize(existing) })
          }
          fail('Movimento de vendas auditado: use o estorno do lote, nao edicao/exclusao direta.')
        }
        if (request.body?.storageLocation === 'SAIDA POR VENDAS IMPORTADAS') {
          const settings = await prisma.appSalesPostingSettingsRecord.findUnique({ where: { stockCenterId: Number(request.body.stockCenterId) || -1 } })
          if (settings?.enabled) fail('Este centro exige conferencia e lancamento pelo motor de cascata. Atualize a pagina.')
        }
        return next()
      }
      if (resource !== 'sales-import-batches' && rawId) {
        const model = resource === 'sales-import-rows' ? prisma.appSalesImportRowRecord : prisma.appSalesConsumptionRecord
        const record = await model.findUnique({ where: { id } })
        batchId = record?.batchId ?? record?.sourceBatchId
      }
      if (!Number.isSafeInteger(batchId)) return next()
      const operation = await prisma.appSalesPostingOperationRecord.findUnique({ where: { batchId } })
      if (operation) {
        if (request.method === 'DELETE' && resource === 'sales-import-batches' && operation.status === 'REVERSED') return next()
        fail('Lote gerenciado pelo motor de cascata. Use conferencia, retomada ou estorno; nao reprocese pelo fluxo legado.')
      }
      if (resource === 'sales-import-batches' && request.body?.status === 'POSTED') {
        const settings = await prisma.appSalesPostingSettingsRecord.findUnique({ where: { stockCenterId: Number(request.body.stockCenterId) || -1 } })
        if (settings?.enabled) fail('Este centro exige conferencia antes da baixa. Atualize a pagina.')
      }
      next()
    } catch (error) {
      response.status(error.statusCode ?? 500).json({ error: error.message })
    }
  })
}

module.exports = { registerSalesImportRoutes, normalizeTiming }
