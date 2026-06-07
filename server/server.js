const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')

loadEnvFile(path.join(__dirname, '.env'))

const prisma = new PrismaClient()
const app = express()
const port = Number(process.env.PORT || 4000)
const clientDistPath = path.resolve(__dirname, '..', 'dist')
const appStateSnapshotKey = 'global'
const companiesStorageKey = 'gestor-estoque:companies'
const usersStorageKey = 'gestor-estoque:users'
const accessProfilesStorageKey = 'gestor-estoque:access-profiles'
const stockModuleSettingsStorageKey = 'gestor-estoque:stock-module-settings'
const stockCentersStorageKey = 'gestor-estoque:stock-centers'
const productsStorageKey = 'gestor-estoque:products'
const serviceItemsStorageKey = 'gestor-estoque:service-items'
const technicalSheetsStorageKey = 'gestor-estoque:technical-sheets'
const requisitionsStorageKey = 'gestor-estoque:requisitions'
const requisitionNotificationsStorageKey = 'gestor-estoque:requisition-notifications'
const manualProductionRequestsStorageKey = 'gestor-estoque:manual-production-requests'
const productionInProgressDraftsStorageKey = 'gestor-estoque:production-in-progress-drafts'
const inventoryRecordsStorageKey = 'gestor-estoque:inventory-records'
const inventoryCountSessionsStorageKey = 'gestor-estoque:inventory-count-sessions'
const inventoryCountsStorageKey = 'gestor-estoque:inventory-counts'
const pendingInventoryMovementsStorageKey = 'gestor-estoque:pending-inventory-movements'
const inventoryStorageLocationsStorageKey = 'gestor-estoque:inventory-storage-locations'
const inventoryActiveRecordsStorageKey = 'gestor-estoque:inventory-active-records'
const inventoryActiveSessionsStorageKey = 'gestor-estoque:inventory-active-sessions'
const maxInt32Id = 2147483647
let hasSeededAppAdminRecords = false
let hasSeededAppStockCenterRecords = false
let hasSeededAppCatalogRecords = false
let hasSeededAppRequisitionRecords = false
let hasSeededAppProductionRecords = false
let hasSeededAppInventoryRecords = false
let hasSanitizedLegacyEntitySnapshotIds = false

app.use(cors())
app.use(express.json({ limit: '5mb' }))
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.set('Pragma', 'no-cache')
  response.set('Expires', '0')
  next()
})

app.get('/api/health', async (_request, response) => {
  await prisma.$queryRaw`SELECT 1`
  response.json({ ok: true })
})

app.get('/api/bootstrap', async (_request, response) => {
  const [companies, establishments, products, memberships, stockMovements] = await Promise.all([
    prisma.company.count(),
    prisma.establishment.count(),
    prisma.product.count(),
    prisma.membership.count(),
    prisma.stockMovement.count(),
  ])

  response.json({
    app: 'gestor-estoque',
    mode: 'bootstrap',
    counts: {
      companies,
      establishments,
      products,
      memberships,
      stockMovements,
    },
  })
})

app.get('/api/state', async (_request, response) => {
  const snapshot = await prisma.appStateSnapshot.findUnique({
    where: { key: appStateSnapshotKey },
  })

  response.json({
    app: 'gestor-estoque',
    mode: 'state',
    snapshot: snapshot
      ? {
          payload: snapshot.payload,
          updatedAt: snapshot.updatedAt.toISOString(),
        }
      : null,
  })
})

async function handleAppStateUpsert(request, response) {
  const payload = request.body?.payload

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    response.status(400).json({ error: 'Payload de estado invalido.' })
    return
  }

  const snapshot = await prisma.appStateSnapshot.upsert({
    where: { key: appStateSnapshotKey },
    create: {
      key: appStateSnapshotKey,
      payload,
    },
    update: {
      payload,
    },
  })

  response.json({
    ok: true,
    updatedAt: snapshot.updatedAt.toISOString(),
  })
}

app.put('/api/state', handleAppStateUpsert)
app.post('/api/state', handleAppStateUpsert)

app.get('/api/companies', async (_request, response) => {
  await ensureAppAdminRecordsSeeded()
  const companies = await prisma.appCompanyRecord.findMany({
    orderBy: [{ tradeName: 'asc' }, { id: 'asc' }],
  })
  response.json({ companies })
})

async function syncCompanyLinkedCompanyIds(transaction, companyId, linkedCompanyIds) {
  const allCompanies = await transaction.appCompanyRecord.findMany({
    select: { id: true, linkedCompanyIds: true },
  })
  const validCompanyIds = new Set(allCompanies.map((record) => record.id))
  const nextLinkedCompanyIds = Array.from(
    new Set(
      linkedCompanyIds.filter((linkedCompanyId) => linkedCompanyId !== companyId && validCompanyIds.has(linkedCompanyId)),
    ),
  ).sort((left, right) => left - right)

  await transaction.appCompanyRecord.update({
    where: { id: companyId },
    data: { linkedCompanyIds: nextLinkedCompanyIds },
  })

  for (const company of allCompanies) {
    if (company.id === companyId) {
      continue
    }

    const shouldLink = nextLinkedCompanyIds.includes(company.id)
    const currentLinkedCompanyIds = Array.isArray(company.linkedCompanyIds) ? company.linkedCompanyIds : []
    const nextCompanyLinkedIds = shouldLink
      ? Array.from(new Set([...currentLinkedCompanyIds, companyId])).sort((left, right) => left - right)
      : currentLinkedCompanyIds.filter((linkedCompanyId) => linkedCompanyId !== companyId)

    if (JSON.stringify(nextCompanyLinkedIds) === JSON.stringify(currentLinkedCompanyIds)) {
      continue
    }

    await transaction.appCompanyRecord.update({
      where: { id: company.id },
      data: { linkedCompanyIds: nextCompanyLinkedIds },
    })
  }
}

app.post('/api/companies', async (request, response) => {
  const company = normalizeCompanyPayload(request.body)
  if (!company) {
    response.status(400).json({ error: 'Payload de empresa invalido.' })
    return
  }

  const saved = await prisma.$transaction(async (transaction) => {
    await transaction.appCompanyRecord.upsert({
      where: { id: company.id },
      create: company,
      update: company,
    })
    await syncCompanyLinkedCompanyIds(transaction, company.id, company.linkedCompanyIds)
    return transaction.appCompanyRecord.findUnique({ where: { id: company.id } })
  })
  response.json({ company: saved })
})

app.put('/api/companies/:id', async (request, response) => {
  const companyId = parseIntegerParam(request.params.id)
  const company = normalizeCompanyPayload({ ...request.body, id: companyId })
  if (companyId === null || !company) {
    response.status(400).json({ error: 'Payload de empresa invalido.' })
    return
  }

  const saved = await prisma.$transaction(async (transaction) => {
    await transaction.appCompanyRecord.upsert({
      where: { id: companyId },
      create: company,
      update: company,
    })
    await syncCompanyLinkedCompanyIds(transaction, companyId, company.linkedCompanyIds)
    return transaction.appCompanyRecord.findUnique({ where: { id: companyId } })
  })
  response.json({ company: saved })
})

app.delete('/api/companies/:id', async (request, response) => {
  const companyId = parseIntegerParam(request.params.id)
  if (companyId === null) {
    response.status(400).json({ error: 'Empresa invalida.' })
    return
  }

  const linkedUsers = await prisma.appUserRecord.findMany({
    where: {
      OR: [{ companyId }, { companyIds: { has: companyId } }],
    },
  })

  await prisma.$transaction(async (transaction) => {
    const linkedCompanies = await transaction.appCompanyRecord.findMany({
      where: { linkedCompanyIds: { has: companyId } },
    })
    const sharedTechnicalSheets = await transaction.appTechnicalSheetRecord.findMany({
      where: { sharedCompanyIds: { has: companyId } },
      select: { id: true, sharedCompanyIds: true },
    })

    for (const user of linkedUsers) {
      const nextCompanyIds = user.companyIds.filter((id) => id !== companyId)
      const nextCompanyId = user.companyId === companyId ? nextCompanyIds[0] ?? null : user.companyId

      if (nextCompanyIds.length === 0 && nextCompanyId === null) {
        await transaction.appUserRecord.delete({ where: { id: user.id } })
        continue
      }

      await transaction.appUserRecord.update({
        where: { id: user.id },
        data: {
          companyIds: nextCompanyIds,
          companyId: nextCompanyId,
        },
      })
    }

    await Promise.all(
      linkedCompanies.map((company) =>
        transaction.appCompanyRecord.update({
          where: { id: company.id },
          data: {
            linkedCompanyIds: company.linkedCompanyIds.filter((linkedCompanyId) => linkedCompanyId !== companyId),
          },
        }),
      ),
    )

    await Promise.all(
      sharedTechnicalSheets.map((sheet) =>
        transaction.appTechnicalSheetRecord.update({
          where: { id: sheet.id },
          data: {
            sharedCompanyIds: sheet.sharedCompanyIds.filter((linkedCompanyId) => linkedCompanyId !== companyId),
          },
        }),
      ),
    )

    await transaction.appAccessProfileRecord.deleteMany({ where: { companyId } })
    await transaction.appStockModuleSettingsRecord.deleteMany({ where: { companyId } })
    await transaction.appStockCenterRecord.deleteMany({ where: { companyId } })
    await transaction.appSalesImportTemplateRecord.deleteMany({ where: { companyId } })
    await transaction.appSalesImportBatchRecord.deleteMany({ where: { companyId } })
    await transaction.appSalesImportRowRecord.deleteMany({ where: { companyId } })
    await transaction.appSalesConsumptionRecord.deleteMany({ where: { companyId } })
    await transaction.appRequisitionNotificationRecord.deleteMany({ where: { companyId } })
    await transaction.appUserCompanyMembershipRecord.deleteMany({ where: { companyId } })
    await transaction.appRequisitionRecord.deleteMany({ where: { companyId } })
    await transaction.appProductionDraftRecord.deleteMany({ where: { companyId } })
    await transaction.appManualProductionRequestRecord.deleteMany({ where: { companyId } })
    await transaction.appPendingInventoryMovementRecord.deleteMany({ where: { companyId } })
    await transaction.appInventoryActiveSessionLinkRecord.deleteMany({ where: { companyId } })
    await transaction.appInventoryActiveRecordLinkRecord.deleteMany({ where: { companyId } })
    await transaction.appInventoryCountRecord.deleteMany({ where: { companyId } })
    await transaction.appInventoryCountSessionRecord.deleteMany({ where: { companyId } })
    await transaction.appInventoryRecord.deleteMany({ where: { companyId } })
    await transaction.appInventoryStorageLocationRecord.deleteMany({ where: { companyId } })
    await transaction.appProductRecord.deleteMany({ where: { companyId } })
    await transaction.appServiceItemRecord.deleteMany({ where: { companyId } })
    await transaction.appTechnicalSheetRecord.deleteMany({ where: { companyId } })
    await transaction.appCompanyRecord.deleteMany({ where: { id: companyId } })
  })

  response.json({ ok: true })
})

app.get('/api/access-profiles', async (request, response) => {
  await ensureAppAdminRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const accessProfiles = await prisma.appAccessProfileRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  response.json({ accessProfiles })
})

app.post('/api/access-profiles', async (request, response) => {
  const accessProfile = normalizeAccessProfilePayload(request.body)
  if (!accessProfile) {
    response.status(400).json({ error: 'Payload de perfil de acesso invalido.' })
    return
  }

  const saved = await prisma.appAccessProfileRecord.upsert({
    where: { id: accessProfile.id },
    create: accessProfile,
    update: accessProfile,
  })
  response.json({ accessProfile: saved })
})

app.put('/api/access-profiles/:id', async (request, response) => {
  const accessProfileId = parseIntegerParam(request.params.id)
  const accessProfile = normalizeAccessProfilePayload({ ...request.body, id: accessProfileId })
  if (accessProfileId === null || !accessProfile) {
    response.status(400).json({ error: 'Payload de perfil de acesso invalido.' })
    return
  }

  const saved = await prisma.appAccessProfileRecord.upsert({
    where: { id: accessProfileId },
    create: accessProfile,
    update: accessProfile,
  })
  response.json({ accessProfile: saved })
})

app.delete('/api/access-profiles/:id', async (request, response) => {
  const accessProfileId = parseIntegerParam(request.params.id)
  if (accessProfileId === null) {
    response.status(400).json({ error: 'Perfil invalido.' })
    return
  }

  await prisma.$transaction([
    prisma.appUserRecord.updateMany({
      where: { accessProfileId },
      data: { accessProfileId: null },
    }),
    prisma.appUserCompanyMembershipRecord.updateMany({
      where: { accessProfileId },
      data: { accessProfileId: null },
    }),
    prisma.appAccessProfileRecord.deleteMany({ where: { id: accessProfileId } }),
  ])
  await removeProfileIdFromStockModuleSettings(accessProfileId)

  response.json({ ok: true })
})

app.get('/api/users', async (request, response) => {
  await ensureAppAdminRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const users = await prisma.appUserRecord.findMany({
    where:
      companyId === null
        ? undefined
        : {
            OR: [{ companyId }, { companyIds: { has: companyId } }],
          },
    orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    include: { memberships: true },
  })
  response.json({ users })
})

app.post('/api/users', async (request, response) => {
  const user = normalizeUserPayload(request.body)
  if (!user) {
    response.status(400).json({ error: 'Payload de usuario invalido.' })
    return
  }

  const { memberships, ...userRecord } = user
  const saved = await prisma.$transaction(async (transaction) => {
    const savedUser = await transaction.appUserRecord.upsert({
      where: { id: userRecord.id },
      create: userRecord,
      update: userRecord,
    })
    await transaction.appUserCompanyMembershipRecord.deleteMany({ where: { userId: userRecord.id } })
    for (const membership of memberships) {
      await transaction.appUserCompanyMembershipRecord.create({
        data: {
          userId: userRecord.id,
          companyId: membership.companyId,
          role: membership.role,
          sectors: membership.sectors,
          sectionAccess: membership.sectionAccess,
          catalogAccess: membership.catalogAccess,
          accessProfileId: membership.accessProfileId,
          isActive: membership.isActive,
        },
      })
    }
    return transaction.appUserRecord.findUnique({
      where: { id: savedUser.id },
      include: { memberships: true },
    })
  })
  response.json({ user: saved })
})

