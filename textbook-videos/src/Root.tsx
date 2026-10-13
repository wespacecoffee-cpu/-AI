// 台帳の 1 項目 = 1 作品（Composition）。長さは台帳から計算する（timing.ts）。
import React from 'react'
import { Composition } from 'remotion'
import { Explainer } from './Explainer'
import { FILM } from './theme'
import { timeline } from './timing'
import type { ExplainerSpec } from './types'
import org from '../ledger/org.json'
import fixtures from '../ledger/fixtures.json'

const LEDGERS: ExplainerSpec[] = [...(org as unknown as ExplainerSpec[]), ...(fixtures as unknown as ExplainerSpec[])]

export const Root: React.FC = () => (
  <>
    {LEDGERS.map((spec) => (
      <Composition
        key={spec.id}
        id={spec.id}
        component={Explainer}
        durationInFrames={timeline(spec).total}
        fps={FILM.fps}
        width={FILM.width}
        height={FILM.height}
        defaultProps={{ spec }}
      />
    ))}
  </>
)
