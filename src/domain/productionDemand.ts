export function getUncoveredProductionQuantity(requiredQuantity: number, currentQuantity: number) {
  return Math.max(requiredQuantity - currentQuantity, 0)
}