app.put('/api/users/:id', async (request, response) => {
  const userId = parseIntegerParam(request.params.id)
  const user = normalizeUserPayload({ ...request.body, id: userId })
  if (userId === null || !user) {
    response.status(400).json({ error: 'Payload de usuario invalido.' })
    return
  }

  const { memberships, ...userRecord } = user
  const saved = await prisma.$transaction(async (transaction) => {
    const savedUser = await transaction.appUserRecord.upsert({
      where: { id: userId },
      create: userRecord,
      update: userRecord,
    })
    await transaction.appUserCompanyMembershipRecord.deleteMany({ where: { userId } })
    for (const membership of memberships) {
      await transaction.appUserCompanyMembershipRecord.create({
        data: {
          userId,
          companyId: membership.companyId,
          role: membership.role,
          sectors: membership.sectors,
          sectionAccess: membership.sectionAccess,
          catalogAccess: membership.catalogAccess,
          accessProfileId: membership.accessProfileId,
          isActive: membership.isActive,
        },
      })
    }
    return transaction.appUserRecord.findUnique({
      where: { id: savedUser.id },
      include: { memberships: true },
    })
  })
  response.json({ user: saved })
})

app.delete('/api/users/:id', async (request, response) => {
  const userId = parseIntegerParam(request.params.id)
  if (userId === null) {
    response.status(400).json({ error: 'Usuario invalido.' })
    return
  }

  await prisma.appUserRecord.deleteMany({ where: { id: userId } })
  response.json({ ok: true })
})

app.get('/api/stock-module-settings', async (request, response) => {
  await ensureAppAdminRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const stockModuleSettings = await prisma.appStockModuleSettingsRecord.findMany({
    where: companyId === null ? undefined : { companyId },
  })
  response.json({ stockModuleSettings })
})

app.put('/api/stock-module-settings/:companyId', async (request, response) => {
  const companyId = parseIntegerParam(request.params.companyId)
  const stockModuleSettings = normalizeStockModuleSettingsPayload({ ...request.body, companyId })
  if (companyId === null || !stockModuleSettings) {
    response.status(400).json({ error: 'Payload de configuracoes de estoque invalido.' })
    return
  }

  const saved = await prisma.appStockModuleSettingsRecord.upsert({
    where: { companyId },
    create: stockModuleSettings,
    update: stockModuleSettings,
  })
  response.json({ stockModuleSettings: saved })
})

app.get('/api/stock-centers', async (request, response) => {
  await ensureAppStockCenterRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const stockCenters = await prisma.appStockCenterRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  response.json({ stockCenters })
})

app.get('/api/sales-import-templates', async (request, response) => {
  const companyId = parseIntegerParam(request.query.companyId)
  const templates = await prisma.appSalesImportTemplateRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  response.json({ templates })
})

app.post('/api/sales-import-templates', async (request, response) => {
  const template = normalizeSalesImportTemplatePayload(request.body)
  if (!template) {
    response.status(400).json({ error: 'Payload de template de importacao invalido.' })
    return
  }

  const saved = await prisma.appSalesImportTemplateRecord.upsert({
    where: { id: template.id },
    create: template,
    update: template,
  })
  response.json({ template: saved })
})

app.put('/api/sales-import-templates/:id', async (request, response) => {
  const templateId = parseIntegerParam(request.params.id)
  const template = normalizeSalesImportTemplatePayload({ ...request.body, id: templateId })
  if (templateId === null || !template) {
    response.status(400).json({ error: 'Payload de template de importacao invalido.' })
    return
  }

  const saved = await prisma.appSalesImportTemplateRecord.upsert({
    where: { id: templateId },
    create: template,
    update: template,
  })
  response.json({ template: saved })
})

app.delete('/api/sales-import-templates/:id', async (request, response) => {
  const templateId = parseIntegerParam(request.params.id)
  if (templateId === null) {
    response.status(400).json({ error: 'Template de importacao invalido.' })
    return
  }

  await prisma.appSalesImportTemplateRecord.deleteMany({ where: { id: templateId } })
  response.json({ ok: true })
})

app.get('/api/sales-import-batches', async (request, response) => {
  const companyId = parseIntegerParam(request.query.companyId)
  const batches = await prisma.appSalesImportBatchRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ createdAtRecord: 'desc' }, { id: 'desc' }],
  })
  response.json({ batches })
})

app.post('/api/sales-import-batches', async (request, response) => {
  const batch = normalizeSalesImportBatchPayload(request.body)
  if (!batch) {
    response.status(400).json({ error: 'Payload de lote de importacao invalido.' })
    return
  }

  const saved = await prisma.appSalesImportBatchRecord.upsert({
    where: { id: batch.id },
    create: batch,
    update: batch,
  })
  response.json({ batch: saved })
})

app.put('/api/sales-import-batches/:id', async (request, response) => {
  const batchId = parseIntegerParam(request.params.id)
  const batch = normalizeSalesImportBatchPayload({ ...request.body, id: batchId })
  if (batchId === null || !batch) {
    response.status(400).json({ error: 'Payload de lote de importacao invalido.' })
    return
  }

  const saved = await prisma.appSalesImportBatchRecord.upsert({
    where: { id: batchId },
    create: batch,
    update: batch,
  })
  response.json({ batch: saved })
})

app.get('/api/sales-import-rows', async (request, response) => {
  const batchId = parseIntegerParam(request.query.batchId)
  const rows = await prisma.appSalesImportRowRecord.findMany({
    where: batchId === null ? undefined : { batchId },
    orderBy: [{ id: 'asc' }],
  })
  response.json({ rows })
})

app.post('/api/sales-import-rows', async (request, response) => {
  const row = normalizeSalesImportRowPayload(request.body)
  if (!row) {
    response.status(400).json({ error: 'Payload de linha de importacao invalido.' })
    return
  }

  const saved = await prisma.appSalesImportRowRecord.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  })
  response.json({ row: saved })
})

app.put('/api/sales-import-rows/:id', async (request, response) => {
  const rowId = parseIntegerParam(request.params.id)
  const row = normalizeSalesImportRowPayload({ ...request.body, id: rowId })
  if (rowId === null || !row) {
    response.status(400).json({ error: 'Payload de linha de importacao invalido.' })
    return
  }

  const saved = await prisma.appSalesImportRowRecord.upsert({
    where: { id: rowId },
    create: row,
    update: row,
  })
  response.json({ row: saved })
})

app.get('/api/sales-consumptions', async (request, response) => {
  const companyId = parseIntegerParam(request.query.companyId)
  const consumptions = await prisma.appSalesConsumptionRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ consumedAt: 'desc' }, { id: 'desc' }],
  })
  response.json({ consumptions })
})

app.post('/api/sales-consumptions', async (request, response) => {
  const consumption = normalizeSalesConsumptionPayload(request.body)
  if (!consumption) {
    response.status(400).json({ error: 'Payload de consumo importado invalido.' })
    return
  }

  const saved = await prisma.appSalesConsumptionRecord.upsert({
    where: { id: consumption.id },
    create: consumption,
    update: consumption,
  })
  response.json({ consumption: saved })
})

app.put('/api/sales-consumptions/:id', async (request, response) => {
  const consumptionId = parseIntegerParam(request.params.id)
  const consumption = normalizeSalesConsumptionPayload({ ...request.body, id: consumptionId })
  if (consumptionId === null || !consumption) {
    response.status(400).json({ error: 'Payload de consumo importado invalido.' })
    return
  }

  const saved = await prisma.appSalesConsumptionRecord.upsert({
    where: { id: consumptionId },
    create: consumption,
    update: consumption,
  })
  response.json({ consumption: saved })
})

app.post('/api/stock-centers', async (request, response) => {
  const stockCenter = normalizeStockCenterPayload(request.body)
  if (!stockCenter) {
    response.status(400).json({ error: 'Payload de centro de estoque invalido.' })
    return
  }

  const saved = await prisma.appStockCenterRecord.upsert({
    where: { id: stockCenter.id },
    create: stockCenter,
    update: stockCenter,
  })
  response.json({ stockCenter: saved })
})

app.put('/api/stock-centers/:id', async (request, response) => {
  const stockCenterId = parseIntegerParam(request.params.id)
  const stockCenter = normalizeStockCenterPayload({ ...request.body, id: stockCenterId })
  if (stockCenterId === null || !stockCenter) {
    response.status(400).json({ error: 'Payload de centro de estoque invalido.' })
    return
  }

  const saved = await prisma.appStockCenterRecord.upsert({
    where: { id: stockCenterId },
    create: stockCenter,
    update: stockCenter,
  })
  response.json({ stockCenter: saved })
})

app.delete('/api/stock-centers/:id', async (request, response) => {
  const stockCenterId = parseIntegerParam(request.params.id)
  if (stockCenterId === null) {
    response.status(400).json({ error: 'Centro de estoque invalido.' })
    return
  }

  await prisma.appStockCenterRecord.deleteMany({ where: { id: stockCenterId } })
  response.json({ ok: true })
})

app.get('/api/requisitions', async (request, response) => {
  await ensureAppRequisitionRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const requisitions = await prisma.appRequisitionRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ createdAtRecord: 'desc' }, { id: 'desc' }],
  })
  response.json({ requisitions })
})

app.post('/api/requisitions', async (request, response) => {
  const requisition = normalizeRequisitionPayload(request.body)
  if (!requisition) {
    response.status(400).json({ error: 'Payload de requisicao invalido.' })
    return
  }

  const saved = await prisma.appRequisitionRecord.upsert({
    where: { id: requisition.id },
    create: requisition,
    update: requisition,
  })
  response.json({ requisition: saved })
})

app.put('/api/requisitions/:id', async (request, response) => {
  const requisitionId = parseIntegerParam(request.params.id)
  const requisition = normalizeRequisitionPayload({ ...request.body, id: requisitionId })
  if (requisitionId === null || !requisition) {
    response.status(400).json({ error: 'Payload de requisicao invalido.' })
    return
  }

  const saved = await prisma.appRequisitionRecord.upsert({
    where: { id: requisitionId },
    create: requisition,
    update: requisition,
  })
  response.json({ requisition: saved })
})

app.delete('/api/requisitions/:id', async (request, response) => {
  const requisitionId = parseIntegerParam(request.params.id)
  if (requisitionId === null) {
    response.status(400).json({ error: 'Requisicao invalida.' })
    return
  }

  await prisma.$transaction([
    prisma.appRequisitionNotificationRecord.deleteMany({ where: { requisitionId } }),
    prisma.appRequisitionRecord.deleteMany({ where: { id: requisitionId } }),
  ])
  response.json({ ok: true })
})

app.get('/api/requisition-notifications', async (request, response) => {
  await ensureAppRequisitionRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const notifications = await prisma.appRequisitionNotificationRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ createdAtRecord: 'desc' }, { id: 'desc' }],
  })
  response.json({ notifications })
})

app.post('/api/requisition-notifications', async (request, response) => {
  const notification = normalizeRequisitionNotificationPayload(request.body)
  if (!notification) {
    response.status(400).json({ error: 'Payload de notificacao invalido.' })
    return
  }

  const saved = await prisma.appRequisitionNotificationRecord.upsert({
    where: { id: notification.id },
    create: notification,
    update: notification,
  })
  response.json({ notification: saved })
})

app.put('/api/requisition-notifications/:id', async (request, response) => {
  const notificationId = parseIntegerParam(request.params.id)
  const notification = normalizeRequisitionNotificationPayload({ ...request.body, id: notificationId })
  if (notificationId === null || !notification) {
    response.status(400).json({ error: 'Payload de notificacao invalido.' })
    return
  }

  const saved = await prisma.appRequisitionNotificationRecord.upsert({
    where: { id: notificationId },
    create: notification,
    update: notification,
  })
  response.json({ notification: saved })
})

app.delete('/api/requisition-notifications/:id', async (request, response) => {
  const notificationId = parseIntegerParam(request.params.id)
  if (notificationId === null) {
    response.status(400).json({ error: 'Notificacao invalida.' })
    return
  }

  await prisma.appRequisitionNotificationRecord.deleteMany({ where: { id: notificationId } })
  response.json({ ok: true })
})

app.get('/api/manual-production-requests', async (request, response) => {
  await ensureAppProductionRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const requests = await prisma.appManualProductionRequestRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ createdAtRecord: 'desc' }, { id: 'desc' }],
  })
  response.json({ manualProductionRequests: requests })
})

app.post('/api/manual-production-requests', async (request, response) => {
  const productionRequest = normalizeManualProductionRequestPayload(request.body)
  if (!productionRequest) {
    response.status(400).json({ error: 'Payload de solicitacao de producao invalido.' })
    return
  }

  const saved = await prisma.appManualProductionRequestRecord.upsert({
    where: { id: productionRequest.id },
    create: productionRequest,
    update: productionRequest,
  })
  response.json({ manualProductionRequest: saved })
})

app.put('/api/manual-production-requests/:id', async (request, response) => {
  const requestId = parseIntegerParam(request.params.id)
  const productionRequest = normalizeManualProductionRequestPayload({ ...request.body, id: requestId })
  if (requestId === null || !productionRequest) {
    response.status(400).json({ error: 'Payload de solicitacao de producao invalido.' })
    return
  }

  const saved = await prisma.appManualProductionRequestRecord.upsert({
    where: { id: requestId },
    create: productionRequest,
    update: productionRequest,
  })
  response.json({ manualProductionRequest: saved })
})

app.delete('/api/manual-production-requests/:id', async (request, response) => {
  const requestId = parseIntegerParam(request.params.id)
  if (requestId === null) {
    response.status(400).json({ error: 'Solicitacao de producao invalida.' })
    return
  }

  await prisma.appManualProductionRequestRecord.deleteMany({ where: { id: requestId } })
  response.json({ ok: true })
})

app.get('/api/production-drafts', async (request, response) => {
  await ensureAppProductionRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const drafts = await prisma.appProductionDraftRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  })
  response.json({ productionDrafts: drafts })
})

app.post('/api/production-drafts', async (request, response) => {
  const draft = normalizeProductionDraftPayload(request.body)
  if (!draft) {
    response.status(400).json({ error: 'Payload de rascunho de producao invalido.' })
    return
  }

  const saved = await prisma.appProductionDraftRecord.upsert({
    where: { draftId: draft.draftId },
    create: draft,
    update: draft,
  })
  response.json({ productionDraft: saved })
})

app.put('/api/production-drafts/:draftId', async (request, response) => {
  const draftId = parseIntegerParam(request.params.draftId)
  const draft = normalizeProductionDraftPayload({ ...request.body, draftId })
  if (draftId === null || !draft) {
    response.status(400).json({ error: 'Payload de rascunho de producao invalido.' })
    return
  }

  const saved = await prisma.appProductionDraftRecord.upsert({
    where: { draftId },
    create: draft,
    update: draft,
  })
  response.json({ productionDraft: saved })
})

