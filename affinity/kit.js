// Affinity デザインキット
//
// tools/affinity.mjs run が、デザインスクリプトの先頭に自動で連結する補助関数集。
// スクリプト側では `kit.xxx(...)` で呼び出す（グローバル名の衝突を避けるため 1 つの名前空間にまとめている）。
//
// ここに書いた SDK 呼び出しは、すべて Affinity 3.2 の実機で動作確認されたコードから写したもの:
//   - 図形・テキスト・画像・書き出し・新規ドキュメント:
//       enoyola/affinity-creative-mcp (MIT) src/editing-scripts.ts, src/scripts.ts（macOS / Affinity 3.2.0 で実機検証）
//   - レイヤー削除・名前付け・不透明度・Document.current:
//       bolloplayer/affinity-mcp-setup (MIT) examples/color-boost-two-layer.js（Windows / Affinity 3.2.x で実機検証）
// 確認されていない API（フォント指定、角丸、グラデーション等）は意図的に入れていない。
// 必要になったら SDK ドキュメントで確かめ、実機で動いたものだけをここへ追加すること。

const kit = (() => {
  'use strict';

  const BLEND_NORMAL = () => require('affinity:common').BlendMode.Normal;

  function currentDoc() {
    const { Document } = require('/document');
    const doc = Document.current;
    if (!doc) throw new Error('開いているドキュメントがありません。kit.newDocument() で作るか、Affinity でファイルを開いてください。');
    return doc;
  }

  // '#RRGGBB' または '#RRGGBBAA' → RGBA8
  function colour(hex) {
    const { RGBA8 } = require('/colours');
    const m = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(hex));
    if (!m) throw new Error('色は #RRGGBB または #RRGGBBAA で指定してください: ' + hex);
    const h = m[1];
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
    return RGBA8(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a);
  }

  function solidFill(hex) {
    const { FillDescriptor } = require('/fills');
    return hex == null ? FillDescriptor.createNone() : FillDescriptor.createSolid(colour(hex), BLEND_NORMAL());
  }

  function nameOf(node) {
    return node.userDescription || node.defaultDescription || null;
  }

  // レイヤーの実際の位置とサイズを読み戻す（座標系の確認用）
  function box(node) {
    try {
      const b = node.getSpreadBaseBox();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    } catch (_) {
      return null;
    }
  }

  function summary(node) {
    return { name: nameOf(node), box: box(node) };
  }

  function addDefinition(doc, definition, name) {
    const { AddChildNodesCommandBuilder, NodeChildType } = require('/commands');
    if (name) definition.userDescription = name;
    const builder = AddChildNodesCommandBuilder.create();
    builder.addNode(definition);
    const command = builder.createCommand(true, NodeChildType.Main);
    doc.executeCommand(command);
    return command.newNodes[0];
  }

  // 新規ドキュメント。単位は px を推奨（図形やテキストの座標が px で検証されているため）。
  function newDocument({ width, height, unit = 'px', dpi = 72, transparent = false, artboard = false } = {}) {
    const { Document, NewDocumentOptions } = require('/document');
    const { UnitType } = require('/units');
    const { RasterFormat } = require('/rasterobject');
    if (!(width > 0 && height > 0)) throw new Error('newDocument には width と height（正の数）が必要です。');
    const aliases = { px: ['Pixel', 'Pixels'], mm: ['Millimetres', 'Millimetre'], cm: ['Centimetres', 'Centimetre'], in: ['Inches', 'Inch'] }[unit];
    if (!aliases) throw new Error('unit は px / mm / cm / in のいずれかです: ' + unit);
    const unitValue = aliases.map((n) => UnitType[n]).find((v) => v !== undefined);
    if (unitValue === undefined) throw new Error('この Affinity では単位 ' + unit + ' が見つかりません。');
    const options = NewDocumentOptions.createDefault();
    options.units = unitValue;
    options.width = width;
    options.height = height;
    options.isLandscape = width > height;
    options.dpi = dpi;
    options.viewDpi = dpi;
    options.isTransparentBackground = transparent;
    options.rasterFormat = RasterFormat.RGBA8;
    options.createArtboard = artboard;
    options.isMultiPage = false;
    options.pageCount = 1;
    options.isFacing = false;
    options.createMaster = false;
    return Document.create(options);
  }

  function shape(kind, { x, y, w, h, fill = '#000000', stroke = null, strokeWidth = 1, name } = {}, doc = currentDoc()) {
    const { ShapeNodeDefinition } = require('/nodes');
    const { ShapeRectangle, ShapeEllipse } = require('/shapes');
    const { FillDescriptor } = require('/fills');
    const { Rectangle } = require('/geometry');
    const { LineStyleDescriptor } = require('/linestyle');
    const geometry = kind === 'ellipse' ? ShapeEllipse.create() : ShapeRectangle.create();
    const definition = ShapeNodeDefinition.create(
      geometry,
      new Rectangle(x, y, w, h),
      solidFill(fill),
      solidFill(stroke),
      LineStyleDescriptor.createDefault(strokeWidth),
      FillDescriptor.createNone(),
    );
    return addDefinition(doc, definition, name || kind);
  }

  // テキスト。frame を渡すとフレームテキスト、省略するとアーティスティックテキスト。
  // align: 'left' | 'center' | 'right' | 'justify'
  function text({ x, y, text: content, size = 24, color = '#000000', align = 'left', frame, name } = {}, doc = currentDoc()) {
    const { StoryBuilder } = require('/storybuilder');
    const { StoryDelta } = require('/storydelta');
    const { GlyphAttDoubleType } = require('/glyphatts');
    const { ParagraphAlignXType } = require('/paragraphatts');
    const { ArtTextNodeDefinition, FrameTextNodeDefinition } = require('/nodes');
    const alignKey = { left: 'Left', center: 'Centre', right: 'Right', justify: 'JustifyAll' }[align];
    if (!alignKey) throw new Error('align は left / center / right / justify のいずれかです: ' + align);
    if (frame && !(frame.w > 0 && frame.h > 0)) throw new Error('frame には w と h（正の数）が必要です。');
    const story = StoryBuilder.create();
    if (frame) story.setToFrameTextDefaultStyle(doc.dpi, doc.format);
    else story.setToArtisticTextDefaultStyle(doc.dpi, doc.format);
    story.applyGlyphDelta(StoryDelta.createGlyphDouble(GlyphAttDoubleType.Height, size));
    story.applyGlyphDelta(StoryDelta.createBrushFill(solidFill(color)));
    story.applyParagraphDelta(StoryDelta.createAlignX(ParagraphAlignXType[alignKey]));
    story.addText(String(content));
    const definition = frame
      ? FrameTextNodeDefinition.createFromStoryBuilder({ x, y, width: frame.w, height: frame.h }, story)
      : ArtTextNodeDefinition.createFromStoryBuilder({ x, y }, story);
    return addDefinition(doc, definition, name || 'Text');
  }

  // 空のレイヤー（コンテナ）
  function layer(name, doc = currentDoc()) {
    const { ContainerNodeDefinition } = require('/nodes');
    return addDefinition(doc, ContainerNodeDefinition.create(name), null);
  }

  // 画像の配置。Affinity のスクリプトが読めるのはデスクトップ配下のファイルだけ。
  function image({ path, x = 0, y = 0, w, h, name } = {}, doc = currentDoc()) {
    const { Bitmap } = require('/rasterobject');
    const { ImageNodeDefinition } = require('/nodes');
    const { TransformBuilder } = require('/geometry');
    const bitmap = Bitmap.loadFromFile(path, doc.format);
    const definition = ImageNodeDefinition.create(doc.format);
    definition.bitmap = bitmap;
    const node = addDefinition(doc, definition, name || 'Image');
    const before = node.getSpreadBaseBox();
    let sx = 1;
    let sy = 1;
    if (w != null && h != null) { sx = w / before.width; sy = h / before.height; }
    else if (w != null) { sx = sy = w / before.width; }
    else if (h != null) { sx = sy = h / before.height; }
    const transform = new TransformBuilder().translate(-before.x, -before.y).scale(sx, sy).translate(x, y).transform;
    doc.applyTransform(transform, node);
    return node;
  }

  function setOpacity(node, opacity, doc = currentDoc()) {
    const { Selection } = require('/selections');
    doc.selection = Selection.create(doc, node);
    doc.setOpacity(opacity);
    doc.selection = null;
  }

  // 同じ名前のトップレベルレイヤーを消す。スクリプトを何度実行しても重複しないようにするため。
  function removeNamed(names, doc = currentDoc()) {
    const { DocumentCommand } = require('/commands');
    const { Selection } = require('/selections');
    const targets = new Set(Array.isArray(names) ? names : [names]);
    let removed = 0;
    for (const node of doc.layers.toArray()) {
      if (targets.has(nameOf(node))) {
        doc.executeCommand(DocumentCommand.createDeleteSelection(Selection.create(doc, node), true));
        removed += 1;
      }
    }
    return removed;
  }

  function layers(doc = currentDoc()) {
    return doc.layers.toArray().map(summary);
  }

  function exportPresets() {
    const { FileExportOptions } = require('/document');
    return [...FileExportOptions.allPresetNames];
  }

  // 書き出し。path はデスクトップ配下の絶対パス（Affinity のサンドボックス制約）。
  // preset は kit.exportPresets() で得られる名前のいずれか。
  function exportTo(path, preset, doc = currentDoc()) {
    const { FileExportOptions, FileExportArea } = require('/document');
    if (!FileExportOptions.allPresetNames.includes(preset)) {
      throw new Error('書き出しプリセットがありません: ' + preset + '（kit.exportPresets() で一覧を確認）');
    }
    const records = doc.export(path, FileExportOptions.createWithPresetName(preset), FileExportArea.createForWholeDocument(), null);
    return records.all.map((r) => ({ path: r.path, success: r.isSuccess, error: r.isSuccess ? null : r.errorMessage }));
  }

  function desktop() {
    return require('/application').app.userDesktopPath;
  }

  function log(value) {
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  }

  return {
    currentDoc, newDocument, colour, rect: (o, d) => shape('rectangle', o, d), ellipse: (o, d) => shape('ellipse', o, d),
    text, layer, image, setOpacity, removeNamed, layers, summary, box, exportPresets, exportTo, desktop, log,
  };
})();
