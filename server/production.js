const productionLock = 194619801

function productionKey(draft) {
  return `${draft.companyId}:${draft.centerId}:${draft.sheetId}:${draft.startedAt}`
}

function fail(message, statusCode = 409) {
  throw Object.assign(new Error(message), { statusCode })
}

async function lockedTransaction(prisma, callback) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock($1)', productionLock)
        return callback(tx)
      }, { timeout: 20000 })
    } catch (error) {
      if (error.code !== 'P2002' || attempt >= 3) throw error
    }
  }
}

async function saveProductionDraft(prisma, draft) {
  return lockedTransaction(prisma, async (tx) => {
    const operation = await tx.appProductionOperationRecord.findUnique({ where: { key: productionKey(draft) } })
    if (operation?.status === 'FINISHED') fail('Esta producao ja foi concluida. Atualize a fila de producoes.')
    if (await findLegacyFinish(tx, draft)) fail('Esta producao ja possui entrada registrada no estoque. Atualize a fila de producoes.')
    const existing = await tx.appProductionDraftRecord.findUnique({ where: { draftId: draft.draftId } })
    if (existing && productionKey(existing) !== productionKey(draft)) fail('Este ID pertence a outra producao. Atualize a fila.')
    return tx.appProductionDraftRecord.upsert({
      where: { draftId: draft.draftId }, create: draft, update: draft,
    })
  })
}

async function findLegacyFinish(tx, draft) {
  const sessions = await tx.appInventoryCountSessionRecord.findMany({
    where: { companyId: draft.companyId, stockCenterId: draft.centerId, startedAt: draft.startedAt, inventoryId: null },
    select: { id: true },
  })
  if (!sessions.length) return null
  const record = await tx.appInventoryCountRecord.findFirst({ where: {
    sessionId: { in: sessions.map((s) => s.id) }, technicalSheetId: draft.sheetId,
    companyId: draft.companyId, stockCenterId: draft.centerId,
    storageLocation: 'ENTRADA DE PRODUCAO', recipientLabel: 'PRODUCAO CONFIRMADA',
  }, orderBy: { id: 'desc' } })
  if (!record) return null
  const session = await tx.appInventoryCountSessionRecord.findUnique({ where: { id: record.sessionId } })
  return { result: 'applied', session, records: [record], pending: null }
}

async function saveMovement(tx, draft, session, records, serialize) {
  if (records.length === 0) return { result: 'applied', session: null, records: [], pending: null }
  const sessionId = await nextInventoryMovementId(tx)
  const pending = await tx.appPendingInventoryMovementRecord.findMany()
  const savedSession = { ...session, id: sessionId, inventoryId: null }
  const savedRecords = records.map((record, index) => ({ ...record, id: sessionId + index + 1, sessionId, inventoryId: null }))
  const inventory = await tx.appInventoryRecord.findFirst({
    where: { companyId: draft.companyId, stockCenterId: draft.centerId, isClosed: false },
    orderBy: { id: 'desc' },
  })
  if (inventory) {
    const movement = await tx.appPendingInventoryMovementRecord.create({ data: {
      id: Math.max(0, ...pending.map((m) => m.id)) + 1,
      companyId: draft.companyId, stockCenterId: draft.centerId, inventoryId: inventory.id,
      createdAt: new Date().toISOString(), createdByUserId: savedSession.closedByUserId,
      createdByUserName: savedSession.closedByUserName,
      description: `${savedRecords[0].storageLocation} - ${draft.sheetId}`,
      session: serialize(savedSession), records: serialize(savedRecords),
    } })
    return { result: 'queued', session: savedSession, records: serialize(savedRecords), pending: movement }
  }
  await tx.appInventoryCountSessionRecord.create({ data: savedSession })
  await tx.appInventoryCountRecord.createMany({ data: savedRecords })
  return { result: 'applied', session: savedSession, records: serialize(savedRecords), pending: null }
}

async function nextInventoryMovementId(tx) {
  const [sessionMax, countMax, pending] = await Promise.all([
    tx.appInventoryCountSessionRecord.aggregate({ _max: { id: true } }),
    tx.appInventoryCountRecord.aggregate({ _max: { id: true } }),
    tx.appPendingInventoryMovementRecord.findMany(),
  ])
  const reservedIds = pending.flatMap((m) => [m.session?.id ?? 0, ...m.records.map((r) => r.id)])
  return Math.max(sessionMax._max.id ?? 0, countMax._max.id ?? 0, ...reservedIds) + 1
}

