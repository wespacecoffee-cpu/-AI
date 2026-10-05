#!/usr/bin/env node
// Affinity の内蔵 MCP サーバーに接続するコマンドラインツール。
//
//   node tools/affinity.mjs check                     接続診断（読み取りのみ。ドキュメントは変更しない）
//   node tools/affinity.mjs run <script.js>           affinity/kit.js を先頭に付けてスクリプトを実行
//   node tools/affinity.mjs run <script.js> --no-kit  kit なしで実行
//   node tools/affinity.mjs render [--out file] [--spread N]
//                                                     現在のドキュメントを JPEG で書き出し（Claude が画像を見て確認する用）
//   node tools/affinity.mjs docs                      SDK ドキュメントの目次を表示
//   node tools/affinity.mjs docs <topic...> | --all   SDK ドキュメントを .affinity-docs/ に保存
//
// 接続先は環境変数 AFFINITY_MCP_URL、なければ .mcp.json の affinity.url を使う。
// Affinity は開いた状態で、設定 > Model Context Protocol > Enable Affinity MCP をオンにしておくこと。

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT_PATH = join(ROOT, 'affinity', 'kit.js');
const DOCS_DIR = join(ROOT, '.affinity-docs');
const CONNECT_TIMEOUT_MS = 5000;
const CALL_TIMEOUT_MS = Number(process.env.AFFINITY_MCP_TIMEOUT_MS || 120000);

// Windows では IPv6 ループバック [::1] のみで待ち受けることが報告されている（127.0.0.1 は ECONNREFUSED）。
// macOS の既存実装は localhost を使っているため、診断では両方を試す。
const FALLBACK_URLS = ['http://[::1]:6767/sse', 'http://localhost:6767/sse', 'http://127.0.0.1:6767/sse'];

export const EXPECTED_TOOLS = [
  'add_sdk_hint', 'execute_script', 'list_library_scripts', 'list_sdk_documentation', 'read_library_script',
  'read_sdk_documentation_topic', 'render_selection', 'render_spread', 'report_sdk_issue',
  'save_script_to_library', 'search_sdk_hints',
];

