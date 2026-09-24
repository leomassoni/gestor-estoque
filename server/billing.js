const crypto = require('node:crypto')

const provider = 'ASAAS'
const billingSeedSnapshotKey = 'billing-defaults-seeded'
const defaultCurrency = 'BRL'

const subscriptionStatuses = new Set([
  'TRIAL',
  'GRACE',
  'ACTIVE',
  'PAST_DUE',
  'BLOCKED',
  'CANCELLED',
  'LIFETIME_FREE',
  'SCHEDULED_FOR_DELETION',
])

const billingCycles = new Set(['FORTNIGHTLY', 'MONTHLY', 'SEMIANNUAL', 'ANNUAL'])

const asaasCycleByBillingCycle = {
  FORTNIGHTLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
  SEMIANNUAL: 'SEMIANNUALLY',
  ANNUAL: 'YEARLY',
}

const defaultPlans = [
  {
    id: 'ESSENTIAL',
    name: 'Essencial',
    description: 'Ficha tecnica, CMV, estoque e inventario para uma operacao enxuta.',
    tier: 'ESSENTIAL',
    monthlyPriceCents: 24900,
    fortnightlyPriceCents: 14900,
    semiannualPriceCents: 126900,
    annualPriceCents: 239000,
    isActive: true,
  },
  {
    id: 'PROFESSIONAL',
    name: 'Profissional',
    description: 'Fluxo completo com requisicoes, producao, compras e importacao de vendas.',
    tier: 'PROFESSIONAL',
    monthlyPriceCents: 49900,
    fortnightlyPriceCents: 29900,
    semiannualPriceCents: 254400,
    annualPriceCents: 479000,
    isActive: true,
  },
  {
    id: 'GROUP',
    name: 'Grupo',
    description: 'Multiempresa, compartilhamento de producao e rastreio de custos entre casas.',
    tier: 'GROUP',
    monthlyPriceCents: 89900,
    fortnightlyPriceCents: 53900,
    semiannualPriceCents: 458500,
    annualPriceCents: 863000,
    isActive: true,
  },
]

function parseInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function centsFromValue(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.round(parsed * 100)
}

function getPlanPriceCents(plan, billingCycle) {
  if (!plan) {
    return 0
  }
  if (billingCycle === 'FORTNIGHTLY') {
    return plan.fortnightlyPriceCents
  }
  if (billingCycle === 'SEMIANNUAL') {
    return plan.semiannualPriceCents
  }
  if (billingCycle === 'ANNUAL') {
    return plan.annualPriceCents
  }
  return plan.monthlyPriceCents
}

