import type { Dispatch, SetStateAction } from 'react'
import { NormalizedTextInput } from './NormalizedTextField'
import { renderItemColumnHeader } from './tableColumnHeaders'
import type {
  ColumnSort,
  ItemColumnKey,
  ProductAction,
  ServiceItemRecord,
} from '../types/domain'

type ServiceItemListPanelProps = {
  canDeleteRecords: boolean
  columnFilters: Partial<Record<ItemColumnKey, string[]>>
  columnSort: ColumnSort<ItemColumnKey> | null
  columnVisibility: Record<ItemColumnKey, boolean>
  distinctColumnValues: Record<ItemColumnKey, string[]>
  hiddenColumns: Array<[ItemColumnKey, string]>
  itemListId: string
  itemSearch: string
  itemSuggestions: string[]
  openColumnMenu: ItemColumnKey | null
  visibleItems: ServiceItemRecord[]
  formatServiceItemSize: (sizeValue: string, sizeUnit: ServiceItemRecord['sizeUnit']) => string
  getServiceItemColumnValue: (item: ServiceItemRecord, key: ItemColumnKey) => string
  onEditItem: (itemId: string) => void
  onNewItem: () => void
  onSearchChange: (value: string) => void
  onServiceItemAction: (itemId: string, action: ProductAction) => void
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<ItemColumnKey, string[]>>>>
  setColumnSort: Dispatch<SetStateAction<ColumnSort<ItemColumnKey> | null>>
  setColumnVisibility: Dispatch<SetStateAction<Record<ItemColumnKey, boolean>>>
  setOpenColumnMenu: Dispatch<SetStateAction<ItemColumnKey | null>>
}

export function ServiceItemListPanel({
  canDeleteRecords,
  columnFilters,
  columnSort,
  columnVisibility,
  distinctColumnValues,
  hiddenColumns,
  itemListId,
  itemSearch,
  itemSuggestions,
  openColumnMenu,
  visibleItems,
  formatServiceItemSize,
  getServiceItemColumnValue,
  onEditItem,
  onNewItem,
  onSearchChange,
  onServiceItemAction,
  setColumnFilters,
  setColumnSort,
  setColumnVisibility,
  setOpenColumnMenu,
}: ServiceItemListPanelProps) {
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length + 1

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Utensilios e Recipientes</p>
          <h2>Itens cadastrados</h2>
        </div>
        <div className="toolbar-actions">
          <button className="primary-button" type="button" onClick={onNewItem}>
            Novo item
          </button>
        </div>
      </div>

      <div className="list-toolbar">
        <label className="field search-field">
          <span>Pesquisar item</span>
          <NormalizedTextInput
            list={itemListId}
            value={itemSearch}
            onChange={onSearchChange}
            commitMode="debounce"
            placeholder="Busque por nome, ID interno, ID empresa ou cod. fabricante"
          />
          <datalist id={itemListId}>
            {itemSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
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

      <div className="table-wrap">
        <table className="product-table">
          <thead>
            <tr>
              {columnVisibility.item
                ? renderItemColumnHeader('item', 'Item', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.internalId
                ? renderItemColumnHeader('internalId', 'ID interno', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.companyId
                ? renderItemColumnHeader('companyId', 'ID empresa', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.manufacturerCode
                ? renderItemColumnHeader('manufacturerCode', 'Cod. fabricante', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.sectors
                ? renderItemColumnHeader('sectors', 'Setores', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.kind
                ? renderItemColumnHeader('kind', 'Categoria', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.family
                ? renderItemColumnHeader('family', 'Tipo', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.subfamily
                ? renderItemColumnHeader('subfamily', 'Material', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.sizeCapacity
                ? renderItemColumnHeader('sizeCapacity', 'Tamanho/capacidade', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.packages
                ? renderItemColumnHeader('packages', 'Embalagens', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              {columnVisibility.status
                ? renderItemColumnHeader('status', 'Status', openColumnMenu, setOpenColumnMenu, columnFilters, distinctColumnValues, setColumnFilters, setColumnVisibility, columnSort, setColumnSort)
                : null}
              <th className="sticky-actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => (
                <tr key={item.id}>
                  {columnVisibility.item ? <td className="sticky-product-cell"><strong>{item.name}</strong></td> : null}
                  {columnVisibility.internalId ? <td>{item.id}</td> : null}
                  {columnVisibility.companyId ? <td>{item.companyProductId || '-'}</td> : null}
                  {columnVisibility.manufacturerCode ? <td>{item.manufacturerCode || '-'}</td> : null}
                  {columnVisibility.sectors ? <td>{item.sectors.join(', ')}</td> : null}
                  {columnVisibility.kind ? <td>{getServiceItemColumnValue(item, 'kind')}</td> : null}
                  {columnVisibility.family ? <td>{item.family}</td> : null}
                  {columnVisibility.subfamily ? <td>{item.subfamily}</td> : null}
                  {columnVisibility.sizeCapacity ? <td>{formatServiceItemSize(item.sizeValue, item.sizeUnit) || '-'}</td> : null}
                  {columnVisibility.packages ? <td>{String(item.packages.length)}</td> : null}
                  {columnVisibility.status ? (
                    <td>
                      <span className={item.isActive ? 'package-chip package-chip-success' : 'package-chip package-chip-warning'}>
                        {item.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  ) : null}
                  <td className="sticky-actions-cell">
                    <div className="table-actions">
                      <button className="icon-button icon-edit" type="button" aria-label="Editar item" onClick={() => onEditItem(item.id)}>
                        <span aria-hidden="true">✎</span>
                      </button>
                      <button
                        className="icon-button icon-disable"
                        type="button"
                        aria-label={item.isActive ? 'Inativar item' : 'Ativar item'}
                        onClick={() => onServiceItemAction(item.id, item.isActive ? 'disable' : 'enable')}
                      >
                        <span aria-hidden="true">{item.isActive ? '◐' : '◑'}</span>
                      </button>
                      {canDeleteRecords ? (
                        <button className="icon-button icon-delete" type="button" aria-label="Excluir item" onClick={() => onServiceItemAction(item.id, 'delete')}>
                          <span aria-hidden="true">🗑</span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={visibleColumnCount}>
                  <div className="empty-state empty-state-inline">
                    <strong>Nenhum item encontrado.</strong>
                    <p>Ajuste a pesquisa ou os filtros para exibir outros registros.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
