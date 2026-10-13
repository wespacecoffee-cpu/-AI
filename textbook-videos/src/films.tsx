// 図のテンプレート（SPEC.md の film.kind）。どれも steps[k]（段 k が立ち上がるフレーム）で進み、close で締めに渡す。
// 図の領域は y=100〜550（上は見出し、下はキャプション）。言葉は大きく少なく、線は光って進む。
import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { GlowPath, Label, SvgDefs, Word, lengthOf } from './kit'
import { C, CALM, SERIF, SOFT, clamp } from './theme'
import type { FilmSpec, Item } from './types'

type P<K extends FilmSpec['kind']> = { film: Extract<FilmSpec, { kind: K }>; steps: number[]; close: number }

export const Film: React.FC<{ film: FilmSpec; steps: number[]; close: number }> = ({ film, steps, close }) => {
  switch (film.kind) {
    case 'triad':
      return <Triad film={film} steps={steps} close={close} />
    case 'spectrum':
      return <Spectrum film={film} steps={steps} close={close} />
    case 'path':
      return <PathFilm film={film} steps={steps} close={close} />
    case 'contrast':
      return <Contrast film={film} steps={steps} close={close} />
    case 'axes':
      return <Axes film={film} steps={steps} close={close} />
    case 'loop':
      return <Loop film={film} steps={steps} close={close} />
    case 'strata':
      return <Strata film={film} steps={steps} close={close} />
    case 'venn':
      return <Venn film={film} steps={steps} close={close} />
    case 'balance':
      return <Balance film={film} steps={steps} close={close} />
    case 'stairs':
      return <Stairs film={film} steps={steps} close={close} />
    case 'constellation':
      return <Constellation film={film} steps={steps} close={close} />
  }
}

// ── 共通 ────────────────────────────────────────────────
function useClock() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const at = (start: number, config: typeof SOFT | typeof CALM = CALM) => spring({ frame: frame - start, fps, config })
  /** 段 k が出ているか（立ち上がり始めを過ぎたか） */
  const on = (start: number) => frame >= start
  return { frame, fps, at, on }
}

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={1280} height={720} viewBox="0 0 1280 720" style={{ position: 'absolute', left: 0, top: 0 }}>
    <SvgDefs />
    {children}
  </svg>
)

const line = (x1: number, y1: number, x2: number, y2: number) => `M ${x1} ${y1} L ${x2} ${y2}`

/** 2 点の間の線を、両端の言葉にかからないよう縮める */
function shortened(x1: number, y1: number, x2: number, y2: number, pad1: number, pad2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const L = Math.hypot(dx, dy)
  const ux = dx / L
  const uy = dy / L
  return line(x1 + ux * pad1, y1 + uy * pad1, x2 - ux * pad2, y2 - uy * pad2)
}

const Node: React.FC<{ x: number; y: number; r?: number; p: number; color?: string }> = ({ x, y, r = 9, p, color = C.gold }) =>
  p > 0 ? (
    <g opacity={Math.min(1, p * 1.5)}>
      <circle cx={x} cy={y} r={r * 2.4} fill="url(#halo)" />
      <circle cx={x} cy={y} r={r * p} fill="none" stroke={color} strokeWidth={2} />
      <circle cx={x} cy={y} r={r * 0.38 * p} fill={color} />
    </g>
  ) : null

/** 言葉の大きさ（長い言葉は小さく） */
const wordSize = (w: string, big: number, small: number, limit = 5) => ([...w].length > limit ? small : big)

/** 言葉の占める箱（中心から）。Rise の字間 0.14em を含む概算 */
function wordBox(item: { word: string; note?: string }, size: number) {
  const w = [...item.word].length * size * 1.16
  const nw = item.note ? [...item.note].length * 21 * 1.1 : 0
  return { hw: Math.max(w, nw) / 2 + 18, top: size * 0.7 + 10, bottom: size * 0.62 + (item.note ? 44 : 12) }
}

/** 中心 (x,y) から単位ベクトル (ux,uy) の向きに進んで、箱を出るまでの距離 */
function exitDistance(ux: number, uy: number, box: { hw: number; top: number; bottom: number }) {
  const tx = Math.abs(ux) < 1e-6 ? Infinity : box.hw / Math.abs(ux)
  const ty = Math.abs(uy) < 1e-6 ? Infinity : (uy < 0 ? box.top : box.bottom) / Math.abs(uy)
  return Math.min(tx, ty)
}

