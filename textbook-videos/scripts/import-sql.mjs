// 取り込み用 Edge Function（supabase/org-video-import）を pg_net で呼ぶ SQL を作る。
//   node scripts/import-sql.mjs --sha <コミット> --token-file <トークン> [--batch 8] > calls.sql
// out/video/*.mp4 と out/poster/*.jpg の SHA-256 を計算し、固定コミットの raw URL と組にして渡す。
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : d
}
const sha = opt('sha')
const token = fs.readFileSync(opt('token-file'), 'utf8').trim()
const batch = Number(opt('batch', '8'))
if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('--sha にコミットの 40 桁を')

const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'ledger/org.json'), 'utf8')).map((s) => s.id)
const items = []
for (const id of ids) {
  for (const [dir, ext] of [['video', 'mp4'], ['poster', 'jpg']]) {
    const f = path.join(ROOT, 'out', dir, `${id}.${ext}`)
    const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
    items.push({ src: `https://raw.githubusercontent.com/wespacecoffee-cpu/-AI/${sha}/textbook-videos/out/${dir}/${id}.${ext}`, sha256: h })
  }
}
const url = 'https://sttioqmsvinjeovzohqx.supabase.co/functions/v1/org-video-import'
const out = []
for (let i = 0; i < items.length; i += batch) {
  const body = JSON.stringify({ token, items: items.slice(i, i + batch) })
  out.push(`select net.http_post(url := '${url}', body := $j$${body}$j$::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 140000) as request_id;`)
}
console.log(out.join('\n'))
console.error(`${items.length} files in ${out.length} calls`)
