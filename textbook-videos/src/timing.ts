// 拍（beat）の長さと、図の各段が立ち上がるフレームを台帳から計算する。
// 長さ：題 2.6 秒 ＋ 各拍（1.4 秒 ＋ 字数 ÷ 7 秒、最短 3.4 秒）＋ 締め 3.8 秒 ＋ 余韻 0.6 秒。
import type { ExplainerSpec, FilmSpec, Seg } from './types'
import { FILM } from './theme'

export const OPEN = 78
export const CLOSE = 114
export const TAIL = 18
const STAGGER = 14 // 同じ拍で複数の段が出るときの間隔

export function segText(segs: Seg[]): string {
  return segs.map((s) => (typeof s === 'string' ? s : '')).join('')
}

export function beatFrames(segs: Seg[]): number {
  const chars = [...segText(segs)].length
  return Math.max(102, Math.round((1.4 + chars / 7) * FILM.fps))
}

/** テンプレートごとの段数 S（SPEC.md の表） */
export function stepCount(film: FilmSpec): number {
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
  }
}

export type Timeline = {
  total: number
  beatStart: number[]
  beatEnd: number[]
  /** 段 k（0 始まり）が立ち上がり始めるフレーム */
  stepStart: number[]
  closeStart: number
}

export function timeline(spec: ExplainerSpec): Timeline {
  const beatStart: number[] = []
  const beatEnd: number[] = []
  let t = OPEN
  for (const b of spec.beats) {
    beatStart.push(t)
    t += beatFrames(b.caption)
    beatEnd.push(t)
  }
  const closeStart = t
  const S = stepCount(spec.film)
  const stepStart: number[] = new Array(S).fill(closeStart)
  let prev = 0
  spec.beats.forEach((b, i) => {
    for (let k = prev; k < Math.min(b.show, S); k++) stepStart[k] = beatStart[i] + 6 + (k - prev) * STAGGER
    prev = Math.max(prev, b.show)
  })
  return { total: closeStart + CLOSE + TAIL, beatStart, beatEnd, stepStart, closeStart }
}