/** 2 つの言葉の間を、両方の箱の外だけでつなぐ線 */
function between(a: { x: number; y: number }, ba: ReturnType<typeof wordBox>, b: { x: number; y: number }, bb: ReturnType<typeof wordBox>) {
  const L = Math.hypot(b.x - a.x, b.y - a.y)
  const ux = (b.x - a.x) / L
  const uy = (b.y - a.y) / L
  return shortened(a.x, a.y, b.x, b.y, exitDistance(ux, uy, ba) + 8, exitDistance(-ux, -uy, bb) + 8)
}

/** 最後に出た段だけ金にする（締めの直前まで） */
const latest = (k: number, shown: number) => k === shown - 1

function shownCount(steps: number[], frame: number) {
  return steps.filter((s) => frame >= s).length
}

// ── triad：3 つの要素（と中心） ─────────────────────────────────
const Triad: React.FC<P<'triad'>> = ({ film, steps }) => {
  const { frame, at, on } = useClock()
  const pos = [
    { x: 640, y: 175 },
    { x: 330, y: 430 },
    { x: 950, y: 430 },
  ]
  const shown = shownCount(steps, frame)
  const hasCenter = !!film.center
  const centerOn = hasCenter && on(steps[3])
  const sizes = film.nodes.map((n) => wordSize(n.word, 50, 40))
  const boxes = film.nodes.map((n, i) => wordBox(n, sizes[i]))
  const cPos = { x: 640, y: 340 }
  const cSize = film.center ? wordSize(film.center.word, 42, 34) : 42
  const cBox = film.center ? wordBox(film.center, cSize) : null
  const edges: [number, number, number][] = [
    [0, 1, steps[1] + 4],
    [1, 2, steps[2] + 4],
    [2, 0, steps[2] + 18],
  ]
  return (
    <AbsoluteFill>
      <Svg>
        {edges.map(([a, b, s], i) => {
          const d = between(pos[a], boxes[a], pos[b], boxes[b])
          return <GlowPath key={i} d={d} length={lengthOf(d)} progress={at(s)} width={1.8} />
        })}
        {centerOn && cBox
          ? pos.map((q, i) => {
              const d = between(cPos, cBox, q, boxes[i])
              return <GlowPath key={`c${i}`} d={d} length={lengthOf(d)} progress={at(steps[3] + 6 + i * 4)} width={1.2} opacity={0.55} head={false} />
            })
          : null}
      </Svg>
      {film.nodes.map((n, k) =>
        on(steps[k]) ? (
          <Word key={k} x={pos[k].x} y={pos[k].y} word={n.word} note={n.note} delay={steps[k]} size={sizes[k]}
            color={!centerOn && latest(k, shown) ? C.gold : C.text} halo={!centerOn && latest(k, shown) ? 1 : 0} />
        ) : null,
      )}
      {centerOn && film.center ? <Word x={cPos.x} y={cPos.y} word={film.center.word} note={film.center.note} delay={steps[3]} size={cSize} color={C.gold} halo={1} /> : null}
    </AbsoluteFill>
  )
}

// ── spectrum：両極とその間の位置 ───────────────────────────────
const Spectrum: React.FC<P<'spectrum'>> = ({ film, steps }) => {
  const { frame, at, on } = useClock()
  const Y = 300
  const X0 = 170
  const X1 = 1110
  const shown = shownCount(steps, frame)
  const pLine = at(steps[0])
  const markers = film.markers.map((m, i) => ({ ...m, x: X0 + Math.max(0, Math.min(1, m.at)) * (X1 - X0), i }))
  // 近すぎる印は下にずらす
  const rows = markers.map((m, i) => (markers.slice(0, i).some((o) => Math.abs(o.x - m.x) < 230) ? 1 : 0))
  return (
    <AbsoluteFill>
      <Svg>
        <GlowPath d={line(640, Y, X0, Y)} length={640 - X0} progress={pLine} />
        <GlowPath d={line(640, Y, X1, Y)} length={X1 - 640} progress={pLine} />
        <Node x={X0} y={Y} p={at(steps[0] + 14)} />
        <Node x={X1} y={Y} p={at(steps[0] + 14)} />
        {markers.map((m) => {
          if (!on(steps[m.i + 1])) return null
          const s = at(steps[m.i + 1], SOFT)
          const x = interpolate(s, [0, 1], [640, m.x])
          return (
            <g key={m.i}>
              <line x1={x} y1={Y - 16} x2={x} y2={Y + 16 + rows[m.i] * 70} stroke={latest(m.i + 1, shown) ? C.gold : C.soft} strokeWidth={1.4} opacity={0.8} />
              <Node x={x} y={Y} r={11} p={s} color={latest(m.i + 1, shown) ? C.gold : C.text} />
            </g>
          )
        })}
      </Svg>
      {on(steps[0]) ? (
        <>
          <Word x={X0 + 80} y={Y - 92} word={film.left.word} note={film.left.note} delay={steps[0] + 8} size={46} />
          <Word x={X1 - 80} y={Y - 92} word={film.right.word} note={film.right.note} delay={steps[0] + 14} size={46} />
        </>
      ) : null}
      {markers.map((m) =>
        on(steps[m.i + 1]) ? (
          <Word key={m.i} x={m.x} y={Y + 78 + rows[m.i] * 70} word={m.word} note={m.note} delay={steps[m.i + 1] + 10} size={38}
            color={latest(m.i + 1, shown) ? C.gold : C.text} halo={latest(m.i + 1, shown) ? 0.8 : 0} />
        ) : null,
      )}
    </AbsoluteFill>
  )
}

