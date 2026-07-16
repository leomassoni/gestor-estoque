import { normalizeRegistrationText } from '../utils/core'

export const listViewStorageKey = 'gestor-estoque:list-view'
export const itemListViewStorageKey = 'gestor-estoque:item-list-view'
export const technicalSheetListViewStorageKey = 'gestor-estoque:technical-sheet-list-view'
export const authStorageKey = 'gestor-estoque:auth'
export const companiesStorageKey = 'gestor-estoque:companies'
export const productsStorageKey = 'gestor-estoque:products'
export const serviceItemsStorageKey = 'gestor-estoque:service-items'
export const usersStorageKey = 'gestor-estoque:users'
export const accessProfilesStorageKey = 'gestor-estoque:access-profiles'
export const technicalSheetSettingsStorageKey = 'gestor-estoque:technical-sheet-settings'
export const technicalSheetsStorageKey = 'gestor-estoque:technical-sheets'
export const flavorProfilesStorageKey = 'gestor-estoque:flavor-profiles'
export const stockCentersStorageKey = 'gestor-estoque:stock-centers'
export const inventoryRecordsStorageKey = 'gestor-estoque:inventory-records'
export const inventoryActiveRecordsStorageKey = 'gestor-estoque:inventory-active-records'
export const inventoryCountSessionsStorageKey = 'gestor-estoque:inventory-count-sessions'
export const inventoryActiveSessionsStorageKey = 'gestor-estoque:inventory-active-sessions'
export const inventoryCountsStorageKey = 'gestor-estoque:inventory-counts'
export const wasteSessionsStorageKey = 'gestor-estoque:waste-sessions'
export const wasteRecordsStorageKey = 'gestor-estoque:waste-records'
export const pendingInventoryMovementsStorageKey = 'gestor-estoque:pending-inventory-movements'
export const inventoryStorageLocationsStorageKey = 'gestor-estoque:inventory-storage-locations'
export const stockModuleSettingsStorageKey = 'gestor-estoque:stock-module-settings'
export const requisitionsStorageKey = 'gestor-estoque:requisitions'
export const requisitionNotificationsStorageKey = 'gestor-estoque:requisition-notifications'
export const manualProductionRequestsStorageKey = 'gestor-estoque:manual-production-requests'
export const productionInProgressDraftsStorageKey = 'gestor-estoque:production-in-progress-drafts'
export const auditLogsStorageKey = 'gestor-estoque:audit-logs'
export const stockReportColumnOrderStorageKey = 'gestor-estoque:stock-report-column-order'
export const stockReportModelsStorageKey = 'gestor-estoque:stock-report-models'
export const syncedAppStorageKeys = [
  technicalSheetSettingsStorageKey,
  productsStorageKey,
  serviceItemsStorageKey,
  technicalSheetsStorageKey,
  flavorProfilesStorageKey,
  stockCentersStorageKey,
  requisitionsStorageKey,
  requisitionNotificationsStorageKey,
  inventoryRecordsStorageKey,
  inventoryActiveRecordsStorageKey,
  inventoryCountSessionsStorageKey,
  inventoryActiveSessionsStorageKey,
  inventoryCountsStorageKey,
  wasteSessionsStorageKey,
  wasteRecordsStorageKey,
  pendingInventoryMovementsStorageKey,
  inventoryStorageLocationsStorageKey,
  manualProductionRequestsStorageKey,
  productionInProgressDraftsStorageKey,
] as const

export type SyncedAppStorageKey = (typeof syncedAppStorageKeys)[number]

export type RemoteAppStatePayload = {
  version: 1
  entries: Partial<Record<SyncedAppStorageKey, string>>
}

export const masterCredentials = {
  username: 'igarape.aeb',
  password: 'Leo180613*',
}

export const defaultFlavorProfileNames = ['Doce', 'Azedo', 'Amargo', 'Salgado', 'Umami'] as const

export function buildDefaultFlavorProfileId(companyId: number, name: string) {
  const normalizedSlug = normalizeRegistrationText(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return `default-flavor-profile:${companyId}:${normalizedSlug || 'perfil'}`
}

export function readRemoteAppStatePayloadFromLocalStorage(): RemoteAppStatePayload {
  const entries: Partial<Record<SyncedAppStorageKey, string>> = {}

  if (typeof window === 'undefined') {
    return { version: 1, entries }
  }

  syncedAppStorageKeys.forEach((key) => {
    const raw = window.localStorage.getItem(key)
    if (typeof raw === 'string') {
      entries[key] = raw
    }
  })

  return {
    version: 1,
    entries,
  }
}

export function writeRemoteAppStatePayloadToLocalStorage(payload: RemoteAppStatePayload) {
  if (typeof window === 'undefined') {
    return
  }

  syncedAppStorageKeys.forEach((key) => {
    const nextValue = payload.entries[key]
    if (typeof nextValue === 'string') {
      window.localStorage.setItem(key, nextValue)
      return
    }

    window.localStorage.removeItem(key)
  })
}

export function normalizeRemoteAppStatePayload(payload: unknown): RemoteAppStatePayload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const version = (payload as { version?: unknown }).version
  const entries = (payload as { entries?: unknown }).entries
  if (version !== 1 || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return null
  }

  const normalizedEntries: Partial<Record<SyncedAppStorageKey, string>> = {}
  syncedAppStorageKeys.forEach((key) => {
    const value = (entries as Record<string, unknown>)[key]
    if (typeof value === 'string') {
      normalizedEntries[key] = value
    }
  })

  return {
    version: 1,
    entries: normalizedEntries,
  }
}

export function scoreRemoteAppStatePayload(payload: RemoteAppStatePayload | null): number {
  if (!payload) {
    return 0
  }

  return syncedAppStorageKeys.reduce((total, key) => {
    const raw = payload.entries[key]
    if (typeof raw !== 'string' || raw.trim() === '') {
      return total
    }

    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return total + parsed.length * 100 + raw.length
      }

      if (parsed && typeof parsed === 'object') {
        return total + Object.keys(parsed as Record<string, unknown>).length * 20 + raw.length
      }
    } catch {
      return total + raw.length
    }

    return total + raw.length
  }, 0)
}

export function logRemoteAppStateMessage(message: string) {
  console.info(`[remote-app-state] ${message}`)
}
