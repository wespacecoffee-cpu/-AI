// テスト用の Affinity MCP サーバーのモック。
//
// 本物と同じ 11 個のツール名・引数名で SSE を話し、本物と同じく
// 「preamble を読むまで execute_script を拒否する（接続ごと）」挙動を再現する。
// execute_script は Node の vm で実行し、require() には SDK モジュールのスタブを渡す。
// スタブは affinity/kit.js が呼ぶ API の形（実機検証済みコードから写したもの）だけを持ち、
// 呼び出し内容を記録する。本物の Affinity の描画結果を再現するものではない。

import http from 'node:http';
import vm from 'node:vm';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// 1x1 の JPEG
const TINY_JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

const TOOLS = [
  ['add_sdk_hint', { hint: { type: 'string' } }, ['hint']],
  ['execute_script', { script: { type: 'string' } }, ['script']],
  ['list_library_scripts', {}, []],
  ['list_sdk_documentation', {}, []],
  ['read_library_script', { title: { type: 'string' } }, ['title']],
  ['read_sdk_documentation_topic', { filename: { type: 'string' } }, ['filename']],
  ['render_selection', { document_session_uuid: { type: 'string' } }, ['document_session_uuid']],
  ['render_spread', { document_session_uuid: { type: 'string' }, spread_index: { type: 'number' } }, ['document_session_uuid', 'spread_index']],
  ['report_sdk_issue', { description: { type: 'string' }, code: { type: 'string' } }, ['description']],
  ['save_script_to_library', { title: { type: 'string' }, description: { type: 'string' }, code: { type: 'string' } }, ['title', 'description', 'code']],
  ['search_sdk_hints', { prompt: { type: 'string' } }, ['prompt']],
].map(([name, properties, required]) => ({ name, description: name, inputSchema: { type: 'object', properties, required } }));

function makeDocument(state, title = 'Untitled', options = null) {
  const layers = [];
  const doc = {
    title,
    options,
    sessionUuid: `mock-${state.documents.length + 1}`,
    dpi: options?.dpi ?? 72,
    format: 'RGBA8',
    selection: null,
    layersArray: layers,
    layers: {
      get length() { return layers.length; },
      toArray: () => [...layers],
      get all() { return [...layers]; },
    },
    executeCommand(command) {
      state.calls.push(['executeCommand', command.kind]);
      if (command.kind === 'add') {
        const node = makeNode(command.definition);
        layers.push(node);
        command.newNodes = [node];
      } else if (command.kind === 'delete') {
        const index = layers.indexOf(command.selection.node);
        if (index >= 0) layers.splice(index, 1);
      }
    },
    applyTransform(transform, node) {
      state.calls.push(['applyTransform', transform.ops]);
      node.transform = transform.ops;
    },
    setOpacity(value) {
      if (!this.selection) throw new Error('mock: setOpacity requires a selection');
      this.selection.node.opacity = value;
    },
    export(path, options, area) {
      state.calls.push(['export', path, options.preset, area.kind]);
      return { all: [{ path, isSuccess: true, errorMessage: '' }] };
    },
  };
  state.documents.push(doc);
  return doc;
}

function makeNode(definition) {
  return {
    userDescription: definition.userDescription,
    defaultDescription: definition.kind,
    definition,
    getSpreadBaseBox() {
      const b = definition.bounds ?? { x: definition.x ?? 0, y: definition.y ?? 0, width: definition.width ?? 100, height: definition.height ?? 50 };
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    },
  };
}

