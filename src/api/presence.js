// Kehadiran online (presence) untuk Chat Redaksi — demo berbasis polling.
// Setiap user yang membuka halaman chat mengirim "heartbeat" berkala (lastSeen)
// ke koleksi `presence`. User dianggap online bila lastSeen-nya masih segar.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`Gagal memuat data (${res.status})`)
  }
  return res.json()
}

// Ambang online: lastSeen lebih baru dari ini (ms) → dianggap online.
// Lebih besar dari interval heartbeat agar toleran terhadap 1-2 heartbeat terlewat.
export const ONLINE_WINDOW_MS = 45 * 1000

// Murni & bisa diuji: apakah user (username) online pada waktu `now`,
// berdasarkan daftar presence (heartbeat terakhir tiap user).
export function isOnline(presenceList, username, now = Date.now()) {
  const row = (presenceList || []).find((p) => p.username === username)
  if (!row || !row.lastSeen) return false
  return now - new Date(row.lastSeen).getTime() <= ONLINE_WINDOW_MS
}

export const presenceApi = {
  async list() {
    return request('/presence')
  },

  // Tandai user ini sedang aktif — dipanggil berkala saat chat dibuka.
  async heartbeat(username) {
    const list = await request('/presence')
    const existing = list.find((p) => p.username === username)
    const body = { username, lastSeen: new Date().toISOString() }
    if (existing) {
      return request(`/presence/${existing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    }
    return request('/presence', { method: 'POST', body: JSON.stringify(body) })
  },
}
