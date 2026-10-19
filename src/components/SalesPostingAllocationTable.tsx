import { useState } from 'react'
import type { SalesPostingAllocation } from '../domain/salesImports'
import { formatDateForDisplay, formatDecimal } from '../utils/core'

export function SalesPostingAllocationTable({ title, items }: { title: string; items: SalesPostingAllocation[] }) {
  const [page, setPage] = useState(0)
  const pageSize = 100
  const lastPage = Math.max(0, Math.ceil(items.length / pageSize) - 1)
  const active = Math.min(page, lastPage)
  if (!items.length) return null
  return <details><summary>{title} ({items.length})</summary>
    {items.length > pageSize && <div className="form-actions">
      <button type="button" className="icon-button" title="Pagina anterior" aria-label="Pagina anterior" disabled={!active} onClick={() => setPage(active - 1)}>&lt;</button>
      <span>{active + 1} / {lastPage + 1}</span>
      <button type="button" className="icon-button" title="Proxima pagina" aria-label="Proxima pagina" disabled={active >= lastPage} onClick={() => setPage(active + 1)}>&gt;</button>
    </div>}
    <div className="table-wrap"><table className="data-table"><thead><tr>
      <th>Data</th><th>Item</th><th>Quantidade</th><th>Saldo antes</th><th>Saldo depois</th><th>Origem</th>
    </tr></thead><tbody>{items.slice(active * pageSize, (active + 1) * pageSize).map((allocation, index) => <tr key={index}>
      <td>{formatDateForDisplay(allocation.consumedAt)}</td><td>{allocation.name}</td><td>{formatDecimal(allocation.quantity)} {allocation.unit}</td>
      <td>{formatDecimal(allocation.balanceBefore)}</td><td>{formatDecimal(allocation.balanceAfter)}</td>
      <td>{allocation.sourceName} &gt; {allocation.path.map((step) => step.name).join(' > ')}{allocation.theoretical ? ' (CONSUMO TEORICO)' : ''}</td>
    </tr>)}</tbody></table></div>
  </details>
}
