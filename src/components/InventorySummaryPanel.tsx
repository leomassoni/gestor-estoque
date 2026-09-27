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
  parseDecimal,
} from '../utils/core'
import { NormalizedTextInput } from './NormalizedTextField'
import { renderInventorySummaryColumnHeader } from './tableColumnHeaders'

type InventorySummaryPanelProps = {
  search: string
  counts: InventoryCountRecord[]
  visibleCounts: InventoryCountRecord[]
  hiddenColumns: Array<[InventorySummaryColumnKey, string]>
  columnVisibility: Record<InventorySummaryColumnKey, boolean>
  openColumnMenu: InventorySummaryColumnKey | null
  columnFilters: Partial<Record<InventorySummaryColumnKey, string[]>>
  distinctColumnValues: Record<InventorySummaryColumnKey, string[]>
  columnSort: ColumnSort<InventorySummaryColumnKey> | null
  drafts: Record<string, InventoryCountHistoryDraft>
  editingRowKey: string | null
  openSessionIds: Set<number>
  countableItems: InventoryCountableItem[]
  countableSheets: TechnicalSheetRecord[]
  productById: Map<string, ProductRecord>
  serviceItemsById: Map<string, ServiceItemRecord>
  canEditInventorySummary: boolean
  canDeleteInventorySummary: boolean
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

export function InventorySummaryPanel({
  search,
  counts,
  visibleCounts,
  hiddenColumns,
  columnVisibility,
  openColumnMenu,
  columnFilters,
  distinctColumnValues,
  columnSort,
  drafts,
  editingRowKey,
  openSessionIds,
  countableItems,
  countableSheets,
  productById,
  serviceItemsById,
  canEditInventorySummary,
  canDeleteInventorySummary,
  onSearchChange,
  setOpenColumnMenu,
  setColumnFilters,
  setColumnVisibility,
  setColumnSort,
  onUpdateDraft,
  onEditRow,
  onSaveDraft,
  onDeleteCount,
}: InventorySummaryPanelProps) {
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
    <section className="panel">
      <div className="empty-state empty-state-inline">
        <strong>Resumo do inventario</strong>
        <p>Este bloco mostra a consolidacao atual das contagens lancadas dentro deste inventario.</p>

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

        {hiddenColumns.length > 0 ? (
          <div className="hidden-columns">
            <strong>Colunas ocultas</strong>
            <div className="hidden-columns-list">
              {hiddenColumns.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="ghost-button hidden-column-chip"
                  onClick={() =>
                    setColumnVisibility((current) => ({
                      ...current,
                      [key]: true,
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {counts.length > 0 ? (
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
                  <th className="sticky-actions">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {visibleCounts.length > 0 ? (
                  visibleCounts.map((record) => {
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
                      <tr
                        key={`inventory-summary-${record.id}`}
                        className={openSessionIds.has(record.sessionId) ? 'inventory-summary-pending-row' : ''}
                      >
                        {columnVisibility.date ? <td>{formatDateForDisplay(record.countedAt)}</td> : null}
                        {columnVisibility.location ? <td>{record.storageLocation}</td> : null}
                        {columnVisibility.product ? <td className="sticky-product-cell"><strong>{record.technicalSheetName}</strong></td> : null}
                        {columnVisibility.type ? <td>{getStockCountableKindLabel(record.technicalSheetKind)}</td> : null}
                        {columnVisibility.recipient ? (
                          <td>
                            {isEditingRow && recipientOptions.length > 0 ? (
                              <select
                                value={draft.recipientItemId}
                                onChange={(event) => onUpdateDraft(rowKey, 'recipientItemId', event.target.value)}
                                disabled={!isEditingRow}
                              >
                                <option value="">Selecione</option>
                                {recipientOptions.map((option) => (
                                  <option key={`summary-${record.id}-${option.id}`} value={option.id}>
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
                              <input
                                type="number"
                                min="0"
                                value={draft.closedItemsQuantity}
                                onChange={(event) => onUpdateDraft(rowKey, 'closedItemsQuantity', event.target.value)}
                                disabled={!isEditingRow}
                              />
                            ) : (
                              displayRecord.closedItemsQuantity
                            )}
                          </td>
                        ) : null}
                        {columnVisibility.open ? (
                          <td>
                            {isEditingRow ? (
                              <div className="inline-edit-stack">
                                <select
                                  value={draft.hasOpenItems}
                                  onChange={(event) => onUpdateDraft(rowKey, 'hasOpenItems', event.target.value)}
                                >
                                  <option value="false">NAO</option>
                                  <option value="true">SIM</option>
                                </select>
                                {draft.hasOpenItems === 'true' ? (
                                  <>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={draft.openItemsGrossWeight}
                                      onChange={(event) => onUpdateDraft(rowKey, 'openItemsGrossWeight', event.target.value)}
                                      placeholder="Peso"
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={draft.openItemsContainerQuantity}
                                      onChange={(event) => onUpdateDraft(rowKey, 'openItemsContainerQuantity', event.target.value)}
                                      placeholder="Qtd."
                                    />
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
                        <td className="sticky-actions-cell">
                          <div className="table-actions">
                            <button
                              type="button"
                              className={isEditingRow ? 'icon-button icon-save' : 'icon-button icon-edit'}
                              aria-label={isEditingRow ? 'Salvar item do resumo do inventario' : 'Editar item do resumo do inventario'}
                              title={isEditingRow ? 'Salvar item do resumo do inventario' : 'Editar item do resumo do inventario'}
                              onClick={() => (isEditingRow ? onSaveDraft(record.id) : onEditRow(rowKey))}
                              disabled={!canEditInventorySummary}
                            >
                              <span aria-hidden="true">{isEditingRow ? '✓' : '✎'}</span>
                            </button>
                            <button
                              type="button"
                              className="icon-button icon-delete"
                              aria-label="Excluir item do resumo do inventario"
                              title="Excluir item do resumo do inventario"
                              onClick={() => onDeleteCount(record)}
                              disabled={!canDeleteInventorySummary}
                            >
                              <span aria-hidden="true">✕</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={Object.values(columnVisibility).filter(Boolean).length + 1}>
                      Nenhum item encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="compact-feedback">Nenhum item foi consolidado neste inventario ate o momento.</p>
        )}
      </div>
    </section>
  )
}
