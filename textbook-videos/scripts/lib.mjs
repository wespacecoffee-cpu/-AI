// 台帳の検証と、埋め込み用 HTML の組み立て（scripts/*.mjs と test/ が共通で使う）
export const MARKS = ['頑健', '有力', '仮説/経験則', '俗説注意']
export const KINDS = ['triad', 'spectrum', 'path', 'contrast', 'axes', 'loop', 'strata', 'venn', 'balance', 'stairs', 'constellation']

export const len = (s) => [...(s ?? '')].length
export const segText = (segs) => segs.map((s) => (typeof s === 'string' ? s : '')).join('')

export function stepCount(film) {
  switch (film.kind) {
    case 'triad':
      return film.center ? 4 : 3
    case 'spectrum':
      return 1 + film.markers.length
    case 'path':
      return film.stations.length
    case 'contrast':
    case 'axes':
    case 'balance':
    case 'constellation':
      return 3
    case 'loop':
      return film.nodes.length + 1
    case 'strata':
      return film.layers.length
    case 'venn':
      return film.circles.length + 1
    case 'stairs':
      return film.steps.length
    default:
      return NaN
  }
}

/** 台帳 1 項目の検査。問題の一覧（空なら合格）を返す */
export function validateSpec(spec) {
  const errs = []
  const e = (m) => errs.push(`${spec.id ?? '?'}: ${m}`)
  for (const k of ['id', 'chapter', 'chapterLabel', 'before', 'title', 'summary', 'film', 'beats', 'closing', 'sources']) if (spec[k] === undefined) e(`${k} がない`)
  if (errs.length) return errs
  if (!/^org-\d{2}$/.test(spec.id)) e(`id の形式 (${spec.id})`)
  if (spec.id !== `org-${String(spec.chapter).padStart(2, '0')}`) e('id と chapter が合わない')
  const max = (what, s, n) => len(s) > n && e(`${what}「${s}」が ${len(s)} 字（上限 ${n}）`)
  const checkSegs = (what, segs, n) => {
    if (!Array.isArray(segs)) return e(`${what} が配列でない`)
    for (const s of segs) if (typeof s !== 'string' && !(s && MARKS.includes(s.mark))) e(`${what} に不正な要素 ${JSON.stringify(s)}`)
    max(what, segText(segs), n)
  }
  max('title', spec.title, 20)
  checkSegs('summary', spec.summary, 80)
  max('closing.phrase', spec.closing.phrase, 16)
  if (spec.closing.mark && !MARKS.includes(spec.closing.mark)) e(`closing.mark が不正 (${spec.closing.mark})`)
  if (!spec.before || /^#/.test(spec.before)) e('before は # を除いた見出しの文字列')
  if (!Array.isArray(spec.sources) || spec.sources.length < 1) e('sources が空')

  const f = spec.film
  if (!KINDS.includes(f.kind)) e(`film.kind が不正 (${f.kind})`)
  const item = (what, it) => {
    if (!it || typeof it.word !== 'string') return e(`${what}.word がない`)
    max(`${what}.word`, it.word, 8)
    if (it.note !== undefined) max(`${what}.note`, it.note, 14)
  }
  const between = (what, arr, lo, hi) => (!Array.isArray(arr) || arr.length < lo || arr.length > hi) && e(`${what} の数は ${lo}〜${hi}（${arr?.length}）`)
  switch (f.kind) {
    case 'triad':
      between('nodes', f.nodes, 3, 3)
      f.nodes?.forEach((n, i) => item(`nodes[${i}]`, n))
      if (f.center) item('center', f.center)
      break
    case 'spectrum':
      item('left', f.left)
      item('right', f.right)
      between('markers', f.markers, 1, 4)
      f.markers?.forEach((m, i) => {
        item(`markers[${i}]`, m)
        if (!(typeof m.at === 'number' && m.at >= 0 && m.at <= 1)) e(`markers[${i}].at は 0〜1`)
      })
      break
    case 'path':
      between('stations', f.stations, 3, 5)
      f.stations?.forEach((s, i) => item(`stations[${i}]`, s))
      if (f.broken !== undefined && !(Number.isInteger(f.broken) && f.broken >= 1 && f.broken < f.stations.length)) e('broken は 1 ≦ n < 駅数')
      break
    case 'contrast':
      for (const side of ['left', 'right']) {
        max(`${side}.head`, f[side]?.head, 8)
        between(`${side}.lines`, f[side]?.lines, 0, 3)
        f[side]?.lines?.forEach((l, i) => max(`${side}.lines[${i}]`, l, 14))
      }
      if (!['left', 'right'].includes(f.emphasis)) e('emphasis は left/right')
      if (f.verdict !== undefined) max('verdict', f.verdict, 14)
      break
    case 'axes':
      for (const a of ['x', 'y']) {
        max(`${a}.label`, f[a]?.label, 8)
        max(`${a}.low`, f[a]?.low, 6)
        max(`${a}.high`, f[a]?.high, 6)
      }
      for (const q of ['tl', 'tr', 'bl', 'br']) item(`quadrants.${q}`, f.quadrants?.[q])
      if (!['tl', 'tr', 'bl', 'br'].includes(f.focus)) e('focus は tl/tr/bl/br')
      break
    case 'loop':
      between('nodes', f.nodes, 3, 5)
      f.nodes?.forEach((n, i) => item(`nodes[${i}]`, n))
      if (!['vicious', 'virtuous'].includes(f.tone)) e('tone は vicious/virtuous')
      if (f.center) max('center.word', f.center.word, 8)
      break
    case 'strata':
      between('layers', f.layers, 3, 4)
      f.layers?.forEach((l, i) => item(`layers[${i}]`, l))
      break
    case 'venn':
      between('circles', f.circles, 2, 3)
      f.circles?.forEach((c, i) => item(`circles[${i}]`, c))
      item('overlap', f.overlap)
      break
    case 'balance':
      for (const side of ['left', 'right']) {
        max(`${side}.word`, f[side]?.word, 8)
        between(`${side}.items`, f[side]?.items, 0, 2)
        f[side]?.items?.forEach((t, i) => max(`${side}.items[${i}]`, t, 14))
      }
      if (!['left', 'right', 'level'].includes(f.tilt)) e('tilt は left/right/level')
      if (f.pivot !== undefined) max('pivot', f.pivot, 8)
      break
    case 'stairs':
      between('steps', f.steps, 3, 5)
      f.steps?.forEach((s, i) => item(`steps[${i}]`, s))
      if (f.crises) {
        if (f.crises.length > f.steps.length - 1) e('crises は steps−1 個以内')
        f.crises.forEach((c, i) => max(`crises[${i}]`, c, 8))
      }
      break
    case 'constellation':
      between('stars', f.stars, 6, 12)
      f.stars?.forEach((s, i) => max(`stars[${i}]`, s, 8))
      if (!Array.isArray(f.focus) || f.focus.length < 1 || f.focus.length > 3 || f.focus.some((i) => !(i >= 0 && i < f.stars.length))) e('focus は 1〜3 個の有効な番号')
      if (f.center !== undefined) max('center', f.center, 8)
      break
  }

  if (!Array.isArray(spec.beats) || spec.beats.length < 3 || spec.beats.length > 6) e(`beats は 3〜6（${spec.beats?.length}）`)
  const S = stepCount(f)
  let prev = 0
  spec.beats?.forEach((b, i) => {
    checkSegs(`beats[${i}].caption`, b.caption, 40)
    if (!Number.isInteger(b.show) || b.show < prev || b.show > S) e(`beats[${i}].show=${b.show} が不正（前 ${prev}、S=${S}）`)
    prev = Math.max(prev, b.show)
  })
  if (spec.beats?.length && spec.beats.at(-1).show !== S) e(`最後の拍の show (${spec.beats.at(-1).show}) が段数 S=${S} と違う`)
  return errs
}

// ── 埋め込み HTML ─────────────────────────────────────────
// coffee-community の ExplainerFigure（figure.explainer：「図解 n／total」と題 → 動画 → 要約 → 動画の内容を文字で読む欄）と同じ構成。
// wecoffee-os は marked（GFM）で Markdown → HTML にし、<script> だけを除く。figure から始まる HTML ブロックは
// 空行まで素通しなので、ブロックの中に空行を入れない（test/embed.test.mjs で同じ関数を使って確かめる）。

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const MARK_STYLE = {
  頑健: 'border:1px solid #c9975b;color:#8a5a2b;background:rgba(201,151,91,.12)',
  有力: 'border:1px solid #c9975b;color:#8a5a2b',
  '仮説/経験則': 'border:1px dashed #9a948a;color:#6f6a62',
  俗説注意: 'border:1px dashed #9a948a;color:#6f6a62;text-decoration:line-through',
}
const markHtml = (m) => `<span class="ev" style="display:inline-block;margin:0 .25em;padding:0 .5em;border-radius:999px;font-size:.78em;line-height:1.5;vertical-align:.08em;${MARK_STYLE[m]}">【${esc(m)}】</span>`
export const segsHtml = (segs) => segs.map((s) => (typeof s === 'string' ? esc(s) : markHtml(s.mark))).join('')

/** 図の言葉を文字で読む（動画を見られない人・読み上げのため） */
export function filmText(f) {
  const it = (x) => (x.note ? `${x.word}（${x.note}）` : x.word)
  switch (f.kind) {
    case 'triad':
      return `三つの要素：${f.nodes.map(it).join('／')}${f.center ? `。中心に ${it(f.center)}` : ''}`
    case 'spectrum':
      return `両端：${it(f.left)} ⇔ ${it(f.right)}。その間：${f.markers.map(it).join('／')}`
    case 'path':
      return `流れ：${f.stations.map(it).join(' → ')}${f.broken ? `（${f.stations[f.broken - 1].word} と ${f.stations[f.broken].word} の間で途切れる）` : ''}`
    case 'contrast':
      return `${f.left.head}（${f.left.lines.join('・')}）と ${f.right.head}（${f.right.lines.join('・')}）。残るのは「${f.emphasis === 'left' ? f.left.head : f.right.head}」${f.verdict ? `：${f.verdict}` : ''}`
    case 'axes':
      return `横軸 ${f.x.label}（${f.x.low}→${f.x.high}）× 縦軸 ${f.y.label}（${f.y.low}→${f.y.high}）。左上 ${it(f.quadrants.tl)}／右上 ${it(f.quadrants.tr)}／左下 ${it(f.quadrants.bl)}／右下 ${it(f.quadrants.br)}。注目：${f.quadrants[f.focus].word}`
    case 'loop':
      return `${f.tone === 'vicious' ? '悪循環' : '好循環'}：${f.nodes.map(it).join(' → ')} → （はじめに戻る）${f.center ? `。中心に ${f.center.word}` : ''}`
    case 'strata':
      return `下から：${f.layers.map(it).join(' ／ ')}`
    case 'venn':
      return `重なる円：${f.circles.map(it).join('／')}。重なり：${it(f.overlap)}`
    case 'balance':
      return `天秤：${f.left.word}（${f.left.items.join('・')}）と ${f.right.word}（${f.right.items.join('・')}）${f.pivot ? `。支点：${f.pivot}` : ''}`
    case 'stairs':
      return `段階：${f.steps.map(it).join(' → ')}${f.crises?.length ? `。段の間の壁：${f.crises.join('／')}` : ''}`
    case 'constellation':
      return `星座：${f.stars.join('／')}。注目：${f.focus.map((i) => f.stars[i]).join('・')}${f.center ? `。中心に ${f.center}` : ''}`
  }
}

export const markerOpen = (id) => `<!-- explainer:${id} -->`
export const markerClose = (id) => `<!-- /explainer:${id} -->`

/**
 * 章に入れる 1 ブロック（空行を含まない）。n/total は章の中の何本目か。
 * urls: { video, poster }
 */
export function figureHtml(spec, urls, n = 1, total = 1) {
  const L = []
  L.push(markerOpen(spec.id))
  L.push(`<figure class="explainer" id="explainer-${spec.id}" aria-labelledby="explainer-${spec.id}-title" style="margin:2.2em 0;padding:0">`)
  L.push(`<p class="explainer-head" style="margin:0 0 .6em;display:flex;gap:.8em;align-items:baseline;flex-wrap:wrap"><span class="lead-label" style="font-size:.8em;letter-spacing:.2em;opacity:.7">図解 ${n}／${total}</span><strong id="explainer-${spec.id}-title" style="letter-spacing:.06em">${esc(spec.title)}</strong></p>`)
  L.push(`<video controls playsinline preload="metadata" width="1280" height="720" poster="${esc(urls.poster)}" src="${esc(urls.video)}" style="display:block;width:100%;height:auto;aspect-ratio:16/9;border-radius:10px;background:#0b0f13" aria-describedby="explainer-${spec.id}-text">動画を再生できない環境です。下の「動画の内容を文字で読む」をご覧ください。</video>`)
  L.push(`<figcaption style="margin-top:.7em;font-size:.92em;line-height:1.8">${segsHtml(spec.summary)}</figcaption>`)
  L.push(`<details id="explainer-${spec.id}-text" style="margin-top:.5em;font-size:.9em;line-height:1.8"><summary style="cursor:pointer;opacity:.75">動画の内容を文字で読む</summary><ol style="margin:.5em 0 0 1.4em;padding:0">` +
    spec.beats.map((b) => `<li>${segsHtml(b.caption)}</li>`).join('') +
    `<li>${esc(spec.closing.phrase)}${spec.closing.mark ? markHtml(spec.closing.mark) : ''}</li></ol><p style="margin:.4em 0 0">図：${esc(filmText(spec.film))}</p></details>`)
  L.push('</figure>')
  L.push(markerClose(spec.id))
  const html = L.join('\n')
  if (/\n\s*\n/.test(html)) throw new Error(`${spec.id}: ブロックの中に空行がある`)
  return html
}

/** 見出し行（## / ###、# を除いた文字列が before）の直前にブロックを入れる。改行コードは本文に合わせる */
export function insertBefore(content, before, block) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)
  const idx = lines.findIndex((l) => /^#{2,3} /.test(l) && l.replace(/^#{2,3} /, '').trim() === before.trim())
  if (idx < 0) return { ok: false, reason: `見出し「${before}」が見つからない` }
  const id = (block.match(/<!-- explainer:([^ ]+) -->/) || [])[1]
  if (id && content.includes(markerOpen(id))) return { ok: false, reason: 'already', content }
  const blockLines = block.split('\n')
  const out = [...lines.slice(0, idx), ...blockLines, '', ...lines.slice(idx)]
  return { ok: true, content: out.join(eol) }
}

/** insertBefore の逆。マーカーの間（とその後ろの空行 1 つ）を取り除く */
export function removeBlock(content, id) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)
  const a = lines.indexOf(markerOpen(id))
  const b = lines.indexOf(markerClose(id))
  if (a < 0 || b < a) return { ok: false, content }
  const end = lines[b + 1] === '' ? b + 2 : b + 1
  return { ok: true, content: [...lines.slice(0, a), ...lines.slice(end)].join(eol) }
}