// ── path：順に進む流れ（途中で切れることもある） ──────────────────────
const PathFilm: React.FC<P<'path'>> = ({ film, steps }) => {
  const { frame, at, on } = useClock()
  const n = film.stations.length
  const pts = film.stations.map((_, i) => ({ x: 170 + (i * 940) / (n - 1), y: 330 + (i % 2 === 0 ? 0 : -46) }))
  const shown = shownCount(steps, frame)
  const broken = film.broken ?? n
  return (
    <AbsoluteFill>
      <Svg>
        {pts.slice(1).map((q, j) => {
          const i = j + 1
          const a = pts[i - 1]
          const d = shortened(a.x, a.y, q.x, q.y, 22, 22)
          const isBreak = i === broken
          const dead = i > broken
          const p = at(steps[i] - 2)
          return (
            <g key={i}>
              <GlowPath d={d} length={lengthOf(d)} progress={p} dashed={isBreak || dead} color={isBreak || dead ? C.soft : C.gold} opacity={dead ? 0.45 : 1} head={!isBreak && !dead} />
              {isBreak && p > 0.6 ? <BreakMark x={(a.x + q.x) / 2} y={(a.y + q.y) / 2} p={at(steps[i] + 10, SOFT)} /> : null}
            </g>
          )
        })}
        {pts.map((q, i) => (on(steps[i]) ? <Node key={i} x={q.x} y={q.y} p={at(steps[i] + 6)} color={i >= broken ? C.soft : C.gold} /> : null))}
      </Svg>
      {film.stations.map((s, i) =>
        on(steps[i]) ? (
          <React.Fragment key={i}>
            <Word x={pts[i].x} y={pts[i].y - 66} word={s.word} delay={steps[i] + 4} size={[...s.word].length > 5 ? 34 : 40}
              color={i >= broken ? C.soft : latest(i, shown) ? C.gold : C.text} dim={i >= broken ? 0.4 : 0} halo={i < broken && latest(i, shown) ? 0.9 : 0} />
            {s.note ? <Label x={pts[i].x} y={pts[i].y + 50} text={s.note} delay={steps[i] + 14} /> : null}
          </React.Fragment>
        ) : null,
      )}
    </AbsoluteFill>
  )
}

const BreakMark: React.FC<{ x: number; y: number; p: number }> = ({ x, y, p }) => (
  <g transform={`translate(${x} ${y}) rotate(-60) scale(${p})`} opacity={p}>
    <line x1={-6} y1={-20} x2={-6} y2={20} stroke={C.night} strokeWidth={10} />
    <line x1={-12} y1={-18} x2={-12} y2={18} stroke={C.amber} strokeWidth={2} />
    <line x1={0} y1={-18} x2={0} y2={18} stroke={C.amber} strokeWidth={2} />
  </g>
)

