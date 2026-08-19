// Uji 7 fitur baru chat: riwayat lama, pemisah pesan baru, cari, lampiran, kartu artikel, mute, notifikasi
import { writeFileSync } from 'node:fs'

const CDP = 'http://127.0.0.1:9230'
const APP = 'http://localhost:5173'
const DATA = 'http://localhost:3001'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  }
  const rpc = (method, params = {}) => new Promise((res) => {
    const mid = ++id
    pending.set(mid, res)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  return { ws, rpc }
}

const tabs = await (await fetch(`${CDP}/json/list`)).json()
const page = tabs.find((t) => t.type === 'page')
const { ws, rpc } = await connect(page.webSocketDebuggerUrl)
await rpc('Page.enable')
await rpc('Runtime.enable')
await rpc('DOM.enable')

async function nav(url) { await rpc('Page.navigate', { url }); await sleep(2800) }
async function evalJs(expr) {
  const res = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true })
  if (res.result?.exceptionDetails) return 'EXC: ' + JSON.stringify(res.result.exceptionDetails.exception?.description || '')
  return res.result?.result?.value
}
async function setSession(user) {
  await evalJs(`localStorage.setItem('genz_session', ${JSON.stringify(JSON.stringify(user))})`)
  await nav(APP + '/admin/pesan')
}
async function typeAndSend(text) {
  await evalJs(`(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return 'NO TEXTAREA';
    ta.value = ${JSON.stringify(text)};
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return 'TYPED';
  })()`)
  await sleep(200)
  await evalJs(`(() => {
    const ta = document.querySelector('textarea');
    ta?.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  })()`)
  await sleep(900)
}

const admin = { id: 1, username: 'admin', name: 'Administrator', role: 'admin', status: 'active' }
const results = {}
const cleanupIds = []
let tempUserId = null

