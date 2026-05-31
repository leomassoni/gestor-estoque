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
let hasSeededAppAdminRecords = false

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
