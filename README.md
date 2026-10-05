# Claude Code × Affinity デザイン

Claude Code に日本語で「こういうデザインを作って」と指示すると、Affinity 上に実際のデザイン（編集できる図形・テキストのレイヤー）が作られるようにするためのワークスペースです。

## はじめに：Affinity Designer 2 について

**Affinity Designer 2 には、外部のプログラムから操作するための公式の仕組み（スクリプトや API）がありません。**
そのため、ここでは 2 つの経路を用意しています。

| | A. Affinity MCP 経路（おすすめ） | B. SVG 経路 |
|---|---|---|
| 使うアプリ | Affinity（Canva 版、3.2 以降。無料） | Affinity Designer 2 |
| 仕組み | Affinity に内蔵されている MCP サーバー経由で、Claude Code が JavaScript でデザインを直接作る・直す | Claude Code が SVG ファイルを作り、Designer 2 で開く |
| 修正の指示 | 「見出しを大きく」→ Affinity 上のデザインがそのまま変わる | SVG を作り直して、開き直す |
| 確認 | Claude Code が Affinity のレンダリング画像を見て自分で確かめる | Claude Code がプレビュー画像を見て確かめ、最終確認は Designer 2 で行う |

Affinity（Canva 版）は 2025 年 10 月から無料で配布されており、Vector・Pixel・Layout の 3 つのスタジオを 1 つのアプリにまとめた、Designer 2 の後継です。
2026 年 4 月のバージョン 3.2 には、外部の AI ツールが接続するための MCP サーバーが内蔵されています。
また、Affinity は Designer 2 などの旧バージョンのファイルも開けます。

## A. Affinity MCP 経路のセットアップ

### 1. Affinity の準備（初回のみ）

