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
const productsStorageKey = 'gestor-estoque:products'
const serviceItemsStorageKey = 'gestor-estoque:service-items'
const technicalSheetsStorageKey = 'gestor-estoque:technical-sheets'
let hasSeededAppAdminRecords = false
let hasSeededAppCatalogRecords = false

app.use(cors())
app.use(express.json({ limit: '5mb' }))

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

app.post('/api/companies', async (request, response) => {
  const company = normalizeCompanyPayload(request.body)
  if (!company) {
    response.status(400).json({ error: 'Payload de empresa invalido.' })
    return
  }

  const saved = await prisma.appCompanyRecord.upsert({
    where: { id: company.id },
    create: company,
    update: company,
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

  const saved = await prisma.appCompanyRecord.upsert({
    where: { id: companyId },
    create: company,
    update: company,
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

    await transaction.appAccessProfileRecord.deleteMany({ where: { companyId } })
    await transaction.appStockModuleSettingsRecord.deleteMany({ where: { companyId } })
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
  })
  response.json({ users })
})

app.post('/api/users', async (request, response) => {
  const user = normalizeUserPayload(request.body)
  if (!user) {
    response.status(400).json({ error: 'Payload de usuario invalido.' })
    return
  }

  const saved = await prisma.appUserRecord.upsert({
    where: { id: user.id },
    create: user,
    update: user,
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

  const saved = await prisma.appUserRecord.upsert({
    where: { id: userId },
    create: user,
    update: user,
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
  response.json({ technicalSheets })
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

  return {
    id,
    fullName: user.fullName,
    username: user.username,
    password: user.password,
    role,
    companyId,
    companyIds,
    sectors,
    sectionAccess: user.sectionAccess,
    catalogAccess: user.catalogAccess,
    accessProfileId,
    isActive: user.isActive,
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
  }
}

function normalizeProductPayload(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const product = value
  if (
    typeof product.id !== 'string' ||
    typeof product.companyId !== 'number' ||
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
  if (
    typeof sheet.id !== 'number' ||
    typeof sheet.companyId !== 'number' ||
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

  return {
    id: sheet.id,
    companyId: sheet.companyId,
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
    yieldDifferenceDestination: sheet.yieldDifferenceDestination,
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

async function ensureAppAdminRecordsSeeded() {
  if (hasSeededAppAdminRecords) {
    return
  }

  const [companiesCount, usersCount, accessProfilesCount, stockModuleSettingsCount] = await Promise.all([
    prisma.appCompanyRecord.count(),
    prisma.appUserRecord.count(),
    prisma.appAccessProfileRecord.count(),
    prisma.appStockModuleSettingsRecord.count(),
  ])

  if (companiesCount > 0 || usersCount > 0 || accessProfilesCount > 0 || stockModuleSettingsCount > 0) {
    hasSeededAppAdminRecords = true
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
      await transaction.appUserRecord.upsert({
        where: { id: user.id },
        create: user,
        update: user,
      })
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
