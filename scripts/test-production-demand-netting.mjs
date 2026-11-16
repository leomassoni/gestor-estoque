import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({
  entryPoints: ['src/domain/productionDemand.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
const { getUncoveredProductionQuantity } = await import(moduleUrl)

const pewenToProduce = getUncoveredProductionQuantity(11110, 8286.68)
const sodaRequired = pewenToProduce * 516.129 / 1000
const sodaToProduce = getUncoveredProductionQuantity(sodaRequired, 938)
const sumoRequired = sodaToProduce * 200 / 430
const sumoToProduce = getUncoveredProductionQuantity(sumoRequired, 0)
const grapesRequired = sumoToProduce * 1000 / 650

assert(Math.abs(pewenToProduce - 2823.32) < 0.001)
assert(Math.abs(sodaToProduce - 519.19732828) < 0.001)
assert(Math.abs(sumoToProduce - 241.48712943) < 0.001)
assert(Math.abs(grapesRequired - 371.51866067) < 0.001)
assert.equal(Math.ceil(grapesRequired / 500), 1)
assert.equal(getUncoveredProductionQuantity(11110, 12000), 0)
assert.equal(getUncoveredProductionQuantity(100, -20), 120)

console.log('PASS: a cascata desconta o estoque de cada preparo antes de calcular suas dependencias')
