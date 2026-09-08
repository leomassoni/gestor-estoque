import { Fragment, type Dispatch, type SetStateAction } from 'react'
import {
  renderColumnHeader,
} from './tableColumnHeaders'
import { NormalizedTextInput } from './NormalizedTextField'
import {
  calculateNormalizedPackageQuantity,
} from '../domain/technicalSheets'
import type {
  ColumnKey,
  ColumnSort,
  PackageForm,
  ProductAction,
  ProductRecord,
} from '../types/domain'
import {
  formatControlUnitShort,
  formatDecimal,
  formatMoney,
  parseDecimal,
} from '../utils/core'

type ProductListPanelProps = {
  canDeleteProducts: boolean
  columnFilters: Partial<Record<ColumnKey, string[]>>
  columnSort: ColumnSort<ColumnKey> | null
  columnVisibility: Record<ColumnKey, boolean>
  distinctColumnValues: Record<ColumnKey, string[]>
  expandedProductPackageIds: Set<string>
  hiddenColumns: Array<[ColumnKey, string]>
  openColumnMenu: ColumnKey | null
  productListId: string
  productSearch: string
  productSuggestions: string[]
  visibleProducts: ProductRecord[]
  getProductColumnValue: (product: ProductRecord, key: ColumnKey) => string
  onCopyProduct: (productId: string) => void
  onCopyTechnicalSheet: (technicalSheetId: number) => void
  onEditProduct: (productId: string) => void
  onEditTechnicalSheet: (technicalSheetId: number) => void
  onNewProduct: () => void
  onProductAction: (productId: string, action: ProductAction) => void
  onSearchChange: (value: string) => void
  onToggleProductPackageDetails: (productId: string) => void
  setColumnFilters: Dispatch<SetStateAction<Partial<Record<ColumnKey, string[]>>>>
  setColumnSort: Dispatch<SetStateAction<ColumnSort<ColumnKey> | null>>
  setColumnVisibility: Dispatch<SetStateAction<Record<ColumnKey, boolean>>>
  setOpenColumnMenu: Dispatch<SetStateAction<ColumnKey | null>>
}

function getActiveProductPackages(product: ProductRecord) {
  return product.packages.filter((item) => item.isActive)
}

function formatProductPackageQuantityLabel(product: ProductRecord, packageForm: PackageForm) {
  const quantity = calculateNormalizedPackageQuantity(packageForm, product.controlUnit)
  return quantity > 0 ? `${formatDecimal(quantity)} ${formatControlUnitShort(product.controlUnit)}` : 'SEM QUANTIDADE'
}

function formatProductPackagePurchasePriceLabel(packageForm: PackageForm) {
  const purchasePrice = parseDecimal(packageForm.purchasePrice) ?? 0
  return purchasePrice > 0 ? `R$ ${formatMoney(purchasePrice)}` : 'Sem custo'
}