function calculateContractedPriceCents(basePriceCents, discountPercent) {
  const discount = Math.min(Math.max(Number(discountPercent) || 0, 0), 100)
  return Math.max(Math.round(basePriceCents * (1 - discount / 100)), 0)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function normalizeDateOrNull(value) {
  if (!value) {
    return null
  }
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isSubscriptionOperationallyActive(subscription, now = new Date()) {
  if (!subscription) {
    return false
  }
  if (subscription.lifetimeAccess || subscription.status === 'LIFETIME_FREE') {
    return true
  }
  if (subscription.status === 'ACTIVE') {
    return true
  }
  if (subscription.status === 'TRIAL' && subscription.trialEndsAt && subscription.trialEndsAt >= now) {
    return true
  }
  if (subscription.status === 'GRACE' && subscription.graceEndsAt && subscription.graceEndsAt >= now) {
    return true
  }
  return false
}

function isSubscriptionReadOnly(subscription, now = new Date()) {
  if (!subscription) {
    return true
  }
  if (subscription.status === 'GRACE' && subscription.graceEndsAt && subscription.graceEndsAt >= now) {
    return true
  }
  return !isSubscriptionOperationallyActive(subscription, now)
}

function normalizeSubscriptionStatus(value) {
  return subscriptionStatuses.has(value) ? value : 'TRIAL'
}

function normalizeBillingCycle(value) {
  return billingCycles.has(value) ? value : 'MONTHLY'
}

function serializeBillingRecord(record) {
  if (!record) {
    return null
  }
  return {
    ...record,
    trialStartedAt: record.trialStartedAt?.toISOString?.() ?? null,
    trialEndsAt: record.trialEndsAt?.toISOString?.() ?? null,
    graceEndsAt: record.graceEndsAt?.toISOString?.() ?? null,
    currentPeriodStartedAt: record.currentPeriodStartedAt?.toISOString?.() ?? null,
    currentPeriodEndsAt: record.currentPeriodEndsAt?.toISOString?.() ?? null,
    dataDeletionScheduledAt: record.dataDeletionScheduledAt?.toISOString?.() ?? null,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    createdAtRecord: record.createdAtRecord?.toISOString?.() ?? record.createdAtRecord,
    processedAt: record.processedAt?.toISOString?.() ?? record.processedAt,
  }
}

async function seedSubscriptionPlans(prisma) {
  for (const plan of defaultPlans) {
    await prisma.appSubscriptionPlanRecord.upsert({
      where: { id: plan.id },
      create: plan,
      update: plan,
    })
  }
}

async function ensureBillingDefaults(prisma) {
  await seedSubscriptionPlans(prisma)

  const seeded = await prisma.appStateSnapshot.findUnique({ where: { key: billingSeedSnapshotKey } })
  if (seeded) {
    return
  }

  const companies = await prisma.appCompanyRecord.findMany({ select: { id: true } })
  for (const company of companies) {
    await prisma.appCompanySubscriptionRecord.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        planId: 'GROUP',
        status: 'LIFETIME_FREE',
        billingCycle: 'MONTHLY',
        lifetimeAccess: true,
        notes: 'Acesso vitalicio free concedido automaticamente aos usuarios/empresas existentes antes da cobranca.',
      },
      update: {},
    })
  }

  await prisma.appStateSnapshot.upsert({
    where: { key: billingSeedSnapshotKey },
    create: {
      key: billingSeedSnapshotKey,
      payload: { seededAt: new Date().toISOString(), companyIds: companies.map((company) => company.id) },
    },
    update: {
      payload: { seededAt: new Date().toISOString(), companyIds: companies.map((company) => company.id) },
    },
  })
}

async function createTrialSubscriptionForCompany(prisma, companyId, options = {}) {
  const now = new Date()
  const trialEndsAt = addDays(now, 15)
  const graceEndsAt = addDays(trialEndsAt, 5)
  const planId = options.planId || 'PROFESSIONAL'
  const plan = await prisma.appSubscriptionPlanRecord.findUnique({ where: { id: planId } })
  const billingCycle = normalizeBillingCycle(options.billingCycle || 'MONTHLY')
  const basePriceCents = getPlanPriceCents(plan, billingCycle)
  const discountPercent = Math.min(Math.max(Number(options.discountPercent) || 0, 0), 100)
  const contractedPriceCents = calculateContractedPriceCents(basePriceCents, discountPercent)

  return prisma.appCompanySubscriptionRecord.upsert({
    where: { companyId },
    create: {
      companyId,
      planId,
      status: 'TRIAL',
      billingCycle,
      basePriceCents,
      discountPercent,
      contractedPriceCents,
      trialStartedAt: now,
      trialEndsAt,
      graceEndsAt,
      currentPeriodStartedAt: now,
      currentPeriodEndsAt: trialEndsAt,
      founderPromotion: options.founderPromotion === true,
      feedbackParticipant: options.feedbackParticipant === true,
      notes: options.notes || 'Trial irrestrito por 15 dias com 5 dias de carencia.',
    },
    update: {},
  })
}