app.delete('/api/production-drafts/:draftId', async (request, response) => {
  const draftId = parseIntegerParam(request.params.draftId)
  if (draftId === null) {
    response.status(400).json({ error: 'Rascunho de producao invalido.' })
    return
  }

  await prisma.appProductionDraftRecord.deleteMany({ where: { draftId } })
  response.json({ ok: true })
})

app.get('/api/inventory-storage-locations', async (request, response) => {
  await ensureAppInventoryRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const locations = await prisma.appInventoryStorageLocationRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ name: 'asc' }],
  })
  response.json({ inventoryStorageLocations: locations })
})

app.post('/api/inventory-storage-locations', async (request, response) => {
  const location = normalizeInventoryStorageLocationPayload(request.body)
  if (!location) {
    response.status(400).json({ error: 'Payload de local de armazenamento invalido.' })
    return
  }

  const saved = await prisma.appInventoryStorageLocationRecord.upsert({
    where: { companyId_name: { companyId: location.companyId, name: location.name } },
    create: location,
    update: location,
  })
  response.json({ inventoryStorageLocation: saved })
})

app.put('/api/inventory-storage-locations/:companyId/:name', async (request, response) => {
  const companyId = parseIntegerParam(request.params.companyId)
  const previousName = normalizeRegistrationText(String(request.params.name ?? ''))
  const location = normalizeInventoryStorageLocationPayload({ ...request.body, companyId })
  if (companyId === null || !previousName || !location) {
    response.status(400).json({ error: 'Payload de local de armazenamento invalido.' })
    return
  }

  if (previousName === location.name) {
    const saved = await prisma.appInventoryStorageLocationRecord.upsert({
      where: { companyId_name: { companyId, name: location.name } },
      create: location,
      update: location,
    })
    response.json({ inventoryStorageLocation: saved })
    return
  }

  await prisma.$transaction([
    prisma.appInventoryStorageLocationRecord.deleteMany({ where: { companyId, name: previousName } }),
    prisma.appInventoryStorageLocationRecord.upsert({
      where: { companyId_name: { companyId, name: location.name } },
      create: location,
      update: location,
    }),
  ])
  response.json({ inventoryStorageLocation: location })
})

app.delete('/api/inventory-storage-locations/:companyId/:name', async (request, response) => {
  const companyId = parseIntegerParam(request.params.companyId)
  const name = normalizeRegistrationText(String(request.params.name ?? ''))
  if (companyId === null || !name) {
    response.status(400).json({ error: 'Local de armazenamento invalido.' })
    return
  }

  await prisma.appInventoryStorageLocationRecord.deleteMany({ where: { companyId, name } })
  response.json({ ok: true })
})

app.get('/api/inventories', async (request, response) => {
  await ensureAppInventoryRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const inventories = await prisma.appInventoryRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
  })
  response.json({ inventoryRecords: inventories })
})

app.get('/api/inventory-active-record-links', async (request, response) => {
  await ensureAppInventoryRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const links = await prisma.appInventoryActiveRecordLinkRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ companyId: 'asc' }, { userKey: 'asc' }],
  })
  response.json({ inventoryActiveRecordLinks: links })
})

app.put('/api/inventory-active-record-links/:companyId/:userKey', async (request, response) => {
  const companyId = parseIntegerParam(request.params.companyId)
  const userKey = String(request.params.userKey ?? '')
  const link = normalizeInventoryActiveRecordLinkPayload({ ...request.body, companyId, userKey })
  if (companyId === null || !userKey || !link) {
    response.status(400).json({ error: 'Payload de vinculo ativo de inventario invalido.' })
    return
  }

  const saved = await prisma.appInventoryActiveRecordLinkRecord.upsert({
    where: { companyId_userKey: { companyId, userKey } },
    create: link,
    update: link,
  })
  response.json({ inventoryActiveRecordLink: saved })
})

app.delete('/api/inventory-active-record-links/:companyId/:userKey', async (request, response) => {
  const companyId = parseIntegerParam(request.params.companyId)
  const userKey = String(request.params.userKey ?? '')
  if (companyId === null || !userKey) {
    response.status(400).json({ error: 'Vinculo ativo de inventario invalido.' })
    return
  }

  await prisma.appInventoryActiveRecordLinkRecord.deleteMany({ where: { companyId, userKey } })
  response.json({ ok: true })
})

app.put('/api/inventories/:id', async (request, response) => {
  const inventoryId = parseIntegerParam(request.params.id)
  const inventory = normalizeInventoryPayload({ ...request.body, id: inventoryId })
  if (inventoryId === null || !inventory) {
    response.status(400).json({ error: 'Payload de inventario invalido.' })
    return
  }

  const saved = await prisma.appInventoryRecord.upsert({
    where: { id: inventoryId },
    create: inventory,
    update: inventory,
  })
  response.json({ inventoryRecord: saved })
})

app.delete('/api/inventories/:id', async (request, response) => {
  const inventoryId = parseIntegerParam(request.params.id)
  if (inventoryId === null) {
    response.status(400).json({ error: 'Inventario invalido.' })
    return
  }

  await prisma.appInventoryRecord.deleteMany({ where: { id: inventoryId } })
  response.json({ ok: true })
})

app.get('/api/inventory-count-sessions', async (request, response) => {
  await ensureAppInventoryRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const sessions = await prisma.appInventoryCountSessionRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
  })
  response.json({ inventoryCountSessions: sessions })
})

app.get('/api/inventory-active-session-links', async (request, response) => {
  await ensureAppInventoryRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const links = await prisma.appInventoryActiveSessionLinkRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ companyId: 'asc' }, { userKey: 'asc' }],
  })
  response.json({ inventoryActiveSessionLinks: links })
})

app.put('/api/inventory-active-session-links/:companyId/:userKey', async (request, response) => {
  const companyId = parseIntegerParam(request.params.companyId)
  const userKey = String(request.params.userKey ?? '')
  const link = normalizeInventoryActiveSessionLinkPayload({ ...request.body, companyId, userKey })
  if (companyId === null || !userKey || !link) {
    response.status(400).json({ error: 'Payload de vinculo ativo de sessao invalido.' })
    return
  }

  const saved = await prisma.appInventoryActiveSessionLinkRecord.upsert({
    where: { companyId_userKey: { companyId, userKey } },
    create: link,
    update: link,
  })
  response.json({ inventoryActiveSessionLink: saved })
})

app.delete('/api/inventory-active-session-links/:companyId/:userKey', async (request, response) => {
  const companyId = parseIntegerParam(request.params.companyId)
  const userKey = String(request.params.userKey ?? '')
  if (companyId === null || !userKey) {
    response.status(400).json({ error: 'Vinculo ativo de sessao invalido.' })
    return
  }

  await prisma.appInventoryActiveSessionLinkRecord.deleteMany({ where: { companyId, userKey } })
  response.json({ ok: true })
})

app.put('/api/inventory-count-sessions/:id', async (request, response) => {
  const sessionId = parseIntegerParam(request.params.id)
  const session = normalizeInventoryCountSessionPayload({ ...request.body, id: sessionId })
  if (sessionId === null || !session) {
    response.status(400).json({ error: 'Payload de sessao de contagem invalido.' })
    return
  }

  const saved = await prisma.appInventoryCountSessionRecord.upsert({
    where: { id: sessionId },
    create: session,
    update: session,
  })
  response.json({ inventoryCountSession: saved })
})

app.delete('/api/inventory-count-sessions/:id', async (request, response) => {
  const sessionId = parseIntegerParam(request.params.id)
  if (sessionId === null) {
    response.status(400).json({ error: 'Sessao de contagem invalida.' })
    return
  }

  await prisma.appInventoryCountSessionRecord.deleteMany({ where: { id: sessionId } })
  response.json({ ok: true })
})

app.get('/api/inventory-counts', async (request, response) => {
  await ensureAppInventoryRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const counts = await prisma.appInventoryCountRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ countedAt: 'desc' }, { id: 'desc' }],
  })
  response.json({ inventoryCounts: counts })
})

app.put('/api/inventory-counts/:id', async (request, response) => {
  const countId = parseIntegerParam(request.params.id)
  const count = normalizeInventoryCountPayload({ ...request.body, id: countId })
  if (countId === null || !count) {
    response.status(400).json({ error: 'Payload de contagem invalido.' })
    return
  }

  const saved = await prisma.appInventoryCountRecord.upsert({
    where: { id: countId },
    create: count,
    update: count,
  })
  response.json({ inventoryCount: saved })
})

app.delete('/api/inventory-counts/:id', async (request, response) => {
  const countId = parseIntegerParam(request.params.id)
  if (countId === null) {
    response.status(400).json({ error: 'Contagem invalida.' })
    return
  }

  await prisma.appInventoryCountRecord.deleteMany({ where: { id: countId } })
  response.json({ ok: true })
})

app.get('/api/pending-inventory-movements', async (request, response) => {
  await ensureAppInventoryRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const pendingMovements = await prisma.appPendingInventoryMovementRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ createdAtRecord: 'desc' }, { id: 'desc' }],
  })
  response.json({ pendingInventoryMovements: pendingMovements })
})

app.put('/api/pending-inventory-movements/:id', async (request, response) => {
  const movementId = parseIntegerParam(request.params.id)
  const movement = normalizePendingInventoryMovementPayload({ ...request.body, id: movementId })
  if (movementId === null || !movement) {
    response.status(400).json({ error: 'Payload de movimentacao pendente invalido.' })
    return
  }

  const saved = await prisma.appPendingInventoryMovementRecord.upsert({
    where: { id: movementId },
    create: movement,
    update: movement,
  })
  response.json({ pendingInventoryMovement: saved })
})

app.delete('/api/pending-inventory-movements/:id', async (request, response) => {
  const movementId = parseIntegerParam(request.params.id)
  if (movementId === null) {
    response.status(400).json({ error: 'Movimentacao pendente invalida.' })
    return
  }

  await prisma.appPendingInventoryMovementRecord.deleteMany({ where: { id: movementId } })
  response.json({ ok: true })
})

app.get('/api/products', async (request, response) => {
  await ensureAppCatalogRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const products = await prisma.appProductRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  response.json({ products })
})

app.post('/api/products', async (request, response) => {
  const product = normalizeProductPayload(request.body)
  if (!product) {
    response.status(400).json({ error: 'Payload de produto invalido.' })
    return
  }

  try {
    await ensureUniqueProductName(product)
    const saved = await prisma.appProductRecord.upsert({
      where: { id: product.id },
      create: product,
      update: product,
    })
    response.json({ product: saved })
  } catch (error) {
    response.status(error.statusCode ?? 500).json({ error: error.message ?? 'Erro ao salvar produto.' })
  }
})

app.put('/api/products/:id', async (request, response) => {
  const productId = String(request.params.id ?? '').trim()
  const product = normalizeProductPayload({ ...request.body, id: productId })
  if (!productId || !product) {
    response.status(400).json({ error: 'Payload de produto invalido.' })
    return
  }

  try {
    await ensureUniqueProductName(product)
    const saved = await prisma.appProductRecord.upsert({
      where: { id: productId },
      create: product,
      update: product,
    })
    response.json({ product: saved })
  } catch (error) {
    response.status(error.statusCode ?? 500).json({ error: error.message ?? 'Erro ao salvar produto.' })
  }
})

app.delete('/api/products/:id', async (request, response) => {
  const productId = String(request.params.id ?? '').trim()
  if (!productId) {
    response.status(400).json({ error: 'Produto invalido.' })
    return
  }

  await prisma.appProductRecord.deleteMany({ where: { id: productId } })
  response.json({ ok: true })
})

app.get('/api/service-items', async (request, response) => {
  await ensureAppCatalogRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const serviceItems = await prisma.appServiceItemRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  response.json({ serviceItems })
})

app.post('/api/service-items', async (request, response) => {
  const serviceItem = normalizeServiceItemPayload(request.body)
  if (!serviceItem) {
    response.status(400).json({ error: 'Payload de item invalido.' })
    return
  }

  try {
    await ensureUniqueServiceItemName(serviceItem)
    const saved = await prisma.appServiceItemRecord.upsert({
      where: { id: serviceItem.id },
      create: serviceItem,
      update: serviceItem,
    })
    response.json({ serviceItem: saved })
  } catch (error) {
    response.status(error.statusCode ?? 500).json({ error: error.message ?? 'Erro ao salvar item.' })
  }
})

app.put('/api/service-items/:id', async (request, response) => {
  const serviceItemId = String(request.params.id ?? '').trim()
  const serviceItem = normalizeServiceItemPayload({ ...request.body, id: serviceItemId })
  if (!serviceItemId || !serviceItem) {
    response.status(400).json({ error: 'Payload de item invalido.' })
    return
  }

  try {
    await ensureUniqueServiceItemName(serviceItem)
    const saved = await prisma.appServiceItemRecord.upsert({
      where: { id: serviceItemId },
      create: serviceItem,
      update: serviceItem,
    })
    response.json({ serviceItem: saved })
  } catch (error) {
    response.status(error.statusCode ?? 500).json({ error: error.message ?? 'Erro ao salvar item.' })
  }
})

app.delete('/api/service-items/:id', async (request, response) => {
  const serviceItemId = String(request.params.id ?? '').trim()
  if (!serviceItemId) {
    response.status(400).json({ error: 'Item invalido.' })
    return
  }

  await prisma.appServiceItemRecord.deleteMany({ where: { id: serviceItemId } })
  response.json({ ok: true })
})

