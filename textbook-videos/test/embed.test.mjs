// 埋め込みブロックが wecoffee-os の表示（src/lib/markdown.ts の renderMarkdown と同じ処理）で崩れないこと、
// 原稿への出し入れが正確に元に戻ること、apply.sql と同じ文字列操作が revert.sql で元に戻ることを確かめる。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { marked } from 'marked'
import { figureHtml, insertBefore, removeBlock, validateSpec } from '../scripts/lib.mjs'

// wecoffee-os src/lib/markdown.ts（2026-10 のデプロイから写した。marked ^15、gfm、<script> だけ除く）
marked.setOptions({ gfm: true, breaks: false })
const renderMarkdown = (md) => marked.parse(md.replace(/<script[\s\S]*?<\/script>/gi, ''), { async: false })

const spec = {
  id: 'org-01',
  chapter: 1,
  chapterLabel: '第1章',
  before: 'ウィリアムソンの拡張と、その限界',
  title: '市場か、組織か',
  summary: ['市場を使うにはコストがかかる。', { mark: '頑健' }],
  film: { kind: 'spectrum', left: { word: '市場' }, right: { word: '組織' }, markers: [{ word: '中間形態', at: 0.5 }] },
  beats: [
    { caption: ['市場と組織は両端'], show: 1 },
    { caption: ['間に中間形態がある', { mark: '有力' }], show: 2 },
    { caption: ['<b>と&は文字のまま'], show: 2 },
  ],
  closing: { phrase: '境界はコストで決まる', mark: '頑健' },
  sources: ['x'],
}
const urls = { video: 'https://example.supabase.co/storage/v1/object/public/videos/library/org/org-01.mp4?v=1', poster: 'https://example.supabase.co/storage/v1/object/public/photos/library/org/org-01.jpg?v=1' }
const chapter = `# 第1章 なぜ人は「会社」に集まるのか\n\n## 理論の核心\n\n### コースの問い\n\n本文の段落。**強調**。\n\n### ウィリアムソンの拡張と、その限界\n\n次の段落。\n`

test('台帳の検査が通る', () => {
  assert.deepEqual(validateSpec(spec), [])
})

test('ブロックに空行が無く、見出しの直前に入る', () => {
  const html = figureHtml(spec, urls)
  assert.ok(!/\n\s*\n/.test(html))
  const r = insertBefore(chapter, spec.before, html)
  assert.ok(r.ok)
  assert.ok(r.content.includes(`${html}\n\n### ウィリアムソンの拡張と、その限界`))
})

test('wecoffee-os と同じ renderMarkdown で figure・video・details がそのまま出て、前後の Markdown も崩れない', () => {
  const html = figureHtml(spec, urls)
  const out = renderMarkdown(insertBefore(chapter, spec.before, html).content)
  assert.match(out, /<figure class="explainer" id="explainer-org-01"/)
  assert.match(out, /<video controls playsinline preload="metadata"[^>]* src="https:\/\/example\.supabase\.co\/storage\/v1\/object\/public\/videos\/library\/org\/org-01\.mp4\?v=1"/)
  assert.match(out, /<details id="explainer-org-01-text"/)
  assert.match(out, /<h3>ウィリアムソンの拡張と、その限界<\/h3>/)
  assert.match(out, /<p>本文の段落。<strong>強調<\/strong>。<\/p>/)
  assert.match(out, /&lt;b&gt;と&amp;は文字のまま/) // 台帳の文字はエスケープされる
  assert.ok(!out.includes('<p><figure')) // 段落に包まれない
})

test('原稿への出し入れは元に戻る（LF と CRLF）・二度入れない', () => {
  const html = figureHtml(spec, urls)
  for (const text of [chapter, chapter.replace(/\n/g, '\r\n')]) {
    const a = insertBefore(text, spec.before, html)
    assert.ok(a.ok)
    if (text.includes('\r\n')) assert.ok(!/[^\r]\n/.test(a.content))
    assert.equal(insertBefore(a.content, spec.before, html).reason, 'already')
    assert.equal(removeBlock(a.content, spec.id).content, text)
  }
})

test('apply.sql と同じ操作（見出し行の先頭に「ブロック＋空行」）を revert.sql の replace で取り除くと元に戻る', () => {
  const unit = `${figureHtml(spec, urls)}\n\n`
  const pos = chapter.indexOf(`\n### ${spec.before}\n`) // position() - 1
  assert.ok(pos > 0)
  assert.equal(chapter.slice(pos - 1, pos + 1), '\n\n') // 見出しの前が空行
  const applied = chapter.slice(0, pos + 1) + unit + chapter.slice(pos + 1)
  assert.equal(applied, insertBefore(chapter, spec.before, figureHtml(spec, urls)).content)
  assert.equal(applied.replace(unit, ''), chapter)
})

test('台帳（ledger/org.json）がすべて検査を通る', () => {
  const specs = JSON.parse(fs.readFileSync(new URL('../ledger/org.json', import.meta.url), 'utf8'))
  for (const s of specs) assert.deepEqual(validateSpec(s), [], s.id)
})
