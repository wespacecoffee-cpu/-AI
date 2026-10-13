// 手元の原稿（wecoffee-os の取り込み元の Markdown）に、図解ブロックを入れる／取り除く。
// wecoffee-os の scripts/ingest-library.mjs は再実行のたびに章を原稿から入れ替えるので、
// DB だけに入れたブロックは次の取り込みで消える。原稿にも同じブロックを入れておけば消えない。
//
//   node scripts/embed-local.mjs                  # 既定の場所（デスクトップ\ラベル\organization-textbook\manuscript）
//   node scripts/embed-local.mjs --dir "<原稿のフォルダ>"
//   node scripts/embed-local.mjs --dry            # 書き換えずに予定だけ表示
//   node scripts/embed-local.mjs --revert         # 入れたブロックを取り除く
// 章のファイルは、本文の「# <章の題>」の行で見分ける（ファイル名に依らない）。改行コード（CRLF/LF）と BOM はそのまま保つ。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { insertBefore, removeBlock } from './lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : undefined
}

const REL = path.join('ラベル', 'organization-textbook', 'manuscript')
const candidates = opt('dir')
  ? [opt('dir')]
  : [path.join(os.homedir(), 'Desktop', REL), path.join(os.homedir(), 'OneDrive', 'Desktop', REL), path.join(os.homedir(), 'OneDrive', 'デスクトップ', REL)]
const dir = candidates.find((d) => fs.existsSync(d))
if (!dir) {
  console.error(`原稿のフォルダが見つかりません。--dir で指定してください。\n探した場所:\n  ${candidates.join('\n  ')}`)
  process.exit(1)
}

const figures = JSON.parse(fs.readFileSync(path.join(ROOT, 'embed/org-figures.json'), 'utf8'))
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.md$/i.test(e.name)) files.push(p)
  }
}
walk(dir)

const read = (p) => {
  const raw = fs.readFileSync(p, 'utf8')
  const bom = raw.charCodeAt(0) === 0xfeff
  return { bom, text: bom ? raw.slice(1) : raw }
}
const h1 = (text) => (text.split(/\r?\n/).find((l) => /^# /.test(l)) ?? '').replace(/^# /, '').trim()

let changed = 0
let problems = 0
for (const fig of figures) {
  const hits = files.filter((p) => h1(read(p).text) === fig.chapterTitle)
  if (hits.length !== 1) {
    console.error(`× ${fig.id}「${fig.chapterTitle}」: 該当する原稿が ${hits.length} 件`)
    problems++
    continue
  }
  const file = hits[0]
  const { bom, text } = read(file)
  const r = flag('revert') ? removeBlock(text, fig.id) : insertBefore(text, fig.before, fig.html)
  if (!r.ok) {
    if (r.reason === 'already') console.log(`- ${fig.id}: 入っている（${path.basename(file)}）`)
    else if (flag('revert')) console.log(`- ${fig.id}: 入っていない（${path.basename(file)}）`)
    else {
      console.error(`× ${fig.id}: ${r.reason}（${path.basename(file)}）`)
      problems++
    }
    continue
  }
  console.log(`${flag('dry') ? '（予定）' : ''}${flag('revert') ? '取り除く' : '入れる'} ${fig.id} → ${path.basename(file)}「${fig.before}」の前`)
  if (!flag('dry')) fs.writeFileSync(file, (bom ? '﻿' : '') + r.content, 'utf8')
  changed++
}
console.log(`\n${changed} 件${flag('dry') ? '（未書き込み）' : ''}、問題 ${problems} 件。フォルダ: ${dir}`)
if (problems) process.exit(1)
