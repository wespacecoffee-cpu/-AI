// 台帳の機械的な検査（字数・段数・印・テンプレートの形）。本文との照合（sources の原文一致・before の見出し）は
// scripts/build-embed.mjs が出す check.sql を Supabase で流して確かめる。
//   node scripts/validate.mjs [ledger/org.json]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSpec } from './lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = process.argv[2] ?? path.join(ROOT, 'ledger/org.json')
const specs = JSON.parse(fs.readFileSync(file, 'utf8'))
const errs = specs.flatMap(validateSpec)
const ids = specs.map((s) => s.id)
const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
if (dup.length) errs.push(`id の重複: ${dup.join(', ')}`)
if (errs.length) {
  console.error(errs.join('\n'))
  console.error(`\n${errs.length} 件の問題（${specs.length} 項目）`)
  process.exit(1)
}
console.log(`OK: ${specs.length} 項目`)