async function apiPost(path, body) {
  const res = await fetch(`${DATA}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json()
}
async function apiDel(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(`${DATA}${path}`, { method: 'DELETE' }); if (r.ok) return } catch {}
    await sleep(250)
  }
}

try {
  await nav(APP + '/admin/pesan')
  await setSession(admin)

  // ===== F2: pemisah "pesan baru" =====
  const divMsg = await apiPost('/messages', {
    roomId: 'group', type: 'group', sender: 'garaanemesis', senderName: 'Garaa Nemesis',
    content: 'DIVIDERMARK pesan baru untuk tes', readBy: [], reactions: {}, createdAt: new Date().toISOString(),
  })
  cleanupIds.push(divMsg.id)
  await nav(APP + '/admin/pesan')
  await sleep(2500)
  results['2. pemisah Pesan baru muncul'] = await evalJs(`document.body.innerText.includes('Pesan baru') ? 'YA ✅' : 'TIDAK'`)
  await sleep(6000) // auto-read
  const divMsgAfter = (await (await fetch(`${DATA}/messages/${divMsg.id}`)).json())
  results['2b. pesan uji jadi terbaca'] = (divMsgAfter.readBy || []).includes('admin') ? 'YA ✅' : 'TIDAK'

  // ===== F3: cari pesan =====
  await typeAndSend('zebra789 kata kunci unik')
  await sleep(400)
  await evalJs(`(() => {
    const inp = document.querySelector('input[placeholder="Cari pesan di ruang ini…"]');
    inp.value = 'zebra789';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`)
  await sleep(600)
  results['3. pencarian memfilter + highlight'] = await evalJs(`(() => {
    const t = document.body.innerText;
    const has = t.includes('zebra789 kata kunci unik');
    const mark = !!document.querySelector('mark');
    return (has && mark) ? 'YA ✅' : 'TIDAK';
  })()`)
  await evalJs(`(() => {
    const inp = document.querySelector('input[placeholder="Cari pesan di ruang ini…"]');
    inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`)
  await sleep(400)

  // ===== F4: lampiran gambar (via CDP setFileInputFiles) =====
  writeFileSync('./.tmp-test.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
  const absPng = process.cwd().replace(/\\/g, '/') + '/.tmp-test.png'
  const doc = await rpc('DOM.getDocument')
  const q = await rpc('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' })
  if (q.result.nodeId) {
    await rpc('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [absPng] })
    await sleep(1500)
    results['4. chip lampiran muncul'] = await evalJs(`document.body.innerText.includes('.tmp-test.png') ? 'YA ✅' : 'TIDAK'`)
    await typeAndSend('')
    await sleep(1500)
    const dbAtt = await (await fetch(`${DATA}/messages`)).json()
    const attMsg = dbAtt.find((m) => m.attachment && m.sender === 'admin')
    results['4b. lampiran tersimpan di db'] = attMsg ? 'YA ✅' : 'TIDAK'
    results['4c. gambar tampil di bubble'] = attMsg ? await evalJs(`!!document.querySelector('img[src^="data:image"]') ? 'YA ✅' : 'TIDAK'`) : 'SKIP'
    if (attMsg) cleanupIds.push(attMsg.id)
  } else {
    results['4. input file tidak ditemukan'] = 'SKIP'
  }

  // ===== F5: kartu artikel =====
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.title === 'Bagikan artikel dari portal')?.click()`)
  await sleep(800)
  results['5. modal pilih artikel terbuka'] = await evalJs(`document.body.innerText.includes('Bagikan Artikel') ? 'YA ✅' : 'TIDAK'`)
  await evalJs(`(() => {
    const modal = [...document.querySelectorAll('.fixed.inset-0')].find((el) => el.innerText.includes('Bagikan Artikel'));
    const btn = [...modal.querySelectorAll('button')].find((b) => b.innerText.includes('Buka di portal'));
    btn?.click();
  })()`)
  await sleep(600)
  results['5b. chip artikel siap kirim'] = await evalJs(`!!document.querySelector('button[title="Batal bagikan"]') ? 'YA ✅' : 'TIDAK'`)
  await typeAndSend('')
  await sleep(500)
  const dbAfterCard = await (await fetch(`${DATA}/messages`)).json()
  const cardMsg = dbAfterCard.find((m) => m.articleCard && m.sender === 'admin')
  results['5c. kartu artikel tersimpan'] = cardMsg ? `YA ✅ (${cardMsg.articleCard.title.slice(0, 25)}…)` : 'TIDAK'
  results['5d. kartu tampil di bubble'] = cardMsg ? await evalJs(`document.body.innerText.includes('Buka di portal') ? 'YA ✅' : 'TIDAK'`) : 'SKIP'
  if (cardMsg) cleanupIds.push(cardMsg.id)

  // ===== F6: mute per percakapan =====
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.title === 'Senyapkan notifikasi ruang ini')?.click()`)
  await sleep(800)
  const meAfterMute = (await (await fetch(`${DATA}/users`)).json()).find((u) => u.username === 'admin')
  results['6. mute tersimpan (group)'] = meAfterMute.mutedRooms?.includes('group') ? 'YA ✅' : 'TIDAK'
  results['6b. ikon jadi 🔕'] = await evalJs(`document.body.innerText.includes('🔕') ? 'YA ✅' : 'TIDAK'`)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.title === 'Aktifkan notifikasi ruang ini')?.click()`)
  await sleep(800)
  const meAfterUnmute = (await (await fetch(`${DATA}/users`)).json()).find((u) => u.username === 'admin')
  results['6c. unmute berhasil'] = meAfterUnmute.mutedRooms?.includes('group') ? 'BELUM ❌' : 'YA ✅'

  // ===== F7: notifikasi browser (sanity — tidak crash, API tersedia) =====
  results['7. Notification API ada'] = await evalJs(`typeof Notification !== 'undefined' ? 'YA ✅' : 'TIDAK'`)

  // ===== F1: muat riwayat lama (108 pesan di ruang uji) =====
  const tempUser = await apiPost('/users', { name: 'Old Tester', username: 'oldtest', role: 'writer', status: 'active', permissions: [], passwordHash: 'x', email: 'oldtest@gmail.com' })
  tempUserId = tempUser.id
  const NOW = Date.now()
  const created = []
  for (let i = 1; i <= 108; i++) {
    created.push(await apiPost('/messages', {
      roomId: 'dm:admin-oldtest', type: 'dm', sender: 'oldtest', senderName: 'Old Tester',
      content: i === 1 ? 'OLDSTART-1 pesan paling lama' : i === 108 ? 'OLDEND-108 pesan terbaru' : `pesan lama ${i}`,
      readBy: [], reactions: {}, createdAt: new Date(NOW - (108 - i) * 1000).toISOString(),
    }))
    await sleep(30)
  }
  created.forEach((m) => cleanupIds.push(m.id))
  await sleep(500)
  await nav(APP + '/admin/pesan')
  await evalJs(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Old Tester'));
    btn?.click();
  })()`)
  await sleep(1500)
  results['1. hanya 100 pesan tampil awalnya'] = await evalJs(`document.body.innerText.includes('OLDSTART-1') ? 'TIDAK (sudah tampil) ❌' : 'YA ✅ (pesan lama belum tampil)'`)
  results['1b. tombol Muat pesan lebih lama ada'] = await evalJs(`document.body.innerText.includes('Muat pesan lebih lama') ? 'YA ✅' : 'TIDAK'`)
  await evalJs(`[...document.querySelectorAll('button')].find((b) => b.innerText.includes('Muat pesan lebih lama'))?.click()`)
  await sleep(1500)
  results['1c. pesan lama termuat'] = await evalJs(`document.body.innerText.includes('OLDSTART-1') ? 'YA ✅' : 'TIDAK'`)
  results['1d. tombol hilang setelah habis'] = await evalJs(`document.body.innerText.includes('Muat pesan lebih lama') ? 'MASIH ❌' : 'HILANG ✅'`)

  results['8. tidak ada error di halaman'] = await evalJs(`document.body.innerText.includes('Gagal') ? 'ADA ERROR ❌' : 'BERSIH ✅'`)
} catch (e) {
  results['ERROR'] = String(e?.message || e)
} finally {
  // bersihkan (berurutan + jeda agar json-server tidak kewalahan)
  for (const id of cleanupIds) {
    await apiDel(`/messages/${id}`)
    await sleep(40)
  }
  if (tempUserId) await apiDel(`/users/${tempUserId}`)
  try { writeFileSync('./.tmp-test.png', '') } catch {}
  console.log(JSON.stringify(results, null, 2))
  ws.close()
  process.exit(0)
}
