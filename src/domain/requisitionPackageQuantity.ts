export function calculateRequisitionPackageQuantities(requiredPackages: number, currentPackages: number) {
  const roundUp = (quantity: number) => quantity > 0 ? Math.max(0, Math.ceil(quantity - 1e-9)) : 0

  return {
    targetPackages: roundUp(requiredPackages),
    requestedPackages: roundUp(requiredPackages - currentPackages),
  }
}
