import type { Dispatch, SetStateAction } from 'react'
import {
  calculateInventoryOpenPhysicalQuantityForContext,
  calculateInventoryTotalCountedQuantityForContext,
  buildInventoryRecipientOptionsForContext,
  getInventoryDensityFactorForContext,
  getStockCountableKindLabel,
} from '../domain/inventory'
import { calculateNormalizedPackageQuantity } from '../domain/technicalSheets'
import type {
  ClosedInventorySummaryModalState,
  ColumnSort,
  InventoryCountHistoryDraft,
  InventoryCountRecord,
  InventoryCountableItem,
  InventorySummaryColumnKey,
  ProductRecord,
  ServiceItemRecord,
  TechnicalSheetRecord,
} from '../types/domain'
import {
  formatControlUnitShort,
  formatDateForDisplay,
  formatDecimal,
  formatInventoryRecordCode,
  formatTimeForDisplay,
  parseDecimal,
} from '../utils/core'
import { NormalizedTextInput } from './NormalizedTextField'
import { renderInventorySummaryColumnHeader } from './tableColumnHeaders'

type InventoryClosedSummaryModalProps = {
  modalState: ClosedInventorySummaryModalState
  search: string
  counts: InventoryCountRecord[]
  columnVisibility: Record<InventorySummaryColumnKey, boolean>
  openColumnMenu: InventorySummaryColumnKey | null
  columnFilters: Partial<Record<InventorySummaryColumnKey, string[]>>
  distinctColumnValues: Record<InventorySummaryColumnKey, string[]>
  columnSort: ColumnSort<InventorySummaryColumnKey> | null
  drafts: Record<string, InventoryCountHistoryDraft>
  editingRowKey: string | null
  countableItems: InventoryCountableItem[]
  countableSheets: TechnicalSheetRecord[]
  productById: Map<string, ProductRecord>
  serviceItemsById: Map<string, ServiceItemRecord>
  canEditInventorySummary: boolean
  canDeleteInventorySummary: boolean
  onClose: () => void
  onSearchChange: (value: string) => void
  setOpenColumnMenu: Dispatch<SetStateAction<InventorySummaryColumnKey | null>>
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<InventorySummaryColumnKey, string[]>>>>
  setColumnVisibility: Dispatch<SetStateAction<Record<InventorySummaryColumnKey, boolean>>>
  setColumnSort: Dispatch<SetStateAction<ColumnSort<InventorySummaryColumnKey> | null>>
  onUpdateDraft: (rowKey: string, field: keyof InventoryCountHistoryDraft, value: string) => void
  onEditRow: (rowKey: string) => void
  onSaveDraft: (recordId: number) => void
  onDeleteCount: (record: InventoryCountRecord) => void
}

function isProductionStockKind(kind: string): kind is 'PREPARO' | 'PRODUTO_INTERNO' {
  return kind === 'PREPARO' || kind === 'PRODUTO_INTERNO'
}

function getInventoryOpenCountedLabel(record: InventoryCountRecord) {
  const openQuantity = parseDecimal(record.openItemsNetQuantity) ?? 0
  return `${formatDecimal(openQuantity)} ${formatControlUnitShort(record.totalCountedUnit)}`
}

function getInventoryTotalCountedLabel(
  record: InventoryCountRecord,
  productById: Map<string, ProductRecord>,
) {
  if (record.technicalSheetKind === 'PRODUTO' && record.packageId !== null) {
    const product = productById.get(record.productId) ?? null
    const selectedPackage = product?.packages.find((item) => item.id === record.packageId) ?? null
    const packageQuantity =
      product && selectedPackage
        ? calculateNormalizedPackageQuantity(selectedPackage, product.controlUnit)
        : 0
    const totalQuantity = parseDecimal(record.totalCountedQuantity) ?? 0
    if (packageQuantity > 0 && product) {
      return `${formatDecimal(totalQuantity / packageQuantity)} x ${formatDecimal(packageQuantity)} ${formatControlUnitShort(product.controlUnit)}`
    }
  }

  return `${record.totalCountedQuantity} ${formatControlUnitShort(record.totalCountedUnit)}`
}