function getAsaasConfig() {
  const apiKey = normalizeText(process.env.ASAAS_API_KEY)
  const apiBaseUrl = normalizeText(process.env.ASAAS_API_BASE_URL || 'https://api.asaas.com/v3').replace(/\/$/, '')
  const environment = normalizeText(process.env.ASAAS_ENV || 'production')
  return {
    configured: Boolean(apiKey),
    environment,
    apiBaseUrl,
    apiKey,
  }
}

async function asaasRequest(path, { method = 'GET', body = null } = {}) {
  const config = getAsaasConfig()
  if (!config.configured) {
    const error = new Error('ASAAS_API_KEY nao configurada no servidor.')
    error.statusCode = 503
    throw error
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      access_token: config.apiKey,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const firstError = Array.isArray(data?.errors) ? data.errors[0]?.description : null
    const error = new Error(firstError || data?.message || `Asaas retornou HTTP ${response.status}.`)
    error.statusCode = response.status
    error.providerResponse = data
    throw error
  }
  return data
}

function buildAsaasExternalReference(companyId) {
  return `gestor-estoque:company:${companyId}`
}

function resolveAsaasPaymentUrl(payment) {
  return (
    normalizeText(payment?.invoiceUrl) ||
    normalizeText(payment?.bankSlipUrl) ||
    normalizeText(payment?.transactionReceiptUrl) ||
    normalizeText(payment?.pixQrCode?.payload)
  )
}

function buildWebhookEventKey(payload) {
  const eventType = normalizeText(payload?.event) || 'UNKNOWN'
  const paymentId = normalizeText(payload?.payment?.id)
  const subscriptionId = normalizeText(payload?.subscription?.id || payload?.payment?.subscription)
  const dateCreated = normalizeText(payload?.dateCreated || payload?.payment?.dateCreated || payload?.payment?.clientPaymentDate)
  const fingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload ?? {}))
    .digest('hex')
    .slice(0, 16)
  return [eventType, paymentId, subscriptionId, dateCreated, fingerprint].filter(Boolean).join(':')
}

function centsFromAsaasValue(value) {
  return centsFromValue(value ?? 0)
}

async function upsertBillingPaymentFromAsaas(prisma, payment, companyIdFallback = null) {
  if (!payment?.id) {
    return null
  }
  const externalReference = normalizeText(payment.externalReference)
  const companyId =
    parseInteger(externalReference.split(':').at(-1)) ??
    companyIdFallback ??
    null
  if (companyId === null) {
    return null
  }

  return prisma.appBillingPaymentRecord.upsert({
    where: {
      provider_providerPaymentId: {
        provider,
        providerPaymentId: payment.id,
      },
    },
    create: {
      companyId,
      provider,
      providerPaymentId: payment.id,
      providerCustomerId: normalizeText(payment.customer),
      providerSubscriptionId: normalizeText(payment.subscription),
      status: normalizeText(payment.status) || 'UNKNOWN',
      billingType: normalizeText(payment.billingType),
      valueCents: centsFromAsaasValue(payment.value),
      netValueCents: payment.netValue === null || payment.netValue === undefined ? null : centsFromAsaasValue(payment.netValue),
      dueDate: normalizeText(payment.dueDate),
      paidAt: normalizeText(payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate),
      invoiceUrl: resolveAsaasPaymentUrl(payment),
      externalReference,
      raw: payment,
    },
    update: {
      companyId,
      providerCustomerId: normalizeText(payment.customer),
      providerSubscriptionId: normalizeText(payment.subscription),
      status: normalizeText(payment.status) || 'UNKNOWN',
      billingType: normalizeText(payment.billingType),
      valueCents: centsFromAsaasValue(payment.value),
      netValueCents: payment.netValue === null || payment.netValue === undefined ? null : centsFromAsaasValue(payment.netValue),
      dueDate: normalizeText(payment.dueDate),
      paidAt: normalizeText(payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate),
      invoiceUrl: resolveAsaasPaymentUrl(payment),
      externalReference,
      raw: payment,
    },
  })
}

