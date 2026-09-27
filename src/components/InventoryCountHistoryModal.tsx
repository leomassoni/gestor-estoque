import {
  calculateInventoryOpenPhysicalQuantityForContext,
  calculateInventoryTotalCountedQuantityForContext,
  buildInventoryRecipientOptionsForContext,
  getInventoryDensityFactorForContext,
  getStockCountableKindLabel,
} from '../domain/inventory'
import type {
  InventoryCountHistoryDisplayRow,
  InventoryCountHistoryDraft,
  InventoryCountHistoryModalState,
  InventoryCountRecord,
  InventoryCountSessionRecord,
  InventoryCountableItem,
  ProductRecord,
  ServiceItemRecord,
  TechnicalSheetRecord,
} from '../types/domain'
import {
  formatControlUnitShort,
  formatDateForDisplay,
  formatDecimal,
} from '../utils/core'

type InventoryCountHistoryModalProps = {
  modalState: InventoryCountHistoryModalState
  rows: InventoryCountHistoryDisplayRow[]
  drafts: Record<string, InventoryCountHistoryDraft>
  targetSession: InventoryCountSessionRecord | null
  canDeleteSession: boolean
  countableItems: InventoryCountableItem[]
  countableSheets: TechnicalSheetRecord[]
  productById: Map<string, ProductRecord>
  serviceItemsById: Map<string, ServiceItemRecord>
  canManageRecord: (record: InventoryCountRecord) => boolean
  onClose: () => void
  onOpenInventory: () => void
  onDeleteSession: (sessionRecord: InventoryCountSessionRecord) => void
  onUpdateDraft: (rowKey: string, field: keyof InventoryCountHistoryDraft, value: string) => void
  onSaveDrafts: () => void
}

function isProductionStockKind(kind: string): kind is 'PREPARO' | 'PRODUTO_INTERNO' {
  return kind === 'PREPARO' || kind === 'PRODUTO_INTERNO'
}

export function InventoryCountHistoryModal({
  modalState,
  rows,
  drafts,
  targetSession,
  canDeleteSession,
  countableItems,
  countableSheets,
  productById,
  serviceItemsById,
  canManageRecord,
  onClose,
  onOpenInventory,
  onDeleteSession,
  onUpdateDraft,
  onSaveDrafts,
}: InventoryCountHistoryModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-card modal-card-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-history-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="kicker">Historico de contagem</p>
            <h2 id="inventory-history-modal-title">Itens da contagem registrada</h2>
          </div>
          <div className="toolbar-actions">
            {targetSession && canDeleteSession ? (
              <button
                type="button"
                className="danger-button"
                onClick={() => onDeleteSession(targetSession)}
              >
                Excluir contagem
              </button>
            ) : null}
            {!modalState.isClosed ? (
              <button type="button" className="ghost-button" onClick={onOpenInventory}>
                Abrir no inventario
              </button>
            ) : null}
          </div>
        </div>

        <p className="confirm-copy">
          Centro {modalState.stockCenterName} • Data {formatDateForDisplay(modalState.countedAt)}.
          {modalState.isClosed
            ? ' Esta contagem esta fechada, mas os lancamentos ainda podem ser ajustados aqui por usuarios com permissao.'
            : ' Ajuste os lancamentos desta sessao diretamente neste pop-up.'}
        </p>

        {rows.length > 0 ? (
          <div className="table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Local</th>
                  <th className="sticky-product">Produto</th>
                  <th>Tipo</th>
                  <th>Recipiente</th>
                  <th>Fechados</th>
                  <th>Abertos</th>
                  <th>Peso abertos (g)</th>
                  <th>Qtd. abertos</th>
                  <th>Total contado</th>
                  <th>Por</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const record = row.record
                  const draft = drafts[row.rowKey] ?? {
                    storageLocation: record?.storageLocation ?? '',
                    recipientItemId: record?.recipientItemId ?? '',
                    closedItemsQuantity: record?.closedItemsQuantity ?? '0',
                    hasOpenItems: record?.hasOpenItems ? 'true' : 'false',
                    openItemsGrossWeight: record?.openItemsGrossWeight ?? '',
                    openItemsContainerQuantity: record?.openItemsContainerQuantity ?? '',
                  }
                  const countableItem =
                    isProductionStockKind(row.kind)
                      ? countableItems.find((item) => isProductionStockKind(item.kind) && item.technicalSheetId === (record?.technicalSheetId ?? row.stockRow?.technicalSheetId ?? null)) ?? null
                      : row.kind === 'PRODUTO'
                        ? countableItems.find((item) => item.kind === 'PRODUTO' && item.productId === (record?.productId ?? row.stockRow?.productId ?? '')) ?? null
                        : countableItems.find((item) => item.kind === 'ITEM' && item.serviceItemId === (record?.serviceItemId ?? row.stockRow?.serviceItemId ?? '')) ?? null
                  const sheet =
                    isProductionStockKind(row.kind) && (record?.technicalSheetId ?? row.stockRow?.technicalSheetId ?? null) !== null
                      ? countableSheets.find((item) => item.id === (record?.technicalSheetId ?? row.stockRow?.technicalSheetId ?? null)) ?? null
                      : null
                  const product = row.kind === 'PRODUTO' ? productById.get(record?.productId ?? row.stockRow?.productId ?? '') ?? null : null
                  const serviceItem = row.kind === 'ITEM' ? serviceItemsById.get(record?.serviceItemId ?? row.stockRow?.serviceItemId ?? '') ?? null : null
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
                  const canManage = record ? canManageRecord(record) : true

                  return (
                    <tr key={row.rowKey}>
                      <td>{record?.storageLocation || 'CORRECAO DE CONTAGEM'}</td>
                      <td className="sticky-product-cell">
                        <strong>{row.name}</strong>
                      </td>
                      <td>{getStockCountableKindLabel(row.kind)}</td>
                      <td>
                        {recipientOptions.length > 0 ? (
                          <select
                            value={draft.recipientItemId}
                            onChange={(event) => onUpdateDraft(row.rowKey, 'recipientItemId', event.target.value)}
                            disabled={!canManage}
                          >
                            <option value="">Selecione</option>
                            {recipientOptions.map((option) => (
                              <option key={`${row.rowKey}-${option.id}`} value={option.id}>
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
                          onChange={(event) => onUpdateDraft(row.rowKey, 'closedItemsQuantity', event.target.value)}
                          disabled={!canManage}
                        />
                      </td>
                      <td>
                        <select
                          value={draft.hasOpenItems}
                          onChange={(event) => onUpdateDraft(row.rowKey, 'hasOpenItems', event.target.value)}
                          disabled={!canManage}
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
                          onChange={(event) => onUpdateDraft(row.rowKey, 'openItemsGrossWeight', event.target.value)}
                          disabled={!canManage || draft.hasOpenItems !== 'true'}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={draft.hasOpenItems === 'true' ? draft.openItemsContainerQuantity : ''}
                          onChange={(event) => onUpdateDraft(row.rowKey, 'openItemsContainerQuantity', event.target.value)}
                          disabled={!canManage || draft.hasOpenItems !== 'true'}
                        />
                      </td>
                      <td>
                        {formatDecimal(totalCountedQuantity)} {formatControlUnitShort(row.baseUnit)}
                      </td>
                      <td>{record?.createdByUserName ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <strong>Nenhum lancamento encontrado nesta contagem.</strong>
            <p>Essa sessao foi registrada sem itens ou ainda nao recebeu lancamentos.</p>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="primary-button" onClick={onSaveDrafts}>
            Salvar alteracoes
          </button>
        </div>
      </section>
    </div>
  )
}
