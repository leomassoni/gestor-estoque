import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { canCountOpenInventoryItems, isInventorySessionInOpenInventory } from '../src/domain/inventoryCountSafety.ts'
const require = createRequire(import.meta.url)
const { assertInventorySessionWritable } = require('../server/inventorySessionSafety.js')
assert.equal(canCountOpenInventoryItems({ kind: 'PRODUTO', controlUnit: 'UNIT' }), false)
assert.equal(canCountOpenInventoryItems({ kind: 'ITEM', controlUnit: 'UNIT' }), false)
assert.equal(canCountOpenInventoryItems({ kind: 'PRODUTO', controlUnit: 'MILLILITER' }), true)
assert.equal(canCountOpenInventoryItems({ kind: 'PRODUTO', controlUnit: 'GRAM' }), true)
assert.equal(canCountOpenInventoryItems({ kind: 'PREPARO', controlUnit: 'UNIT' }), true)
const inventory = { id: 103, companyId: 13, countedAt: '2026-10-25', isClosed: false }
const session = { inventoryId: 103, companyId: 13, countedAt: '2026-10-25', isClosed: false }
assert(isInventorySessionInOpenInventory(session, inventory))
for (const invalid of [null, { ...inventory, isClosed: true }, { ...inventory, id: 102 },
  { ...inventory, companyId: 5 }, { ...inventory, countedAt: '2026-10-11' }]) {
  assert.equal(isInventorySessionInOpenInventory(session, invalid), false)
}
const db = (value) => ({ appInventoryRecord: { findUnique: async () => value } })
await assertInventorySessionWritable(db(inventory), session, null)
await assert.rejects(assertInventorySessionWritable(db({ ...inventory, isClosed: true }), session, session), /finalizado/)
await assert.rejects(assertInventorySessionWritable(db(inventory), session, { ...session, isClosed: true }), /sincronizacao/)
await assertInventorySessionWritable(db(inventory), session, { ...session, isClosed: true }, true)
await assert.rejects(assertInventorySessionWritable(db({ ...inventory, isClosed: true }), session, session, true), /finalizado/)
await assertInventorySessionWritable(db(inventory), { ...session, inventoryId: null }, null)
console.log('PASS UNIT sem pergunta oculta; sessao exige empresa/data/inventario aberto; retomada explicita e operacoes preservadas')
