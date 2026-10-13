# 図解動画の台帳（ledger）仕様 — 『組織を診る・設計する・動かす』

シェアリングコーヒーコミュニティ（coffee-community）の「教科書の説明動画（図解）」と同じ仕組みで作る。
向こうの台帳 `src/server/explainers.ts` の型 `{ film, before, title, summary, captions, labels }` に合わせ、
1 本 = 台帳の 1 項目。作品（動き）は Remotion のテンプレート、言葉は台帳から props で渡す。

## 守ること（内容）

- **言葉は教科書の本文から取る。** 意味を変えずに短くするのはよい。本文に無い主張・数字・人名・事例を足さない。
- **根拠強度タグは本文のとおり。** 本文で、その主張の近くに付いているタグ（【頑健】【有力】【仮説/経験則】【俗説注意】）だけを付ける。
  タグが本文に無い主張にはタグを付けない（推測で付けない）。
- **数字は本文にある数字だけ。** 本文に無い数を作らない。
- `sources` に、各キャプションと図の言葉の根拠になった本文の一節を **原文のまま**（改変せず）入れる。検証に使う。

## 守ること（見た目）— coffee-community の代表の指示に合わせる

- 1 画面に 1 つの大きな言葉。暗い地に金の 1 色。明朝の題字と広い字間。ばねと残像のある動き。光って進む経路。
- **使わない**：英字の飾りラベル、数字の枠と棒グラフ、同じ形のカードの反復。
- 図の言葉（word・head）は **8 字以内**、補足（note・lines・items）は **14 字以内**、題（title）は **20 字以内**、
  キャプション 1 本は **40 字以内**（タグの文字は数えない）、締めの言葉（closing.phrase）は **16 字以内**、要約（summary）は **80 字以内**。
  axes の `label` は 8 字以内、`low`・`high` は 6 字以内。`pivot`・`crises`・`stars`・`center` は 8 字以内。
- 字数は `scripts/validate.mjs` が機械的に検査する（`npm run validate`）。

## 台帳の 1 項目（JSON）

```jsonc
{
  "id": "org-01",                    // org-<章の sort_order 2桁>
  "chapter": 1,                       // library_chapters.sort_order（序章=0 … 終章=24）
  "chapterLabel": "第1章",            // 序章 / 第N章 / 終章
  "before": "ウィリアムソンの拡張と、その限界", // この見出し（# を除いた本文そのまま）の直前に入れる＝ひとつ前の節の終わり
  "title": "市場か、組織か",          // 図解の題（20 字以内）
  "summary": ["…本文の要約 1〜2 文…", {"mark": "頑健"}],  // 動画の下に出す要約（Seg[]、80 字以内）
  "film": { "kind": "spectrum", ... }, // テンプレートと図の言葉（下の一覧）
  "beats": [                           // 3〜6 拍。各拍でキャプションが 1 本出て、図が show 段まで進む
    { "caption": ["市場で毎回契約すると、", "探す・交渉する・見張るコストがかかる"], "show": 1 },
    { "caption": ["…", {"mark": "頑健"}], "show": 2 }
  ],
  "closing": { "phrase": "会社は、安くつく道具", "mark": "頑健" },  // 最後の 1 画面の大きな言葉（mark は任意）
  "sources": ["本文の一節（原文のまま）", "…"]
}
```

- `Seg` は文字列か `{ "mark": "頑健" | "有力" | "仮説/経験則" | "俗説注意" }`。
- `beats[].show` は「この拍の終わりに見えている図の段数」。単調増加（同じ値の連続は可）、最後の拍で **その図の段数 S** に等しい。
- 長さの目安：題 2.5 秒 ＋ 各拍（1.4 秒 ＋ 字数 ÷ 7 秒）＋ 締め 3.5 秒。全体で 25〜50 秒。

## テンプレート（film.kind）と段数 S

| kind | 用途 | データ | 段数 S |
|---|---|---|---|
| `triad` | 3 つの要素（とその中心） | `nodes: [{word, note?}×3]`, `center?: {word, note?}` | 3（center があれば 4） |
| `spectrum` | 両極とその間の位置 | `left: {word, note?}`, `right: {word, note?}`, `markers: [{word, at: 0〜1, note?}]`（1〜4） | 1 ＋ markers 数 |
| `path` | 順に進む流れ・因果の連鎖 | `stations: [{word, note?}]`（3〜5）, `broken?: n`（n 番目の駅の手前で経路が切れる＝情報が死ぬ等。1 ≦ n < 駅数） | 駅数 |
| `contrast` | 誤解と実像・二つの見方 | `left: {head, lines[≤3]}`, `right: {head, lines[≤3]}`, `emphasis: "left"\|"right"`, `verdict?: string`（14 字以内） | 3（左 → 右 → 判定） |
| `axes` | 2 軸 × 4 象限 | `x: {label, low, high}`, `y: {label, low, high}`, `quadrants: {tl, tr, bl, br: {word, note?}}`, `focus: "tl"\|"tr"\|"bl"\|"br"` | 3（軸 → 4 象限 → 注目） |
| `loop` | 悪循環・好循環 | `nodes: [{word, note?}]`（3〜5、時計回り）, `tone: "vicious"\|"virtuous"`, `center?: {word}` | 節数 ＋ 1（最後に光が回る） |
| `strata` | 下から積む層・土台と上物・序列 | `layers: [{word, note?}]`（3〜4、**下から**） | 層数 |
| `venn` | 重なる 2〜3 つの円 | `circles: [{word, note?}]`（2〜3）, `overlap: {word, note?}` | 円数 ＋ 1 |
| `balance` | 交換条件・トレードオフ | `left: {word, items[≤2]}`, `right: {word, items[≤2]}`, `tilt: "left"\|"right"\|"level"`, `pivot?: string`（支点の言葉、8 字以内） | 3（左 → 右 → 傾き） |
| `stairs` | 段階・成長・手順 | `steps: [{word, note?}]`（3〜5、下から）, `crises?: [string]`（段の間の壁、steps−1 個以内、8 字以内） | 段数 |
| `constellation` | 多数の原理を一つの星座に | `stars: [string]`（6〜12、8 字以内）, `focus: [index…]`（1〜3）, `center?: string` | 3（星 → 結線 → 注目） |

`word`・`head` は大きく出る言葉。`note` は小さく添える補足。どれも本文の言葉から。

## 置き場所（before）

- 図解はその見出しの **直前**（＝ひとつ前の節の終わり）に入る。説明し終えた直後に図で確かめる位置にする。
- `before` は章の本文にある見出し行（`##` / `###`）の # を除いた文字列と **完全一致** させる。
