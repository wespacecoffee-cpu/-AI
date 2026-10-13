// 作品の共通の色・書体・ばね。coffee-community の src/motion/theme.ts と springs（build-springs.mjs）の値をそのまま使う。

export const C = {
  night: '#0b0f13',
  card: '#12171c',
  text: '#ece7dc',
  soft: '#aba69b',
  amber: '#c9975b',
  gold: '#e3b873',
  teal: '#0f2a30',
  rule: '#262c33',
} as const

/** 題字・大きな言葉・キャプション（明朝） */
export const SERIF = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif'
/** 図の小さな補足だけ（coffee-community でも Zen Kaku Gothic New は「図だけ」） */
export const SANS = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif'

/** 題字：わずかに行き過ぎて戻る、柔らかいばね */
export const SOFT = { damping: 15, mass: 0.9, stiffness: 80 } as const
/** 行き過ぎないばね（線・面） */
export const CALM = { damping: 200 } as const
/** 根拠の印が付くときのばね（coffee-community の evidence-film の Mark と同じ） */
export const MARK = { damping: 12, stiffness: 140, mass: 0.7 } as const

export const FILM = { width: 1280, height: 720, fps: 30 } as const

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