async function updateSubscriptionFromPayment(prisma, payment, companyIdFallback = null) {
  const paymentStatus = normalizeText(payment?.status)
  const externalReference = normalizeText(payment?.externalReference)
  const companyId =
    parseInteger(externalReference.split(':').at(-1)) ??
    companyIdFallback ??
    null
  if (companyId === null) {
    return null
  }

  const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(paymentStatus)
  const isOverdue = ['OVERDUE'].includes(paymentStatus)
  const isRefundedOrCancelled = ['REFUNDED', 'REFUND_REQUESTED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'DELETED'].includes(paymentStatus)

  const current = await prisma.appCompanySubscriptionRecord.findUnique({ where: { companyId } })
  if (!current) {
    return null
  }

  const nextStatus = current.lifetimeAccess
    ? 'LIFETIME_FREE'
    : isPaid
      ? 'ACTIVE'
      : isOverdue
        ? 'PAST_DUE'
        : isRefundedOrCancelled
          ? 'BLOCKED'
          : current.status

  return prisma.appCompanySubscriptionRecord.update({
    where: { companyId },
    data: {
      status: nextStatus,
      lastPaymentStatus: paymentStatus || current.lastPaymentStatus,
      asaasCustomerId: normalizeText(payment?.customer) || current.asaasCustomerId,
      asaasSubscriptionId: normalizeText(payment?.subscription) || current.asaasSubscriptionId,
      currentPeriodStartedAt: isPaid ? new Date() : current.currentPeriodStartedAt,
      currentPeriodEndsAt: isPaid ? normalizeDateOrNull(payment?.dueDate) ?? current.currentPeriodEndsAt : current.currentPeriodEndsAt,
    },
  })
}

function registerBillingWebhook(app, prisma) {
  app.post('/api/billing/asaas/webhook', async (request, response) => {
    const expectedToken = normalizeText(process.env.ASAAS_WEBHOOK_AUTH_TOKEN)
    const receivedToken = normalizeText(request.headers['asaas-access-token'])
    if (!expectedToken) {
      response.status(503).json({ error: 'Token do webhook Asaas nao configurado.' })
      return
    }
    if (receivedToken !== expectedToken) {
      response.status(401).json({ error: 'Webhook Asaas nao autorizado.' })
      return
    }

    const payload = request.body && typeof request.body === 'object' ? request.body : {}
    const eventType = normalizeText(payload.event) || 'UNKNOWN'
    const payment = payload.payment && typeof payload.payment === 'object' ? payload.payment : null
    const subscription = payload.subscription && typeof payload.subscription === 'object' ? payload.subscription : null
    const providerPaymentId = normalizeText(payment?.id)
    const providerSubscriptionId = normalizeText(subscription?.id || payment?.subscription)
    const externalReference = normalizeText(payment?.externalReference || subscription?.externalReference)
    const companyId = parseInteger(externalReference.split(':').at(-1))
    const providerEventKey = buildWebhookEventKey(payload)

    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.appBillingEventRecord.upsert({
          where: {
            provider_providerEventKey: {
              provider,
              providerEventKey,
            },
          },
          create: {
            provider,
            providerEventKey,
            eventType,
            companyId,
            providerPaymentId,
            providerSubscriptionId,
            externalReference,
            result: 'RECEIVED',
            raw: payload,
          },
          update: {
            eventType,
            companyId,
            providerPaymentId,
            providerSubscriptionId,
            externalReference,
            result: 'RECEIVED',
            errorMessage: '',
            raw: payload,
            processedAt: new Date(),
          },
        })
      })

      if (payment) {
        await upsertBillingPaymentFromAsaas(prisma, payment, companyId)
        await updateSubscriptionFromPayment(prisma, payment, companyId)
      }

      await prisma.appBillingEventRecord.update({
        where: {
          provider_providerEventKey: {
            provider,
            providerEventKey,
          },
        },
        data: { result: 'PROCESSED', errorMessage: '', processedAt: new Date() },
      })
      response.json({ ok: true })
    } catch (error) {
      await prisma.appBillingEventRecord
        .upsert({
          where: {
            provider_providerEventKey: {
              provider,
              providerEventKey,
            },
          },
          create: {
            provider,
            providerEventKey,
            eventType,
            companyId,
            providerPaymentId,
            providerSubscriptionId,
            externalReference,
            result: 'ERROR',
            errorMessage: error instanceof Error ? error.message : 'Erro ao processar webhook Asaas.',
            raw: payload,
          },
          update: {
            result: 'ERROR',
            errorMessage: error instanceof Error ? error.message : 'Erro ao processar webhook Asaas.',
            raw: payload,
            processedAt: new Date(),
          },
        })
        .catch(() => null)
      response.status(500).json({ error: 'Erro ao processar webhook Asaas.' })
    }
  })
}

