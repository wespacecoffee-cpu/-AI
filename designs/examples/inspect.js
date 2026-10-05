// 読み取り専用: 開いているドキュメントの情報とトップレベルのレイヤーを表示する。何も変更しない。
// 実行: node tools/affinity.mjs run designs/examples/inspect.js

const doc = kit.currentDoc();
kit.log({
  title: doc.title,
  sessionUuid: doc.sessionUuid,
  dpi: doc.dpi,
  layers: kit.layers(doc),
});
