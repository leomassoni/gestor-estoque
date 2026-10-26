const { registerInventoryIdentityRecoveryRoutes } = require('./inventoryIdentityRecovery')

function fail(message, statusCode) {
  throw Object.assign(new Error(message), { statusCode })
}

function userAuditData(user) {
  if (!user) return null
  const { id, fullName, username, role, companyId, companyIds, sectors, isActive, accessProfileId,
    sectionAccess, catalogAccess, recipePanelAccess, memberships } = user
  return { id, fullName, username, role, companyId, companyIds, sectors, isActive, accessProfileId,
    sectionAccess, catalogAccess, recipePanelAccess,
    memberships: memberships.map(({ userId: _userId, createdAt: _created, updatedAt: _updated, ...membership }) => membership) }
}

async function auditUser(tx, auth, before, after, recovery) {
  const user = after ?? before
  const actor = auth.user
  const action = !before ? 'CREATE' : !after ? 'DELETE' : 'UPDATE'
  const max = await tx.appAuditLogRecord.aggregate({ _max: { id: true } })
  await tx.appAuditLogRecord.create({ data: {
    id: (max._max.id ?? 0) + 1, companyId: user.companyId,
    actorUserId: actor?.id ?? null, actorUserName: actor?.fullName ?? 'ADMINISTRADOR DO SISTEMA',
    actorUsername: actor?.username ?? auth.username ?? '', actorRole: actor?.role ?? 'MASTER',
    actorKind: auth.kind === 'systemAdmin' ? 'SYSTEM_ADMIN' : 'APP_USER', module: 'USUARIOS',
    actionKey: recovery ? 'RECOVER_USER_INVENTORY_IDENTITY' : `${action}_USER`,
    actionLabel: recovery ? 'Recuperacao de vinculos de contagem' : `${action === 'CREATE' ? 'Cadastro' : action === 'DELETE' ? 'Exclusao' : 'Atualizacao'} de usuario`,
    targetType: 'USER', targetId: String(user.id), targetLabel: user.fullName,
    summary: recovery ? `Vinculos de inventario de ${user.fullName} recuperados apos colisao de ID.` :
      `Usuario ${user.fullName} ${action === 'CREATE' ? 'cadastrado' : action === 'DELETE' ? 'excluido' : 'atualizado'} pelo servidor.`,
    impactSummary: 'Acao e auditoria confirmadas na mesma transacao. Contagens historicas preservadas.',
    severity: action === 'DELETE' ? 'CRITICAL' : 'HIGH', result: 'SUCCESS',
    relatedCompanyIds: [...new Set([...(before?.companyIds ?? []), ...(after?.companyIds ?? [])])],
    occurredAt: new Date().toISOString(),
    details: { source: 'SERVER', before: userAuditData(before), after: userAuditData(after), ...(recovery ? { recovery } : {}) },
  } })
}

