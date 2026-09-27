import { lazy, Suspense, type ReactNode } from 'react'

export const ExecutionPlanningList = lazy(() =>
  import('./ExecutionPlanningList').then((module) => ({ default: module.ExecutionPlanningList })),
)
export const InventoryActiveFlowPanel = lazy(() =>
  import('./InventoryActiveFlowPanel').then((module) => ({ default: module.InventoryActiveFlowPanel })),
)
export const InventoryCurrentCountSummaryPanel = lazy(() =>
  import('./InventoryCurrentCountSummaryPanel').then((module) => ({ default: module.InventoryCurrentCountSummaryPanel })),
)
export const InventoryClosedSummaryModal = lazy(() =>
  import('./InventoryClosedSummaryModal').then((module) => ({ default: module.InventoryClosedSummaryModal })),
)
export const InventoryClosedRecordsPanel = lazy(() =>
  import('./InventoryClosedRecordsPanel').then((module) => ({ default: module.InventoryClosedRecordsPanel })),
)
export const InventorySummaryPanel = lazy(() =>
  import('./InventorySummaryPanel').then((module) => ({ default: module.InventorySummaryPanel })),
)
export const ProductListPanel = lazy(() =>
  import('./ProductListPanel').then((module) => ({ default: module.ProductListPanel })),
)
export const ServiceItemListPanel = lazy(() =>
  import('./ServiceItemListPanel').then((module) => ({ default: module.ServiceItemListPanel })),
)
export const StockCenterRegisteredListPanel = lazy(() =>
  import('./StockCenterRegisteredListPanel').then((module) => ({ default: module.StockCenterRegisteredListPanel })),
)
export const TechnicalSheetListPanel = lazy(() =>
  import('./TechnicalSheetListPanel').then((module) => ({ default: module.TechnicalSheetListPanel })),
)

type LazyPanelBoundaryProps = {
  children: ReactNode
}

export function LazyPanelBoundary({ children }: LazyPanelBoundaryProps) {
  return (
    <Suspense
      fallback={
        <div className="empty-state empty-state-inline">
          <strong>Carregando painel...</strong>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