app.get('/api/technical-sheets', async (request, response) => {
  await ensureAppCatalogRecordsSeeded()
  const companyId = parseIntegerParam(request.query.companyId)
  const technicalSheets = await prisma.appTechnicalSheetRecord.findMany({
    where: companyId === null ? undefined : { companyId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
  response.json({
    technicalSheets: technicalSheets.map((sheet) => ({
      ...sheet,
      imageDataUrl: '',
    })),
  })
})

app.get('/api/technical-sheets/:id', async (request, response) => {
  await ensureAppCatalogRecordsSeeded()
  const technicalSheetId = parseIntegerParam(request.params.id)
  if (technicalSheetId === null) {
    response.status(400).json({ error: 'Ficha tecnica invalida.' })
    return
  }

  const technicalSheet = await prisma.appTechnicalSheetRecord.findUnique({
    where: { id: technicalSheetId },
  })
  if (!technicalSheet) {
    response.status(404).json({ error: 'Ficha tecnica nao encontrada.' })
    return
  }

  response.json({ technicalSheet })
})

app.post('/api/technical-sheets', async (request, response) => {
  const technicalSheet = normalizeTechnicalSheetPayload(request.body)
  if (!technicalSheet) {
    response.status(400).json({ error: 'Payload de ficha tecnica invalido.' })
    return
  }

  try {
    await ensureUniqueTechnicalSheetName(technicalSheet)
    const saved = await prisma.appTechnicalSheetRecord.upsert({
      where: { id: technicalSheet.id },
      create: technicalSheet,
      update: technicalSheet,
    })
    response.json({ technicalSheet: saved })
  } catch (error) {
    response.status(error.statusCode ?? 500).json({ error: error.message ?? 'Erro ao salvar ficha tecnica.' })
  }
})

app.put('/api/technical-sheets/:id', async (request, response) => {
  const technicalSheetId = parseIntegerParam(request.params.id)
  const technicalSheet = normalizeTechnicalSheetPayload({ ...request.body, id: technicalSheetId })
  if (technicalSheetId === null || !technicalSheet) {
    response.status(400).json({ error: 'Payload de ficha tecnica invalido.' })
    return
  }

  try {
    await ensureUniqueTechnicalSheetName(technicalSheet)
    const saved = await prisma.appTechnicalSheetRecord.upsert({
      where: { id: technicalSheetId },
      create: technicalSheet,
      update: technicalSheet,
    })
    response.json({ technicalSheet: saved })
  } catch (error) {
    response.status(error.statusCode ?? 500).json({ error: error.message ?? 'Erro ao salvar ficha tecnica.' })
  }
})

app.delete('/api/technical-sheets/:id', async (request, response) => {
  const technicalSheetId = parseIntegerParam(request.params.id)
  if (technicalSheetId === null) {
    response.status(400).json({ error: 'Ficha tecnica invalida.' })
    return
  }

  await prisma.appTechnicalSheetRecord.deleteMany({ where: { id: technicalSheetId } })
  response.json({ ok: true })
})

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))

  app.get(/^(?!\/api\/).*/, (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next()
      return
    }

    response.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Erro interno do servidor.' })
})

app.listen(port, () => {
  console.log(`Gestor de Estoque API em http://localhost:${port}`)
})

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const fileContents = fs.readFileSync(filePath, 'utf8')
  fileContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) {
        return
      }

      const key = line.slice(0, separatorIndex).trim()
      const rawValue = line.slice(separatorIndex + 1).trim()
      const normalizedValue = rawValue.replace(/^"(.*)"$/, '$1')

      if (!process.env[key]) {
        process.env[key] = normalizedValue
      }
    })
}

function parseIntegerParam(value) {
  const resolved = Array.isArray(value) ? value[0] : value
  const parsed = Number.parseInt(String(resolved ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function isSafeInt32Id(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= maxInt32Id
}

function parseSnapshotArrayEntry(entries, key) {
  const raw = entries?.[key]
  if (typeof raw !== 'string') {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (_error) {
    return []
  }
}

function buildSafeInt32IdMap(values) {
  const usedIds = new Set(values.filter(isSafeInt32Id))
  let nextId = usedIds.size > 0 ? Math.max(...usedIds) + 1 : 1
  const idMap = new Map()

  for (const value of values) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || isSafeInt32Id(value) || idMap.has(value)) {
      continue
    }

    while (usedIds.has(nextId) && nextId <= maxInt32Id) {
      nextId += 1
    }

    if (nextId > maxInt32Id) {
      break
    }

    idMap.set(value, nextId)
    usedIds.add(nextId)
    nextId += 1
  }

  return idMap
}

function remapSafeInt32Id(value, idMap) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return value
  }
  return idMap.get(value) ?? value
}

function remapStockCenterMinimumEntry(entry, stockCenterIdMap) {
  if (!entry || typeof entry !== 'object') {
    return entry
  }

  return {
    ...entry,
    destinationCenterId:
      entry.destinationCenterId === null ? null : remapSafeInt32Id(entry.destinationCenterId, stockCenterIdMap),
  }
}

function remapInventorySessionLikeRecord(record, inventoryIdMap, stockCenterIdMap, sessionIdMap) {
  if (!record || typeof record !== 'object') {
    return record
  }

  return {
    ...record,
    id: remapSafeInt32Id(record.id, sessionIdMap),
    inventoryId: record.inventoryId === null ? null : remapSafeInt32Id(record.inventoryId, inventoryIdMap),
    stockCenterId: remapSafeInt32Id(record.stockCenterId, stockCenterIdMap),
  }
}

function remapInventoryCountLikeRecord(record, inventoryIdMap, stockCenterIdMap, sessionIdMap, countIdMap) {
  if (!record || typeof record !== 'object') {
    return record
  }

  return {
    ...record,
    id: remapSafeInt32Id(record.id, countIdMap),
    inventoryId: record.inventoryId === null ? null : remapSafeInt32Id(record.inventoryId, inventoryIdMap),
    sessionId: remapSafeInt32Id(record.sessionId, sessionIdMap),
    stockCenterId: remapSafeInt32Id(record.stockCenterId, stockCenterIdMap),
  }
}

async function sanitizeLegacyEntitySnapshotIds() {
  if (hasSanitizedLegacyEntitySnapshotIds) {
    return
  }

  const snapshot = await prisma.appStateSnapshot.findUnique({
    where: { key: appStateSnapshotKey },
  })
  const payload = snapshot?.payload
  const entries = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.entries : null
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    hasSanitizedLegacyEntitySnapshotIds = true
    return
  }

  const stockCenters = parseSnapshotArrayEntry(entries, stockCentersStorageKey)
  const technicalSheets = parseSnapshotArrayEntry(entries, technicalSheetsStorageKey)
  const requisitions = parseSnapshotArrayEntry(entries, requisitionsStorageKey)
  const requisitionNotifications = parseSnapshotArrayEntry(entries, requisitionNotificationsStorageKey)
  const manualProductionRequests = parseSnapshotArrayEntry(entries, manualProductionRequestsStorageKey)
  const productionDrafts = parseSnapshotArrayEntry(entries, productionInProgressDraftsStorageKey)
  const inventoryRecords = parseSnapshotArrayEntry(entries, inventoryRecordsStorageKey)
  const inventoryActiveRecordLinks = parseSnapshotArrayEntry(entries, inventoryActiveRecordsStorageKey)
  const inventoryCountSessions = parseSnapshotArrayEntry(entries, inventoryCountSessionsStorageKey)
  const inventoryActiveSessionLinks = parseSnapshotArrayEntry(entries, inventoryActiveSessionsStorageKey)
  const inventoryCounts = parseSnapshotArrayEntry(entries, inventoryCountsStorageKey)
  const pendingInventoryMovements = parseSnapshotArrayEntry(entries, pendingInventoryMovementsStorageKey)

  const stockCenterIdMap = buildSafeInt32IdMap(stockCenters.map((record) => record?.id))
  const requisitionIdMap = buildSafeInt32IdMap(requisitions.map((record) => record?.id))
  const requisitionGroupIdMap = buildSafeInt32IdMap(
    requisitions.map((record) => record?.requisitionGroupId).filter((value) => value !== null && value !== undefined),
  )
  const requisitionNotificationIdMap = buildSafeInt32IdMap(requisitionNotifications.map((record) => record?.id))
  const manualProductionRequestIdMap = buildSafeInt32IdMap(
    manualProductionRequests.flatMap((record) => [record?.id, record?.rootRequestId, record?.parentRequestId]),
  )
  const productionDraftIdMap = buildSafeInt32IdMap(productionDrafts.map((record) => record?.draftId))
  const inventoryIdMap = buildSafeInt32IdMap(inventoryRecords.map((record) => record?.id))
  const inventorySessionIdMap = buildSafeInt32IdMap(
    inventoryCountSessions
      .flatMap((record) => [record?.id])
      .concat(
        pendingInventoryMovements.flatMap((record) => [
          record?.session?.id,
          ...(Array.isArray(record?.records) ? record.records.map((item) => item?.sessionId) : []),
        ]),
      ),
  )
  const inventoryCountIdMap = buildSafeInt32IdMap(
    inventoryCounts
      .map((record) => record?.id)
      .concat(
        pendingInventoryMovements.flatMap((record) =>
          Array.isArray(record?.records) ? record.records.map((item) => item?.id) : [],
        ),
      ),
  )
  const pendingInventoryMovementIdMap = buildSafeInt32IdMap(pendingInventoryMovements.map((record) => record?.id))

  const shouldSanitize =
    stockCenterIdMap.size > 0 ||
    requisitionIdMap.size > 0 ||
    requisitionGroupIdMap.size > 0 ||
    requisitionNotificationIdMap.size > 0 ||
    manualProductionRequestIdMap.size > 0 ||
    productionDraftIdMap.size > 0 ||
    inventoryIdMap.size > 0 ||
    inventorySessionIdMap.size > 0 ||
    inventoryCountIdMap.size > 0 ||
    pendingInventoryMovementIdMap.size > 0

  if (!shouldSanitize) {
    hasSanitizedLegacyEntitySnapshotIds = true
    return
  }

  const nextEntries = {
    ...entries,
    [stockCentersStorageKey]: JSON.stringify(
      stockCenters.map((record) => ({
        ...record,
        id: remapSafeInt32Id(record?.id, stockCenterIdMap),
      })),
    ),
    [technicalSheetsStorageKey]: JSON.stringify(
      technicalSheets.map((record) => ({
        ...record,
        productionCenters: Array.isArray(record?.productionCenters)
          ? record.productionCenters.map((assignment) => ({
              ...assignment,
              stockCenterId: remapSafeInt32Id(assignment?.stockCenterId, stockCenterIdMap),
            }))
          : [],
      })),
    ),
    [requisitionsStorageKey]: JSON.stringify(
      requisitions.map((record) => ({
        ...record,
        id: remapSafeInt32Id(record?.id, requisitionIdMap),
        requisitionGroupId: remapSafeInt32Id(record?.requisitionGroupId, requisitionGroupIdMap),
        stockCenterId: remapSafeInt32Id(record?.stockCenterId, stockCenterIdMap),
        supplyCenterId: record?.supplyCenterId === null ? null : remapSafeInt32Id(record?.supplyCenterId, stockCenterIdMap),
        lines: Array.isArray(record?.lines)
          ? record.lines.map((line) => ({
              ...line,
              destinationCenterId:
                line?.destinationCenterId === null ? null : remapSafeInt32Id(line?.destinationCenterId, stockCenterIdMap),
            }))
          : [],
      })),
    ),
    [requisitionNotificationsStorageKey]: JSON.stringify(
      requisitionNotifications.map((record) => ({
        ...record,
        id: remapSafeInt32Id(record?.id, requisitionNotificationIdMap),
        requisitionId: remapSafeInt32Id(record?.requisitionId, requisitionIdMap),
      })),
    ),
    [manualProductionRequestsStorageKey]: JSON.stringify(
      manualProductionRequests.map((record) => ({
        ...record,
        id: remapSafeInt32Id(record?.id, manualProductionRequestIdMap),
        centerId: remapSafeInt32Id(record?.centerId, stockCenterIdMap),
        rootRequestId: remapSafeInt32Id(record?.rootRequestId, manualProductionRequestIdMap),
        parentRequestId:
          record?.parentRequestId === null ? null : remapSafeInt32Id(record?.parentRequestId, manualProductionRequestIdMap),
      })),
    ),
    [productionInProgressDraftsStorageKey]: JSON.stringify(
      productionDrafts.map((record) => ({
        ...record,
        draftId: remapSafeInt32Id(record?.draftId, productionDraftIdMap),
        centerId: remapSafeInt32Id(record?.centerId, stockCenterIdMap),
        consumptionSessionId:
          record?.consumptionSessionId === null
            ? null
            : remapSafeInt32Id(record?.consumptionSessionId, inventorySessionIdMap),
        manualRequestIds: Array.isArray(record?.manualRequestIds)
          ? record.manualRequestIds.map((value) => remapSafeInt32Id(value, manualProductionRequestIdMap))
          : [],
      })),
    ),
    [inventoryRecordsStorageKey]: JSON.stringify(
      inventoryRecords.map((record) => ({
        ...record,
        id: remapSafeInt32Id(record?.id, inventoryIdMap),
        stockCenterId: remapSafeInt32Id(record?.stockCenterId, stockCenterIdMap),
      })),
    ),
    [inventoryActiveRecordsStorageKey]: JSON.stringify(
      inventoryActiveRecordLinks.map((record) => ({
        ...record,
        inventoryId: record?.inventoryId === null ? null : remapSafeInt32Id(record?.inventoryId, inventoryIdMap),
      })),
    ),
    [inventoryCountSessionsStorageKey]: JSON.stringify(
      inventoryCountSessions.map((record) =>
        remapInventorySessionLikeRecord(record, inventoryIdMap, stockCenterIdMap, inventorySessionIdMap),
      ),
    ),
    [inventoryActiveSessionsStorageKey]: JSON.stringify(
      inventoryActiveSessionLinks.map((record) => ({
        ...record,
        sessionId: record?.sessionId === null ? null : remapSafeInt32Id(record?.sessionId, inventorySessionIdMap),
      })),
    ),
    [inventoryCountsStorageKey]: JSON.stringify(
      inventoryCounts.map((record) =>
        remapInventoryCountLikeRecord(record, inventoryIdMap, stockCenterIdMap, inventorySessionIdMap, inventoryCountIdMap),
      ),
    ),
    [pendingInventoryMovementsStorageKey]: JSON.stringify(
      pendingInventoryMovements.map((record) => ({
        ...record,
        id: remapSafeInt32Id(record?.id, pendingInventoryMovementIdMap),
        stockCenterId: remapSafeInt32Id(record?.stockCenterId, stockCenterIdMap),
        inventoryId: remapSafeInt32Id(record?.inventoryId, inventoryIdMap),
        session: remapInventorySessionLikeRecord(record?.session, inventoryIdMap, stockCenterIdMap, inventorySessionIdMap),
        records: Array.isArray(record?.records)
          ? record.records.map((item) =>
              remapInventoryCountLikeRecord(item, inventoryIdMap, stockCenterIdMap, inventorySessionIdMap, inventoryCountIdMap),
            )
          : [],
      })),
    ),
  }

  await prisma.appStateSnapshot.update({
    where: { key: appStateSnapshotKey },
    data: {
      payload: {
        ...payload,
        entries: nextEntries,
      },
    },
  })

  if (stockCenterIdMap.size > 0) {
    const technicalSheetRecords = await prisma.appTechnicalSheetRecord.findMany()
    for (const record of technicalSheetRecords) {
      const productionCenters = Array.isArray(record.productionCenters)
        ? record.productionCenters.map((assignment) =>
            assignment && typeof assignment === 'object'
              ? {
                  ...assignment,
                  stockCenterId: remapSafeInt32Id(assignment.stockCenterId, stockCenterIdMap),
                }
              : assignment,
          )
        : []

      await prisma.appTechnicalSheetRecord.update({
        where: { id: record.id },
        data: { productionCenters },
      })
    }
  }

  hasSanitizedLegacyEntitySnapshotIds = true
}

