const { lockedTransaction } = require('./production')

function fail(message, statusCode = 409) {
  throw Object.assign(new Error(message), { statusCode })
}

function isManualRequest(request) {
  return request.sourceRequisitionId === null && request.planningSourceKind !== 'EXECUCAO'
}

function registerManualProductionCancellationRoutes(app, prisma, { userCanAccessCompany }) {
  app.post('/api/manual-production-requests/cancel', async (request, response) => {
    try {
      const { companyId, centerId, sheetId, requestIds } = request.body ?? {}
      if (![companyId, centerId, sheetId].every((id) => Number.isSafeInteger(id) && id > 0) ||
          !Array.isArray(requestIds) || requestIds.length === 0 ||
          requestIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
          new Set(requestIds).size !== requestIds.length) fail('Solicitacoes de producao invalidas.', 400)

      const result = await lockedTransaction(prisma, async (tx) => {
        const allRequests = await tx.appManualProductionRequestRecord.findMany({ where: { companyId } })
        const byId = new Map(allRequests.map((item) => [item.id, item]))
        const selected = requestIds.map((id) => byId.get(id))
        if (selected.some((item) => !item || item.centerId !== centerId || item.sheetId !== sheetId || !isManualRequest(item))) {
          fail('A fila mudou ou inclui demanda que nao e entrada manual. Atualize a lista.')
        }
        const rootIds = new Set(selected.filter((item) => !item.isDependencyRequest).map((item) => item.rootRequestId))
        if (selected.some((item) => item.isDependencyRequest && byId.has(item.rootRequestId))) {
          fail('Esta dependencia ainda possui pedido principal. Cancele o pedido na origem.')
        }
        const affected = allRequests.filter((item) => rootIds.has(item.rootRequestId) || requestIds.includes(item.id))
        if (affected.some((item) => !isManualRequest(item))) fail('O pedido possui demanda de outra origem e nao pode ser cancelado aqui.')

        const centers = await tx.appStockCenterRecord.findMany({ where: { id: { in: [...new Set(affected.map((item) => item.centerId))] } } })
        if (centers.length !== new Set(affected.map((item) => item.centerId)).size ||
            centers.some((item) => item.companyId !== companyId)) fail('Centro de producao invalido.')
        if (request.auth.kind !== 'systemAdmin' &&
            (!userCanAccessCompany(request.auth.user, companyId) ||
              centers.some((item) => !item.userIds.includes(request.auth.user.id)))) {
          fail('Sem permissao para cancelar pedidos desses centros.', 403)
        }
        const drafts = await tx.appProductionDraftRecord.findMany({
          where: { companyId, OR: affected.map((item) => ({ centerId: item.centerId, sheetId: item.sheetId })) },
        })
        if (drafts.length > 0) fail('Ha producao iniciada. Cancele o inicio antes de retirar o pedido manual.')

        const deleted = await tx.appManualProductionRequestRecord.deleteMany({
          where: { companyId, id: { in: affected.map((item) => item.id) } },
        })
        if (deleted.count !== affected.length) fail('A fila mudou durante o cancelamento. Atualize a lista.')

        const maxAudit = await tx.appAuditLogRecord.aggregate({ _max: { id: true } })
        const actor = request.auth.user
        await tx.appAuditLogRecord.create({ data: {
          id: (maxAudit._max.id ?? 0) + 1, companyId,
          actorUserId: actor?.id ?? null, actorUserName: actor?.fullName ?? 'ADMINISTRADOR DO SISTEMA',
          actorUsername: actor?.username ?? request.auth.username ?? '', actorRole: actor?.role ?? 'MASTER',
          actorKind: request.auth.kind === 'systemAdmin' ? 'SYSTEM_ADMIN' : 'APP_USER',
          module: 'PRODUCAO', actionKey: 'CANCEL_MANUAL_PRODUCTION_REQUEST',
          actionLabel: 'Entrada manual de producao cancelada', targetType: 'MANUAL_PRODUCTION_REQUEST',
          targetId: requestIds.join(','), targetLabel: `${centerId}:${sheetId}`,
          summary: `${selected.length} pedido(s) manual(is) retirado(s) da fila do centro ${centerId}.`,
          impactSummary: `${affected.length} solicitacao(oes) removida(s), incluindo dependencias vinculadas; nenhuma movimentacao de estoque alterada.`,
          severity: 'HIGH', result: 'SUCCESS', relatedCompanyIds: [], occurredAt: new Date().toISOString(),
          details: { selectedRequestIds: requestIds, removedRequests: affected },
        } })
        return { ok: true, deletedIds: affected.map((item) => item.id) }
      })
      response.json(result)
    } catch (error) {
      console.error('Manual production cancellation failed:', error.message)
      response.status(error.statusCode ?? 500).json({
        error: error.statusCode ? error.message : 'Nao foi possivel cancelar o pedido manual. Atualize a fila e tente novamente.',
      })
    }
  })
}

module.exports = { registerManualProductionCancellationRoutes }
