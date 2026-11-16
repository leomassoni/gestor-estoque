import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: ['src/domain/requisitionPackageQuantity.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
const { calculateRequisitionPackageQuantities } = await import(moduleUrl)

assert.deepEqual(calculateRequisitionPackageQuantities(24 / 50, 0), { targetPackages: 1, requestedPackages: 1 })
assert.deepEqual(calculateRequisitionPackageQuantities(64.8 / 50, 0), { targetPackages: 2, requestedPackages: 2 })
assert.deepEqual(calculateRequisitionPackageQuantities(64.8 / 50, 20 / 50), { targetPackages: 2, requestedPackages: 1 })
assert.deepEqual(calculateRequisitionPackageQuantities(24 / 50, 24 / 50), { targetPackages: 1, requestedPackages: 0 })
assert.deepEqual(calculateRequisitionPackageQuantities(24 / 50, 50 / 50), { targetPackages: 1, requestedPackages: 0 })
assert.deepEqual(calculateRequisitionPackageQuantities(1, 0.9999999999999999), { targetPackages: 1, requestedPackages: 0 })
assert.deepEqual(calculateRequisitionPackageQuantities(0, -0.4), { targetPackages: 0, requestedPackages: 1 })

console.log('PASS: requisicao de produtos embalados cobre minimo e saldo parcial sem zerar demanda positiva')