function registerUserManagementRoutes(app, prisma, helpers) {
  const { normalizeUserPayload, hashPassword, sanitizeAppUserRecord, getAppUserCompanyIds } = helpers
  function authorize(auth, existing, incoming) {
    if (auth.kind === 'systemAdmin') return
    const allowed = getAppUserCompanyIds(auth.user)
    const canManage = auth.user.sectionAccess?.Usuarios || auth.user.memberships?.some((m) =>
      m.isActive && m.sectionAccess?.Usuarios)
    if (!canManage || (existing && !getAppUserCompanyIds(existing).some((id) => allowed.includes(id))) ||
        (incoming && getAppUserCompanyIds(incoming).some((id) => !allowed.includes(id)))) {
      fail('Usuario ou empresa fora do escopo de administracao.', 403)
    }
  }
  async function transaction(operation) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(74261003)')
          return operation(tx)
        }, { timeout: 20000 })
      } catch (error) {
        // Another operational audit may allocate an ID concurrently; retry the whole transaction.
        if (error.code !== 'P2002' || attempt >= 4) throw error
      }
    }
  }
  const route = (handler) => async (request, response) => {
    try { await handler(request, response) } catch (error) {
      const status = error.statusCode ?? (error.code === 'P2002' ? 409 : 500)
      if (status >= 500) console.error('User management failed:', error.code ?? 'INTERNAL')
      response.status(status).json({
        error: status >= 500 ? 'Nao foi possivel concluir a operacao de usuario no servidor.' :
          error.code === 'P2002' ? 'Ja existe outro usuario com esse login.' : error.message,
      })
    }
  }
  app.post('/api/users', route(async (request, response) => {
    const user = normalizeUserPayload({ ...request.body, id: 1 })
    if (!user || !user.password.trim()) fail('Dados de usuario e senha obrigatorios.', 400)
    authorize(request.auth, null, user)
    const passwordHash = await hashPassword(user.password)
    const saved = await transaction(async (tx) => {
      if (await tx.appUserRecord.findUnique({ where: { username: user.username } })) fail('Ja existe outro usuario com esse login.', 409)
      // Legacy bootstrap imports explicit IDs; never move the sequence backwards or reuse a deleted ID.
      await tx.$queryRawUnsafe(`SELECT setval('"AppUserRecord_id_seq"', GREATEST(last_value,
        COALESCE((SELECT MAX(id) FROM "AppUserRecord"), 0)),
        is_called OR last_value <= COALESCE((SELECT MAX(id) FROM "AppUserRecord"), 0)) FROM "AppUserRecord_id_seq"`)
      const { id: _id, memberships, ...record } = user
      const created = await tx.appUserRecord.create({ data: {
        ...record, password: '', passwordHash,
        memberships: { create: memberships.map(({ id: _id, ...membership }) => membership) },
      }, include: { memberships: true } })
      await auditUser(tx, request.auth, null, created)
      return created
    })
    response.json({ user: sanitizeAppUserRecord(saved) })
  }))
  app.put('/api/users/:id', route(async (request, response) => {
    const id = Number(request.params.id)
    const user = normalizeUserPayload({ ...request.body, id })
    if (!Number.isSafeInteger(id) || !user) fail('Payload de usuario invalido.', 400)
    const passwordHash = user.password.trim() ? await hashPassword(user.password) : null
    const saved = await transaction(async (tx) => {
      const existing = await tx.appUserRecord.findUnique({ where: { id }, include: { memberships: true } })
      if (!existing) fail('Usuario inexistente. Atualize a lista antes de continuar.', 404)
      authorize(request.auth, existing, user)
      const { memberships, ...record } = user
      await tx.appUserCompanyMembershipRecord.deleteMany({ where: { userId: id } })
      const updated = await tx.appUserRecord.update({ where: { id }, data: {
        ...record, password: passwordHash ? '' : existing.password,
        passwordHash: passwordHash ?? existing.passwordHash,
        memberships: { create: memberships.map(({ id: _id, ...membership }) => membership) },
      }, include: { memberships: true } })
      await auditUser(tx, request.auth, existing, updated)
      return updated
    })
    response.json({ user: sanitizeAppUserRecord(saved) })
  }))
  app.delete('/api/users/:id', route(async (request, response) => {
    const id = Number(request.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) fail('Usuario invalido.', 400)
    await transaction(async (tx) => {
      const existing = await tx.appUserRecord.findUnique({ where: { id }, include: { memberships: true } })
      if (!existing) fail('Usuario nao encontrado.', 404)
      authorize(request.auth, existing, null)
      await auditUser(tx, request.auth, existing, null)
      await tx.appUserRecord.delete({ where: { id } })
    })
    response.json({ ok: true })
  }))
  registerInventoryIdentityRecoveryRoutes(app, prisma, { transaction, auditUser, getAppUserCompanyIds })
}

module.exports = { registerUserManagementRoutes }
