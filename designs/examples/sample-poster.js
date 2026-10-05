// サンプル: 1080×1350 px の告知ポスターを新規ドキュメントに作る。
// 実行: node tools/affinity.mjs run designs/examples/sample-poster.js
// 確認: node tools/affinity.mjs render  → renders/latest.jpg
//
// 書き方の決まり（CLAUDE.md 参照）:
//   - 寸法と色は先頭の定数にまとめる
//   - レイヤーには必ず名前を付ける（あとから「見出しを大きく」等の指示で特定できるように）
//   - 既存ドキュメントに描く場合は kit.removeNamed() で自分のレイヤーを先に消し、再実行で重複させない

const W = 1080;
const H = 1350;
const COLOURS = {
  background: '#F4EFE6',
  accent: '#3B2A20',
  highlight: '#C8873A',
  text: '#FFFFFF',
};

const doc = kit.newDocument({ width: W, height: H, unit: 'px', dpi: 72 });

const created = [
  kit.rect({ x: 0, y: 0, w: W, h: H, fill: COLOURS.background, name: 'Background' }, doc),
  kit.rect({ x: 0, y: 0, w: W, h: 520, fill: COLOURS.accent, name: 'Header band' }, doc),
  kit.ellipse({ x: W - 360, y: 360, w: 280, h: 280, fill: COLOURS.highlight, name: 'Accent circle' }, doc),
  kit.text({ x: 80, y: 140, text: 'OPEN DAY', size: 120, color: COLOURS.text, name: 'Headline' }, doc),
  kit.text({ x: 80, y: 300, text: '10.25 SAT  10:00 - 17:00', size: 44, color: COLOURS.text, name: 'Date' }, doc),
  kit.text({
    x: 80, y: 700, frame: { w: W - 160, h: 400 },
    text: 'ここに本文が入ります。Claude Code に「本文を差し替えて」「見出しを大きく」と指示すると、このスクリプトを書き換えて再実行します。',
    size: 36, color: COLOURS.accent, name: 'Body',
  }, doc),
];

// 位置とサイズを読み戻して、指定どおりに配置されたかを確認する
kit.log({ document: doc.title, created: created.map(kit.summary) });
