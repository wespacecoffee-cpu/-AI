// 1 本の図解：題（章と題字）→ 図が拍ごとに進み、下にキャプション → 締めの大きな言葉と根拠の印。
import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { Film } from './films'
import { Caption, Ground, MarkBadge, Rise, useFonts, useRise } from './kit'
import { C, CALM, SANS, SERIF, clamp } from './theme'
import { OPEN, segText, timeline } from './timing'
import { BOOK_TITLE, type ExplainerSpec } from './types'

export type ExplainerProps = { spec: ExplainerSpec }

function allText(spec: ExplainerSpec): string {
  return [BOOK_TITLE, spec.chapterLabel, spec.title, spec.closing.phrase, JSON.stringify(spec.film), ...spec.beats.map((b) => segText(b.caption)), '頑健有力仮説/経験則俗説注意より'].join('')
}

export const Explainer: React.FC<ExplainerProps> = ({ spec }) => {
  useFonts(allText(spec))
  const frame = useCurrentFrame()
  const tl = timeline(spec)

  const openOut = interpolate(frame, [OPEN - 10, OPEN + 6], [1, 0], clamp)
  const bodyIn = interpolate(frame, [OPEN - 4, OPEN + 10], [0, 1], clamp)
  const bodyDim = interpolate(frame, [tl.closeStart - 4, tl.closeStart + 18], [1, 0.16], clamp)
  const bodyBlur = interpolate(frame, [tl.closeStart, tl.closeStart + 18], [0, 5], clamp)

  return (
    <Ground>
      {/* 題 */}
      {frame < OPEN + 8 ? (
        <AbsoluteFill style={{ opacity: openOut, transform: `translateY(${(1 - openOut) * -14}px)` }}>
          <Opening spec={spec} />
        </AbsoluteFill>
      ) : null}

      {/* 図 */}
      {frame >= OPEN - 4 ? (
        <AbsoluteFill style={{ opacity: bodyIn * bodyDim, filter: bodyBlur > 0.05 ? `blur(${bodyBlur}px)` : undefined }}>
          <Header spec={spec} />
          <Film film={spec.film} steps={tl.stepStart} close={tl.closeStart} />
        </AbsoluteFill>
      ) : null}

      {/* キャプション */}
      {spec.beats.map((b, i) => (
        <Caption key={i} segs={b.caption} start={tl.beatStart[i]} end={tl.beatEnd[i]} />
      ))}

      {/* 締め */}
      {frame >= tl.closeStart ? <Closing spec={spec} start={tl.closeStart} /> : null}
    </Ground>
  )
}

const Opening: React.FC<{ spec: ExplainerSpec }> = ({ spec }) => {
  const label = useRise(4, CALM)
  const rule = useRise(26, CALM)
  const titleSize = [...spec.title].length > 14 ? 54 : 62
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 21,
            letterSpacing: '0.42em',
            color: C.soft,
            opacity: label,
            transform: `translateY(${(1 - label) * 10}px)`,
            marginBottom: 26,
          }}
        >
          {`『${BOOK_TITLE}』　${spec.chapterLabel}`}
        </div>
        <Rise text={spec.title} delay={10} size={titleSize} weight={600} tracking={0.18} stagger={2.6} />
        <div style={{ height: 1.5, margin: '30px auto 0', width: 360 * rule, background: C.gold, boxShadow: `0 0 14px ${C.gold}` }} />
      </div>
    </AbsoluteFill>
  )
}

const Header: React.FC<{ spec: ExplainerSpec }> = ({ spec }) => (
  <div
    style={{
      position: 'absolute',
      left: 56,
      top: 38,
      fontFamily: SANS,
      fontSize: 18,
      letterSpacing: '0.22em',
      color: C.soft,
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{ color: C.amber }}>{spec.chapterLabel}</span>
    <span style={{ margin: '0 0.8em', opacity: 0.6 }}>｜</span>
    {spec.title}
  </div>
)

const Closing: React.FC<{ spec: ExplainerSpec; start: number }> = ({ spec, start }) => {
  const rule = useRise(start + 22, CALM)
  const src = useRise(start + 34, CALM)
  const n = [...spec.closing.phrase].length
  const size = n > 12 ? 50 : 58
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', transform: 'translateY(-18px)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Rise text={spec.closing.phrase} delay={start + 6} size={size} weight={600} tracking={0.16} stagger={2.4} />
          {spec.closing.mark ? (
            <span style={{ marginLeft: 18 }}>
              <MarkBadge mark={spec.closing.mark} delay={start + 12 + n * 2.4} size={25} />
            </span>
          ) : null}
        </div>
        <div style={{ height: 1.5, margin: '28px auto 0', width: 300 * rule, background: C.gold, boxShadow: `0 0 14px ${C.gold}` }} />
        <div style={{ marginTop: 26, fontFamily: SERIF, fontSize: 21, letterSpacing: '0.2em', color: C.soft, opacity: src }}>
          {`『${BOOK_TITLE}』${spec.chapterLabel}より`}
        </div>
      </div>
    </AbsoluteFill>
  )
}
