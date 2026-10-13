// 作品の部品。coffee-community の作品（evidence-film / book-title-film / opening-backdrop）の作法に合わせる：
// 暗い地に金の 1 色、明朝の題字と広い字間、ばねと残像のある立ち上がり、光って進む経路。英字の飾りラベルは使わない。
import '@fontsource/noto-serif-jp/400.css'
import '@fontsource/noto-serif-jp/500.css'
import '@fontsource/noto-serif-jp/600.css'
import '@fontsource/zen-kaku-gothic-new/400.css'
import '@fontsource/zen-kaku-gothic-new/500.css'
import React, { useEffect, useState } from 'react'
import { AbsoluteFill, continueRender, delayRender, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, CALM, MARK, SANS, SERIF, SOFT, clamp } from './theme'
import type { Mark, Seg } from './types'

// ── 書体の読み込み（字の分割ファイルを、使う字の分だけ読み終えてから描く） ─────────────
export function useFonts(text: string) {
  const [handle] = useState(() => delayRender('fonts'))
  useEffect(() => {
    const sample = text + '0123456789０１２３４５６７８９・、。「」『』（）—…／'
    const loads = [
      `400 40px "Noto Serif JP"`,
      `500 40px "Noto Serif JP"`,
      `600 40px "Noto Serif JP"`,
      `400 40px "Zen Kaku Gothic New"`,
      `500 40px "Zen Kaku Gothic New"`,
    ].map((f) => document.fonts.load(f, sample))
    Promise.all(loads)
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle))
      .catch((e) => {
        console.error(e)
        continueRender(handle)
      })
  }, [handle, text])
}

// ── 地：夜の墨に、ごく淡い青緑の光と周辺減光 ──────────────────────────────
export const Ground: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame()
  const breathe = 0.5 + 0.5 * Math.sin(frame / 70)
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 42%, rgba(15,42,48,${0.55 + breathe * 0.12}) 0%, rgba(11,15,19,0) 70%)`,
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 85% 80% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)' }} />
      {children}
    </AbsoluteFill>
  )
}

// ── ばねで立ち上がる文字（1 字ずつ・残像つき） ──────────────────────────────
export function useRise(delay: number, config: typeof SOFT | typeof CALM = SOFT) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config })
}

export const Rise: React.FC<{
  text: string
  delay: number
  size: number
  color?: string
  font?: string
  weight?: number
  tracking?: number // em
  stagger?: number
  ghost?: boolean
  style?: React.CSSProperties
}> = ({ text, delay, size, color = C.text, font = SERIF, weight = 500, tracking = 0.12, stagger = 2.2, ghost = true, style }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const chars = [...text]
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'pre', fontFamily: font, fontWeight: weight, fontSize: size, color, letterSpacing: `${tracking}em`, lineHeight: 1.25, ...style }}>
      {chars.map((ch, i) => {
        const d = delay + i * stagger
        const p = spring({ frame: frame - d, fps, config: SOFT })
        const lag = spring({ frame: frame - d - 4, fps, config: SOFT })
        const y = (1 - p) * size * 0.55
        const moving = p > 0.001 && p < 0.985
        return (
          <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
            {ghost && moving ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  transform: `translateY(${(1 - lag) * size * 0.55 + size * 0.08}px)`,
                  opacity: 0.28 * (1 - p) * Math.min(1, p * 6),
                  filter: `blur(${size * 0.05}px)`,
                  color: C.gold,
                }}
              >
                {ch}
              </span>
            ) : null}
            <span style={{ display: 'inline-block', transform: `translateY(${y}px)`, opacity: Math.min(1, p * 1.6) }}>{ch}</span>
          </span>
        )
      })}
    </span>
  )
}

// ── 根拠強度タグ（本文の 4 段階）：頑健＝金の実線、有力＝琥珀の実線、仮説/経験則＝淡い点線、俗説注意＝淡い点線＋取り消し線 ──
export const MarkBadge: React.FC<{ mark: Mark; delay: number; size?: number }> = ({ mark, delay, size = 22 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: frame - delay, fps, config: MARK })
  const color = mark === '頑健' ? C.gold : mark === '有力' ? C.amber : C.soft
  const dashed = mark === '仮説/経験則' || mark === '俗説注意'
  return (
    <span
      style={{
        display: 'inline-block',
        transform: `scale(${s})`,
        opacity: Math.min(1, s * 1.4),
        margin: `0 ${size * 0.3}px`,
        padding: `${size * 0.08}px ${size * 0.55}px`,
        borderRadius: 999,
        border: `1.5px ${dashed ? 'dashed' : 'solid'} ${color}`,
        color,
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: size,
        letterSpacing: '0.12em',
        lineHeight: 1.3,
        verticalAlign: 'middle',
        textDecoration: mark === '俗説注意' ? 'line-through' : undefined,
        background: mark === '頑健' ? 'rgba(227,184,115,0.08)' : undefined,
      }}
    >
      {mark}
    </span>
  )
}

// ── キャプション（文節ごとに立ち上がり、印がばねで付く） ──────────────────────
export const Caption: React.FC<{ segs: Seg[]; start: number; end: number }> = ({ segs, start, end }) => {
  const frame = useCurrentFrame()
  const fadeOut = interpolate(frame, [end - 10, end], [1, 0], clamp)
  if (frame < start - 2 || frame > end) return null
  let k = 0
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        bottom: 46,
        minHeight: 104,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        opacity: fadeOut,
      }}
    >
      <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 33, lineHeight: 1.6, color: C.text, letterSpacing: '0.06em' }}>
        {segs.map((s, i) => {
          const d = start + 4 + k * 5
          k++
          return typeof s === 'string' ? (
            <Rise key={i} text={s} delay={d} size={33} weight={400} tracking={0.06} stagger={0.9} ghost={false} />
          ) : (
            <MarkBadge key={i} mark={s.mark} delay={d + 8} />
          )
        })}
      </div>
    </div>
  )
}

// ── 光って進む経路（SVG の線を引き、先頭に光の玉） ───────────────────────────
export const GlowPath: React.FC<{
  d: string
  length: number
  progress: number
  color?: string
  width?: number
  dashed?: boolean
  head?: boolean
  opacity?: number
}> = ({ d, length, progress, color = C.gold, width = 2.2, dashed = false, head = true, opacity = 1 }) => {
  const p = Math.max(0, Math.min(1, progress))
  if (p <= 0) return null
  const reveal = { strokeDasharray: `${length} ${length}`, strokeDashoffset: length * (1 - p) }
  // 点線は「引いていく」表現ができないので、同じ経路の実線をマスクにして先頭まで見せる
  const maskId = `m${hash(d)}`
  return (
    <g opacity={opacity}>
      <path d={d} fill="none" stroke={color} strokeOpacity={dashed ? 0.1 : 0.22} strokeWidth={width * 4} strokeLinecap="round" filter="url(#glow)" {...reveal} />
      {dashed ? (
        <>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720">
            <path d={d} fill="none" stroke="#fff" strokeWidth={width * 6} strokeLinecap="round" {...reveal} />
          </mask>
          <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray="7 9" mask={`url(#${maskId})`} />
        </>
      ) : (
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" {...reveal} />
      )}
      {head && p < 0.999 ? <PathHead d={d} progress={p} color={color} /> : null}
    </g>
  )
}

