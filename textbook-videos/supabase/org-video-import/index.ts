// 一度だけ使う取り込み用の Edge Function（Supabase / Deno）。
// 書き出した図解動画（MP4）とポスター（JPEG）を、このリポジトリの固定コミットから取り寄せ、
// SHA-256 が台帳どおりであることを確かめてから、wecoffee-os の公開バケットに置く。
//   videos/library/org/org-NN.mp4   photos/library/org/org-NN.jpg
// 呼び出しにはトークンが要る（ここには SHA-256 だけを置く）。使い終わったら 410 を返すだけの関数に差し替える。
import { createClient } from 'npm:@supabase/supabase-js@2'

const TOKEN_SHA256 = '3b6789bf47ede387c5495c6a3e9b2124c3dbdb6b8a2309de7b767c040cf4b2dd'
const SRC = /^https:\/\/raw\.githubusercontent\.com\/wespacecoffee-cpu\/-AI\/[0-9a-f]{40}\/textbook-videos\/out\/(video|poster)\/(org-\d{2})\.(mp4|jpg)$/
const DEST: Record<string, { bucket: string; type: string }> = {
  mp4: { bucket: 'videos', type: 'video/mp4' },
  jpg: { bucket: 'photos', type: 'image/jpeg' },
}

type Item = { src: string; sha256: string }

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (data: Uint8Array | string) => hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data))

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  let body: { token?: string; items?: Item[] }
  try {
    body = await req.json()
  } catch {
    return new Response('bad json', { status: 400 })
  }
  if ((await sha256(body.token ?? '')) !== TOKEN_SHA256) return new Response('forbidden', { status: 403 })
  const items = Array.isArray(body.items) ? body.items.slice(0, 20) : []
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const results = []
  for (const it of items) {
    const m = typeof it.src === 'string' ? it.src.match(SRC) : null
    if (!m || !/^[0-9a-f]{64}$/.test(it.sha256 ?? '')) {
      results.push({ src: it.src, ok: false, error: 'rejected' })
      continue
    }
    const [, , id, ext] = m
    const dest = DEST[ext]
    const path = `library/org/${id}.${ext}`
    try {
      const r = await fetch(it.src)
      if (!r.ok) throw new Error(`fetch ${r.status}`)
      const data = new Uint8Array(await r.arrayBuffer())
      const got = await sha256(data)
      if (got !== it.sha256) throw new Error(`sha256 mismatch ${got}`)
      const { error } = await sb.storage.from(dest.bucket).upload(path, data, { contentType: dest.type, upsert: true, cacheControl: '31536000' })
      if (error) throw new Error(error.message)
      results.push({ bucket: dest.bucket, path, size: data.length, ok: true })
    } catch (e) {
      results.push({ bucket: dest.bucket, path, ok: false, error: String(e) })
    }
  }
  return Response.json({ results })
})
