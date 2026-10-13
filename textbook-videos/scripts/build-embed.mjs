// 台帳から、wecoffee-os の章本文に入れる図解ブロックと SQL を作る。
//   node scripts/build-embed.mjs
// 出力（embed/）:
//   org-figures.json : 章ごとの { id, chapter, chapterTitle, before, html }（embed-local.mjs が手元の原稿に入れるときに使う）
//   apply.sql        : 見出しの直前にブロックを入れる（同じ id のマーカーがあれば何もしない＝冪等）
//   revert.sql       : 入れたブロックをそのまま取り除く（apply の逆）
//   check.sql        : before の見出しと sources の原文が、いまの本文にあるかを確かめる（読むだけ）
// 動画とポスターの置き場（Supabase Storage の公開 URL）は環境変数で変えられる。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { figureHtml, validateSpec } from './lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SUPABASE = process.env.SUPABASE_PUBLIC_URL ?? 'https://sttioqmsvinjeovzohqx.supabase.co'
const VIDEO_BASE = process.env.VIDEO_BASE ?? `${SUPABASE}/storage/v1/object/public/videos/library/org`
const POSTER_BASE = process.env.POSTER_BASE ?? `${SUPABASE}/storage/v1/object/public/photos/library/org`
const VERSION = process.env.VIDEO_VERSION ?? '1' // 作り直したら上げる（ブラウザのキャッシュを避ける）
const TEXTBOOK_SLUG = 'org'

const specs = JSON.parse(fs.readFileSync(path.join(ROOT, 'ledger/org.json'), 'utf8'))
const titles = JSON.parse(fs.readFileSync(path.join(ROOT, 'ledger/org-chapters.json'), 'utf8')) // [{ sort_order, title }]
const errs = specs.flatMap(validateSpec)
if (errs.length) {
  console.error(errs.join('\n'))
  process.exit(1)
}

const dq = (tag, s) => {
  if (s.includes(`$${tag}$`)) throw new Error(`本文に $${tag}$ が含まれる`)
  return `$${tag}$${s}$${tag}$`
}
const tb = `(select id from public.library_textbooks where slug = '${TEXTBOOK_SLUG}')`

// 章ごとに並べる（1 章に複数あれば n／total を振る）
const byChapter = new Map()
for (const s of [...specs].sort((a, b) => a.chapter - b.chapter || a.id.localeCompare(b.id))) {
  if (!byChapter.has(s.chapter)) byChapter.set(s.chapter, [])
  byChapter.get(s.chapter).push(s)
}

const figures = []
const apply = [`-- 図解動画のブロックを『組織を診る・設計する・動かす』の章に入れる（build-embed.mjs が生成。手で直さない）`, `begin;`]
const revert = [`-- apply.sql で入れたブロックを取り除く（build-embed.mjs が生成）`, `begin;`]
const check = [`-- 読むだけ。before の見出しと sources の原文が本文にあるか（すべて true になるはず）`]

for (const [chapter, list] of byChapter) {
  const chapterTitle = titles.find((t) => t.sort_order === chapter)?.title
  if (!chapterTitle) throw new Error(`章 ${chapter} の題が ledger/org-chapters.json にない`)
  list.forEach((spec, i) => {
    const urls = { video: `${VIDEO_BASE}/${spec.id}.mp4?v=${VERSION}`, poster: `${POSTER_BASE}/${spec.id}.jpg?v=${VERSION}` }
    const html = figureHtml(spec, urls, i + 1, list.length)
    const unit = `${html}\n\n` // 見出し行の先頭に入れる単位（ブロック＋空行）
    figures.push({ id: spec.id, chapter, chapterTitle, before: spec.before, html })
    const where = `textbook_id = ${tb} and sort_order = ${chapter}`
    const pos = `greatest(position(E'\\n### ' || ${dq('b', spec.before)} || E'\\n' in content), position(E'\\n## ' || ${dq('b', spec.before)} || E'\\n' in content))`
    apply.push(
      `-- ${spec.id}　${chapterTitle}　「${spec.before}」の前`,
      `update public.library_chapters c set content = overlay(c.content placing ${dq('blk', unit)} from h.pos + 1 for 0)`,
      `from (select id, ${pos} as pos from public.library_chapters where ${where}) h`,
      `where c.id = h.id and h.pos > 0 and position('<!-- explainer:${spec.id} -->' in c.content) = 0;`,
    )
    revert.push(`-- ${spec.id}`, `update public.library_chapters set content = replace(content, ${dq('blk', unit)}, '') where ${where} and position('<!-- explainer:${spec.id} -->' in content) > 0;`)
    check.push(
      `select '${spec.id}' as id, ${pos} > 0 as before_ok, substring(content from ${pos} - 1 for 2) = E'\\n\\n' as blank_before, array[${spec.sources.map((s) => `position(${dq('s', s)} in content) > 0`).join(', ')}] as sources_ok from public.library_chapters where ${where}`,
      `union all`,
    )
  })
}
apply.push(`commit;`)
revert.push(`commit;`)
check.pop()
check[check.length - 1] += ';'

const out = path.join(ROOT, 'embed')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'org-figures.json'), JSON.stringify(figures, null, 1) + '\n')
fs.writeFileSync(path.join(out, 'apply.sql'), apply.join('\n') + '\n')
fs.writeFileSync(path.join(out, 'revert.sql'), revert.join('\n') + '\n')
fs.writeFileSync(path.join(out, 'check.sql'), check.join('\n') + '\n')
console.log(`embed/: ${figures.length} ブロック（${byChapter.size} 章）\n  動画 ${VIDEO_BASE}/<id>.mp4\n  ポスター ${POSTER_BASE}/<id>.jpg`)
