const EPSILON = 1e-8

function parseStockDecimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  let text = value.trim().replace(/\s/g, '')
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '')
  const number = /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN
  return Number.isFinite(number) ? number : null
}

function stockDecimal(value) {
  return Number(value.toFixed(9)).toString().replace('.', ',')
}

function isStockDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

function inventoryKey(record) {
  if (record.technicalSheetId) return `${record.technicalSheetKind === 'VENDA' ? 'PREPARO' : record.technicalSheetKind}:${record.technicalSheetId}`
  return record.productId ? `PRODUTO:${record.productId}` : `ITEM:${record.serviceItemId}`
}

function movementSign(location) {
  if (['SAIDA PARA PRODUCAO', 'SAIDA PARA REQUISICAO', 'SAIDA POR VENDAS IMPORTADAS'].includes(location) ||
      location.startsWith('SAIDA POR DESPERDICIO')) return -1
  if (['ENTRADA DE PRODUCAO', 'ESTORNO DE VENDAS IMPORTADAS', 'RECEBIMENTO DE REQUISICAO'].includes(location)) return 1
  return 0
}

function buildInventoryLedger({ inventories, sessions, counts }) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const events = inventories.filter((inventory) => inventory.isClosed).map((inventory) => {
    const quantities = new Map()
    for (const record of counts.filter((item) => item.inventoryId === inventory.id && !movementSign(item.storageLocation))) {
      const key = inventoryKey(record)
      quantities.set(key, (quantities.get(key) ?? 0) + (parseStockDecimal(record.totalCountedQuantity) ?? 0))
    }
    return { kind: 'INVENTORY', date: inventory.countedAt, timestamp: inventory.startedAt || inventory.closedAt,
      id: inventory.id, quantities }
  })
  for (const record of counts) {
    const sign = movementSign(record.storageLocation)
    if (!sign) continue
    events.push({ kind: 'MOVEMENT', date: record.countedAt,
      timestamp: sessionById.get(record.sessionId)?.closedAt || record.countedAt, id: record.id,
      key: inventoryKey(record), quantity: sign * Math.abs(parseStockDecimal(record.totalCountedQuantity) ?? 0),
      location: record.storageLocation, record })
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || String(a.timestamp).localeCompare(String(b.timestamp)) || a.id - b.id)
  const latestInventory = events.filter((event) => event.kind === 'INVENTORY').at(-1) ?? null
  const snapshots = new Map()
  let balances = new Map()
  for (const [index, event] of events.entries()) {
    if (event.kind === 'INVENTORY') balances = new Map(event.quantities)
    else balances.set(event.key, (balances.get(event.key) ?? 0) + event.quantity)
    if (events[index + 1]?.date !== event.date) snapshots.set(event.date, new Map(balances))
  }
  const dates = [...snapshots.keys()]
  return {
    events, latestInventory, current: balances,
    at(date) {
      const key = dates.filter((day) => day <= date).at(-1)
      return key ? snapshots.get(key) : new Map()
    },
    capacity(key, date) {
      let minimum = this.at(date).get(key) ?? 0
      for (const day of dates.filter((day) => day > date)) minimum = Math.min(minimum, snapshots.get(day).get(key) ?? 0)
      return Math.max(0, minimum)
    },
  }
}

module.exports = { EPSILON, parseStockDecimal, stockDecimal, isStockDateKey, inventoryKey, movementSign, buildInventoryLedger }