async function auditProduction(tx, draft, phase, movement, auth) {
  const max = await tx.appAuditLogRecord.aggregate({ _max: { id: true } })
  const user = auth.user
  await tx.appAuditLogRecord.create({ data: {
    id: (max._max.id ?? 0) + 1, companyId: draft.companyId,
    actorUserId: user?.id ?? null, actorUserName: user?.fullName ?? 'ADMINISTRADOR DO SISTEMA',
    actorUsername: user?.username ?? auth.username ?? '', actorRole: user?.role ?? 'MASTER',
    actorKind: auth.kind === 'systemAdmin' ? 'SYSTEM_ADMIN' : 'APP_USER', module: 'PRODUCAO',
    actionKey: `PRODUCTION_${phase.toUpperCase()}`, actionLabel: phase === 'start' ? 'Producao iniciada' : 'Producao concluida',
    targetType: 'PRODUCTION', targetId: productionKey(draft), targetLabel: String(draft.sheetId),
    summary: `Producao ${phase === 'start' ? 'iniciada' : 'concluida'} no centro ${draft.centerId}.`,
    impactSummary: `${movement.records.length} movimentacoes ${movement.result === 'queued' ? 'pendentes de inventario' : 'persistidas'}.`,
    severity: 'HIGH', result: 'SUCCESS', relatedCompanyIds: [], occurredAt: new Date().toISOString(),
    details: { draft, movement },
  } })
}