// ── contrast：二つの見方（片方が残り、片方が退く） ─────────────────────
const Contrast: React.FC<P<'contrast'>> = ({ film, steps }) => {
  const { frame, at, on } = useClock()
  const judged = on(steps[2])
  const pj = at(steps[2])
  const cols = [
    { side: 'left' as const, x: 350, data: film.left, s: steps[0] },
    { side: 'right' as const, x: 930, data: film.right, s: steps[1] },
  ]
  return (
    <AbsoluteFill>
      <Svg>
        <GlowPath d={line(640, 300, 640, 130)} length={170} progress={at(steps[0])} width={1.4} head={false} />
        <GlowPath d={line(640, 300, 640, 470)} length={170} progress={at(steps[0])} width={1.4} head={false} />
        {cols.map((c) => {
          if (!judged || c.side === film.emphasis) return null
          const w = Math.min(320, [...c.data.head].length * 62)
          return <GlowPath key={c.side} d={line(c.x - w / 2, 196, c.x + w / 2, 196)} length={w} progress={at(steps[2] + 10)} color={C.soft} width={2} head={false} />
        })}
      </Svg>
      {cols.map((c) => {
        if (!on(c.s)) return null
        const win = judged && c.side === film.emphasis
        const lose = judged && c.side !== film.emphasis
        return (
          <div key={c.side} style={{ position: 'absolute', inset: 0, opacity: lose ? interpolate(pj, [0, 1], [1, 0.38]) : 1 }}>
            <Word x={c.x} y={196} word={c.data.head} delay={c.s} size={52} color={win ? C.gold : C.text} halo={win ? pj : 0} />
            {c.data.lines.map((l, i) => (
              <Label key={i} x={c.x} y={285 + i * 54} text={l} delay={c.s + 12 + i * 8} size={27} color={win ? C.text : C.soft} />
            ))}
          </div>
        )
      })}
      {judged && film.verdict ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 488, textAlign: 'center', opacity: at(steps[2] + 16) }}>
          <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 32, letterSpacing: '0.22em', color: C.gold }}>{film.verdict}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

// ── axes：2 軸 × 4 象限 ─────────────────────────────────────
const Axes: React.FC<P<'axes'>> = ({ film, steps }) => {
  const { at, on } = useClock()
  const O = { x: 360, y: 484 }
  const XE = 1090
  const YE = 136
  const mid = { x: (O.x + XE) / 2, y: (O.y + YE) / 2 }
  const quad = {
    tl: { x: (O.x + mid.x) / 2 + 10, y: (YE + mid.y) / 2 + 6 },
    tr: { x: (mid.x + XE) / 2, y: (YE + mid.y) / 2 + 6 },
    bl: { x: (O.x + mid.x) / 2 + 10, y: (mid.y + O.y) / 2 },
    br: { x: (mid.x + XE) / 2, y: (mid.y + O.y) / 2 },
  }
  const rect = {
    tl: { x: O.x + 12, y: YE + 6, w: mid.x - O.x - 22, h: mid.y - YE - 14 },
    tr: { x: mid.x + 10, y: YE + 6, w: XE - mid.x - 22, h: mid.y - YE - 14 },
    bl: { x: O.x + 12, y: mid.y + 8, w: mid.x - O.x - 22, h: O.y - mid.y - 18 },
    br: { x: mid.x + 10, y: mid.y + 8, w: XE - mid.x - 22, h: O.y - mid.y - 18 },
  }
  const focusOn = on(steps[2])
  const pf = at(steps[2])
  const keys = ['tl', 'tr', 'bl', 'br'] as const
  const fr = rect[film.focus]
  const frD = `M ${fr.x + 14} ${fr.y} H ${fr.x + fr.w - 14} Q ${fr.x + fr.w} ${fr.y} ${fr.x + fr.w} ${fr.y + 14} V ${fr.y + fr.h - 14} Q ${fr.x + fr.w} ${fr.y + fr.h} ${fr.x + fr.w - 14} ${fr.y + fr.h} H ${fr.x + 14} Q ${fr.x} ${fr.y + fr.h} ${fr.x} ${fr.y + fr.h - 14} V ${fr.y + 14} Q ${fr.x} ${fr.y} ${fr.x + 14} ${fr.y} Z`
  return (
    <AbsoluteFill>
      <Svg>
        <GlowPath d={line(O.x, O.y, XE, O.y)} length={XE - O.x} progress={at(steps[0])} />
        <GlowPath d={line(O.x, O.y, O.x, YE)} length={O.y - YE} progress={at(steps[0] + 6)} />
        {at(steps[0] + 18) > 0 ? (
          <g opacity={at(steps[0] + 18)} fill={C.gold}>
            <path d={`M ${XE + 12} ${O.y} l -14 -7 v 14 z`} />
            <path d={`M ${O.x} ${YE - 12} l -7 14 h 14 z`} />
          </g>
        ) : null}
        {on(steps[1]) ? (
          <g opacity={0.35 * at(steps[1])} stroke={C.soft} strokeWidth={1} strokeDasharray="4 8">
            <line x1={mid.x} y1={YE + 8} x2={mid.x} y2={O.y - 8} />
            <line x1={O.x + 8} y1={mid.y} x2={XE - 8} y2={mid.y} />
          </g>
        ) : null}
        {focusOn ? (
          <g>
            <rect x={fr.x} y={fr.y} width={fr.w} height={fr.h} rx={14} fill={C.gold} opacity={0.075 * pf} />
            <GlowPath d={frD} length={lengthOf(frD)} progress={pf} width={1.6} head={false} />
          </g>
        ) : null}
      </Svg>
      {on(steps[0]) ? (
        <>
          <Label x={(O.x + XE) / 2} y={O.y + 36} text={`${film.x.label}　→`} delay={steps[0] + 10} color={C.text} size={22} />
          <Label x={O.x + 8} y={O.y + 36} text={film.x.low} delay={steps[0] + 14} align="left" />
          <Label x={XE} y={O.y + 36} text={film.x.high} delay={steps[0] + 14} align="right" />
          <Label x={O.x} y={YE - 44} text={`↑　${film.y.label}`} delay={steps[0] + 14} color={C.text} size={22} />
          <Label x={O.x - 18} y={O.y - 24} text={film.y.low} delay={steps[0] + 18} align="right" />
          <Label x={O.x - 18} y={YE + 24} text={film.y.high} delay={steps[0] + 18} align="right" />
        </>
      ) : null}
      {on(steps[1])
        ? keys.map((k, i) => {
            const q = film.quadrants[k]
            const isF = focusOn && film.focus === k
            return (
              <Word key={k} x={quad[k].x} y={quad[k].y} word={q.word} note={q.note} delay={steps[1] + i * 7} size={38}
                color={isF ? C.gold : C.text} dim={focusOn && !isF ? pf * 0.5 : 0} halo={isF ? pf : 0} />
            )
          })
        : null}
    </AbsoluteFill>
  )
}

