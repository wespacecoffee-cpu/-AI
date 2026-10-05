import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockAffinity } from './mock-affinity.mjs';
import { connect, textOf } from '../tools/affinity.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'tools', 'affinity.mjs');
const run = promisify(execFile);

let mock;
let tmp;

before(async () => {
  mock = await startMockAffinity();
  tmp = await mkdtemp(join(tmpdir(), 'affinity-cli-'));
});

after(async () => {
  await mock.close();
  await rm(tmp, { recursive: true, force: true });
});

function cli(...args) {
  return run(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: { ...process.env, AFFINITY_MCP_URL: mock.url },
  });
}

async function cliFailing(...args) {
  try {
    await cli(...args);
  } catch (error) {
    return error;
  }
  assert.fail('コマンドは失敗するはずでした');
}

async function script(name, body) {
  const path = join(tmp, name);
  await writeFile(path, body, 'utf8');
  return path;
}

test('モックは本物と同じく preamble 前の execute_script を拒否する', async () => {
  const client = await connect(mock.url);
  try {
    const rejected = await client.callTool({ name: 'execute_script', arguments: { script: 'console.log(1)' } });
    assert.equal(rejected.isError, true);
    assert.match(textOf(rejected), /preamble/);
    await client.callTool({ name: 'read_sdk_documentation_topic', arguments: { filename: 'preamble' } });
    const accepted = await client.callTool({ name: 'execute_script', arguments: { script: 'console.log(1)' } });
    assert.equal(textOf(accepted), '1');
  } finally {
    await client.close();
  }
});

test('check: 接続・11 ツール・preamble・読み取りスクリプトを確認する', async () => {
  const { stdout } = await cli('check');
  assert.ok(stdout.includes(`[OK] 接続: ${mock.url}`), stdout);
  assert.match(stdout, /\[OK\] ツール 11 個/);
  assert.match(stdout, /\[OK\] preamble を読み込み/);
  assert.match(stdout, /製品: Affinity \(mock\)/);
  assert.match(stdout, /診断完了/);
});

test('run: preamble を先に読み、kit 付きでサンプルポスターを作る', async () => {
  const before = mock.state.documents.length;
  const { stdout } = await cli('run', join(ROOT, 'designs', 'examples', 'sample-poster.js'));
  const result = JSON.parse(stdout);
  assert.equal(mock.state.documents.length, before + 1);
  assert.deepEqual(result.created.map((c) => c.name), ['Background', 'Header band', 'Accent circle', 'Headline', 'Date', 'Body']);
  assert.deepEqual(result.created[0].box, { x: 0, y: 0, width: 1080, height: 1350 });
  assert.deepEqual(result.created[2].box, { x: 720, y: 360, width: 280, height: 280 });

  const doc = mock.state.documents.at(-1);
  assert.equal(doc.options.width, 1080);
  assert.equal(doc.options.units, 'px');
  assert.equal(doc.options.rasterFormat, 'RGBA8');

  const [background, , circle, headline, , body] = doc.layersArray.map((n) => n.definition);
  assert.equal(background.shape, 'rectangle');
  assert.deepEqual(background.fill.solid, { r: 0xf4, g: 0xef, b: 0xe6, a: 255 });
  assert.deepEqual(background.stroke, { none: true });
  assert.equal(circle.shape, 'ellipse');
  assert.equal(headline.kind, 'artText');
  assert.equal(headline.story.text, 'OPEN DAY');
  assert.deepEqual(headline.story.deltas[1], ['glyphDouble', 'Height', 120]);
  assert.equal(body.kind, 'frameText');
  assert.deepEqual({ ...body.bounds }, { x: 80, y: 700, width: 920, height: 400 }); // vm 内で作られたオブジェクトなので複製して比較
});

test('run: スクリプト内の例外は SCRIPT_ERROR として表示され、終了コードは 1', async () => {
  const path = await script('broken.js', "kit.rect({ x: 0, y: 0, w: 10, h: 10, fill: 'red' });");
  const error = await cliFailing('run', path);
  assert.equal(error.code, 1);
  assert.match(error.stdout, /SCRIPT_ERROR: 色は #RRGGBB または #RRGGBBAA/);
});

test('kit.removeNamed で再実行してもレイヤーが重複しない', async () => {
  const doc = mock.openDocument('Reuse');
  const path = await script('idempotent.js', [
    "kit.removeNamed(['Badge', 'Badge label']);",
    "kit.ellipse({ x: 10, y: 10, w: 80, h: 80, fill: '#FF000080', stroke: '#000000', strokeWidth: 2, name: 'Badge' });",
    "kit.text({ x: 20, y: 40, text: 'NEW', align: 'center', name: 'Badge label' });",
    'kit.log(kit.layers());',
  ].join('\n'));
  await cli('run', path);
  const { stdout } = await cli('run', path);
  assert.deepEqual(JSON.parse(stdout).map((l) => l.name), ['Badge', 'Badge label']);
  assert.equal(doc.layersArray.length, 2);
  const [badge, label] = doc.layersArray.map((n) => n.definition);
  assert.deepEqual(badge.fill.solid, { r: 255, g: 0, b: 0, a: 0x80 });
  assert.deepEqual(badge.lineStyle, { width: 2 });
  assert.deepEqual(label.story.deltas.at(-1), ['alignX', 'Centre']);
});

test('kit.image と kit.exportTo', async () => {
  const doc = mock.openDocument('Images');
  const path = await script('image.js', [
    "kit.image({ path: '/mock/Desktop/logo.png', x: 50, y: 60, w: 100, name: 'Logo' });",
    "kit.log(kit.exportTo('/mock/Desktop/out.png', 'PNG'));",
  ].join('\n'));
  const { stdout } = await cli('run', path);
  assert.deepEqual(JSON.parse(stdout), [{ path: '/mock/Desktop/out.png', success: true, error: null }]);
  assert.deepEqual(doc.layersArray[0].transform, [['translate', -0, -0], ['scale', 0.5, 0.5], ['translate', 50, 60]]);

  const missing = await script('bad-preset.js', "kit.exportTo('/mock/Desktop/out.xyz', 'NOPE');");
  const error = await cliFailing('run', missing);
  assert.match(error.stdout, /書き出しプリセットがありません: NOPE/);
});

test('render: 現在のドキュメントを画像ファイルに保存する', async () => {
  mock.openDocument('Render me');
  const out = join(tmp, 'render.jpg');
  const { stdout } = await cli('render', '--out', out);
  assert.equal(stdout.trim(), out);
  const bytes = await readFile(out);
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
});

test('docs: SDK ドキュメントの目次を表示する', async () => {
  const { stdout } = await cli('docs');
  assert.deepEqual(stdout.trim().split('\n'), ['preamble', 'document.md', 'nodes.md']);
});

test('接続できない URL ではわかりやすいメッセージで終了する', async () => {
  const error = await run(process.execPath, [CLI, 'run', join(ROOT, 'designs', 'examples', 'inspect.js')], {
    cwd: ROOT,
    env: { ...process.env, AFFINITY_MCP_URL: 'http://[::1]:9/sse' },
  }).catch((e) => e);
  assert.equal(error.code, 2);
  assert.match(error.stderr, /Affinity に接続できません/);
});