function makeModules(state) {
  const app = {
    productLongName: 'Affinity (mock)',
    version: '0.0.0-mock',
    platformName: 'mock',
    userDesktopPath: '/mock/Desktop',
    documents: {
      get current() { return state.current; },
      get all() { return [...state.documents]; },
    },
  };
  class Rectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  class TransformBuilder {
    constructor() { this.ops = []; }
    translate(x, y) { this.ops.push(['translate', x, y]); return this; }
    scale(x, y) { this.ops.push(['scale', x, y]); return this; }
    rotate(r) { this.ops.push(['rotate', r]); return this; }
    get transform() { return { ops: this.ops }; }
  }
  const builderFactory = () => ({
    nodes: [],
    addNode(definition) { this.nodes.push(definition); },
    createCommand(_selectNew, childType) {
      if (childType !== 'Main') throw new Error('mock: unexpected child type ' + childType);
      return { kind: 'add', definition: this.nodes[0], newNodes: [] };
    },
  });
  const story = () => ({
    deltas: [],
    text: '',
    setToFrameTextDefaultStyle(dpi, format) { this.deltas.push(['frameDefault', dpi, format]); },
    setToArtisticTextDefaultStyle(dpi, format) { this.deltas.push(['artDefault', dpi, format]); },
    applyGlyphDelta(d) { this.deltas.push(d); },
    applyParagraphDelta(d) { this.deltas.push(d); },
    addText(t) { this.text += t; },
  });
  return {
    '/application': { app },
    '/document': {
      Document: {
        get current() { return state.current; },
        get all() { return [...state.documents]; },
        create(options) { const d = makeDocument(state, 'New', options); state.current = d; return d; },
      },
      NewDocumentOptions: { createDefault: () => ({}) },
      FileExportOptions: { allPresetNames: ['PNG', 'JPEG (High quality)'], createWithPresetName: (preset) => ({ preset }) },
      FileExportArea: { createForWholeDocument: () => ({ kind: 'whole' }) },
    },
    '/units': { UnitType: { Pixel: 'px', Millimetres: 'mm', Centimetres: 'cm', Inches: 'in' } },
    '/rasterobject': {
      RasterFormat: { RGBA8: 'RGBA8' },
      Bitmap: { loadFromFile: (path, format) => ({ path, format, width: 200, height: 100 }) },
    },
    '/nodes': {
      ShapeNodeDefinition: { create: (shape, bounds, fill, stroke, lineStyle, transparency) => ({ kind: 'shape', shape, bounds, fill, stroke, lineStyle, transparency }) },
      ArtTextNodeDefinition: { createFromStoryBuilder: (pos, s) => ({ kind: 'artText', ...pos, story: s }) },
      FrameTextNodeDefinition: { createFromStoryBuilder: (rect, s) => ({ kind: 'frameText', bounds: rect, story: s }) },
      ContainerNodeDefinition: { create: (name) => ({ kind: 'container', userDescription: name }) },
      ImageNodeDefinition: { create: (format) => ({ kind: 'image', format, bounds: { x: 0, y: 0, width: 200, height: 100 } }) },
    },
    '/commands': {
      AddChildNodesCommandBuilder: { create: builderFactory },
      NodeChildType: { Main: 'Main' },
      DocumentCommand: { createDeleteSelection: (selection) => ({ kind: 'delete', selection }) },
    },
    '/shapes': { ShapeRectangle: { create: () => 'rectangle' }, ShapeEllipse: { create: () => 'ellipse' } },
    '/fills': { FillDescriptor: { createSolid: (colour, blend) => ({ solid: colour, blend }), createNone: () => ({ none: true }) } },
    '/geometry': { Rectangle, TransformBuilder },
    '/linestyle': { LineStyleDescriptor: { createDefault: (width) => ({ width }) } },
    '/colours': { RGBA8: (r, g, b, a) => ({ r, g, b, a }) },
    'affinity:common': { BlendMode: { Normal: 'Normal' } },
    '/storybuilder': { StoryBuilder: { create: story } },
    '/storydelta': {
      StoryDelta: {
        createGlyphDouble: (type, value) => ['glyphDouble', type, value],
        createBrushFill: (fill) => ['brushFill', fill],
        createAlignX: (align) => ['alignX', align],
      },
    },
    '/glyphatts': { GlyphAttDoubleType: { Height: 'Height' } },
    '/paragraphatts': { ParagraphAlignXType: { Left: 'Left', Centre: 'Centre', Right: 'Right', JustifyAll: 'JustifyAll' } },
    '/selections': { Selection: { create: (doc, node) => ({ doc, node }) } },
  };
}

function runScript(state, script) {
  const output = [];
  const modules = makeModules(state);
  const context = vm.createContext({
    console: { log: (...args) => output.push(args.map(String).join(' ')) },
    require: (name) => {
      if (!(name in modules)) throw new Error(`mock: unknown module ${name}`);
      return modules[name];
    },
    JSON, Math, Number, String, Array, Set, Object, Error, Buffer: undefined,
  });
  vm.runInContext(script, context, { timeout: 2000 });
  return output.join('\n');
}

function listen(server, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once('error', onError);
    server.listen(0, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

export async function startMockAffinity({ host = '::1' } = {}) {
  const state = { documents: [], current: null, calls: [], scripts: [], toolCalls: [] };
  const transports = new Map();

  function makeServer() {
    let preambleRead = false;
    const server = new Server({ name: 'affinity-mock', version: '0.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
      const { name, arguments: args = {} } = params;
      state.toolCalls.push(name);
      const text = (t) => ({ content: [{ type: 'text', text: t }] });
      switch (name) {
        case 'read_sdk_documentation_topic':
          if (args.filename === 'preamble') { preambleRead = true; return text('# preamble (mock)'); }
          return text(`# ${args.filename} (mock)`);
        case 'list_sdk_documentation':
          return text('preamble,document.md,nodes.md');
        case 'execute_script':
          if (!preambleRead) return { isError: true, ...text('The preamble documentation topic has not yet been read') };
          state.scripts.push(args.script);
          try {
            return text(runScript(state, args.script));
          } catch (error) {
            return { isError: true, ...text(`mock runtime error: ${error.message}`) };
          }
        case 'render_spread': {
          const doc = state.documents.find((d) => d.sessionUuid === args.document_session_uuid);
          if (!doc) return { isError: true, ...text('no such document') };
          return { content: [{ type: 'image', data: TINY_JPEG, mimeType: 'image/jpeg' }] };
        }
        default:
          return text(`${name} (mock)`);
      }
    });
    return server;
  }

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://mock');
    if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);
      res.on('close', () => transports.delete(transport.sessionId));
      await makeServer().connect(transport);
    } else if (req.method === 'POST' && url.pathname === '/messages') {
      const transport = transports.get(url.searchParams.get('sessionId'));
      if (!transport) { res.writeHead(404).end(); return; }
      await transport.handlePostMessage(req, res);
    } else {
      res.writeHead(404).end();
    }
  });

  // 本物の Affinity は [::1] で待ち受ける。IPv6 が使えない環境（CI コンテナ等）では 127.0.0.1 に切り替える。
  try {
    await listen(httpServer, host);
  } catch (error) {
    if (host !== '::1' || error.code !== 'EAFNOSUPPORT' && error.code !== 'EADDRNOTAVAIL') throw error;
    host = '127.0.0.1';
    await listen(httpServer, host);
  }
  const { port } = httpServer.address();
  const hostPart = host.includes(':') ? `[${host}]` : host;
  return {
    url: `http://${hostPart}:${port}/sse`,
    state,
    openDocument(title = 'Existing') {
      const doc = makeDocument(state, title);
      state.current = doc;
      return doc;
    },
    close: () => new Promise((resolve) => {
      for (const t of transports.values()) t.close().catch(() => {});
      httpServer.closeAllConnections?.();
      httpServer.close(resolve);
    }),
  };
}