async function normalizeSubscriptionInput(prisma, companyId, body) {
  const status = normalizeSubscriptionStatus(body?.status)
  const billingCycle = normalizeBillingCycle(body?.billingCycle)
  const planId = normalizeText(body?.planId) || 'PROFESSIONAL'
  const plan = await prisma.appSubscriptionPlanRecord.findUnique({ where: { id: planId } })
  if (!plan) {
    const error = new Error('Plano de assinatura nao encontrado.')
    error.statusCode = 400
    throw error
  }
  const discountPercent = Math.min(Math.max(parseInteger(body?.discountPercent) ?? 0, 0), 100)
  const lifetimeAccess = body?.lifetimeAccess === true || status === 'LIFETIME_FREE'
  const basePriceCents = lifetimeAccess ? 0 : getPlanPriceCents(plan, billingCycle)
  const contractedPriceCents = lifetimeAccess ? 0 : calculateContractedPriceCents(basePriceCents, discountPercent)

  return {
    companyId,
    planId,
    status: lifetimeAccess ? 'LIFETIME_FREE' : status,
    billingCycle,
    basePriceCents,
    discountPercent: lifetimeAccess ? 100 : discountPercent,
    contractedPriceCents,
    currency: defaultCurrency,
    trialStartedAt: normalizeDateOrNull(body?.trialStartedAt),
    trialEndsAt: normalizeDateOrNull(body?.trialEndsAt),
    graceEndsAt: normalizeDateOrNull(body?.graceEndsAt),
    currentPeriodStartedAt: normalizeDateOrNull(body?.currentPeriodStartedAt),
    currentPeriodEndsAt: normalizeDateOrNull(body?.currentPeriodEndsAt),
    lifetimeAccess,
    founderPromotion: body?.founderPromotion === true,
    feedbackParticipant: body?.feedbackParticipant === true,
    dataDeletionScheduledAt: normalizeDateOrNull(body?.dataDeletionScheduledAt),
    notes: normalizeText(body?.notes),
  }
}

