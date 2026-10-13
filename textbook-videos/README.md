# 教科書の図解動画（Remotion）

wecoffee-os の書庫にある『組織を診る・設計する・動かす』（組織論、25 章）の要所に入れる説明動画を作るための作業場。
シェアリングコーヒーコミュニティ（coffee-community）の「教科書の説明動画（図解）」と同じ仕組みで作っている。

| | coffee-community | ここ |
|---|---|---|
| 台帳 | `src/server/explainers.ts`（章ごとに `film / before / title / summary / captions / labels`） | `ledger/org.json`（同じ項目。印はこの本の【頑健】【有力】【仮説/経験則】【俗説注意】） |
| 作品 | `src/motion/explainers/`（Remotion） | `src/films.tsx`（Remotion。11 種のテンプレート） |
| 色・書体・ばね | `src/motion/theme.ts`・`springs.json` | `src/theme.ts`（同じ値） |
| 本文への置き方 | `ExplainerFigure`（図解 n／total・題 → 動画 → 要約 → 動画の内容を文字で読む欄） | 同じ構成の `<figure class="explainer">` を章の Markdown に入れる（`scripts/lib.mjs`） |
| 再生 | サイトの中で `@remotion/player` | wecoffee-os にプレーヤーが無いので、同じ作品を MP4 に書き出して `<video>` で再生 |

wecoffee-os は章の Markdown を `marked`（GFM）で HTML にし、`<script>` だけを除いて表示する（`src/lib/markdown.ts`）。
`<figure>` から始まり空行の無い HTML ブロックはそのまま通るので、OS のコードを変えずに動画を入れられる（`test/embed.test.mjs` で同じ処理を通して確かめている）。

## 置き場所

- 動画：Supabase Storage の公開バケット `videos`（OS の「動画URL作成」と同じバケット）の `library/org/org-NN.mp4`
- ポスター（再生前に見える絵）：公開バケット `photos` の `library/org/org-NN.jpg`
- 章の本文：`library_chapters.content` の、台帳の `before` の見出しの直前。ブロックは `<!-- explainer:org-NN -->` 〜 `<!-- /explainer:org-NN -->` で囲む

## 手順

```bash
npm install
npm run validate                 # 台帳の字数・段数・印を検査
node scripts/render.mjs --stills --no-video --ids org-01   # 確認用の静止画（out/check/org-01.png）
node scripts/render.mjs          # 全部を MP4（out/video/）とポスター（out/poster/）に書き出す
npm run embed:build              # embed/ に章へ入れるブロックと SQL を作る
npm test
```

- `embed/check.sql`：台帳の見出しと引用（sources）が、いまの本文にあるかを確かめる（読むだけ）
- `embed/apply.sql`：章の本文にブロックを入れる（同じブロックがあれば何もしない）
- `embed/revert.sql`：入れたブロックだけを取り除く

## 大事：原稿にも入れておく（取り込みで消えないように）

wecoffee-os の `scripts/ingest-library.mjs` は、実行するたびに章を手元の原稿（`デスクトップ\ラベル\organization-textbook\manuscript`）から入れ替える。
DB だけに入れたブロックは、次に取り込みを流すと消える。原稿にも同じブロックを入れておけば、取り込み後も残る。

```bash
# 手元の PC で（このリポジトリを取得して textbook-videos/ で npm install した後）
node scripts/embed-local.mjs --dry   # 何をどこに入れるかだけ表示
node scripts/embed-local.mjs         # 原稿に入れる（改行コード・BOM はそのまま）
node scripts/embed-local.mjs --revert   # 取り除く
```

## 作り直すとき

1. `ledger/org.json` の言葉を直す（言葉は教科書の本文から。根拠の印は本文のとおり。`SPEC.md`）
2. `node scripts/render.mjs --ids org-NN` で書き出し直す
3. `VIDEO_VERSION=2 npm run embed:build` で URL の `?v=` を上げ、同じ場所に上書きアップロードする
