async function assertInventorySessionWritable(prisma, session, existing, allowReopen = false) {
  if (session.inventoryId !== null) {
    const inventory = await prisma.appInventoryRecord.findUnique({ where: { id: session.inventoryId } })
    if (!inventory || inventory.companyId !== session.companyId || inventory.countedAt !== session.countedAt) {
      throw Object.assign(new Error('A contagem nao corresponde a um inventario valido.'), { statusCode: 409 })
    }
    if (inventory.isClosed && !session.isClosed) {
      throw Object.assign(new Error('O inventario ja foi finalizado. Sua contagem nao pode ser reaberta por sincronizacao.'), { statusCode: 409 })
    }
  }
  if (existing?.isClosed && !session.isClosed && !allowReopen) {
    throw Object.assign(new Error('Contagem finalizada nao pode ser reaberta por sincronizacao automatica. Use a acao de retomar contagem.'), { statusCode: 409 })
  }
}

async function deleteInventorySessionWithAudit(tx, sessionId, auth) {
  const session = await tx.appInventoryCountSessionRecord.findUnique({ where: { id: sessionId } })
  if (!session) return
  const counts = await tx.appInventoryCountRecord.findMany({ where: { sessionId }, select: {
    id: true, inventoryId: true, productId: true, technicalSheetId: true, technicalSheetName: true,
    totalCountedQuantity: true, totalCountedUnit: true, storageLocation: true, createdByUserId: true,
    createdByUserName: true, createdAtRecord: true,
  } })
  await tx.appInventoryCountRecord.deleteMany({ where: { sessionId } })
  await tx.appInventoryCountSessionRecord.delete({ where: { id: sessionId } })
  await tx.appInventoryActiveSessionLinkRecord.updateMany({ where: { sessionId }, data: { sessionId: null } })
  const max = await tx.appAuditLogRecord.aggregate({ _max: { id: true } })
  await tx.appAuditLogRecord.create({ data: {
    id: (max._max.id ?? 0) + 1, companyId: session.companyId,
    actorUserId: auth.user?.id ?? null, actorUserName: auth.user?.fullName ?? 'ADMINISTRADOR DO SISTEMA',
    actorUsername: auth.user?.username ?? auth.username ?? '', actorRole: auth.user?.role ?? 'MASTER',
    actorKind: auth.kind === 'systemAdmin' ? 'SYSTEM_ADMIN' : 'APP_USER', module: 'INVENTARIO',
    actionKey: 'INVENTORY_COUNT_SESSION_DELETED', actionLabel: 'Contagem excluida',
    targetType: 'INVENTORY_COUNT_SESSION', targetId: String(sessionId), targetLabel: session.startedByUserName,
    summary: `Contagem ${sessionId} de ${session.startedByUserName} excluida do inventario ${session.inventoryId ?? 'operacional'}.`,
    impactSummary: `${counts.length} registros removidos. A posicao historica deste inventario pode mudar.`,
    severity: 'CRITICAL', result: 'SUCCESS', relatedCompanyIds: [], occurredAt: new Date().toISOString(),
    details: { source: 'SERVER', session, deletedItemCount: counts.length, counts },
  } })
}

async function lockInventoryRow(transaction, inventoryId) {
  if (inventoryId !== null) {
    await transaction.$queryRawUnsafe('SELECT id FROM "AppInventoryRecord" WHERE id = $1 FOR UPDATE', inventoryId)
  }
}

module.exports = { assertInventorySessionWritable, lockInventoryRow, deleteInventorySessionWithAudit }