async function configuredUrl() {
  if (process.env.AFFINITY_MCP_URL) return process.env.AFFINITY_MCP_URL;
  try {
    const config = JSON.parse(await readFile(join(ROOT, '.mcp.json'), 'utf8'));
    return config?.mcpServers?.affinity?.url ?? FALLBACK_URLS[0];
  } catch {
    return FALLBACK_URLS[0];
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: ${ms}ms 以内に応答がありません`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function connect(url) {
  const client = new Client({ name: 'claude-affinity-design', version: '0.1.0' });
  const transport = new SSEClientTransport(new URL(url));
  try {
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, `接続 ${url}`);
  } catch (error) {
    await transport.close().catch(() => {});
    throw error;
  }
  return client;
}

export function textOf(result) {
  return (result?.content ?? [])
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
}

async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, {
    timeout: CALL_TIMEOUT_MS,
    maxTotalTimeout: CALL_TIMEOUT_MS,
  });
  if (result.isError) {
    const error = new Error(`Affinity のツール ${name} がエラーを返しました:\n${textOf(result)}`);
    error.result = result;
    throw error;
  }
  return result;
}

// execute_script は接続ごとに preamble を読んでからでないと拒否される。
async function readPreamble(client) {
  return call(client, 'read_sdk_documentation_topic', { filename: 'preamble' });
}

// スクリプト内の例外を必ず出力に残す。execute_script は console.log の内容しか返さない。
export function wrapScript(body, { withKit = true, kitSource = '' } = {}) {
  return [
    withKit ? kitSource : '',
    'try {',
    body,
    '} catch (error) {',
    "  console.log('SCRIPT_ERROR: ' + (error && error.message ? error.message : String(error)));",
    "  if (error && error.stack) console.log(error.stack);",
    '}',
  ].join('\n');
}

async function withClient(fn) {
  const url = await configuredUrl();
  let client;
  try {
    client = await connect(url);
  } catch (error) {
    console.error(`Affinity に接続できません (${url}): ${error.message}`);
    console.error('Affinity が起動しているか、MCP 設定がオンか確認し、`npm run check` で診断してください。');
    process.exit(2);
  }
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

async function cmdCheck() {
  const configured = await configuredUrl();
  const candidates = [configured, ...FALLBACK_URLS.filter((u) => u !== configured)];
  let client;
  let working;
  for (const url of candidates) {
    try {
      client = await connect(url);
      working = url;
      console.log(`[OK] 接続: ${url}`);
      break;
    } catch (error) {
      console.log(`[NG] 接続: ${url} — ${error.message}`);
    }
  }
  if (!client) {
    console.log('\nどのアドレスにも接続できませんでした。次を確認してください:');
    console.log('  1. Affinity（Canva 版、3.2 以降）が起動している');
    console.log('  2. 設定 > Model Context Protocol > Enable Affinity MCP がオン（変更直後は Affinity を再起動）');
    process.exit(1);
  }
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    const missing = EXPECTED_TOOLS.filter((n) => !names.includes(n));
    console.log(`[${missing.length ? 'WARN' : 'OK'}] ツール ${names.length} 個: ${names.join(', ')}`);
    if (missing.length) console.log(`       想定していて見つからないツール: ${missing.join(', ')}`);

    await readPreamble(client);
    console.log('[OK] preamble を読み込み');

    const probe = [
      "const { app } = require('/application');",
      "console.log('製品: ' + app.productLongName + ' ' + app.version);",
      "console.log('OS: ' + app.platformName);",
      "console.log('デスクトップ: ' + app.userDesktopPath);",
      "const doc = app.documents.current;",
      "console.log('開いているドキュメント: ' + app.documents.all.length);",
      "if (doc) console.log('現在のドキュメント: ' + doc.title + ' / トップレベルのレイヤー数 ' + doc.layers.length);",
    ].join('\n');
    const result = await call(client, 'execute_script', { script: wrapScript(probe, { withKit: false }) });
    console.log('[OK] スクリプト実行（読み取りのみ）:');
    console.log(textOf(result).replace(/^/gm, '       '));

    if (working !== configured) {
      console.log(`\n[注意] .mcp.json の URL (${configured}) では繋がらず、${working} で繋がりました。`);
      console.log(`       .mcp.json の "url" を "${working}" に書き換えてから Claude Code を再起動してください。`);
    } else {
      console.log('\n診断完了: Claude Code からも同じ URL で接続できます。');
    }
  } finally {
    await client.close().catch(() => {});
  }
}

async function cmdRun(file, { noKit }) {
  if (!file) throw new Error('使い方: node tools/affinity.mjs run <script.js> [--no-kit]');
  const body = await readFile(resolve(file), 'utf8');
  const kitSource = noKit ? '' : await readFile(KIT_PATH, 'utf8');
  const script = wrapScript(body, { withKit: !noKit, kitSource });
  await withClient(async (client) => {
    await readPreamble(client);
    const output = textOf(await call(client, 'execute_script', { script }));
    console.log(output);
    if (/^SCRIPT_ERROR: /m.test(output)) process.exitCode = 1;
  });
}

function imageFrom(result) {
  for (const item of result?.content ?? []) {
    if (item?.type === 'image' && item.data) return { data: item.data, mimeType: item.mimeType || 'image/jpeg' };
  }
  // テキストで base64 が返る実装にも対応する
  const text = textOf(result).trim();
  const match = /^data:(image\/[a-z]+);base64,(.+)$/s.exec(text);
  if (match) return { data: match[2], mimeType: match[1] };
  if (/^[A-Za-z0-9+/=\s]{200,}$/.test(text)) return { data: text.replace(/\s+/g, ''), mimeType: 'image/jpeg' };
  return null;
}

async function cmdRender({ out, spread }) {
  await withClient(async (client) => {
    await readPreamble(client);
    const probe = "const d = require('/application').app.documents.current; console.log(d ? d.sessionUuid : '');";
    const uuid = textOf(await call(client, 'execute_script', { script: probe })).trim();
    if (!uuid) throw new Error('開いているドキュメントがありません。');
    const result = await call(client, 'render_spread', { document_session_uuid: uuid, spread_index: Number(spread ?? 0) });
    const image = imageFrom(result);
    if (!image) throw new Error(`render_spread の応答に画像が見つかりません:\n${JSON.stringify(result).slice(0, 500)}`);
    const ext = image.mimeType.split('/')[1] === 'png' ? 'png' : 'jpg';
    const path = resolve(out ?? join(ROOT, 'renders', `latest.${ext}`));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(image.data, 'base64'));
    console.log(path);
  });
}

async function cmdDocs(topics, { all }) {
  await withClient(async (client) => {
    const list = textOf(await call(client, 'list_sdk_documentation'))
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (!topics.length && !all) {
      console.log(list.join('\n'));
      return;
    }
    await mkdir(DOCS_DIR, { recursive: true });
    for (const topic of all ? list : topics) {
      const path = resolve(DOCS_DIR, topic);
      const rel = relative(DOCS_DIR, path);
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`不正なトピック名: ${topic}`);
      try {
        const text = textOf(await call(client, 'read_sdk_documentation_topic', { filename: topic }));
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, text, 'utf8');
        console.log(`保存: ${path}`);
      } catch (error) {
        console.log(`失敗: ${topic} — ${error.message.split('\n')[0]}`);
      }
    }
  });
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'no-kit': { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
      out: { type: 'string' },
      spread: { type: 'string' },
    },
  });
  const [command, ...rest] = positionals;
  switch (command) {
    case 'check': return cmdCheck();
    case 'run': return cmdRun(rest[0], { noKit: values['no-kit'] });
    case 'render': return cmdRender(values);
    case 'docs': return cmdDocs(rest, values);
    default:
      console.log('使い方: node tools/affinity.mjs <check | run <script.js> [--no-kit] | render [--out file] [--spread N] | docs [topic...|--all]>');
      process.exitCode = command ? 1 : 0;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