export function ProductListPanel({
  canDeleteProducts,
  columnFilters,
  columnSort,
  columnVisibility,
  distinctColumnValues,
  expandedProductPackageIds,
  hiddenColumns,
  openColumnMenu,
  productListId,
  productSearch,
  productSuggestions,
  visibleProducts,
  getProductColumnValue,
  onCopyProduct,
  onCopyTechnicalSheet,
  onEditProduct,
  onEditTechnicalSheet,
  onNewProduct,
  onProductAction,
  onSearchChange,
  onToggleProductPackageDetails,
  setColumnFilters,
  setColumnSort,
  setColumnVisibility,
  setOpenColumnMenu,
}: ProductListPanelProps) {
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length + 1

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Produtos</p>
          <h2>Produtos cadastrados</h2>
        </div>
        <div className="toolbar-actions">
          <button className="primary-button" type="button" onClick={onNewProduct}>
            Novo produto
          </button>
        </div>
      </div>

      <div className="list-toolbar">
        <label className="field search-field">
          <span>Pesquisar produto</span>
          <NormalizedTextInput
            list={productListId}
            value={productSearch}
            onChange={onSearchChange}
            commitMode="debounce"
            placeholder="Busque por nome, ID interno ou ID da empresa"
          />
          <datalist id={productListId}>
            {productSuggestions.map((item) => (
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
              {columnVisibility.product
                ? renderColumnHeader(
                    'product',
                    'Produto',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.internalId
                ? renderColumnHeader(
                    'internalId',
                    'ID interno',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.companyId
                ? renderColumnHeader(
                    'companyId',
                    'ID empresa',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.sectors
                ? renderColumnHeader(
                    'sectors',
                    'Setores',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.family
                ? renderColumnHeader(
                    'family',
                    'Familia',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.subfamily
                ? renderColumnHeader(
                    'subfamily',
                    'Subfamilia',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.controlUnit
                ? renderColumnHeader(
                    'controlUnit',
                    'Unidade',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.unitCost
                ? renderColumnHeader(
                    'unitCost',
                    'Custo unitario',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.purchaseCost
                ? renderColumnHeader(
                    'purchaseCost',
                    'Custo de compra',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.costStatus
                ? renderColumnHeader(
                    'costStatus',
                    'Status de custo',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.executionYield
                ? renderColumnHeader(
                    'executionYield',
                    'Volume execucao',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.packages
                ? renderColumnHeader(
                    'packages',
                    'Embalagens',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              {columnVisibility.status
                ? renderColumnHeader(
                    'status',
                    'Status',
                    openColumnMenu,
                    setOpenColumnMenu,
                    columnFilters,
                    distinctColumnValues,
                    setColumnFilters,
                    setColumnVisibility,
                    columnSort,
                    setColumnSort,
                  )
                : null}
              <th className="sticky-actions">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.length > 0 ? (
              visibleProducts.map((product) => {
                const activePackages = getActiveProductPackages(product)
                const isPackageDetailsExpanded = expandedProductPackageIds.has(product.id)
                const costStatus = getProductColumnValue(product, 'costStatus')
                return (
                  <Fragment key={product.id}>
                    <tr>
                      {columnVisibility.product ? (
                        <td className="sticky-product-cell">
                          <strong>{product.name}</strong>
                        </td>
                      ) : null}
                      {columnVisibility.internalId ? <td>{product.id}</td> : null}
                      {columnVisibility.companyId ? <td>{product.companyProductId || '-'}</td> : null}
                      {columnVisibility.sectors ? <td>{product.sectors.join(', ')}</td> : null}
                      {columnVisibility.family ? <td>{product.family}</td> : null}
                      {columnVisibility.subfamily ? <td>{product.subfamily}</td> : null}
                      {columnVisibility.controlUnit ? <td>{getProductColumnValue(product, 'controlUnit')}</td> : null}
                      {columnVisibility.unitCost ? <td>{getProductColumnValue(product, 'unitCost')}</td> : null}
                      {columnVisibility.purchaseCost ? (
                        <td>
                          <div className="package-cost-cell">
                            <span>{getProductColumnValue(product, 'purchaseCost')}</span>
                            {activePackages.length > 1 ? (
                              <button
                                type="button"
                                className="link-button package-cost-toggle"
                                onClick={() => onToggleProductPackageDetails(product.id)}
                              >
                                {isPackageDetailsExpanded ? 'Ocultar' : 'Detalhar'}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                      {columnVisibility.costStatus ? (
                        <td>
                          <span
                            className={
                              costStatus === 'OK'
                                ? 'package-chip package-chip-success'
                                : 'package-chip package-chip-warning'
                            }
                          >
                            {costStatus}
                          </span>
                        </td>
                      ) : null}
                      {columnVisibility.executionYield ? <td>{getProductColumnValue(product, 'executionYield')}</td> : null}
                      {columnVisibility.packages ? <td>{String(product.packages.length)}</td> : null}
                      {columnVisibility.status ? (
                        <td>
                          <span
                            className={
                              product.isActive
                                ? 'package-chip package-chip-success'
                                : 'package-chip package-chip-warning'
                            }
                          >
                            {product.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      ) : null}
                      <td className="sticky-actions-cell">
                        <div className="table-actions">
                          <button
                            className="icon-button icon-edit"
                            type="button"
                            aria-label="Editar produto"
                            title="Editar produto"
                            onClick={() =>
                              typeof product.technicalSheetId === 'number'
                                ? onEditTechnicalSheet(product.technicalSheetId)
                                : onEditProduct(product.id)
                            }
                          >
                            <span aria-hidden="true">✎</span>
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={typeof product.technicalSheetId === 'number' ? 'Copiar ficha tecnica' : 'Copiar produto'}
                            title={typeof product.technicalSheetId === 'number' ? 'Copiar ficha tecnica' : 'Copiar produto'}
                            onClick={() =>
                              typeof product.technicalSheetId === 'number'
                                ? onCopyTechnicalSheet(product.technicalSheetId)
                                : onCopyProduct(product.id)
                            }
                          >
                            <span aria-hidden="true">⧉</span>
                          </button>
                          <button
                            className="icon-button icon-disable"
                            type="button"
                            aria-label={product.isActive ? 'Inativar produto' : 'Ativar produto'}
                            title={product.isActive ? 'Inativar produto' : 'Ativar produto'}
                            onClick={() =>
                              onProductAction(product.id, product.isActive ? 'disable' : 'enable')
                            }
                          >
                            <span aria-hidden="true">{product.isActive ? '◐' : '◑'}</span>
                          </button>
                          {canDeleteProducts ? (
                            <button
                              className="icon-button icon-delete"
                              type="button"
                              aria-label="Excluir produto"
                              title="Excluir produto"
                              onClick={() => onProductAction(product.id, 'delete')}
                            >
                              <span aria-hidden="true">🗑</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {isPackageDetailsExpanded ? (
                      <tr className="package-cost-detail-row">
                        <td colSpan={visibleColumnCount}>
                          <div className="package-cost-detail-panel">
                            <strong>Embalagens ativas de {product.name}</strong>
                            <div className="package-cost-detail-grid">
                              {activePackages.map((packageForm) => (
                                <article key={packageForm.id} className="package-cost-detail-card">
                                  <span>{packageForm.internalCode || `EMB-${packageForm.id}`}</span>
                                  <strong>
                                    {formatProductPackagePurchasePriceLabel(packageForm)} /{' '}
                                    {formatProductPackageQuantityLabel(product, packageForm)}
                                  </strong>
                                </article>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            ) : (
              <tr>
                <td colSpan={visibleColumnCount}>
                  <div className="empty-state empty-state-inline">
                    <strong>Nenhum produto encontrado.</strong>
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