function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/** 経路の先頭の光（SVGPathElement で位置を測る） */
const PathHead: React.FC<{ d: string; progress: number; color: string }> = ({ d, progress, color }) => {
  const pt = pointAt(d, progress)
  return (
    <g>
      <circle cx={pt.x} cy={pt.y} r={16} fill={color} opacity={0.18} filter="url(#glow)" />
      <circle cx={pt.x} cy={pt.y} r={4.5} fill="#fff6e4" />
    </g>
  )
}

const measure = new Map<string, SVGPathElement>()
export function pointAt(d: string, t: number): { x: number; y: number } {
  let el = measure.get(d)
  if (!el) {
    el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    el.setAttribute('d', d)
    measure.set(d, el)
  }
  const len = el.getTotalLength()
  const p = el.getPointAtLength(len * Math.max(0, Math.min(1, t)))
  return { x: p.x, y: p.y }
}
export function lengthOf(d: string): number {
  let el = measure.get(d)
  if (!el) {
    el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    el.setAttribute('d', d)
    measure.set(d, el)
  }
  return el.getTotalLength()
}

/** SVG の共通定義（光のにじみ） */
export const SvgDefs: React.FC = () => (
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" />
    </filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18" />
    </filter>
    <radialGradient id="halo">
      <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
      <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
    </radialGradient>
  </defs>
)

/** 図の言葉（大きな言葉＋小さな補足）。中心が (x, y) */
export const Word: React.FC<{
  x: number
  y: number
  word: string
  note?: string
  delay: number
  size?: number
  color?: string
  dim?: number // 0..1 で淡くする
  halo?: number // 0..1 で後ろに光
  align?: 'center' | 'left' | 'right'
  noteBelow?: boolean
}> = ({ x, y, word, note, delay, size = 50, color = C.text, dim = 0, halo = 0, align = 'center', noteBelow = true }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pNote = spring({ frame: frame - delay - 10, fps, config: CALM })
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0%'
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(${tx}, -50%)`,
        textAlign: align,
        opacity: 1 - dim * 0.65,
        whiteSpace: 'nowrap',
      }}
    >
      {halo > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '42%',
            width: size * 6,
            height: size * 3,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(ellipse at center, rgba(227,184,115,${0.22 * halo}) 0%, rgba(227,184,115,0) 70%)`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div style={{ position: 'relative', textShadow: `0 0 ${size * 0.3}px ${C.night}, 0 0 ${size * 0.12}px ${C.night}` }}>
        <Rise text={word} delay={delay} size={size} color={color} tracking={0.14} />
      </div>
      {note && noteBelow ? (
        <div
          style={{
            position: 'relative',
            marginTop: size * 0.18,
            fontFamily: SANS,
            fontSize: 21,
            letterSpacing: '0.08em',
            color: C.soft,
            textShadow: `0 0 8px ${C.night}`,
            opacity: pNote,
            transform: `translateY(${(1 - pNote) * 8}px)`,
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  )
}

/** 図の中の小さなラベル（軸の名前など） */
export const Label: React.FC<{ x: number; y: number; text: string; delay: number; align?: 'center' | 'left' | 'right'; color?: string; size?: number }> = ({
  x,
  y,
  text,
  delay,
  align = 'center',
  color = C.soft,
  size = 21,
}) => {
  const p = useRise(delay, CALM)
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0%'
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(${tx}, -50%) translateY(${(1 - p) * 8}px)`,
        opacity: p,
        fontFamily: SANS,
        fontSize: size,
        letterSpacing: '0.1em',
        color,
        whiteSpace: 'nowrap',
        textShadow: `0 0 8px ${C.night}, 0 0 3px ${C.night}`,
      }}
    >
      {text}
    </div>
  )
}