function normalizeRegistrationText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ./_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trimStart()
    .toUpperCase()
}

function normalizeRegistrationNameKey(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function ensureUniqueProductName(product) {
  const existing = await prisma.appProductRecord.findMany({
    where: { companyId: product.companyId },
    select: { id: true, name: true },
  })

  const duplicate = existing.find(
    (record) => record.id !== product.id && normalizeRegistrationNameKey(record.name) === normalizeRegistrationNameKey(product.name),
  )

  if (duplicate) {
    const error = new Error(`Ja existe um produto cadastrado com o nome ${product.name}.`)
    error.statusCode = 409
    throw error
  }
}

async function ensureUniqueServiceItemName(serviceItem) {
  const existing = await prisma.appServiceItemRecord.findMany({
    where: { companyId: serviceItem.companyId },
    select: { id: true, name: true },
  })

  const duplicate = existing.find(
    (record) => record.id !== serviceItem.id && normalizeRegistrationNameKey(record.name) === normalizeRegistrationNameKey(serviceItem.name),
  )

  if (duplicate) {
    const error = new Error(`Ja existe um item cadastrado com o nome ${serviceItem.name}.`)
    error.statusCode = 409
    throw error
  }
}

async function ensureUniqueTechnicalSheetName(technicalSheet) {
  const existing = await prisma.appTechnicalSheetRecord.findMany({
    where: { companyId: technicalSheet.companyId },
    select: { id: true, name: true },
  })

  const duplicate = existing.find(
    (record) =>
      record.id !== technicalSheet.id &&
      normalizeRegistrationNameKey(record.name) === normalizeRegistrationNameKey(technicalSheet.name),
  )

  if (duplicate) {
    const error = new Error(`Ja existe uma ficha tecnica cadastrada com o nome ${technicalSheet.name}.`)
    error.statusCode = 409
    throw error
  }
}

function normalizeCompanyPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const company = value
  const id = parseIntegerParam(company.id)
  const status = company.status === 'INATIVA' ? 'INATIVA' : company.status === 'ATIVA' ? 'ATIVA' : null
  const linkedCompanyIds = Array.isArray(company.linkedCompanyIds)
    ? Array.from(
        new Set(
          company.linkedCompanyIds
            .map((item) => parseIntegerParam(item))
            .filter((item) => item !== null && item !== id),
        ),
      )
    : []
  if (
    id === null ||
    typeof company.tradeName !== 'string' ||
    typeof company.legalName !== 'string' ||
    typeof company.cnpj !== 'string' ||
    typeof company.cep !== 'string' ||
    typeof company.street !== 'string' ||
    typeof company.number !== 'string' ||
    typeof company.complement !== 'string' ||
    typeof company.neighborhood !== 'string' ||
    typeof company.city !== 'string' ||
    typeof company.state !== 'string' ||
    status === null
  ) {
    return null
  }

  return {
    id,
    tradeName: company.tradeName,
    legalName: company.legalName,
    cnpj: company.cnpj,
    cep: company.cep,
    street: company.street,
    number: company.number,
    complement: company.complement,
    neighborhood: company.neighborhood,
    city: company.city,
    state: company.state,
    status,
    linkedCompanyIds,
  }
}

function normalizeAccessProfilePayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const profile = value
  const id = parseIntegerParam(profile.id)
  const companyId = parseIntegerParam(profile.companyId)
  const role =
    profile.role === 'Administrativo' || profile.role === 'Gestor' || profile.role === 'Colaborador'
      ? profile.role
      : null
  if (
    id === null ||
    companyId === null ||
    typeof profile.name !== 'string' ||
    role === null ||
    typeof profile.isActive !== 'boolean' ||
    !profile.sectionAccess ||
    typeof profile.sectionAccess !== 'object' ||
    !profile.catalogAccess ||
    typeof profile.catalogAccess !== 'object'
  ) {
    return null
  }

  return {
    id,
    companyId,
    name: profile.name,
    role,
    sectionAccess: profile.sectionAccess,
    catalogAccess: profile.catalogAccess,
    isActive: profile.isActive,
  }
}

function normalizeUserPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const user = value
  const id = parseIntegerParam(user.id)
  const companyId = user.companyId === null ? null : parseIntegerParam(user.companyId)
  const accessProfileId = user.accessProfileId === null ? null : parseIntegerParam(user.accessProfileId)
  const role = user.role === 'Administrativo' || user.role === 'Gestor' || user.role === 'Colaborador' ? user.role : null
  const companyIds = Array.isArray(user.companyIds)
    ? Array.from(new Set(user.companyIds.map((item) => parseIntegerParam(item)).filter((item) => item !== null)))
    : []
  const sectors = Array.isArray(user.sectors) ? user.sectors.filter((item) => typeof item === 'string') : []
  if (
    id === null ||
    typeof user.fullName !== 'string' ||
    typeof user.username !== 'string' ||
    typeof user.password !== 'string' ||
    role === null ||
    typeof user.isActive !== 'boolean' ||
    !user.sectionAccess ||
    typeof user.sectionAccess !== 'object' ||
    !user.catalogAccess ||
    typeof user.catalogAccess !== 'object'
  ) {
    return null
  }

  const normalizedCompanyIds = Array.from(new Set([...companyIds, ...(companyId === null ? [] : [companyId])]))
  const normalizedMemberships = Array.isArray(user.memberships)
    ? user.memberships
        .map((membership, index) => {
          if (!membership || typeof membership !== 'object') {
            return null
          }

          const membershipCompanyId = parseIntegerParam(membership.companyId)
          const membershipAccessProfileId =
            membership.accessProfileId === null ? null : parseIntegerParam(membership.accessProfileId)
          const membershipRole =
            membership.role === 'Administrativo' || membership.role === 'Gestor' || membership.role === 'Colaborador'
              ? membership.role
              : role

          if (
            membershipCompanyId === null ||
            !membership.sectionAccess ||
            typeof membership.sectionAccess !== 'object' ||
            !membership.catalogAccess ||
            typeof membership.catalogAccess !== 'object'
          ) {
            return null
          }

          return {
            id: parseIntegerParam(membership.id) ?? -(index + 1),
            companyId: membershipCompanyId,
            role: membershipRole,
            sectors: Array.isArray(membership.sectors) ? membership.sectors.filter((item) => typeof item === 'string') : [],
            sectionAccess: membership.sectionAccess,
            catalogAccess: membership.catalogAccess,
            accessProfileId: membershipAccessProfileId,
            isActive: membership.isActive !== false,
          }
        })
        .filter((membership) => membership !== null)
    : normalizedCompanyIds.map((membershipCompanyId, index) => ({
        id: -(index + 1),
        companyId: membershipCompanyId,
        role,
        sectors,
        sectionAccess: user.sectionAccess,
        catalogAccess: user.catalogAccess,
        accessProfileId,
        isActive: user.isActive,
      }))

  return {
    id,
    fullName: user.fullName,
    username: user.username,
    password: user.password,
    role,
    companyId,
    companyIds: normalizedCompanyIds,
    sectors,
    sectionAccess: user.sectionAccess,
    catalogAccess: user.catalogAccess,
    accessProfileId,
    isActive: user.isActive,
    memberships: normalizedMemberships,
  }
}

function normalizeStockModuleSettingsPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const companyId = parseIntegerParam(record.companyId)
  if (companyId === null) {
    return null
  }

  return {
    companyId,
    inventorySummaryEditProfileIds: normalizeIntegerArray(record.inventorySummaryEditProfileIds),
    inventorySummaryDeleteProfileIds: normalizeIntegerArray(record.inventorySummaryDeleteProfileIds),
    closedInventoryReopenProfileIds: normalizeIntegerArray(record.closedInventoryReopenProfileIds),
    closedInventoryDeleteProfileIds: normalizeIntegerArray(record.closedInventoryDeleteProfileIds),
    salesImportDefaultHistoryMode:
      typeof record.salesImportDefaultHistoryMode === 'string' && record.salesImportDefaultHistoryMode.trim() !== ''
        ? record.salesImportDefaultHistoryMode.trim()
        : 'ROLLING_MONTHS',
    salesImportDefaultHistoryMonths: parseIntegerParam(record.salesImportDefaultHistoryMonths) ?? 3,
    salesImportDefaultCoverageDays: parseIntegerParam(record.salesImportDefaultCoverageDays) ?? 7,
    salesImportDefaultSafetyMarginPercent:
      typeof record.salesImportDefaultSafetyMarginPercent === 'string' && record.salesImportDefaultSafetyMarginPercent.trim() !== ''
        ? record.salesImportDefaultSafetyMarginPercent.trim()
        : '20',
    salesImportAutoApplySuggestedMinimum: record.salesImportAutoApplySuggestedMinimum !== false,
    salesImportAllowManualMinimumOverride: record.salesImportAllowManualMinimumOverride !== false,
    salesImportUnmatchedRowPolicy:
      typeof record.salesImportUnmatchedRowPolicy === 'string' && record.salesImportUnmatchedRowPolicy.trim() !== ''
        ? record.salesImportUnmatchedRowPolicy.trim()
        : 'BLOCK',
    salesImportDuplicateRowPolicy:
      typeof record.salesImportDuplicateRowPolicy === 'string' && record.salesImportDuplicateRowPolicy.trim() !== ''
        ? record.salesImportDuplicateRowPolicy.trim()
        : 'BLOCK',
  }
}

function normalizeSalesImportTemplatePayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const stockCenterId = record.stockCenterId === null ? null : parseIntegerParam(record.stockCenterId)

  if (
    id === null ||
    companyId === null ||
    typeof record.name !== 'string' ||
    typeof record.sheetName !== 'string' ||
    typeof record.dateMode !== 'string' ||
    typeof record.dateColumn !== 'string' ||
    typeof record.dateCell !== 'string' ||
    typeof record.codeColumn !== 'string' ||
    typeof record.quantityColumn !== 'string'
  ) {
    return null
  }

  return {
    id,
    companyId,
    stockCenterId,
    name: record.name.trim(),
    sheetName: record.sheetName.trim(),
    headerRow: parseIntegerParam(record.headerRow) ?? 1,
    dataStartRow: parseIntegerParam(record.dataStartRow) ?? 2,
    dateMode: record.dateMode.trim(),
    dateColumn: record.dateColumn.trim(),
    dateCell: record.dateCell.trim(),
    codeColumn: record.codeColumn.trim(),
    quantityColumn: record.quantityColumn.trim(),
    isActive: record.isActive !== false,
  }
}

function normalizeSalesImportBatchPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const stockCenterId = parseIntegerParam(record.stockCenterId)
  const templateId = record.templateId === null ? null : parseIntegerParam(record.templateId)
  const uploadedByUserId = record.uploadedByUserId === null ? null : parseIntegerParam(record.uploadedByUserId)

  if (
    id === null ||
    companyId === null ||
    stockCenterId === null ||
    typeof record.uploadedByUserName !== 'string' ||
    typeof record.fileName !== 'string' ||
    typeof record.historyMode !== 'string' ||
    typeof record.safetyMarginPercent !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.importedAt !== 'string'
  ) {
    return null
  }

  const summary = record.summary && typeof record.summary === 'object' && !Array.isArray(record.summary) ? record.summary : {}

  return {
    id,
    companyId,
    stockCenterId,
    templateId,
    uploadedByUserId,
    uploadedByUserName: record.uploadedByUserName.trim(),
    fileName: record.fileName.trim(),
    historyMode: record.historyMode.trim(),
    historyMonths: record.historyMonths === null ? null : parseIntegerParam(record.historyMonths),
    coverageDays: parseIntegerParam(record.coverageDays) ?? 7,
    safetyMarginPercent: record.safetyMarginPercent.trim(),
    postingMode: typeof record.postingMode === 'string' && record.postingMode.trim() !== '' ? record.postingMode.trim() : 'ANALYTICAL_ONLY',
    status: record.status.trim(),
    importedAt: record.importedAt,
    summary,
  }
}

function normalizeSalesImportRowPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const batchId = parseIntegerParam(record.batchId)
  const companyId = parseIntegerParam(record.companyId)
  const stockCenterId = parseIntegerParam(record.stockCenterId)
  const matchedTechnicalSheetId = record.matchedTechnicalSheetId === null ? null : parseIntegerParam(record.matchedTechnicalSheetId)

  if (
    id === null ||
    batchId === null ||
    companyId === null ||
    stockCenterId === null ||
    typeof record.sourceRowKey !== 'string' ||
    typeof record.consumedAt !== 'string' ||
    typeof record.companyProductId !== 'string' ||
    typeof record.quantity !== 'string' ||
    typeof record.matchedKind !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.errorMessage !== 'string'
  ) {
    return null
  }

  return {
    id,
    batchId,
    companyId,
    stockCenterId,
    sourceRowKey: record.sourceRowKey,
    consumedAt: record.consumedAt,
    companyProductId: record.companyProductId.trim(),
    quantity: record.quantity.trim(),
    matchedTechnicalSheetId,
    matchedKind: record.matchedKind.trim(),
    status: record.status.trim(),
    errorMessage: record.errorMessage.trim(),
  }
}

function normalizeSalesConsumptionPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const stockCenterId = parseIntegerParam(record.stockCenterId)
  const sourceBatchId = parseIntegerParam(record.sourceBatchId)
  const sourceTechnicalSheetId = parseIntegerParam(record.sourceTechnicalSheetId)
  const stockMovementId = record.stockMovementId === null ? null : parseIntegerParam(record.stockMovementId)

  if (
    id === null ||
    companyId === null ||
    stockCenterId === null ||
    sourceBatchId === null ||
    sourceTechnicalSheetId === null ||
    typeof record.consumedAt !== 'string' ||
    typeof record.sourceTechnicalSheetKind !== 'string' ||
    typeof record.ingredientProductId !== 'string' ||
    typeof record.quantityConsumed !== 'string' ||
    typeof record.unit !== 'string' ||
    typeof record.stockPostingStatus !== 'string' ||
    typeof record.postedAt !== 'string'
  ) {
    return null
  }

  return {
    id,
    companyId,
    stockCenterId,
    consumedAt: record.consumedAt,
    sourceBatchId,
    sourceTechnicalSheetId,
    sourceTechnicalSheetKind: record.sourceTechnicalSheetKind.trim(),
    ingredientProductId: record.ingredientProductId.trim(),
    quantityConsumed: record.quantityConsumed.trim(),
    unit: record.unit.trim(),
    stockPostingStatus: record.stockPostingStatus.trim(),
    stockMovementId,
    postedAt: record.postedAt,
  }
}

function normalizeStockCenterPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const userIds = Array.isArray(record.userIds)
    ? Array.from(new Set(record.userIds.map((item) => parseIntegerParam(item)).filter((item) => item !== null)))
    : []
  const responsibleUserIds = Array.isArray(record.responsibleUserIds)
    ? Array.from(new Set(record.responsibleUserIds.map((item) => parseIntegerParam(item)).filter((item) => item !== null)))
    : []
  const producedTechnicalSheetIds = Array.isArray(record.producedTechnicalSheetIds)
    ? Array.from(new Set(record.producedTechnicalSheetIds.map((item) => parseIntegerParam(item)).filter((item) => item !== null)))
    : []
  const minimumStocks = Array.isArray(record.minimumStocks)
    ? record.minimumStocks
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          kind: item.kind === 'PRODUTO' || item.kind === 'ITEM' || item.kind === 'PREPARO' ? item.kind : 'PREPARO',
          technicalSheetId: parseIntegerParam(item.technicalSheetId),
          productId: typeof item.productId === 'string' ? item.productId : '',
          serviceItemId: typeof item.serviceItemId === 'string' ? item.serviceItemId : '',
          packageId: parseIntegerParam(item.packageId),
          minimumQuantity: typeof item.minimumQuantity === 'string' ? item.minimumQuantity.trim() : '',
          suggestedMinimumQuantity:
            typeof item.suggestedMinimumQuantity === 'string' ? item.suggestedMinimumQuantity.trim() : undefined,
          minimumSource:
            item.minimumSource === 'SUGERIDO_VENDAS' || item.minimumSource === 'MANUAL' ? item.minimumSource : undefined,
          suggestedAt: typeof item.suggestedAt === 'string' ? item.suggestedAt : undefined,
          overriddenAt: typeof item.overriddenAt === 'string' ? item.overriddenAt : undefined,
        }))
        .filter((item) => item.minimumQuantity !== '')
    : []

  if (
    id === null ||
    companyId === null ||
    typeof record.name !== 'string' ||
    typeof record.code !== 'string' ||
    typeof record.sector !== 'string' ||
    typeof record.isProducer !== 'boolean' ||
    typeof record.isActive !== 'boolean'
  ) {
    return null
  }

  return {
    id,
    companyId,
    name: record.name,
    code: record.code,
    sector: record.sector,
    userIds,
    responsibleUserIds,
    isProducer: record.isProducer,
    producedTechnicalSheetIds,
    minimumStocks,
    isActive: record.isActive,
  }
}

function normalizeRequisitionPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const requisitionGroupId = parseIntegerParam(record.requisitionGroupId)
  const stockCenterId = parseIntegerParam(record.stockCenterId)
  const supplyCenterId = record.supplyCenterId === null ? null : parseIntegerParam(record.supplyCenterId)
  const createdByUserId = record.createdByUserId === null ? null : parseIntegerParam(record.createdByUserId)
  const approvedByUserId = record.approvedByUserId === null ? null : parseIntegerParam(record.approvedByUserId)
  const sentByUserId = record.sentByUserId === null ? null : parseIntegerParam(record.sentByUserId)
  const preparedByUserId = record.preparedByUserId === null ? null : parseIntegerParam(record.preparedByUserId)
  const receivedByUserId = record.receivedByUserId === null ? null : parseIntegerParam(record.receivedByUserId)
  const lastUpdatedByUserId = record.lastUpdatedByUserId === null ? null : parseIntegerParam(record.lastUpdatedByUserId)

  if (
    id === null ||
    companyId === null ||
    stockCenterId === null ||
    typeof record.stockCenterName !== 'string' ||
    typeof record.supplyCenterName !== 'string' ||
    typeof record.sector !== 'string' ||
    typeof record.countedAt !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.editScope !== 'string' ||
    !Array.isArray(record.lines) ||
    typeof record.createdAt !== 'string' ||
    typeof record.createdByUserName !== 'string' ||
    typeof record.approvedAt !== 'string' ||
    typeof record.approvedByUserName !== 'string' ||
    typeof record.sentAt !== 'string' ||
    typeof record.sentByUserName !== 'string' ||
    typeof record.preparedAt !== 'string' ||
    typeof record.preparedByUserName !== 'string' ||
    typeof record.receivedAt !== 'string' ||
    typeof record.receivedByUserName !== 'string' ||
    typeof record.lastUpdatedAt !== 'string' ||
    typeof record.lastUpdatedByUserName !== 'string'
  ) {
    return null
  }

  return {
    id,
    companyId,
    requisitionGroupId: requisitionGroupId ?? id,
    stockCenterId,
    stockCenterName: record.stockCenterName,
    supplyCenterId,
    supplyCenterName: record.supplyCenterName,
    sector: record.sector,
    countedAt: record.countedAt,
    status: record.status,
    editScope: record.editScope,
    lines: record.lines,
    createdAt: record.createdAt,
    createdByUserId,
    createdByUserName: record.createdByUserName,
    approvedAt: record.approvedAt,
    approvedByUserId,
    approvedByUserName: record.approvedByUserName,
    sentAt: record.sentAt,
    sentByUserId,
    sentByUserName: record.sentByUserName,
    preparedAt: record.preparedAt,
    preparedByUserId,
    preparedByUserName: record.preparedByUserName,
    receivedAt: record.receivedAt,
    receivedByUserId,
    receivedByUserName: record.receivedByUserName,
    lastUpdatedAt: record.lastUpdatedAt,
    lastUpdatedByUserId,
    lastUpdatedByUserName: record.lastUpdatedByUserName,
  }
}

function normalizeRequisitionNotificationPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const userId = parseIntegerParam(record.userId)
  const requisitionId = parseIntegerParam(record.requisitionId)

  if (
    id === null ||
    companyId === null ||
    userId === null ||
    requisitionId === null ||
    typeof record.message !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.isRead !== 'boolean'
  ) {
    return null
  }

  return {
    id,
    companyId,
    userId,
    requisitionId,
    message: record.message,
    createdAt: record.createdAt,
    isRead: record.isRead,
  }
}

function normalizeManualProductionRequestPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const centerId = parseIntegerParam(record.centerId)
  const sheetId = parseIntegerParam(record.sheetId)
  const createdByUserId = record.createdByUserId === null ? null : parseIntegerParam(record.createdByUserId)
  const rootRequestId = parseIntegerParam(record.rootRequestId)
  const parentRequestId = record.parentRequestId === null ? null : parseIntegerParam(record.parentRequestId)

  if (
    id === null ||
    companyId === null ||
    centerId === null ||
    sheetId === null ||
    typeof record.desiredYield !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.createdByUserName !== 'string' ||
    rootRequestId === null ||
    typeof record.isDependencyRequest !== 'boolean'
  ) {
    return null
  }

  return {
    id,
    companyId,
    centerId,
    sheetId,
    desiredYield: record.desiredYield,
    createdAt: record.createdAt,
    createdByUserId,
    createdByUserName: record.createdByUserName,
    rootRequestId,
    parentRequestId,
    isDependencyRequest: record.isDependencyRequest,
  }
}

function normalizeProductionDraftPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const draftId = parseIntegerParam(record.draftId)
  const companyId = parseIntegerParam(record.companyId)
  const centerId = parseIntegerParam(record.centerId)
  const sheetId = parseIntegerParam(record.sheetId)
  const startedByUserId = record.startedByUserId === null ? null : parseIntegerParam(record.startedByUserId)
  const consumptionSessionId = record.consumptionSessionId === null ? null : parseIntegerParam(record.consumptionSessionId)

  if (
    draftId === null ||
    companyId === null ||
    centerId === null ||
    sheetId === null ||
    typeof record.startedAt !== 'string' ||
    typeof record.startedByUserName !== 'string' ||
    typeof record.desiredYield !== 'string' ||
    typeof record.finalYield !== 'string' ||
    typeof record.confirmedPh !== 'string' ||
    typeof record.confirmedBrix !== 'string' ||
    !record.ingredientOverrides ||
    typeof record.ingredientOverrides !== 'object' ||
    Array.isArray(record.ingredientOverrides) ||
    !Array.isArray(record.manualOverrideIngredientIds)
  ) {
    return null
  }

  const ingredientOverrides = Object.fromEntries(
    Object.entries(record.ingredientOverrides).filter(
      ([key, itemValue]) => typeof key === 'string' && typeof itemValue === 'string',
    ),
  )
  const manualOverrideIngredientIds = record.manualOverrideIngredientIds.filter((item) => typeof item === 'number')
  const manualRequestIds = Array.isArray(record.manualRequestIds)
    ? record.manualRequestIds.filter((item) => typeof item === 'number')
    : []

  return {
    draftId,
    companyId,
    centerId,
    sheetId,
    startedAt: record.startedAt,
    startedByUserId,
    startedByUserName: record.startedByUserName,
    desiredYield: record.desiredYield,
    finalYield: record.finalYield,
    confirmedPh: record.confirmedPh,
    confirmedBrix: record.confirmedBrix,
    ingredientOverrides,
    manualOverrideIngredientIds,
    consumptionSessionId,
    manualRequestIds,
  }
}

function normalizeInventoryStorageLocationPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const companyId = parseIntegerParam(record.companyId)
  if (companyId === null || typeof record.name !== 'string') {
    return null
  }

  return {
    companyId,
    name: normalizeRegistrationText(record.name),
    isActive: record.isActive !== false,
  }
}

function normalizeInventoryPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const stockCenterId = parseIntegerParam(record.stockCenterId)

  if (
    id === null ||
    companyId === null ||
    stockCenterId === null ||
    typeof record.countedAt !== 'string' ||
    typeof record.isClosed !== 'boolean' ||
    typeof record.startedAt !== 'string' ||
    typeof record.startedByUserName !== 'string'
  ) {
    return null
  }

  return {
    id,
    companyId,
    stockCenterId,
    countedAt: record.countedAt,
    isClosed: record.isClosed,
    startedAt: record.startedAt,
    startedByUserId: record.startedByUserId === null ? null : parseIntegerParam(record.startedByUserId),
    startedByUserName: normalizeRegistrationText(record.startedByUserName),
    closedAt: typeof record.closedAt === 'string' ? record.closedAt : '',
    closedByUserId: record.closedByUserId === null ? null : parseIntegerParam(record.closedByUserId),
    closedByUserName: typeof record.closedByUserName === 'string' ? normalizeRegistrationText(record.closedByUserName) : '',
    discardedOpenSessionCount:
      typeof record.discardedOpenSessionCount === 'number' && record.discardedOpenSessionCount > 0
        ? record.discardedOpenSessionCount
        : 0,
    appliedPendingMovementCount:
      typeof record.appliedPendingMovementCount === 'number' && record.appliedPendingMovementCount > 0
        ? record.appliedPendingMovementCount
        : 0,
  }
}

function normalizeInventoryActiveRecordLinkPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const companyId = parseIntegerParam(record.companyId)
  if (companyId === null || typeof record.userKey !== 'string') {
    return null
  }

  return {
    companyId,
    userKey: record.userKey,
    inventoryId: record.inventoryId === null ? null : parseIntegerParam(record.inventoryId),
  }
}

function normalizeInventoryCountSessionPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const stockCenterId = parseIntegerParam(record.stockCenterId)

  if (
    id === null ||
    companyId === null ||
    stockCenterId === null ||
    typeof record.countedAt !== 'string' ||
    typeof record.isClosed !== 'boolean' ||
    typeof record.startedByUserName !== 'string'
  ) {
    return null
  }

  return {
    id,
    inventoryId: record.inventoryId === null ? null : parseIntegerParam(record.inventoryId),
    companyId,
    stockCenterId,
    countedAt: record.countedAt,
    isClosed: record.isClosed,
    startedAt:
      typeof record.startedAt === 'string' && record.startedAt.trim() !== ''
        ? record.startedAt
        : typeof record.closedAt === 'string' && record.closedAt.trim() !== ''
          ? record.closedAt
          : `${record.countedAt}T00:00:00.000Z`,
    startedByUserId: record.startedByUserId === null ? null : parseIntegerParam(record.startedByUserId),
    startedByUserName: normalizeRegistrationText(record.startedByUserName),
    closedAt: typeof record.closedAt === 'string' ? record.closedAt : '',
    closedByUserId: record.closedByUserId === null ? null : parseIntegerParam(record.closedByUserId),
    closedByUserName: typeof record.closedByUserName === 'string' ? normalizeRegistrationText(record.closedByUserName) : '',
  }
}

function normalizeInventoryActiveSessionLinkPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const companyId = parseIntegerParam(record.companyId)
  if (companyId === null || typeof record.userKey !== 'string') {
    return null
  }

  return {
    companyId,
    userKey: record.userKey,
    sessionId: record.sessionId === null ? null : parseIntegerParam(record.sessionId),
  }
}

function normalizeInventoryCountPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const sessionId = parseIntegerParam(record.sessionId)
  const companyId = parseIntegerParam(record.companyId)
  const stockCenterId = parseIntegerParam(record.stockCenterId)
  const technicalSheetId = record.technicalSheetId === null ? null : parseIntegerParam(record.technicalSheetId)
  const packageId = record.packageId === null ? null : parseIntegerParam(record.packageId)

  if (
    id === null ||
    sessionId === null ||
    companyId === null ||
    stockCenterId === null ||
    typeof record.countedAt !== 'string' ||
    typeof record.storageLocation !== 'string' ||
    typeof record.technicalSheetName !== 'string' ||
    !['PREPARO', 'VENDA', 'PRODUTO', 'ITEM'].includes(record.technicalSheetKind) ||
    typeof record.recipientItemId !== 'string' ||
    typeof record.recipientLabel !== 'string' ||
    typeof record.closedItemsQuantity !== 'string' ||
    typeof record.hasOpenItems !== 'boolean' ||
    typeof record.openItemsGrossWeight !== 'string' ||
    typeof record.openItemsContainerQuantity !== 'string' ||
    typeof record.openItemsNetQuantity !== 'string' ||
    typeof record.totalCountedQuantity !== 'string' ||
    !['MILLILITER', 'GRAM', 'UNIT'].includes(record.totalCountedUnit) ||
    typeof record.createdByUserName !== 'string'
  ) {
    return null
  }

  return {
    id,
    inventoryId: record.inventoryId === null ? null : parseIntegerParam(record.inventoryId),
    sessionId,
    companyId,
    stockCenterId,
    countedAt: record.countedAt,
    storageLocation: normalizeRegistrationText(record.storageLocation),
    technicalSheetId,
    productId: typeof record.productId === 'string' ? normalizeRegistrationText(record.productId) : '',
    serviceItemId: typeof record.serviceItemId === 'string' ? normalizeRegistrationText(record.serviceItemId) : '',
    packageId,
    technicalSheetName: normalizeRegistrationText(record.technicalSheetName),
    technicalSheetKind: record.technicalSheetKind,
    recipientItemId: normalizeRegistrationText(record.recipientItemId),
    recipientLabel: normalizeRegistrationText(record.recipientLabel),
    closedItemsQuantity: record.closedItemsQuantity.trim(),
    hasOpenItems: record.hasOpenItems,
    openItemsGrossWeight: record.openItemsGrossWeight.trim(),
    openItemsContainerQuantity: record.openItemsContainerQuantity.trim(),
    openItemsNetQuantity: record.openItemsNetQuantity.trim(),
    totalCountedQuantity: record.totalCountedQuantity.trim(),
    totalCountedUnit: record.totalCountedUnit,
    productionExpectedYield: typeof record.productionExpectedYield === 'string' ? record.productionExpectedYield.trim() : '',
    productionFinalYield: typeof record.productionFinalYield === 'string' ? record.productionFinalYield.trim() : '',
    productionYieldDifference: typeof record.productionYieldDifference === 'string' ? record.productionYieldDifference.trim() : '',
    productionTargetPh: typeof record.productionTargetPh === 'string' ? normalizeRegistrationText(record.productionTargetPh) : '',
    productionConfirmedPh: typeof record.productionConfirmedPh === 'string' ? normalizeRegistrationText(record.productionConfirmedPh) : '',
    productionTargetBrix: typeof record.productionTargetBrix === 'string' ? normalizeRegistrationText(record.productionTargetBrix) : '',
    productionConfirmedBrix: typeof record.productionConfirmedBrix === 'string' ? normalizeRegistrationText(record.productionConfirmedBrix) : '',
    createdByUserId: record.createdByUserId === null ? null : parseIntegerParam(record.createdByUserId),
    createdByUserName: normalizeRegistrationText(record.createdByUserName),
  }
}

function normalizePendingInventoryMovementPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value
  const id = parseIntegerParam(record.id)
  const companyId = parseIntegerParam(record.companyId)
  const stockCenterId = parseIntegerParam(record.stockCenterId)
  const inventoryId = parseIntegerParam(record.inventoryId)

  if (
    id === null ||
    companyId === null ||
    stockCenterId === null ||
    inventoryId === null ||
    typeof record.createdAt !== 'string' ||
    typeof record.description !== 'string'
  ) {
    return null
  }

  const session = normalizeInventoryCountSessionPayload(record.session)
  const records = Array.isArray(record.records)
    ? record.records.map(normalizeInventoryCountPayload).filter((item) => item !== null)
    : []

  if (!session || records.length === 0) {
    return null
  }

  return {
    id,
    companyId,
    stockCenterId,
    inventoryId,
    createdAt: record.createdAt,
    createdByUserId: record.createdByUserId === null ? null : parseIntegerParam(record.createdByUserId),
    createdByUserName:
      typeof record.createdByUserName === 'string' && record.createdByUserName.trim()
        ? record.createdByUserName
        : 'Administrador do sistema',
    description: record.description,
    session,
    records,
  }
}

function normalizeProductPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const product = value
  const ownerCompanyId =
    typeof product.ownerCompanyId === 'number'
      ? product.ownerCompanyId
      : typeof product.companyId === 'number'
        ? product.companyId
        : null
  if (
    typeof product.id !== 'string' ||
    typeof product.companyId !== 'number' ||
    ownerCompanyId === null ||
    typeof product.companyProductId !== 'string' ||
    typeof product.name !== 'string' ||
    typeof product.controlUnit !== 'string' ||
    typeof product.family !== 'string' ||
    typeof product.subfamily !== 'string' ||
    !Array.isArray(product.sectors) ||
    typeof product.alcoholPercentage !== 'string' ||
    typeof product.densitySampleVolume !== 'string' ||
    typeof product.densitySampleWeight !== 'string' ||
    typeof product.ignoreStock !== 'boolean' ||
    typeof product.isActive !== 'boolean' ||
    !Array.isArray(product.packages)
  ) {
    return null
  }

  return {
    id: product.id,
    companyId: product.companyId,
    ownerCompanyId,
    companyProductId: product.companyProductId,
    name: product.name,
    controlUnit: product.controlUnit,
    family: product.family,
    subfamily: product.subfamily,
    sectors: product.sectors.filter((item) => typeof item === 'string'),
    alcoholPercentage: product.alcoholPercentage,
    densitySampleVolume: product.densitySampleVolume,
    densitySampleWeight: product.densitySampleWeight,
    ignoreStock: product.ignoreStock,
    isActive: product.isActive,
    technicalSheetId: typeof product.technicalSheetId === 'number' ? product.technicalSheetId : null,
    packages: product.packages,
  }
}

function normalizeServiceItemPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const serviceItem = value
  if (
    typeof serviceItem.id !== 'string' ||
    typeof serviceItem.companyId !== 'number' ||
    typeof serviceItem.kind !== 'string' ||
    typeof serviceItem.companyProductId !== 'string' ||
    typeof serviceItem.manufacturerCode !== 'string' ||
    typeof serviceItem.name !== 'string' ||
    typeof serviceItem.sizeValue !== 'string' ||
    typeof serviceItem.sizeUnit !== 'string' ||
    typeof serviceItem.emptyWeight !== 'string' ||
    typeof serviceItem.controlUnit !== 'string' ||
    typeof serviceItem.family !== 'string' ||
    typeof serviceItem.subfamily !== 'string' ||
    !Array.isArray(serviceItem.sectors) ||
    typeof serviceItem.imageDataUrl !== 'string' ||
    typeof serviceItem.isActive !== 'boolean' ||
    !Array.isArray(serviceItem.packages)
  ) {
    return null
  }

  return {
    id: serviceItem.id,
    companyId: serviceItem.companyId,
    kind: serviceItem.kind,
    companyProductId: serviceItem.companyProductId,
    manufacturerCode: serviceItem.manufacturerCode,
    name: serviceItem.name,
    sizeValue: serviceItem.sizeValue,
    sizeUnit: serviceItem.sizeUnit,
    emptyWeight: serviceItem.emptyWeight,
    controlUnit: serviceItem.controlUnit,
    family: serviceItem.family,
    subfamily: serviceItem.subfamily,
    sectors: serviceItem.sectors.filter((item) => typeof item === 'string'),
    imageDataUrl: serviceItem.imageDataUrl,
    isActive: serviceItem.isActive,
    packages: serviceItem.packages,
  }
}

function normalizeTechnicalSheetPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const sheet = value
  const ownerCompanyId =
    typeof sheet.ownerCompanyId === 'number'
      ? sheet.ownerCompanyId
      : typeof sheet.companyId === 'number'
        ? sheet.companyId
        : null
  const sharedCompanyIds = Array.isArray(sheet.sharedCompanyIds)
    ? Array.from(
        new Set(
          sheet.sharedCompanyIds
            .map((item) => parseIntegerParam(item))
            .filter((item) => item !== null),
        ),
      )
    : []
  if (
    typeof sheet.id !== 'number' ||
    typeof sheet.companyId !== 'number' ||
    ownerCompanyId === null ||
    typeof sheet.kind !== 'string' ||
    typeof sheet.productId !== 'string' ||
    typeof sheet.companyProductId !== 'string' ||
    typeof sheet.name !== 'string' ||
    typeof sheet.family !== 'string' ||
    typeof sheet.subfamily !== 'string' ||
    !Array.isArray(sheet.sectors) ||
    typeof sheet.outputQuantity !== 'string' ||
    typeof sheet.outputUnit !== 'string' ||
    typeof sheet.densitySampleVolume !== 'string' ||
    typeof sheet.densitySampleWeight !== 'string' ||
    typeof sheet.yieldDifferenceDestination !== 'string' ||
    typeof sheet.yieldDifferenceByproductName !== 'string' ||
    typeof sheet.targetPh !== 'string' ||
    typeof sheet.targetBrix !== 'string' ||
    typeof sheet.portionSize !== 'string' ||
    typeof sheet.colorTagOne !== 'string' ||
    typeof sheet.colorTagTwo !== 'string' ||
    typeof sheet.desiredCmvPercentage !== 'string' ||
    typeof sheet.dilutionRatePercentage !== 'string' ||
    typeof sheet.imageDataUrl !== 'string' ||
    typeof sheet.finalSalePrice !== 'string' ||
    typeof sheet.flavorSweet !== 'string' ||
    typeof sheet.flavorSour !== 'string' ||
    typeof sheet.flavorBitter !== 'string' ||
    typeof sheet.flavorSalty !== 'string' ||
    typeof sheet.flavorUmami !== 'string' ||
    typeof sheet.storytelling !== 'string' ||
    typeof sheet.preparationMode !== 'string' ||
    typeof sheet.shelfLifeRoom !== 'string' ||
    typeof sheet.shelfLifeRefrigerated !== 'string' ||
    typeof sheet.shelfLifeFrozen !== 'string' ||
    !Array.isArray(sheet.productionCenters) ||
    !Array.isArray(sheet.ingredients) ||
    !Array.isArray(sheet.garnishIngredients) ||
    !Array.isArray(sheet.serviceItems) ||
    typeof sheet.isActive !== 'boolean'
  ) {
    return null
  }

  const normalizedIngredients = sheet.ingredients.filter(
    (ingredient) =>
      Boolean(ingredient) &&
      typeof ingredient === 'object' &&
      typeof ingredient.id === 'number' &&
      typeof ingredient.productId === 'string' &&
      typeof ingredient.productLabel === 'string' &&
      typeof ingredient.quantity === 'string' &&
      typeof ingredient.yieldQuantity === 'string',
  )
  const normalizedGarnishIngredients = Array.isArray(sheet.garnishIngredients)
    ? sheet.garnishIngredients.filter(
        (ingredient) =>
          Boolean(ingredient) &&
          typeof ingredient === 'object' &&
          typeof ingredient.id === 'number' &&
          typeof ingredient.productId === 'string' &&
          typeof ingredient.productLabel === 'string' &&
          typeof ingredient.quantity === 'string' &&
          typeof ingredient.yieldQuantity === 'string',
      )
    : []
  const yieldDifferenceReferenceIngredients =
    sheet.kind === 'EXECUCAO' ? normalizedIngredients : [...normalizedIngredients, ...normalizedGarnishIngredients]
  const totalInputQuantity = yieldDifferenceReferenceIngredients.reduce((sum, ingredient) => {
    if (ingredient.isActive === false) {
      return sum
    }
    return sum + (Number.parseFloat(ingredient.quantity) || 0)
  }, 0)
  const declaredOutputQuantity = Number.parseFloat(sheet.outputQuantity) || 0
  const normalizedYieldDifferenceDestination =
    sheet.yieldDifferenceDestination === 'WASTE' || sheet.yieldDifferenceDestination === 'BYPRODUCT'
      ? sheet.yieldDifferenceDestination
      : sheet.kind === 'PREPARO' && declaredOutputQuantity > 0 && totalInputQuantity > declaredOutputQuantity
        ? 'WASTE'
        : ''

  return {
    id: sheet.id,
    companyId: sheet.companyId,
    ownerCompanyId,
    sharedCompanyIds: Array.from(new Set([ownerCompanyId, ...sharedCompanyIds])),
    kind: sheet.kind,
    productId: sheet.productId,
    companyProductId: sheet.companyProductId,
    name: sheet.name,
    family: sheet.family,
    subfamily: sheet.subfamily,
    sectors: sheet.sectors.filter((item) => typeof item === 'string'),
    outputQuantity: sheet.outputQuantity,
    outputUnit: sheet.outputUnit,
    densitySampleVolume: sheet.densitySampleVolume,
    densitySampleWeight: sheet.densitySampleWeight,
    yieldDifferenceDestination: normalizedYieldDifferenceDestination,
    yieldDifferenceByproductName: sheet.yieldDifferenceByproductName,
    yieldDifferenceByproductTechnicalSheetId:
      typeof sheet.yieldDifferenceByproductTechnicalSheetId === 'number' ? sheet.yieldDifferenceByproductTechnicalSheetId : null,
    targetPh: sheet.targetPh,
    targetBrix: sheet.targetBrix,
    portionSize: sheet.portionSize,
    colorTagOne: sheet.colorTagOne,
    colorTagTwo: sheet.colorTagTwo,
    desiredCmvPercentage: sheet.desiredCmvPercentage,
    dilutionRatePercentage: sheet.dilutionRatePercentage,
    imageDataUrl: sheet.imageDataUrl,
    finalSalePrice: sheet.finalSalePrice,
    flavorSweet: sheet.flavorSweet,
    flavorSour: sheet.flavorSour,
    flavorBitter: sheet.flavorBitter,
    flavorSalty: sheet.flavorSalty,
    flavorUmami: sheet.flavorUmami,
    storytelling: sheet.storytelling,
    preparationMode: sheet.preparationMode,
    preparationLeadTimeDays: sheet.preparationLeadTimeDays,
    shelfLifeRoom: sheet.shelfLifeRoom,
    shelfLifeRefrigerated: sheet.shelfLifeRefrigerated,
    shelfLifeFrozen: sheet.shelfLifeFrozen,
    productionCenters: sheet.productionCenters,
    ingredients: sheet.ingredients,
    garnishIngredients: sheet.garnishIngredients,
    serviceItems: sheet.serviceItems,
    isActive: sheet.isActive,
  }
}

function normalizeIntegerArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => parseIntegerParam(item)).filter((item) => item !== null)))
    : []
}

