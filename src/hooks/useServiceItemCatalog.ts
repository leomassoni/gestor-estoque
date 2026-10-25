import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { ServiceItemRecord } from '../types/domain'
import { fetchServiceItemCatalog, mergeServiceItemCatalog, type ServiceItemCatalogStatus } from '../domain/serviceItemCatalog'

const sections = ['Itens', 'FichasTecnicas', 'Inventario', 'Desperdicio']

export function useServiceItemCatalog({ authToken, companyScopeKey, activeSection, normalize, onRecords }: {
  authToken: string | null
  companyScopeKey: string
  activeSection: string
  normalize: (value: unknown) => ServiceItemRecord | null
  onRecords: Dispatch<SetStateAction<ServiceItemRecord[]>>
}) {
  const [status, setStatus] = useState<ServiceItemCatalogStatus>({ isLoading: false, error: '' })
  const [attempt, setAttempt] = useState(0)
  const [completedScope, setCompletedScope] = useState('')
  const enabled = Boolean(authToken && companyScopeKey && sections.includes(activeSection))

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const companyIds = companyScopeKey.split(',').map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
    let pending = false
    let loaded = false
    async function refresh() {
      if (pending || document.hidden || controller.signal.aborted) return
      pending = true
      if (!loaded) setStatus((current) => current.isLoading ? current : { isLoading: true, error: '' })
      try {
        const records = await fetchServiceItemCatalog(companyIds, normalize, controller.signal)
        if (controller.signal.aborted) return
        onRecords((current) => mergeServiceItemCatalog(current, records, companyIds))
        loaded = true
        setCompletedScope(companyScopeKey)
        setStatus((current) => current.isLoading || current.error ? { isLoading: false, error: '' } : current)
      } catch (error) {
        if (!controller.signal.aborted) setStatus({ isLoading: false,
          error: error instanceof Error ? error.message : 'Falha ao carregar os recipientes.' })
      } finally { pending = false }
    }
    void refresh()
    const trigger = () => { void refresh() }
    const interval = window.setInterval(trigger, 60000)
    window.addEventListener('focus', trigger)
    document.addEventListener('visibilitychange', trigger)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', trigger)
      document.removeEventListener('visibilitychange', trigger)
    }
  }, [enabled, activeSection, authToken, companyScopeKey, normalize, onRecords, attempt])

  return { ...status, isLoading: enabled && (status.isLoading || (!status.error && completedScope !== companyScopeKey)),
    retry: () => setAttempt((current) => current + 1) }
}
