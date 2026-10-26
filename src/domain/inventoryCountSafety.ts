import type { InventoryCountableItem, InventoryCountSessionRecord, InventoryRecord } from '../types/domain'

export function canCountOpenInventoryItems(item: InventoryCountableItem | null) {
  return Boolean(item && item.kind !== 'ITEM' && !(item.kind === 'PRODUTO' && item.controlUnit === 'UNIT'))
}

export function isInventorySessionInOpenInventory(
  session: InventoryCountSessionRecord,
  inventory: InventoryRecord | null | undefined,
) {
  return Boolean(inventory && !inventory.isClosed && session.inventoryId === inventory.id &&
    session.companyId === inventory.companyId && session.countedAt === inventory.countedAt)
}
