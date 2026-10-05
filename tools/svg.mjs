#!/usr/bin/env node
// Affinity Designer 2（スクリプト機能なし）向けの SVG ルート。
//
//   node tools/svg.mjs preview <in.svg> [out.png]   SVG を PNG に描画（Claude が画像を見て確認する用）
//   node tools/svg.mjs open <file.svg>              Affinity Designer 2（なければ Affinity）で開く
//
// Affinity Designer 2 では File > Open で開くと、SVG の要素がグループ化されたレイヤーとして編集できる。
// File > Place で配置した場合は埋め込みドキュメントになり、Edit Document → レイヤーを選択して Release が必要。

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve, basename, extname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

async function preview(input, output) {
  if (!input) throw new Error('使い方: node tools/svg.mjs preview <in.svg> [out.png]');
  const svg = await readFile(resolve(input), 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: true },
    background: 'rgba(255,255,255,0)',
  });
  const png = resvg.render().asPng();
  const out = resolve(output ?? join('renders', basename(input, extname(input)) + '.png'));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, png);
  console.log(out);
}

function tryRun(command, args) {
  const result = spawnSync(command, args, { stdio: 'pipe' });
  return result.status === 0;
}

async function open(file) {
  if (!file) throw new Error('使い方: node tools/svg.mjs open <file.svg>');
  const path = resolve(file);
  await access(path);
  if (process.platform === 'darwin') {
    for (const app of ['Affinity Designer 2', 'Affinity']) {
      if (tryRun('open', ['-a', app, path])) {
        console.log(`${app} で開きました: ${path}`);
        return;
      }
    }
    if (tryRun('open', [path])) {
      console.log(`既定のアプリで開きました: ${path}`);
      return;
    }
  } else if (process.platform === 'win32') {
    // Affinity Designer 2 の実行ファイルの場所はインストール方法で変わるため、SVG の既定アプリで開く。
    // SVG の既定アプリを Affinity Designer 2 にしておくこと（README 参照）。
    const quoted = `'${path.replace(/'/g, "''")}'`;
    if (tryRun('powershell', ['-NoProfile', '-Command', `Start-Process -FilePath ${quoted}`])) {
      console.log(`SVG の既定アプリで開きました: ${path}`);
      return;
    }
  }
  throw new Error(`自動で開けませんでした。Affinity Designer 2 の File > Open で次のファイルを開いてください: ${path}`);
}

const [command, ...args] = process.argv.slice(2);
const commands = { preview: () => preview(...args), open: () => open(...args) };
if (!commands[command]) {
  console.log('使い方: node tools/svg.mjs <preview <in.svg> [out.png] | open <file.svg>>');
  process.exitCode = command ? 1 : 0;
} else {
  commands[command]().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