1. [affinity.studio](https://www.affinity.studio) から Affinity をインストールする（Canva アカウントが必要。無料）
2. 設定を開く
   - macOS: **Affinity > Settings > Model Context Protocol**
   - Windows: **Edit > Settings > Model Context Protocol**
3. 次の項目をオンにする
   - **Enable Affinity MCP**（必須）
   - **Access files on your Desktop**（画像の配置・書き出しに必要）
   - 同じ画面に Scripting の項目があればオン
4. 設定を変えたら Affinity を再起動する

### 2. このリポジトリの準備

前提として [Node.js](https://nodejs.org)（18 以降）と [Claude Code](https://code.claude.com) を PC にインストールしておきます。

```bash
# デスクトップの下に置く（Affinity のスクリプトが読み書きできるのはデスクトップ配下だけのため）
cd ~/Desktop
git clone https://github.com/wespacecoffee-cpu/-AI.git affinity-design
cd affinity-design
npm install
```

### 3. 接続を確認する

Affinity を起動した状態で実行します。読み取りだけで、ドキュメントは変更しません。

```bash
npm run check
```

`[OK] スクリプト実行` まで表示されれば接続できています。
`.mcp.json` のアドレスで繋がらず別のアドレスで繋がった場合は、書き換える値が表示されるので、そのとおりに `.mcp.json` を直してください。

### 4. Claude Code を起動する

```bash
claude
```

初回は「`affinity` MCP サーバーを使うか」を聞かれるので承認します。
（MCP の設定は起動時にしか読まれないため、`.mcp.json` を変えたら Claude Code を再起動してください）

### 5. 指示する

例：

```
Instagram 用に 1080×1350 px のポスターを作って。
タイトルは「OPEN DAY」、日付は 10/25（土）10:00〜17:00。
色はこげ茶とベージュで、落ち着いた雰囲気に。
```

```
見出しをもう少し大きくして、日付は見出しのすぐ下に寄せて
```

```
デスクトップに PNG で書き出して
```

Claude Code はデザインを `designs/` の下にスクリプトとして保存してから Affinity で実行し、レンダリング画像を見て確認します。
スクリプトとして残るので、同じデザインの作り直しや色違い・サイズ違いの量産ができます。

## B. SVG 経路（Affinity Designer 2 のまま使う）

Affinity を入れずに Designer 2 だけで作業したい場合は、Claude Code に「SVG 経路で」と伝えてください。

1. Claude Code が `designs/svg/` に SVG を作り、プレビュー画像で見た目を確かめる
2. `node tools/svg.mjs open designs/svg/<名前>.svg` で開く（Windows では SVG の既定アプリで開くので、既定アプリを Affinity Designer 2 にしておく）
3. Designer 2 では **File > Open** で開く。図形や文字がグループ化されたレイヤーとして編集できる
   （File > Place で配置すると埋め込みドキュメントになり、Edit Document → レイヤーを選択して Release する必要がある）

## うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| `npm run check` がどのアドレスにも繋がらない | Affinity が起動していない、または Enable Affinity MCP がオフ。設定を変えた直後なら Affinity を再起動 |
| Windows で `127.0.0.1:6767` が `ECONNREFUSED` | 想定どおり。Affinity は IPv6 の `[::1]` で待ち受けている。`.mcp.json` は `[::1]` のままにする |
| Claude Code に Affinity のツールが出てこない | Claude Code を再起動して `affinity` サーバーを承認する。Affinity を先に起動しておく |
| `The preamble documentation topic has not yet been read` | 接続ごとに preamble を読む必要がある。Claude Code に「preamble を読んでから」と伝える（`tools/affinity.mjs` は自動で読む） |
| 画像の配置や書き出しで `NOT_ALLOWED` / `PERMISSION_DENIED` | Access files on your Desktop をオンにし、ファイルをデスクトップ配下に置く |

## 仕組み

```
あなた ──日本語の指示──▶ Claude Code
                          │  designs/*.js を書く（affinity/kit.js の関数を使用）
                          ▼
                 tools/affinity.mjs  または  MCP ツール（mcp__affinity__*）
                          │  SSE: http://[::1]:6767/sse
                          ▼
                 Affinity 内蔵 MCP サーバー ──▶ execute_script / render_spread など 11 ツール
```

| ファイル | 内容 |
|---|---|
| `.mcp.json` | Claude Code に Affinity の MCP サーバーを登録 |
| `CLAUDE.md` | Claude Code への作業ルール（API を推測しない、レイヤーに名前を付ける、上書きしない等） |
| `.claude/settings.json` | 読み取り専用の操作（接続診断・ドキュメント参照・レンダリング）だけ確認なしで実行を許可。デザインを変更するスクリプト実行は毎回確認される |
| `affinity/kit.js` | 図形・テキスト・画像・書き出しの補助関数 |
| `tools/affinity.mjs` | 接続診断・スクリプト実行・レンダリング・SDK ドキュメント取得 |
| `tools/svg.mjs` | SVG 経路のプレビューと Designer 2 での表示 |
| `designs/` | デザインスクリプトと SVG |
| `test/` | Affinity のモックサーバーを使ったテスト（`npm test`） |

## 検証済みの範囲と、まだ確かめていないこと

- `tools/affinity.mjs` と `affinity/kit.js` は、本物と同じツール名・引数・preamble 必須の挙動を再現したモックサーバーでテストしています（`npm test`、9 件）。
  **本物の Affinity を相手にした動作確認はまだしていません**（作成環境に Affinity がないため）。最初に `npm run check` と `designs/examples/sample-poster.js` の実行で確かめてください
- `kit.js` の SDK 呼び出しは、Affinity 3.2 の実機で動作確認されている公開コード（下記の enoyola/affinity-creative-mcp、bolloplayer/affinity-mcp-setup）から写したものです
- Affinity の MCP とスクリプト機能は Canva がベータとして提供しているもので、今後のバージョンで API が変わる可能性があります
- `tools/svg.mjs open` の Windows での動作と、`tools/affinity.mjs` を Claude Code の MCP 接続と同時に使えるかどうかは未確認です

## 参考にした情報

- [Introducing the all-new Affinity: professional design, now free for everyone](https://canva.com/newsroom/news/all-new-affinity)（Canva 公式。無料化と統合アプリ化）
- [New in Affinity: Scripting and AI automation with Claude](https://www.affinity.studio/blog/affinity-automation-scripting-claude)（Affinity 公式ブログ）
- [Affinity SDK ドキュメント 3.3](https://sdk.affinity.studio/33000/)（スクリプト SDK のリファレンス）
- [Canva releases Affinity 3.3](https://www.cgchannel.com/2026/09/canva-releases-affinity-3-3/)（3.3 で Scripting Studio を追加）
- [bolloplayer/affinity-mcp-setup](https://github.com/bolloplayer/affinity-mcp-setup)（Windows での接続手順。`[::1]`・SSE のみ・preamble 必須・デスクトップ制約の実測）
- [enoyola/affinity-creative-mcp](https://github.com/enoyola/affinity-creative-mcp)（macOS / Affinity 3.2 で実機検証された図形・テキスト・書き出しのコード、設定項目名）
- [rabidgremlin/affinity-scripting](https://github.com/rabidgremlin/affinity-scripting)（MCP サーバーのツールと SDK ドキュメントの取得方法）
- [deba33/codex-plugins-by-deba33](https://github.com/deba33/codex-plugins-by-deba33/tree/main/plugins/affinity-mcp)（11 ツールの入力スキーマ、権限の設定項目）
- [How to import and edit SVG files with Affinity Designer](https://logosbynick.com/import-edit-svg-files-affinity-designer/)、[How to use an SVG file in Affinity Designer](https://fontbundles.net/design-school/how-to-use-an-svg-file-in-affinity-designer)（SVG の Open と Place の違い）