function registerProductionRoutes(app, prisma, helpers) {
  const { normalizeProductionDraftPayload, normalizeInventoryCountSessionPayload, normalizeInventoryCountPayload,
    serializeBigIntForJson: serialize, userCanAccessCompany, parseDecimal } = helpers
  app.post('/api/production-transitions/:phase', async (request, response) => {
    try {
      const phase = request.params.phase
      if (!['start', 'finish'].includes(phase)) fail('Transicao de producao invalida.', 400)
      const raw = request.body
      const draft = normalizeProductionDraftPayload({ ...raw.draft, draftId: raw.draft?.draftId ?? 1 })
      if (!draft || !draft.startedAt || !Number.isFinite(Date.parse(draft.startedAt))) fail('Producao invalida.', 400)
      const sheet = await prisma.appTechnicalSheetRecord.findUnique({ where: { id: draft.sheetId } })
      if (!sheet || !sheet.isActive || !['PREPARO', 'PRODUTO_INTERNO'].includes(sheet.kind) ||
          (sheet.companyId !== draft.companyId && !sheet.sharedCompanyIds.includes(draft.companyId))) fail('Ficha de producao invalida.', 400)
      const center = await prisma.appStockCenterRecord.findUnique({ where: { id: draft.centerId } })
      if (!center || center.companyId !== draft.companyId || !center.isProducer) fail('Centro produtor invalido.', 400)
      if (request.auth.kind !== 'systemAdmin' &&
          (!userCanAccessCompany(request.auth.user, draft.companyId) || !center.userIds.includes(request.auth.user.id))) {
        fail('Sem permissao para produzir neste centro.', 403)
      }
      const session = normalizeInventoryCountSessionPayload({ ...raw.session, id: 1 })
      const records = Array.isArray(raw.records)
        ? raw.records.map((r) => normalizeInventoryCountPayload({ ...r, id: 1, sessionId: 1 })) : []
      if (!session || records.some((r) => !r) || session.companyId !== draft.companyId ||
          session.stockCenterId !== draft.centerId || records.some((r) => r.companyId !== draft.companyId || r.stockCenterId !== draft.centerId)) {
        fail('Movimentacao de producao invalida.', 400)
      }
      if (phase === 'start' && records.some((r) => r.storageLocation !== 'SAIDA PARA PRODUCAO' || !(parseDecimal(r.totalCountedQuantity) < 0))) {
        fail('Consumo de producao invalido.', 400)
      }
      if (phase === 'start') {
        const allowedProducts = new Set(sheet.ingredients.filter((i) => i.isActive).flatMap((i) => [
          i.productId, ...(i.equivalentProducts ?? []).filter((e) => e.isActive !== false).map((e) => e.productId),
        ]))
        const linkedSheets = await prisma.appTechnicalSheetRecord.findMany({
          where: { productId: { in: [...allowedProducts] } }, select: { id: true },
        })
        const allowedSheets = new Set(linkedSheets.map((s) => s.id))
        if (records.some((r) => r.technicalSheetId ? !allowedSheets.has(r.technicalSheetId) : !allowedProducts.has(r.productId))) {
          fail('A composicao da ficha foi atualizada. Reabra a producao para conferir os insumos atuais.')
        }
      }
      if (phase === 'finish') {
        const output = records.find((r) => r.technicalSheetId === draft.sheetId)
        if (!output || records.some((r) => r.storageLocation !== 'ENTRADA DE PRODUCAO' || !(parseDecimal(r.totalCountedQuantity) > 0)) ||
            parseDecimal(output.totalCountedQuantity) !== parseDecimal(draft.finalYield)) fail('Rendimento de producao invalido.', 400)
        if (sheet.targetPh.trim() && !draft.confirmedPh.trim()) fail('Confirme o PH da producao.', 400)
        if (sheet.targetBrix.trim() && !draft.confirmedBrix.trim()) fail('Confirme o Brix da producao.', 400)
        const allowedOutputs = new Set([sheet.id, sheet.yieldDifferenceByproductTechnicalSheetId].filter((id) => id !== null))
        if (records.some((r) => !allowedOutputs.has(r.technicalSheetId)) || new Set(records.map((r) => r.technicalSheetId)).size !== records.length) {
          fail('Saidas da producao nao correspondem a ficha tecnica.', 400)
        }
      }
      const result = await lockedTransaction(prisma, async (tx) => {
        const key = productionKey(draft)
        const operation = await tx.appProductionOperationRecord.findUnique({ where: { key } })
        if (phase === 'finish' && operation?.finishResult) return operation.finishResult
        if (phase === 'start' && operation?.status === 'FINISHED') fail('Esta producao ja foi concluida.')
        if (phase === 'start' && operation?.startResult) return operation.startResult
        const legacyFinish = operation ? null : await findLegacyFinish(tx, draft)
        if (legacyFinish) {
          if (phase === 'start') fail('Esta producao ja foi concluida. Atualize a fila.')
          await tx.appProductionDraftRecord.deleteMany({ where: {
            companyId: draft.companyId, centerId: draft.centerId, sheetId: draft.sheetId, startedAt: draft.startedAt,
          } })
          return serialize({ draft: null, movement: legacyFinish })
        }
        const existing = await tx.appProductionDraftRecord.findFirst({
          where: { companyId: draft.companyId, centerId: draft.centerId, sheetId: draft.sheetId },
        })
        if (phase === 'finish' && (!existing || existing.startedAt !== draft.startedAt)) fail('Producao nao esta mais em andamento. Atualize a fila.')
        if (phase === 'start' && existing) {
          if (existing.startedAt !== draft.startedAt) fail('Esta ficha ja possui uma producao em andamento. Atualize a fila e continue a producao existente.')
          return { draft: existing, movement: { result: 'applied', session: null, records: [], pending: null } }
        }
        if (phase === 'finish' && records.length === 0) fail('Informe o rendimento final da producao.', 400)
        const movement = await saveMovement(tx, draft, session, records, serialize)
        let savedDraft = existing
        if (phase === 'start') {
          const [maxDraft, maxOperation] = await Promise.all([
            tx.appProductionDraftRecord.aggregate({ _max: { draftId: true } }),
            tx.appProductionOperationRecord.aggregate({ _max: { draftId: true } }),
          ])
          savedDraft = await tx.appProductionDraftRecord.create({ data: {
            ...draft, draftId: Math.max(maxDraft._max.draftId ?? 0, maxOperation._max.draftId ?? 0) + 1,
            consumptionSessionId: movement.session?.id ?? null,
          } })
          await tx.appManualProductionRequestRecord.deleteMany({ where: {
            id: { in: draft.manualRequestIds }, companyId: draft.companyId, centerId: draft.centerId,
          } })
        } else {
          await tx.appProductionDraftRecord.delete({ where: { id: existing.id } })
        }
        const payload = serialize({ draft: phase === 'start' ? savedDraft : null, movement })
        await tx.appProductionOperationRecord.upsert({ where: { key }, create: {
          key, companyId: draft.companyId, centerId: draft.centerId, sheetId: draft.sheetId,
          draftId: savedDraft.draftId, status: phase === 'start' ? 'STARTED' : 'FINISHED',
          [phase === 'start' ? 'startResult' : 'finishResult']: payload,
        }, update: { status: phase === 'start' ? 'STARTED' : 'FINISHED',
          [phase === 'start' ? 'startResult' : 'finishResult']: payload } })
        await auditProduction(tx, draft, phase, movement, request.auth)
        return payload
      })
      response.json(result)
    } catch (error) {
      console.error('Production transition failed:', error.message)
      response.status(error.statusCode ?? 500).json({ error: error.statusCode ? error.message : 'Nao foi possivel salvar a producao. Tente novamente.' })
    }
  })
}

module.exports = { registerProductionRoutes, saveProductionDraft, productionKey, lockedTransaction, nextInventoryMovementId }