// ── loop：循環（最後に光が回り続ける） ─────────────────────────────
const Loop: React.FC<P<'loop'>> = ({ film, steps }) => {
  const { frame, at, on } = useClock()
  const n = film.nodes.length
  const cx = 640
  const cy = 318
  const rx = 330
  const ry = 168
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const P = (a: number) => ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
  const gap = 0.36 // 言葉の手前で弧を止める（ラジアン）
  const arc = (i: number) => {
    const a0 = ang(i) + gap
    const a1 = ang(i + 1) - gap
    const pts: string[] = []
    for (let t = 0; t <= 24; t++) {
      const p = P(a0 + ((a1 - a0) * t) / 24)
      pts.push(`${t === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    }
    return pts.join(' ')
  }
  const color = film.tone === 'vicious' ? C.amber : C.gold
  const closedAt = steps[n]
  const closed = on(closedAt)
  const shown = shownCount(steps, frame)
  // 閉じたら光が回り続ける（悪循環は回るほど速くなる）
  const t = Math.max(0, frame - closedAt - 20)
  const speed = film.tone === 'vicious' ? 0.012 + t * 0.00008 : 0.011
  const orbA = -Math.PI / 2 + t * speed * 2 * Math.PI * (film.tone === 'vicious' ? 1 + t * 0.004 : 1) * 0.5
  const orb = P(orbA)
  return (
    <AbsoluteFill>
      <Svg>
        {film.nodes.map((_, i) => {
          const s = i < n - 1 ? steps[i + 1] : closedAt
          const d = arc(i)
          const L = lengthOf(d)
          const p = at(s)
          const end = P(ang(i + 1) - gap)
          const prev = P(ang(i + 1) - gap - 0.05)
          const dir = Math.atan2(end.y - prev.y, end.x - prev.x) * (180 / Math.PI)
          return (
            <g key={i}>
              <GlowPath d={d} length={L} progress={p} color={color} />
              {p > 0.97 ? <path d="M 0 0 L -14 -7 L -14 7 Z" fill={color} transform={`translate(${end.x} ${end.y}) rotate(${dir})`} /> : null}
            </g>
          )
        })}
        {closed && t > 0 ? (
          <g>
            <circle cx={orb.x} cy={orb.y} r={22} fill={color} opacity={0.22} filter="url(#glow)" />
            <circle cx={orb.x} cy={orb.y} r={5} fill="#fff6e4" />
          </g>
        ) : null}
      </Svg>
      {film.nodes.map((nd, i) => {
        const p = P(ang(i))
        return on(steps[i]) ? (
          <Word key={i} x={p.x} y={p.y} word={nd.word} note={nd.note} delay={steps[i]} size={[...nd.word].length > 5 ? 34 : 40}
            color={!closed && latest(i, shown) ? C.gold : C.text} halo={!closed && latest(i, shown) ? 0.9 : 0} />
        ) : null
      })}
      {closed && film.center ? <Word x={cx} y={cy} word={film.center.word} delay={closedAt + 10} size={36} color={color} halo={0.8} /> : null}
    </AbsoluteFill>
  )
}

// ── strata：下から積む層 ─────────────────────────────────────
const Strata: React.FC<P<'strata'>> = ({ film, steps }) => {
  const { frame, at, on } = useClock()
  const n = film.layers.length
  const top = 150
  const bottom = 455
  const ys = film.layers.map((_, i) => bottom - (i * (bottom - top)) / (n - 1))
  const shown = shownCount(steps, frame)
  const pArrow = interpolate(shown, [0, n], [0, 1], clamp)
  return (
    <AbsoluteFill>
      <Svg>
        <GlowPath d={line(250, bottom + 44, 250, top - 30)} length={bottom - top + 74} progress={pArrow * at(steps[0])} width={1.2} color={C.soft} opacity={0.6} />
        {film.layers.map((_, i) => {
          if (!on(steps[i])) return null
          const y = ys[i] + 36
          const p = at(steps[i] + 4)
          return (
            <g key={i}>
              <GlowPath d={line(640, y, 330, y)} length={310} progress={p} width={1.6} head={false} color={latest(i, shown) ? C.gold : C.amber} />
              <GlowPath d={line(640, y, 950, y)} length={310} progress={p} width={1.6} head={false} color={latest(i, shown) ? C.gold : C.amber} />
            </g>
          )
        })}
      </Svg>
      {film.layers.map((l, i) =>
        on(steps[i]) ? (
          <React.Fragment key={i}>
            <Word x={640} y={ys[i]} word={l.word} delay={steps[i]} size={44} color={latest(i, shown) ? C.gold : C.text} halo={latest(i, shown) ? 0.8 : 0} />
            {l.note ? <Label x={980} y={ys[i] + 4} text={l.note} delay={steps[i] + 14} align="left" /> : null}
          </React.Fragment>
        ) : null,
      )}
    </AbsoluteFill>
  )
}

// ── venn：重なる円 ─────────────────────────────────────────
const Venn: React.FC<P<'venn'>> = ({ film, steps }) => {
  const { at, on } = useClock()
  const n = film.circles.length
  const R = n === 2 ? 180 : 148
  // 3 円は下の円がキャプションにかからない高さに収める（下端 ≦ 512）
  const centers = n === 2 ? [{ x: 548, y: 318 }, { x: 732, y: 318 }] : [{ x: 562, y: 232 }, { x: 718, y: 232 }, { x: 640, y: 364 }]
  const words = n === 2 ? [{ x: 448, y: 318 }, { x: 832, y: 318 }] : [{ x: 486, y: 196 }, { x: 794, y: 196 }, { x: 640, y: 446 }]
  const circleD = (c: { x: number; y: number }) => `M ${c.x} ${c.y - R} A ${R} ${R} 0 1 1 ${c.x - 0.01} ${c.y - R} Z`
  const ov = steps[n]
  const pov = at(ov)
  const ovPos = n === 2 ? { x: 640, y: 318 } : { x: 640, y: 282 }
  return (
    <AbsoluteFill>
      <Svg>
        <defs>
          {centers.map((c, i) => (
            <clipPath key={i} id={`vc${i}`}>
              <circle cx={c.x} cy={c.y} r={R} />
            </clipPath>
          ))}
        </defs>
        {on(ov) ? (
          <g clipPath="url(#vc0)">
            <g clipPath="url(#vc1)">
              {n === 3 ? (
                <g clipPath="url(#vc2)">
                  <rect x={0} y={0} width={1280} height={720} fill={C.gold} opacity={0.2 * pov} />
                </g>
              ) : (
                <rect x={0} y={0} width={1280} height={720} fill={C.gold} opacity={0.2 * pov} />
              )}
            </g>
          </g>
        ) : null}
        {centers.map((c, i) => (on(steps[i]) ? <GlowPath key={i} d={circleD(c)} length={2 * Math.PI * R} progress={at(steps[i])} width={1.8} /> : null))}
      </Svg>
      {film.circles.map((c, i) =>
        on(steps[i]) ? <Word key={i} x={words[i].x} y={words[i].y} word={c.word} note={c.note} delay={steps[i] + 8} size={n === 2 ? 42 : 38} dim={on(ov) ? pov * 0.3 : 0} /> : null,
      )}
      {on(ov) ? (
        <>
          <Word x={ovPos.x} y={ovPos.y} word={film.overlap.word} delay={ov + 6} size={n === 3 ? ([...film.overlap.word].length > 3 ? 24 : 28) : [...film.overlap.word].length > 4 ? 28 : 34} color={C.gold} halo={1} />
          {film.overlap.note ? <Label x={n === 3 ? 900 : 640} y={n === 3 ? 470 : 532} text={film.overlap.note} delay={ov + 18} color={C.gold} size={22} align={n === 3 ? 'left' : 'center'} /> : null}
        </>
      ) : null}
    </AbsoluteFill>
  )
}

// ── balance：交換条件（天秤） ─────────────────────────────────
const Balance: React.FC<P<'balance'>> = ({ film, steps }) => {
  const { at, on } = useClock()
  const pivot = { x: 640, y: 230 }
  const half = 360
  const target = film.tilt === 'left' ? 7 : film.tilt === 'right' ? -7 : 0
  const s = at(steps[2], SOFT)
  // 水平で釣り合う場合は、少し揺れてから止まる
  const deg = film.tilt === 'level' && on(steps[2]) ? 5 * (1 - s) * Math.cos(s * 9) : target * s
  const rad = (deg * Math.PI) / 180
  const L = { x: pivot.x - half * Math.cos(rad), y: pivot.y + half * Math.sin(rad) }
  const Rr = { x: pivot.x + half * Math.cos(rad), y: pivot.y - half * Math.sin(rad) }
  const sides = [
    { end: L, data: film.left, s: steps[0] },
    { end: Rr, data: film.right, s: steps[1] },
  ]
  return (
    <AbsoluteFill>
      <Svg>
        <path d={`M ${pivot.x} ${pivot.y + 4} L ${pivot.x - 34} ${pivot.y + 64} L ${pivot.x + 34} ${pivot.y + 64} Z`} fill="none" stroke={C.soft} strokeWidth={1.6} opacity={at(steps[0])} />
        <GlowPath d={line(pivot.x, pivot.y, L.x, L.y)} length={half} progress={at(steps[0])} width={2.2} />
        <GlowPath d={line(pivot.x, pivot.y, Rr.x, Rr.y)} length={half} progress={at(steps[1])} width={2.2} />
        <circle cx={pivot.x} cy={pivot.y} r={6} fill={C.gold} opacity={at(steps[0])} />
        {sides.map((sd, i) =>
          on(sd.s) ? (
            <g key={i} opacity={at(sd.s + 8)}>
              <line x1={sd.end.x} y1={sd.end.y} x2={sd.end.x} y2={sd.end.y + 74} stroke={C.soft} strokeWidth={1.2} />
              <path d={`M ${sd.end.x - 100} ${sd.end.y + 74} Q ${sd.end.x} ${sd.end.y + 104} ${sd.end.x + 100} ${sd.end.y + 74}`} fill="none" stroke={C.gold} strokeWidth={2} />
            </g>
          ) : null,
        )}
      </Svg>
      {sides.map((sd, i) =>
        on(sd.s) ? (
          <React.Fragment key={i}>
            {/* 言葉は皿の下に吊るす（糸が言葉にかからない） */}
            <Word x={sd.end.x} y={sd.end.y + 124} word={sd.data.word} delay={sd.s + 6} size={wordSize(sd.data.word, 38, 32)} />
            {sd.data.items.map((it, j) => (
              <Label key={j} x={sd.end.x} y={sd.end.y + 170 + j * 30} text={it} delay={sd.s + 16 + j * 6} />
            ))}
          </React.Fragment>
        ) : null,
      )}
      {film.pivot && on(steps[2]) ? <Label x={pivot.x} y={pivot.y + 96} text={film.pivot} delay={steps[2] + 10} color={C.gold} size={24} /> : null}
    </AbsoluteFill>
  )
}

// ── stairs：段階（段の間に壁） ────────────────────────────────
const Stairs: React.FC<P<'stairs'>> = ({ film, steps }) => {
  const { frame, at, on } = useClock()
  const n = film.steps.length
  const xs = film.steps.map((_, i) => 230 + (i * 820) / (n - 1))
  const ys = film.steps.map((_, i) => 462 - (i * 300) / (n - 1))
  const tread = Math.min(96, 820 / (n - 1) / 2 - 8)
  const shown = shownCount(steps, frame)
  return (
    <AbsoluteFill>
      <Svg>
        {film.steps.map((_, i) => {
          if (!on(steps[i])) return null
          const y = ys[i] + 30
          const d = i === 0 ? line(xs[0] - tread, y, xs[0] + tread, y) : `M ${xs[i - 1] + tread} ${ys[i - 1] + 30} L ${xs[i] - tread} ${ys[i - 1] + 30} L ${xs[i] - tread} ${y} L ${xs[i] + tread} ${y}`
          return <GlowPath key={i} d={d} length={lengthOf(d)} progress={at(steps[i] - 2)} color={latest(i, shown) ? C.gold : C.amber} />
        })}
        {(film.crises ?? []).map((_, k) => {
          const i = k + 1
          if (i >= n || !on(steps[i])) return null
          const x = xs[i] - tread
          const p = at(steps[i] - 8, SOFT)
          return <line key={k} x1={x - 14} y1={ys[i - 1] + 30} x2={x - 14} y2={ys[i - 1] + 30 - 120 * p} stroke={C.amber} strokeWidth={3} opacity={0.85} />
        })}
      </Svg>
      {film.steps.map((s, i) =>
        on(steps[i]) ? (
          <React.Fragment key={i}>
            <Word x={xs[i]} y={ys[i] - 6} word={s.word} delay={steps[i] + 6} size={[...s.word].length > 4 ? 32 : 38} color={latest(i, shown) ? C.gold : C.text} halo={latest(i, shown) ? 0.8 : 0} />
            {s.note ? <Label x={xs[i]} y={ys[i] + 58} text={s.note} delay={steps[i] + 16} size={19} /> : null}
          </React.Fragment>
        ) : null,
      )}
      {(film.crises ?? []).map((c, k) => {
        const i = k + 1
        if (i >= n || !on(steps[i])) return null
        return <Label key={k} x={xs[i] - tread - 22} y={ys[i - 1] - 40} text={c} delay={steps[i]} align="right" color={C.amber} size={19} />
      })}
    </AbsoluteFill>
  )
}

// ── constellation：多数の原理を一つの星座に ───────────────────────────
const Constellation: React.FC<P<'constellation'>> = ({ film, steps }) => {
  const { at, on } = useClock()
  const n = film.stars.length
  const cx = 640
  const cy = 318
  const rx = 410
  const ry = 168
  const pos = film.stars.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n + (i % 2 ? 0.06 : -0.06)
    const k = i % 2 ? 0.9 : 1.04
    return { x: cx + rx * k * Math.cos(a), y: cy + ry * k * Math.sin(a), a }
  })
  const focusOn = on(steps[2])
  const pf = at(steps[2])
  const ring = pos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
  return (
    <AbsoluteFill>
      <Svg>
        {on(steps[1]) ? <GlowPath d={ring} length={lengthOf(ring)} progress={at(steps[1])} width={1.2} opacity={focusOn ? 1 - pf * 0.5 : 1} /> : null}
        {focusOn && film.center
          ? film.focus.map((fi, j) => {
              const d = shortened(cx, cy, pos[fi].x, pos[fi].y, 60, 14)
              return <GlowPath key={j} d={d} length={lengthOf(d)} progress={at(steps[2] + 8 + j * 5)} width={1.4} />
            })
          : null}
        {pos.map((p, i) => (on(steps[0] + i * 6) ? <Node key={i} x={p.x} y={p.y} r={film.focus.includes(i) && focusOn ? 9 : 6} p={at(steps[0] + i * 6)} color={film.focus.includes(i) && focusOn ? C.gold : C.text} /> : null))}
      </Svg>
      {film.stars.map((s, i) => {
        if (!on(steps[0] + i * 6)) return null
        const p = pos[i]
        const out = { x: p.x + Math.cos(p.a) * 30, y: p.y + Math.sin(p.a) * 32 + (Math.sin(p.a) > 0.3 ? 14 : Math.sin(p.a) < -0.3 ? -14 : 0) }
        const isF = focusOn && film.focus.includes(i)
        const align = Math.cos(p.a) > 0.35 ? 'left' : Math.cos(p.a) < -0.35 ? 'right' : 'center'
        return <Label key={i} x={out.x} y={out.y} text={s} delay={steps[0] + i * 6 + 4} align={align} size={isF ? 27 : 22} color={isF ? C.gold : focusOn ? C.soft : C.text} />
      })}
      {focusOn && film.center ? <Word x={cx} y={cy} word={film.center} delay={steps[2] + 4} size={40} color={C.gold} halo={1} /> : null}
    </AbsoluteFill>
  )
}

export type { Item }
