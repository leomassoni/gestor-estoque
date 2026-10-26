function fail(message, statusCode = 409) {
  throw Object.assign(new Error(message), { statusCode })
}

function registerInventoryIdentityRecoveryRoutes(app, prisma, { transaction, auditUser, getAppUserCompanyIds }) {
  app.post('/api/users/:id/recover-inventory-identity', async (request, response) => {
    try {
      if (request.auth?.kind !== 'systemAdmin') fail('Recuperacao restrita ao administrador master.', 403)
      const id = Number(request.params.id)
      const { previousUserId, companyId, expectedUserName, expectedCountIds, expectedSessionIds, expectedInventoryIds } = request.body ?? {}
      const lists = [expectedCountIds, expectedSessionIds, expectedInventoryIds]
      if (![id, previousUserId, companyId].every((value) => Number.isSafeInteger(value) && value > 0) ||
          id === previousUserId || typeof expectedUserName !== 'string' || !expectedUserName.trim() ||
          lists.some((list) => !Array.isArray(list) || list.some((value) => !Number.isSafeInteger(value) || value <= 0))) {
        fail('Escopo e listas de registros conferidos sao obrigatorios.', 400)
      }
      const result = await transaction(async (tx) => {
        const user = await tx.appUserRecord.findUnique({ where: { id }, include: { memberships: true } })
        const previousUser = await tx.appUserRecord.findUnique({ where: { id: previousUserId }, include: { memberships: true } })
        if (!user || user.fullName !== expectedUserName || !getAppUserCompanyIds(user).includes(companyId) ||
            !previousUser || getAppUserCompanyIds(previousUser).includes(companyId)) {
          fail('Identidades nao correspondem a uma colisao entre empresas. Nenhum vinculo foi alterado.')
        }
        const [counts, sessions, inventories] = await Promise.all([
          tx.appInventoryCountRecord.findMany({ where: { companyId, createdByUserId: previousUserId, createdByUserName: expectedUserName } }),
          tx.appInventoryCountSessionRecord.findMany({ where: { companyId, startedByUserId: previousUserId, startedByUserName: expectedUserName } }),
          tx.appInventoryRecord.findMany({ where: { companyId, startedByUserId: previousUserId, startedByUserName: expectedUserName } }),
        ])
        for (const [records, expectedIds] of [[counts, expectedCountIds], [sessions, expectedSessionIds], [inventories, expectedInventoryIds]]) {
          if (records.length !== expectedIds.length || records.some((record) => !expectedIds.includes(record.id))) {
            fail('Os registros mudaram desde a conferencia. Refaca a copia e a revisao antes de recuperar.')
          }
        }
        await tx.appInventoryCountRecord.updateMany({ where: { id: { in: expectedCountIds } }, data: { createdByUserId: id } })
        await tx.appInventoryCountSessionRecord.updateMany({ where: { id: { in: expectedSessionIds } }, data: { startedByUserId: id } })
        await tx.appInventoryRecord.updateMany({ where: { id: { in: expectedInventoryIds } }, data: { startedByUserId: id } })
        await tx.appInventoryCountSessionRecord.updateMany({ where: { companyId, closedByUserId: previousUserId,
          closedByUserName: expectedUserName }, data: { closedByUserId: id } })
        await tx.appInventoryRecord.updateMany({ where: { companyId, closedByUserId: previousUserId,
          closedByUserName: expectedUserName }, data: { closedByUserId: id } })
        const centers = await tx.appStockCenterRecord.findMany({ where: { companyId } })
        const changedCenters = []
        for (const center of centers) {
          if (!center.userIds.includes(previousUserId) && !center.responsibleUserIds.includes(previousUserId)) continue
          await tx.appStockCenterRecord.update({ where: { id: center.id }, data: {
            userIds: [...new Set(center.userIds.map((value) => value === previousUserId ? id : value))],
            responsibleUserIds: [...new Set(center.responsibleUserIds.map((value) => value === previousUserId ? id : value))],
          } })
          changedCenters.push(center.id)
        }
        const oldKey = `app-user:${previousUserId}`
        const newKey = `app-user:${id}`
        const openSession = sessions.filter((s) => !s.isClosed).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        let active = null
        for (const session of openSession) {
          const inventory = await tx.appInventoryRecord.findUnique({ where: { id: session.inventoryId ?? -1 } })
          if (inventory && !inventory.isClosed) { active = session; break }
        }
        await tx.appInventoryActiveRecordLinkRecord.deleteMany({ where: { companyId, userKey: oldKey } })
        await tx.appInventoryActiveSessionLinkRecord.deleteMany({ where: { companyId, userKey: oldKey } })
        await tx.appInventoryActiveRecordLinkRecord.upsert({ where: { companyId_userKey: { companyId, userKey: newKey } },
          create: { companyId, userKey: newKey, inventoryId: active?.inventoryId ?? null }, update: { inventoryId: active?.inventoryId ?? null } })
        await tx.appInventoryActiveSessionLinkRecord.upsert({ where: { companyId_userKey: { companyId, userKey: newKey } },
          create: { companyId, userKey: newKey, sessionId: active?.id ?? null }, update: { sessionId: active?.id ?? null } })
        const recovery = { previousUserId, newUserId: id, companyId, expectedUserName, countIds: expectedCountIds,
          sessionIds: expectedSessionIds, inventoryIds: expectedInventoryIds, centerIds: changedCenters,
          activeSessionId: active?.id ?? null }
        await auditUser(tx, request.auth, user, user, recovery)
        return recovery
      })
      response.json({ recovery: result })
    } catch (error) {
      response.status(error.statusCode ?? 500).json({ error: error.message })
    }
  })
}

module.exports = { registerInventoryIdentityRecoveryRoutes }