async function removeProfileIdFromStockModuleSettings(profileId) {
  const records = await prisma.appStockModuleSettingsRecord.findMany()
  await Promise.all(
    records.map((record) =>
      prisma.appStockModuleSettingsRecord.update({
        where: { companyId: record.companyId },
        data: {
          inventorySummaryEditProfileIds: record.inventorySummaryEditProfileIds.filter((item) => item !== profileId),
          inventorySummaryDeleteProfileIds: record.inventorySummaryDeleteProfileIds.filter((item) => item !== profileId),
          closedInventoryReopenProfileIds: record.closedInventoryReopenProfileIds.filter((item) => item !== profileId),
          closedInventoryDeleteProfileIds: record.closedInventoryDeleteProfileIds.filter((item) => item !== profileId),
        },
      }),
    ),
  )
}

async function ensureAppUserMembershipRecordsHydrated() {
  const [usersCount, membershipsCount] = await Promise.all([
    prisma.appUserRecord.count(),
    prisma.appUserCompanyMembershipRecord.count(),
  ])

  if (usersCount === 0 || membershipsCount > 0) {
    return
  }

  const users = await prisma.appUserRecord.findMany()
  await prisma.$transaction(
    users.flatMap((user) => {
      const companyIds = Array.from(
        new Set(
          [
            ...(Array.isArray(user.companyIds) ? user.companyIds : []),
            ...(typeof user.companyId === 'number' ? [user.companyId] : []),
          ].filter((companyId) => typeof companyId === 'number'),
        ),
      )
      return companyIds.map((companyId) =>
        prisma.appUserCompanyMembershipRecord.upsert({
          where: {
            userId_companyId: {
              userId: user.id,
              companyId,
            },
          },
          create: {
            userId: user.id,
            companyId,
            role: user.role,
            sectors: user.sectors,
            sectionAccess: user.sectionAccess,
            catalogAccess: user.catalogAccess,
            accessProfileId: user.accessProfileId,
            isActive: user.isActive,
          },
          update: {
            role: user.role,
            sectors: user.sectors,
            sectionAccess: user.sectionAccess,
            catalogAccess: user.catalogAccess,
            accessProfileId: user.accessProfileId,
            isActive: user.isActive,
          },
        }),
      )
    }),
  )
}

async function ensureAppAdminRecordsSeeded() {
  if (hasSeededAppAdminRecords) {
    await ensureAppUserMembershipRecordsHydrated()
    return
  }

  const [companiesCount, usersCount, accessProfilesCount, stockModuleSettingsCount, membershipsCount] = await Promise.all([
    prisma.appCompanyRecord.count(),
    prisma.appUserRecord.count(),
    prisma.appAccessProfileRecord.count(),
    prisma.appStockModuleSettingsRecord.count(),
    prisma.appUserCompanyMembershipRecord.count(),
  ])

  if (companiesCount > 0 || usersCount > 0 || accessProfilesCount > 0 || stockModuleSettingsCount > 0 || membershipsCount > 0) {
    hasSeededAppAdminRecords = true
    await ensureAppUserMembershipRecordsHydrated()
    return
  }

  const snapshot = await prisma.appStateSnapshot.findUnique({
    where: { key: appStateSnapshotKey },
  })
  const payload = snapshot?.payload
  const entries = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.entries : null
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    hasSeededAppAdminRecords = true
    return
  }

  const companies = parseSeedArray(entries[companiesStorageKey], normalizeCompanyPayload)
  const accessProfiles = parseSeedArray(entries[accessProfilesStorageKey], normalizeAccessProfilePayload)
  const users = parseSeedArray(entries[usersStorageKey], normalizeUserPayload)
  const stockModuleSettings = parseSeedArray(entries[stockModuleSettingsStorageKey], normalizeStockModuleSettingsPayload)

  await prisma.$transaction(async (transaction) => {
    for (const company of companies) {
      await transaction.appCompanyRecord.upsert({
        where: { id: company.id },
        create: company,
        update: company,
      })
    }

    for (const accessProfile of accessProfiles) {
      await transaction.appAccessProfileRecord.upsert({
        where: { id: accessProfile.id },
        create: accessProfile,
        update: accessProfile,
      })
    }

    for (const user of users) {
      const { memberships, ...userRecord } = user
      await transaction.appUserRecord.upsert({
        where: { id: user.id },
        create: userRecord,
        update: userRecord,
      })

      for (const membership of memberships) {
        await transaction.appUserCompanyMembershipRecord.upsert({
          where: {
            userId_companyId: {
              userId: userRecord.id,
              companyId: membership.companyId,
            },
          },
          create: {
            userId: userRecord.id,
            companyId: membership.companyId,
            role: membership.role,
            sectors: membership.sectors,
            sectionAccess: membership.sectionAccess,
            catalogAccess: membership.catalogAccess,
            accessProfileId: membership.accessProfileId,
            isActive: membership.isActive,
          },
          update: {
            role: membership.role,
            sectors: membership.sectors,
            sectionAccess: membership.sectionAccess,
            catalogAccess: membership.catalogAccess,
            accessProfileId: membership.accessProfileId,
            isActive: membership.isActive,
          },
        })
      }
    }

    for (const record of stockModuleSettings) {
      await transaction.appStockModuleSettingsRecord.upsert({
        where: { companyId: record.companyId },
        create: record,
        update: record,
      })
    }
  })

  hasSeededAppAdminRecords = true
  await ensureAppUserMembershipRecordsHydrated()
}

async function ensureAppCatalogRecordsSeeded() {
  if (hasSeededAppCatalogRecords) {
    return
  }

  const [productsCount, serviceItemsCount, technicalSheetsCount] = await Promise.all([
    prisma.appProductRecord.count(),
    prisma.appServiceItemRecord.count(),
    prisma.appTechnicalSheetRecord.count(),
  ])

  if (productsCount > 0 || serviceItemsCount > 0 || technicalSheetsCount > 0) {
    hasSeededAppCatalogRecords = true
    return
  }

  const snapshot = await prisma.appStateSnapshot.findUnique({
    where: { key: appStateSnapshotKey },
  })
  const payload = snapshot?.payload
  const entries = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.entries : null
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    hasSeededAppCatalogRecords = true
    return
  }

  const products = parseSeedArray(entries[productsStorageKey], normalizeProductPayload)
  const serviceItems = parseSeedArray(entries[serviceItemsStorageKey], normalizeServiceItemPayload)
  const technicalSheets = parseSeedArray(entries[technicalSheetsStorageKey], normalizeTechnicalSheetPayload)

  await prisma.$transaction(async (transaction) => {
    for (const product of products) {
      await transaction.appProductRecord.upsert({
        where: { id: product.id },
        create: product,
        update: product,
      })
    }

    for (const serviceItem of serviceItems) {
      await transaction.appServiceItemRecord.upsert({
        where: { id: serviceItem.id },
        create: serviceItem,
        update: serviceItem,
      })
    }

    for (const technicalSheet of technicalSheets) {
      await transaction.appTechnicalSheetRecord.upsert({
        where: { id: technicalSheet.id },
        create: technicalSheet,
        update: technicalSheet,
      })
    }
  })

  hasSeededAppCatalogRecords = true
}

async function ensureAppStockCenterRecordsSeeded() {
  if (hasSeededAppStockCenterRecords) {
    return
  }

  await sanitizeLegacyEntitySnapshotIds()

  const stockCentersCount = await prisma.appStockCenterRecord.count()
  if (stockCentersCount > 0) {
    hasSeededAppStockCenterRecords = true
    return
  }

  const snapshot = await prisma.appStateSnapshot.findUnique({
    where: { key: appStateSnapshotKey },
  })
  const payload = snapshot?.payload
  const entries = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.entries : null
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    hasSeededAppStockCenterRecords = true
    return
  }

  const stockCenters = parseSeedArray(entries[stockCentersStorageKey], normalizeStockCenterPayload)

  await prisma.$transaction(async (transaction) => {
    for (const stockCenter of stockCenters) {
      await transaction.appStockCenterRecord.upsert({
        where: { id: stockCenter.id },
        create: stockCenter,
        update: stockCenter,
      })
    }
  })

  hasSeededAppStockCenterRecords = true
}

async function ensureAppRequisitionRecordsSeeded() {
  if (hasSeededAppRequisitionRecords) {
    return
  }

  await sanitizeLegacyEntitySnapshotIds()

  const [requisitionsCount, notificationsCount] = await Promise.all([
    prisma.appRequisitionRecord.count(),
    prisma.appRequisitionNotificationRecord.count(),
  ])
  if (requisitionsCount > 0 || notificationsCount > 0) {
    hasSeededAppRequisitionRecords = true
    return
  }

  const snapshot = await prisma.appStateSnapshot.findUnique({
    where: { key: appStateSnapshotKey },
  })
  const payload = snapshot?.payload
  const entries = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.entries : null
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    hasSeededAppRequisitionRecords = true
    return
  }

  const requisitions = parseSeedArray(entries[requisitionsStorageKey], normalizeRequisitionPayload)
  const notifications = parseSeedArray(entries[requisitionNotificationsStorageKey], normalizeRequisitionNotificationPayload)

  await prisma.$transaction(async (transaction) => {
    for (const requisition of requisitions) {
      await transaction.appRequisitionRecord.upsert({
        where: { id: requisition.id },
        create: requisition,
        update: requisition,
      })
    }

    for (const notification of notifications) {
      await transaction.appRequisitionNotificationRecord.upsert({
        where: { id: notification.id },
        create: notification,
        update: notification,
      })
    }
  })

  hasSeededAppRequisitionRecords = true
}

async function ensureAppProductionRecordsSeeded() {
  if (hasSeededAppProductionRecords) {
    return
  }

  await sanitizeLegacyEntitySnapshotIds()

  const [manualRequestsCount, draftsCount] = await Promise.all([
    prisma.appManualProductionRequestRecord.count(),
    prisma.appProductionDraftRecord.count(),
  ])
  if (manualRequestsCount > 0 || draftsCount > 0) {
    hasSeededAppProductionRecords = true
    return
  }

  const snapshot = await prisma.appStateSnapshot.findUnique({
    where: { key: appStateSnapshotKey },
  })
  const payload = snapshot?.payload
  const entries = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.entries : null
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    hasSeededAppProductionRecords = true
    return
  }

  const manualRequests = parseSeedArray(entries[manualProductionRequestsStorageKey], normalizeManualProductionRequestPayload)
  const drafts = parseSeedArray(entries[productionInProgressDraftsStorageKey], normalizeProductionDraftPayload)

  await prisma.$transaction(async (transaction) => {
    for (const productionRequest of manualRequests) {
      await transaction.appManualProductionRequestRecord.upsert({
        where: { id: productionRequest.id },
        create: productionRequest,
        update: productionRequest,
      })
    }

    for (const draft of drafts) {
      await transaction.appProductionDraftRecord.upsert({
        where: { draftId: draft.draftId },
        create: draft,
        update: draft,
      })
    }
  })

  hasSeededAppProductionRecords = true
}

async function ensureAppInventoryRecordsSeeded() {
  if (hasSeededAppInventoryRecords) {
    return
  }

  await sanitizeLegacyEntitySnapshotIds()

  const [locationsCount, activeRecordLinksCount, inventoriesCount, sessionsCount, activeSessionLinksCount, countsCount, pendingMovementsCount] = await Promise.all([
    prisma.appInventoryStorageLocationRecord.count(),
    prisma.appInventoryActiveRecordLinkRecord.count(),
    prisma.appInventoryRecord.count(),
    prisma.appInventoryCountSessionRecord.count(),
    prisma.appInventoryActiveSessionLinkRecord.count(),
    prisma.appInventoryCountRecord.count(),
    prisma.appPendingInventoryMovementRecord.count(),
  ])
  if (
    locationsCount > 0 ||
    activeRecordLinksCount > 0 ||
    inventoriesCount > 0 ||
    sessionsCount > 0 ||
    activeSessionLinksCount > 0 ||
    countsCount > 0 ||
    pendingMovementsCount > 0
  ) {
    hasSeededAppInventoryRecords = true
    return
  }

  const snapshot = await prisma.appStateSnapshot.findUnique({
    where: { key: appStateSnapshotKey },
  })
  const payload = snapshot?.payload
  const entries = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.entries : null
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    hasSeededAppInventoryRecords = true
    return
  }

  const locations = parseSeedArray(entries[inventoryStorageLocationsStorageKey], normalizeInventoryStorageLocationPayload)
  const activeRecordLinks = parseSeedArray(entries[inventoryActiveRecordsStorageKey], normalizeInventoryActiveRecordLinkPayload)
  const inventories = parseSeedArray(entries[inventoryRecordsStorageKey], normalizeInventoryPayload)
  const sessions = parseSeedArray(entries[inventoryCountSessionsStorageKey], normalizeInventoryCountSessionPayload)
  const activeSessionLinks = parseSeedArray(entries[inventoryActiveSessionsStorageKey], normalizeInventoryActiveSessionLinkPayload)
  const counts = parseSeedArray(entries[inventoryCountsStorageKey], normalizeInventoryCountPayload)
  const pendingMovements = parseSeedArray(entries[pendingInventoryMovementsStorageKey], normalizePendingInventoryMovementPayload)

  await prisma.$transaction(async (transaction) => {
    for (const location of locations) {
      await transaction.appInventoryStorageLocationRecord.upsert({
        where: { companyId_name: { companyId: location.companyId, name: location.name } },
        create: location,
        update: location,
      })
    }

    for (const inventory of inventories) {
      await transaction.appInventoryRecord.upsert({
        where: { id: inventory.id },
        create: inventory,
        update: inventory,
      })
    }

    for (const link of activeRecordLinks) {
      await transaction.appInventoryActiveRecordLinkRecord.upsert({
        where: { companyId_userKey: { companyId: link.companyId, userKey: link.userKey } },
        create: link,
        update: link,
      })
    }

    for (const session of sessions) {
      await transaction.appInventoryCountSessionRecord.upsert({
        where: { id: session.id },
        create: session,
        update: session,
      })
    }

    for (const link of activeSessionLinks) {
      await transaction.appInventoryActiveSessionLinkRecord.upsert({
        where: { companyId_userKey: { companyId: link.companyId, userKey: link.userKey } },
        create: link,
        update: link,
      })
    }

    for (const count of counts) {
      await transaction.appInventoryCountRecord.upsert({
        where: { id: count.id },
        create: count,
        update: count,
      })
    }

    for (const movement of pendingMovements) {
      await transaction.appPendingInventoryMovementRecord.upsert({
        where: { id: movement.id },
        create: movement,
        update: movement,
      })
    }
  })

  hasSeededAppInventoryRecords = true
}

function parseSeedArray(rawValue, normalizer) {
  if (typeof rawValue !== 'string') {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map((entry) => normalizer(entry)).filter((entry) => entry !== null)
  } catch {
    return []
  }
}