function registerBillingRoutes(app, prisma, { requireSystemAdmin }) {
  app.get('/api/billing/asaas/status', requireSystemAdmin, (_request, response) => {
    const config = getAsaasConfig()
    response.json({
      configured: config.configured,
      environment: config.environment,
      apiBaseUrl: config.apiBaseUrl,
      webhookTokenConfigured: Boolean(normalizeText(process.env.ASAAS_WEBHOOK_AUTH_TOKEN)),
    })
  })

  app.get('/api/billing/plans', requireSystemAdmin, async (_request, response) => {
    await ensureBillingDefaults(prisma)
    const plans = await prisma.appSubscriptionPlanRecord.findMany({ orderBy: [{ monthlyPriceCents: 'asc' }] })
    response.json({ plans })
  })

  app.get('/api/billing/subscriptions', requireSystemAdmin, async (_request, response) => {
    await ensureBillingDefaults(prisma)
    const [subscriptions, payments, events] = await Promise.all([
      prisma.appCompanySubscriptionRecord.findMany({ orderBy: [{ companyId: 'asc' }] }),
      prisma.appBillingPaymentRecord.findMany({ orderBy: [{ createdAtRecord: 'desc' }], take: 200 }),
      prisma.appBillingEventRecord.findMany({ orderBy: [{ processedAt: 'desc' }], take: 200 }),
    ])
    response.json({
      subscriptions: subscriptions.map(serializeBillingRecord),
      payments: payments.map(serializeBillingRecord),
      events: events.map(serializeBillingRecord),
    })
  })

  app.put('/api/billing/subscriptions/:companyId', requireSystemAdmin, async (request, response) => {
    await ensureBillingDefaults(prisma)
    const companyId = parseInteger(request.params.companyId)
    if (companyId === null) {
      response.status(400).json({ error: 'Empresa invalida.' })
      return
    }
    const company = await prisma.appCompanyRecord.findUnique({ where: { id: companyId } })
    if (!company) {
      response.status(404).json({ error: 'Empresa nao encontrada.' })
      return
    }

    try {
      const normalized = await normalizeSubscriptionInput(prisma, companyId, request.body)
      const existing = await prisma.appCompanySubscriptionRecord.findUnique({ where: { companyId } })
      const saved = await prisma.appCompanySubscriptionRecord.upsert({
        where: { companyId },
        create: normalized,
        update: {
          ...normalized,
          asaasCustomerId: existing?.asaasCustomerId ?? '',
          asaasSubscriptionId: existing?.asaasSubscriptionId ?? '',
          lastPaymentStatus: existing?.lastPaymentStatus ?? '',
        },
      })
      response.json({ subscription: serializeBillingRecord(saved) })
    } catch (error) {
      response.status(error.statusCode ?? 500).json({ error: error.message ?? 'Erro ao salvar assinatura.' })
    }
  })

  app.post('/api/billing/subscriptions/:companyId/trial', requireSystemAdmin, async (request, response) => {
    await ensureBillingDefaults(prisma)
    const companyId = parseInteger(request.params.companyId)
    if (companyId === null) {
      response.status(400).json({ error: 'Empresa invalida.' })
      return
    }
    const saved = await createTrialSubscriptionForCompany(prisma, companyId, request.body ?? {})
    response.json({ subscription: serializeBillingRecord(saved) })
  })

  app.post('/api/billing/subscriptions/:companyId/asaas', requireSystemAdmin, async (request, response) => {
    await ensureBillingDefaults(prisma)
    const companyId = parseInteger(request.params.companyId)
    if (companyId === null) {
      response.status(400).json({ error: 'Empresa invalida.' })
      return
    }
    const [company, subscription] = await Promise.all([
      prisma.appCompanyRecord.findUnique({ where: { id: companyId } }),
      prisma.appCompanySubscriptionRecord.findUnique({ where: { companyId } }),
    ])
    if (!company || !subscription) {
      response.status(404).json({ error: 'Empresa ou assinatura nao encontrada.' })
      return
    }
    if (subscription.lifetimeAccess || subscription.status === 'LIFETIME_FREE') {
      response.status(400).json({ error: 'Empresa com acesso vitalicio free nao precisa de cobranca Asaas.' })
      return
    }
    if (subscription.contractedPriceCents <= 0) {
      response.status(400).json({ error: 'Assinatura sem valor contratado para cobranca.' })
      return
    }

    try {
      let asaasCustomerId = subscription.asaasCustomerId
      if (!asaasCustomerId) {
        const cnpj = company.cnpj.replace(/\D/g, '')
        const customer = await asaasRequest('/customers', {
          method: 'POST',
          body: {
            name: company.tradeName || company.legalName,
            ...(cnpj.length === 11 || cnpj.length === 14 ? { cpfCnpj: cnpj } : {}),
            externalReference: buildAsaasExternalReference(company.id),
          },
        })
        asaasCustomerId = customer.id
      }

      const nextDueDate =
        normalizeText(request.body?.nextDueDate) ||
        toIsoDate(normalizeDateOrNull(subscription.currentPeriodEndsAt) ?? new Date())
      const billingType = normalizeText(request.body?.billingType) || 'UNDEFINED'
      const asaasSubscription = await asaasRequest('/subscriptions', {
        method: 'POST',
        body: {
          customer: asaasCustomerId,
          billingType,
          value: subscription.contractedPriceCents / 100,
          nextDueDate,
          cycle: asaasCycleByBillingCycle[subscription.billingCycle] ?? 'MONTHLY',
          description: `Gestor-Estoque - ${subscription.planId} - ${company.tradeName || company.legalName}`,
          externalReference: buildAsaasExternalReference(company.id),
        },
      })
      const payments = await asaasRequest(`/payments?subscription=${encodeURIComponent(asaasSubscription.id)}&limit=1`)
      const firstPayment = Array.isArray(payments?.data) ? payments.data[0] ?? null : null
      const savedPayment = firstPayment ? await upsertBillingPaymentFromAsaas(prisma, firstPayment, company.id) : null
      const saved = await prisma.appCompanySubscriptionRecord.update({
        where: { companyId },
        data: {
          asaasCustomerId,
          asaasSubscriptionId: asaasSubscription.id,
          lastPaymentStatus: normalizeText(firstPayment?.status),
        },
      })
      response.json({
        subscription: serializeBillingRecord(saved),
        asaasSubscriptionId: asaasSubscription.id,
        paymentUrl: savedPayment?.invoiceUrl || resolveAsaasPaymentUrl(firstPayment),
        payment: savedPayment ? serializeBillingRecord(savedPayment) : null,
      })
    } catch (error) {
      response.status(error.statusCode ?? 500).json({ error: error.message ?? 'Erro ao criar cobranca Asaas.' })
    }
  })
}