export function InventoryClosedSummaryModal({
  modalState,
  search,
  counts,
  columnVisibility,
  openColumnMenu,
  columnFilters,
  distinctColumnValues,
  columnSort,
  drafts,
  editingRowKey,
  countableItems,
  countableSheets,
  productById,
  serviceItemsById,
  canEditInventorySummary,
  canDeleteInventorySummary,
  onClose,
  onSearchChange,
  setOpenColumnMenu,
  setColumnFilters,
  setColumnVisibility,
  setColumnSort,
  onUpdateDraft,
  onEditRow,
  onSaveDraft,
  onDeleteCount,
}: InventoryClosedSummaryModalProps) {
  const renderHeader = (key: InventorySummaryColumnKey, label: string) =>
    columnVisibility[key]
      ? renderInventorySummaryColumnHeader(
          key,
          label,
          openColumnMenu,
          setOpenColumnMenu,
          columnFilters,
          distinctColumnValues,
          setColumnFilters,
          setColumnVisibility,
          columnSort,
          setColumnSort,
        )
      : null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-card modal-card-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="closed-inventory-summary-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="kicker">Inventario fechado</p>
            <h2 id="closed-inventory-summary-title">Resumo consolidado do inventario</h2>
          </div>
        </div>

        <p className="confirm-copy">
          {formatInventoryRecordCode(modalState.id)} • Centro {modalState.stockCenterName} • Data {formatDateForDisplay(modalState.countedAt)}.
          Inicio {formatTimeForDisplay(modalState.startedAt)} por {modalState.startedByUserName}. Fechamento {formatTimeForDisplay(modalState.closedAt)} por {modalState.closedByUserName || '-'}.
        </p>

        <div className="list-toolbar">
          <label className="field search-field">
            <span>Buscar no resumo do inventario</span>
            <NormalizedTextInput
              value={search}
              onChange={onSearchChange}
              commitMode="debounce"
              placeholder="Busque por item, local, embalagem/recipiente, tipo ou usuario"
            />
          </label>
        </div>

        <div className="table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                {renderHeader('date', 'Data')}
                {renderHeader('location', 'Local')}
                {renderHeader('product', 'Produto')}
                {renderHeader('type', 'Tipo')}
                {renderHeader('recipient', 'Recipiente')}
                {renderHeader('closed', 'Fechados')}
                {renderHeader('open', 'Abertos')}
                {renderHeader('total', 'Total contado')}
                {renderHeader('user', 'Por')}
                {!modalState.readOnly ? <th className="sticky-actions">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {counts.map((record) => {
                const rowKey = `record-${record.id}`
                const isEditingRow = editingRowKey === rowKey
                const draft = drafts[rowKey] ?? {
                  storageLocation: record.storageLocation,
                  recipientItemId: record.recipientItemId,
                  closedItemsQuantity: record.closedItemsQuantity,
                  hasOpenItems: record.hasOpenItems ? 'true' : 'false',
                  openItemsGrossWeight: record.openItemsGrossWeight,
                  openItemsContainerQuantity: record.openItemsContainerQuantity,
                }
                const countableItem =
                  isProductionStockKind(record.technicalSheetKind)
                    ? countableItems.find((item) => isProductionStockKind(item.kind) && item.technicalSheetId === record.technicalSheetId) ?? null
                    : record.technicalSheetKind === 'PRODUTO'
                      ? countableItems.find((item) => item.kind === 'PRODUTO' && item.productId === record.productId) ?? null
                      : countableItems.find((item) => item.kind === 'ITEM' && item.serviceItemId === record.serviceItemId) ?? null
                const sheet =
                  isProductionStockKind(record.technicalSheetKind) && record.technicalSheetId !== null
                    ? countableSheets.find((item) => item.id === record.technicalSheetId) ?? null
                    : null
                const product = record.technicalSheetKind === 'PRODUTO' ? productById.get(record.productId) ?? null : null
                const serviceItem = record.technicalSheetKind === 'ITEM' ? serviceItemsById.get(record.serviceItemId) ?? null : null
                const recipientOptions = buildInventoryRecipientOptionsForContext({
                  countableItem,
                  sheet,
                  product,
                  serviceItem,
                  serviceItemsById,
                })
                const selectedRecipient = recipientOptions.find((item) => item.id === draft.recipientItemId) ?? null
                const densityFactor = getInventoryDensityFactorForContext({ countableItem, sheet, product })
                const openPhysicalQuantity = calculateInventoryOpenPhysicalQuantityForContext({
                  countableItem,
                  hasOpenItems: draft.hasOpenItems === 'true',
                  openItemsGrossWeight: draft.openItemsGrossWeight,
                  openItemsContainerQuantity: draft.openItemsContainerQuantity,
                  recipient: selectedRecipient,
                  densityFactor,
                })
                const totalCountedQuantity = calculateInventoryTotalCountedQuantityForContext({
                  countableItem,
                  sheet,
                  hasRecipientOptions: recipientOptions.length > 0,
                  recipient: selectedRecipient,
                  closedItemsQuantity: draft.closedItemsQuantity,
                  hasOpenItems: draft.hasOpenItems === 'true',
                  openPhysicalQuantity,
                })
                const previewRecord: InventoryCountRecord = {
                  ...record,
                  recipientItemId: selectedRecipient?.id ?? '',
                  recipientLabel: selectedRecipient?.label ?? 'SEM RECIPIENTE VINCULADO',
                  packageId:
                    countableItem?.kind === 'PRODUTO' || countableItem?.kind === 'ITEM'
                      ? selectedRecipient?.packageId ?? null
                      : null,
                  closedItemsQuantity: draft.closedItemsQuantity || '0',
                  hasOpenItems: draft.hasOpenItems === 'true',
                  openItemsGrossWeight: draft.hasOpenItems === 'true' ? draft.openItemsGrossWeight : '',
                  openItemsContainerQuantity: draft.hasOpenItems === 'true' ? draft.openItemsContainerQuantity : '',
                  openItemsNetQuantity: draft.hasOpenItems === 'true' ? formatDecimal(openPhysicalQuantity) : '',
                  totalCountedQuantity: formatDecimal(totalCountedQuantity),
                }
                const displayRecord = isEditingRow ? previewRecord : record

                return (
                  <tr key={`closed-inventory-summary-${record.id}`}>
                    {columnVisibility.date ? <td>{formatDateForDisplay(record.countedAt)}</td> : null}
                    {columnVisibility.location ? <td>{record.storageLocation}</td> : null}
                    {columnVisibility.product ? <td className="sticky-product-cell"><strong>{record.technicalSheetName}</strong></td> : null}
                    {columnVisibility.type ? <td>{getStockCountableKindLabel(record.technicalSheetKind)}</td> : null}
                    {columnVisibility.recipient ? (
                      <td>
                        {isEditingRow && recipientOptions.length > 0 ? (
                          <select value={draft.recipientItemId} onChange={(event) => onUpdateDraft(rowKey, 'recipientItemId', event.target.value)}>
                            <option value="">Selecione</option>
                            {recipientOptions.map((option) => (
                              <option key={`closed-summary-${record.id}-${option.id}`} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{displayRecord.recipientLabel}</span>
                        )}
                      </td>
                    ) : null}
                    {columnVisibility.closed ? (
                      <td>
                        {isEditingRow ? (
                          <input type="number" min="0" value={draft.closedItemsQuantity} onChange={(event) => onUpdateDraft(rowKey, 'closedItemsQuantity', event.target.value)} />
                        ) : (
                          displayRecord.closedItemsQuantity
                        )}
                      </td>
                    ) : null}
                    {columnVisibility.open ? (
                      <td>
                        {isEditingRow ? (
                          <div className="inline-edit-stack">
                            <select value={draft.hasOpenItems} onChange={(event) => onUpdateDraft(rowKey, 'hasOpenItems', event.target.value)}>
                              <option value="false">NAO</option>
                              <option value="true">SIM</option>
                            </select>
                            {draft.hasOpenItems === 'true' ? (
                              <>
                                <input type="number" min="0" step="0.01" value={draft.openItemsGrossWeight} onChange={(event) => onUpdateDraft(rowKey, 'openItemsGrossWeight', event.target.value)} placeholder="Peso" />
                                <input type="number" min="0" step="1" value={draft.openItemsContainerQuantity} onChange={(event) => onUpdateDraft(rowKey, 'openItemsContainerQuantity', event.target.value)} placeholder="Qtd." />
                              </>
                            ) : null}
                          </div>
                        ) : (
                          getInventoryOpenCountedLabel(displayRecord)
                        )}
                      </td>
                    ) : null}
                    {columnVisibility.total ? <td>{getInventoryTotalCountedLabel(displayRecord, productById)}</td> : null}
                    {columnVisibility.user ? <td>{record.createdByUserName}</td> : null}
                    {!modalState.readOnly ? (
                      <td className="sticky-actions-cell">
                        <div className="table-actions">
                          <button
                            type="button"
                            className={isEditingRow ? 'icon-button icon-save' : 'icon-button icon-edit'}
                            aria-label={isEditingRow ? 'Salvar item do inventario fechado' : 'Editar item do inventario fechado'}
                            title={isEditingRow ? 'Salvar item do inventario fechado' : 'Editar item do inventario fechado'}
                            onClick={() => (isEditingRow ? onSaveDraft(record.id) : onEditRow(rowKey))}
                            disabled={!canEditInventorySummary}
                          >
                            <span aria-hidden="true">{isEditingRow ? '✓' : '✎'}</span>
                          </button>
                          <button
                            type="button"
                            className="icon-button icon-delete"
                            aria-label="Excluir item do inventario fechado"
                            title="Excluir item do inventario fechado"
                            onClick={() => onDeleteCount(record)}
                            disabled={!canDeleteInventorySummary}
                          >
                            <span aria-hidden="true">✕</span>
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </section>
    </div>
  )
}
