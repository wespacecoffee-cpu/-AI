// 台帳（ledger/*.json）の型。仕様は SPEC.md。
// coffee-community の src/server/explainers.ts の ExplainerSpec（film / before / title / summary / captions / labels）に合わせ、
// この教科書の根拠強度タグ（【頑健】【有力】【仮説/経験則】【俗説注意】）で印を付ける。

export type Mark = '頑健' | '有力' | '仮説/経験則' | '俗説注意'
export type Seg = string | { mark: Mark }

export type Item = { word: string; note?: string }

export type FilmSpec =
  | { kind: 'triad'; nodes: [Item, Item, Item]; center?: Item }
  | { kind: 'spectrum'; left: Item; right: Item; markers: (Item & { at: number })[] }
  | { kind: 'path'; stations: Item[]; broken?: number }
  | {
      kind: 'contrast'
      left: { head: string; lines: string[] }
      right: { head: string; lines: string[] }
      emphasis: 'left' | 'right'
      verdict?: string
    }
  | {
      kind: 'axes'
      x: { label: string; low: string; high: string }
      y: { label: string; low: string; high: string }
      quadrants: { tl: Item; tr: Item; bl: Item; br: Item }
      focus: 'tl' | 'tr' | 'bl' | 'br'
    }
  | { kind: 'loop'; nodes: Item[]; tone: 'vicious' | 'virtuous'; center?: { word: string } }
  | { kind: 'strata'; layers: Item[] }
  | { kind: 'venn'; circles: Item[]; overlap: Item }
  | {
      kind: 'balance'
      left: { word: string; items: string[] }
      right: { word: string; items: string[] }
      tilt: 'left' | 'right' | 'level'
      pivot?: string
    }
  | { kind: 'stairs'; steps: Item[]; crises?: string[] }
  | { kind: 'constellation'; stars: string[]; focus: number[]; center?: string }

export type Beat = { caption: Seg[]; show: number }

export type ExplainerSpec = {
  id: string
  chapter: number
  chapterLabel: string
  before: string
  title: string
  summary: Seg[]
  film: FilmSpec
  beats: Beat[]
  closing: { phrase: string; mark?: Mark }
  sources: string[]
  rationale?: string
}

export const BOOK_TITLE = '組織を診る・設計する・動かす'