function createBillingAccessMiddleware(prisma) {
  return async (request, response, next) => {
    if (request.auth?.kind !== 'appUser') {
      next()
      return
    }
    if (request.path.startsWith('/billing/') || request.path.startsWith('/auth/')) {
      next()
      return
    }

    const companyIds = Array.from(
      new Set(
        [
          ...(Array.isArray(request.auth.user.companyIds) ? request.auth.user.companyIds : []),
          ...(typeof request.auth.user.companyId === 'number' ? [request.auth.user.companyId] : []),
          ...(Array.isArray(request.auth.user.memberships)
            ? request.auth.user.memberships.filter((membership) => membership.isActive !== false).map((membership) => membership.companyId)
            : []),
        ].filter((companyId) => typeof companyId === 'number'),
      ),
    )
    if (companyIds.length === 0) {
      response.status(403).json({ error: 'Usuario sem empresa vinculada.' })
      return
    }

    const subscriptions = await prisma.appCompanySubscriptionRecord.findMany({ where: { companyId: { in: companyIds } } })
    const now = new Date()
    const hasAnyOperationalAccess = subscriptions.some((subscription) => isSubscriptionOperationallyActive(subscription, now))
    if (!hasAnyOperationalAccess) {
      response.status(402).json({ error: 'Assinatura vencida ou bloqueada.' })
      return
    }

    if (request.method !== 'GET' && subscriptions.every((subscription) => isSubscriptionReadOnly(subscription, now))) {
      response.status(402).json({ error: 'Assinatura em carencia ou bloqueada. Regularize para salvar alteracoes.' })
      return
    }

    next()
  }
}

module.exports = {
  createBillingAccessMiddleware,
  createTrialSubscriptionForCompany,
  ensureBillingDefaults,
  registerBillingRoutes,
  registerBillingWebhook,
}
