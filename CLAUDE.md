# Affinity デザインワークスペース

ユーザーは日本語で「こういうデザインを作って」「見出しを大きく」と指示する。
あなた（Claude Code）はそれを Affinity 上の実際のデザインに変換する。返答は日本語で書く。

## 最初に経路を決める

1. ツール一覧に `mcp__affinity__execute_script` がある → **A. Affinity MCP 経路**
2. ない → `npm run check` を実行する
   - 接続できた → `.mcp.json` が読み込まれていないだけ。ユーザーに Claude Code の再起動と `affinity` サーバーの承認を頼む
   - 接続できない → Affinity（Canva 版 3.2 以降）が起動していないか、MCP 設定がオフ。README の手順を案内する。
     ユーザーが Affinity Designer 2 だけで作業したい場合は **B. SVG 経路** に進む

## A. Affinity MCP 経路（Affinity 3.2 以降）

Affinity は `http://[::1]:6767/sse` で MCP サーバーを内蔵しており、JavaScript の SDK でドキュメントを直接操作できる。

### 作業の流れ

1. **preamble を読む**: 接続ごとに最初に `read_sdk_documentation_topic` を `filename: "preamble"` で呼ぶ。
   読まないと `execute_script` は拒否される（Affinity 側の仕様）。preamble には過去に記録された SDK のヒントも入っている
2. **デザインはファイルに書く**: `designs/<名前>.js` に、`affinity/kit.js` の関数（`kit.rect` など）を使ってスクリプトを書く。
   見本は `designs/examples/sample-poster.js`
3. **実行**: `node tools/affinity.mjs run designs/<名前>.js`（kit が自動で先頭に付く）
4. **数値を確かめる**: 出力の `box`（実際の位置とサイズ）が意図どおりか確認する
5. **見た目を確かめる**: MCP の `render_spread`、または `node tools/affinity.mjs render` で `renders/latest.jpg` を書き出して Read で見る
6. **直す**: スクリプトを修正して再実行。ユーザーには何を変えたかを短く伝える

`tools/affinity.mjs` と Claude Code の MCP 接続を同時に使えるかは確認できていない。
CLI が接続エラーになる場合は、`affinity/kit.js` の中身とデザインスクリプトを連結して MCP の `execute_script` に渡す。

### スクリプトの決まり

- **API を推測しない**。`kit.js` にない操作（フォント指定、角丸、グラデーション、エフェクト等）は、先に SDK ドキュメントで確かめる:
  - `node tools/affinity.mjs docs --all` で `.affinity-docs/` に保存し、grep で探す
  - または MCP の `read_sdk_documentation_topic` / `search_sdk_hints`
- 実機で動いた新しい API は `kit.js` に関数として追加し、`test/mock-affinity.mjs` のスタブも合わせて `npm test` を通す。
  わかりにくい挙動を見つけたら `add_sdk_hint` で記録する（次のセッションの preamble に載る）
- すべてのレイヤーに `name` を付ける。後の指示で「見出し」「背景」を特定するため
- 再実行で重複しないようにする。既存ドキュメントに描くときは、最初に `kit.removeNamed([...])` で自分が作るレイヤーを消す
- 寸法・色・文言はスクリプト先頭の定数にまとめる
- ドキュメントは単位 px で作る（kit の座標が px で検証されているため）。mm などで作る場合は `box` を読み戻して座標系を確かめる
- `execute_script` が返すのは `console.log` の出力だけ。結果は `kit.log()` で出す

### 安全のための決まり

- ユーザーが開いている既存ファイルを、確認なしに保存・上書きしない。新規デザインは新規ドキュメントで作る
- ファイルの読み書き（画像の配置・書き出し・保存）はデスクトップ配下のみ許可されている（Affinity のサンドボックス）。
  パスは `kit.desktop()` を基準に組み立てる
- 失敗したら `SCRIPT_ERROR` の内容をそのままユーザーに見せる。「たぶん動いた」とは言わない

### 実機で報告されている注意点（Affinity 3.2）

- 一番上のレイヤーがグループだと、新しいレイヤーがその中に入る
- `CurvesAdjustmentParameters.masterSpline` などのパラメータは、取得した値を書き換えても反映されない（取得したものは複製）。
  値を変えたら setter やコマンドで設定し直す
- スクリプトからドキュメントを閉じられない。新規ドキュメントを作りすぎない
- `doc.spreads` は `.first` や反復で扱う（`[0]` は使えない）。スプレッドを切り替えると選択が解除される

## B. SVG 経路（Affinity Designer 2 のみ）

Affinity Designer 2 には外部から操作する API がない。代わりに SVG ファイルを作り、Designer 2 で開いてもらう。

1. `designs/svg/<名前>.svg` を書く（見本: `designs/svg/sample-poster.svg`）。要素には `id` を付け、`<g>` でまとめる
2. `node tools/svg.mjs preview designs/svg/<名前>.svg` で PNG にして、Read で見た目を確かめる
3. 直してから `node tools/svg.mjs open designs/svg/<名前>.svg` で開く
4. ユーザーには **File > Open** で開くよう伝える（File > Place だと埋め込みドキュメントになり、編集には Release が必要）

文字は `font-family` で指定したフォントがユーザーの PC に入っていないと置き換わる。
プレビュー（resvg）と Affinity では描画が完全には一致しないので、最終確認は Affinity でしてもらう。

## コマンド

| コマンド | 用途 |
|---|---|
| `npm run check` | Affinity への接続診断（読み取りのみ） |
| `node tools/affinity.mjs run <file.js>` | デザインスクリプトを実行 |
| `node tools/affinity.mjs render [--out f] [--spread N]` | 現在のドキュメントを画像に書き出す |
| `node tools/affinity.mjs docs [topic...\|--all]` | SDK ドキュメントの目次表示・保存 |
| `node tools/svg.mjs preview <svg> [png]` | SVG のプレビュー |
| `node tools/svg.mjs open <svg>` | Affinity Designer 2 で開く |
| `npm test` | モックの Affinity を相手にした CLI と kit のテスト |
