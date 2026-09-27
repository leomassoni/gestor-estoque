import {
  calculateInventoryOpenPhysicalQuantityForContext,
  calculateInventoryTotalCountedQuantityForContext,
  buildInventoryRecipientOptionsForContext,
  getInventoryDensityFactorForContext,
  getStockCountableKindLabel,
} from '../domain/inventory'
import { calculateNormalizedPackageQuantity } from '../domain/technicalSheets'
import type {
  InventoryCountHistoryDraft,
  InventoryCountRecord,
  InventoryCountableItem,
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

type InventoryCurrentCountSummaryPanelProps = {
  records: InventoryCountRecord[]
  drafts: Record<string, InventoryCountHistoryDraft>
  editingRowKey: string | null
  countableItems: InventoryCountableItem[]
  countableSheets: TechnicalSheetRecord[]
  productById: Map<string, ProductRecord>
  serviceItemsById: Map<string, ServiceItemRecord>
  onLeaveSession: () => void
  onCloseSession: () => void
  onUpdateDraft: (rowKey: string, field: keyof InventoryCountHistoryDraft, value: string) => void
  onEditRow: (rowKey: string) => void
  onSaveDraft: (recordId: number) => void
  onDeleteCount: (record: InventoryCountRecord) => void
}

function isProductionStockKind(kind: string): kind is 'PREPARO' | 'PRODUTO_INTERNO' {
  return kind === 'PREPARO' || kind === 'PRODUTO_INTERNO'
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

export function InventoryCurrentCountSummaryPanel({
  records,
  drafts,
  editingRowKey,
  countableItems,
  countableSheets,
  productById,
  serviceItemsById,
  onLeaveSession,
  onCloseSession,
  onUpdateDraft,
  onEditRow,
  onSaveDraft,
  onDeleteCount,
}: InventoryCurrentCountSummaryPanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Contagem</p>
          <h2>Resumo da contagem atual</h2>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="ghost-button" onClick={onLeaveSession}>
            Sair da contagem
          </button>
          <button type="button" className="warning-button" onClick={onCloseSession}>
            Fechar contagem
          </button>
        </div>
      </div>

      {records.length > 0 ? (
        <div className="table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Local</th>
                <th className="sticky-product">Produto</th>
                <th>Tipo</th>
                <th>Recipiente</th>
                <th>Fechados</th>
                <th>Abertos</th>
                <th>Peso abertos (g)</th>
                <th>Qtd. abertos</th>
                <th>Total contado</th>
                <th className="sticky-actions">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
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

                return (
                  <tr key={`current-session-${record.id}`}>
                    <td>{formatDateForDisplay(record.countedAt)}</td>
                    <td>{record.storageLocation}</td>
                    <td className="sticky-product-cell"><strong>{record.technicalSheetName}</strong></td>
                    <td>{getStockCountableKindLabel(record.technicalSheetKind)}</td>
                    <td>
                      {recipientOptions.length > 0 ? (
                        <select
                          value={draft.recipientItemId}
                          onChange={(event) => onUpdateDraft(rowKey, 'recipientItemId', event.target.value)}
                          disabled={!isEditingRow}
                        >
                          <option value="">Selecione</option>
                          {recipientOptions.map((option) => (
                            <option key={`current-${record.id}-${option.id}`} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>SEM RECIPIENTE VINCULADO</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={draft.closedItemsQuantity}
                        onChange={(event) => onUpdateDraft(rowKey, 'closedItemsQuantity', event.target.value)}
                        disabled={!isEditingRow}
                      />
                    </td>
                    <td>
                      <select
                        value={draft.hasOpenItems}
                        onChange={(event) => onUpdateDraft(rowKey, 'hasOpenItems', event.target.value)}
                        disabled={!isEditingRow}
                      >
                        <option value="false">NAO</option>
                        <option value="true">SIM</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.hasOpenItems === 'true' ? draft.openItemsGrossWeight : ''}
                        onChange={(event) => onUpdateDraft(rowKey, 'openItemsGrossWeight', event.target.value)}
                        disabled={!isEditingRow || draft.hasOpenItems !== 'true'}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.hasOpenItems === 'true' ? draft.openItemsContainerQuantity : ''}
                        onChange={(event) => onUpdateDraft(rowKey, 'openItemsContainerQuantity', event.target.value)}
                        disabled={!isEditingRow || draft.hasOpenItems !== 'true'}
                      />
                    </td>
                    <td>{getInventoryTotalCountedLabel(previewRecord, productById)}</td>
                    <td className="sticky-actions-cell">
                      <div className="table-actions">
                        <button
                          type="button"
                          className={isEditingRow ? 'icon-button icon-save' : 'icon-button icon-edit'}
                          aria-label={isEditingRow ? 'Salvar lancamento' : 'Editar lancamento'}
                          title={isEditingRow ? 'Salvar lancamento' : 'Editar lancamento'}
                          onClick={() => (isEditingRow ? onSaveDraft(record.id) : onEditRow(rowKey))}
                        >
                          <span aria-hidden="true">{isEditingRow ? '✓' : '✎'}</span>
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-delete"
                          aria-label="Excluir lancamento"
                          title="Excluir lancamento"
                          onClick={() => onDeleteCount(record)}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <strong>Nenhum lancamento registrado na contagem atual.</strong>
          <p>Registre itens na sua contagem atual para visualizar esse resumo.</p>
        </div>
      )}
    </section>
  )
}
