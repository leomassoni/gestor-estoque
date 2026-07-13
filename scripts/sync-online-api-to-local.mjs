const REMOTE_BASE_URL =
  process.env.GESTOR_REMOTE_BASE_URL?.trim() || 'https://gestor-estoque-zqw9.onrender.com/api'
const LOCAL_BASE_URL = process.env.GESTOR_LOCAL_BASE_URL?.trim() || 'http://localhost:4001/api'

const ENTITY_ENDPOINTS = [
  ['companies', 'companies'],
  ['access-profiles', 'accessProfiles'],
  ['users', 'users'],
  ['stock-module-settings', 'settings'],
  ['stock-centers', 'stockCenters'],
  ['flavor-profiles', 'flavorProfiles'],
  ['sales-import-templates', 'templates'],
  ['sales-import-batches', 'batches'],
  ['sales-import-rows', 'rows'],
  ['sales-consumptions', 'consumptions'],
  ['requisitions', 'requisitions'],
  ['requisition-notifications', 'notifications'],
  ['manual-production-requests', 'manualProductionRequests'],
  ['production-drafts', 'drafts'],
  ['inventory-storage-locations', 'locations'],
  ['inventories', 'inventories'],
  ['inventory-active-record-links', 'links'],
  ['inventory-count-sessions', 'sessions'],
  ['inventory-active-session-links', 'links'],
  ['inventory-counts', 'counts'],
  ['waste-sessions', 'wasteSessions'],
  ['waste-records', 'wasteRecords'],
  ['pending-inventory-movements', 'movements'],
  ['products', 'products'],
  ['service-items', 'serviceItems'],
  ['technical-sheets', 'technicalSheets'],
]

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url}: ${response.status}`)
  }
  return response.json()
}

async function postEntity(endpoint, payload) {
  const usesIdRoute = endpoint === 'waste-sessions' || endpoint === 'waste-records' || endpoint === 'pending-inventory-movements'
  const targetUrl = usesIdRoute ? `${LOCAL_BASE_URL}/${endpoint}/${payload.id}` : `${LOCAL_BASE_URL}/${endpoint}`
  const response = await fetch(targetUrl, {
    method: usesIdRoute ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao salvar ${endpoint}: ${response.status} ${text.slice(0, 600)}`)
  }
}

async function main() {
  console.log(`Sincronizando ${REMOTE_BASE_URL} -> ${LOCAL_BASE_URL}`)
  const warnings = []

  for (const [endpoint, key] of ENTITY_ENDPOINTS) {
    try {
      const remotePayload = await fetchJson(`${REMOTE_BASE_URL}/${endpoint}`)
      const items = Array.isArray(remotePayload?.[key]) ? remotePayload[key] : []
      console.log(`${endpoint}: ${items.length}`)

      let processed = 0
      for (const item of items) {
        await postEntity(endpoint, item)
        processed += 1
        if (processed % 100 === 0) {
          console.log(`${endpoint}: ${processed}/${items.length}`)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warnings.push(`${endpoint}: ${message}`)
      console.warn(`Aviso em ${endpoint}: ${message}`)
    }
  }

  if (warnings.length > 0) {
    console.log('Sincronizacao concluida com avisos:')
    warnings.forEach((warning) => console.log(`- ${warning}`))
    return
  }

  console.log('Sincronizacao concluida.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
