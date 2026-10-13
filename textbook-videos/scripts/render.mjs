// 図解動画の書き出し。
//   node scripts/render.mjs [--ledger org|fixtures|all] [--ids org-01,org-02] [--stills] [--no-video]
//   --stills    : 確認用の静止画（題・各拍の終わり・締め）を out/check/<id>/ に出し、1 枚の一覧にまとめる
//   既定で MP4（H.264, yuv420p, faststart）を out/video/<id>.mp4、ポスター（題の絵）を out/poster/<id>.jpg に出す
// ブラウザは環境変数 REMOTION_BROWSER（未指定なら Playwright の headless_shell）を使う。
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const flag = (name) => args.includes(`--${name}`)

const browserExecutable =
  process.env.REMOTION_BROWSER ||
  (fs.existsSync('/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell')
    ? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'
    : undefined)

const ledgerName = opt('ledger', 'org')
const read = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'ledger', `${n}.json`), 'utf8'))
let specs = ledgerName === 'all' ? [...read('org'), ...read('fixtures')] : read(ledgerName)
const ids = opt('ids', '')
if (ids) specs = specs.filter((s) => ids.split(',').includes(s.id))
if (!specs.length) {
  console.error('対象の台帳項目がありません')
  process.exit(1)
}

// timing.ts と同じ計算（静止画のフレーム選びに使う）
const OPEN = 78
const segText = (segs) => segs.map((s) => (typeof s === 'string' ? s : '')).join('')
const beatFrames = (segs) => Math.max(102, Math.round((1.4 + [...segText(segs)].length / 7) * 30))

console.log(`bundle…`)
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'src/index.ts') })

for (const spec of specs) {
  const composition = await selectComposition({ serveUrl, id: spec.id, browserExecutable, inputProps: { spec } })
  if (flag('stills')) {
    const dir = path.join(ROOT, 'out/check', spec.id)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    const frames = [OPEN - 14]
    let t = OPEN
    for (const b of spec.beats) {
      t += beatFrames(b.caption)
      frames.push(t - 16)
    }
    frames.push(t + 70)
    for (const [i, frame] of frames.entries()) {
      await renderStill({ composition, serveUrl, output: path.join(dir, `${String(i).padStart(2, '0')}.png`), frame, browserExecutable, inputProps: { spec } })
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', path.join(dir, '*.png'), '-vf', `scale=640:-1,tile=2x${Math.ceil(frames.length / 2)}:padding=6:color=0x333333`, path.join(ROOT, 'out/check', `${spec.id}.png`)])
    console.log(`stills ${spec.id} → out/check/${spec.id}.png (${frames.length})`)
  }
  if (!flag('no-video')) {
    const tmp = path.join(ROOT, 'out/video', `${spec.id}.raw.mp4`)
    const out = path.join(ROOT, 'out/video', `${spec.id}.mp4`)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    await renderMedia({ composition, serveUrl, codec: 'h264', crf: 20, pixelFormat: 'yuv420p', outputLocation: tmp, browserExecutable, inputProps: { spec }, muted: true })
    // 先頭に moov を置き（Fast Start）、ブラウザで読み込みながら再生できるようにする
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-c', 'copy', '-movflags', '+faststart', out])
    fs.rmSync(tmp)
    const poster = path.join(ROOT, 'out/poster', `${spec.id}.jpg`)
    fs.mkdirSync(path.dirname(poster), { recursive: true })
    await renderStill({ composition, serveUrl, output: poster, frame: OPEN - 14, imageFormat: 'jpeg', jpegQuality: 86, browserExecutable, inputProps: { spec } })
    const kb = Math.round(fs.statSync(out).size / 1024)
    console.log(`video ${spec.id} → out/video/${spec.id}.mp4 (${kb} KB, ${(composition.durationInFrames / 30).toFixed(1)} s)`)
  }
}
