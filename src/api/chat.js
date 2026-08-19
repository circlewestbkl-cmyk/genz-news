// API chat internal — percakapan Admin, Editor & Penulis (tersimpan di JSON Server)
const BASE_URL = import.meta.env.VITE_API_URL || '/api'

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

// ID ruang DM yang konsisten: "dm:<userA>-<userB>" (urutan abjad) — sama dari kedua sisi
export function dmRoomId(a, b) {
  return 'dm:' + [a, b].sort().join('-')
}

// Apakah user ini ikut serta dalam ruang tersebut?
// Grup = semua orang; DM = hanya salah satu dari kedua pihak.
export function isRoomParticipant(roomId, username) {
  if (!roomId) return false
  if (roomId === 'group') return true
  if (roomId.startsWith('dm:')) {
    const [a, b] = roomId.slice(3).split('-')
    return a === username || b === username
  }
  return false
}

// Jumlah pesan belum dibaca user ini — HANYA dari ruang yang dia ikuti.
// (Pesan DM antar user lain tidak boleh ikut terhitung.)
export function unreadCountFor(messages, username) {
  return messages.filter(
    (m) =>
      m.sender !== username &&
      !(m.readBy || []).includes(username) &&
      isRoomParticipant(m.roomId, username)
  ).length
}

export const chatApi = {
  // Ambil pesan terbaru (terbaru dulu, dibatasi) — ringan untuk polling.
  // beforeTs: ambil pesan yang LEBIH LAMA dari timestamp itu (muat riwayat lama).
  async list(limit = 100, beforeTs = null) {
    const params = new URLSearchParams({ _sort: 'createdAt', _order: 'desc', _limit: String(limit) })
    if (beforeTs) params.set('createdAt_lt', beforeTs)
    return request(`/messages?${params.toString()}`)
  },

  // Kirim pesan ke ruang grup atau DM — bisa berisi balasan (replyTo), forward (forwardedFrom),
  // lampiran (attachment) atau kartu artikel (articleCard)
  async send({ roomId, type, sender, senderName, content, replyTo, forwardedFrom, attachment, articleCard }) {
    return request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        roomId,
        type,
        sender,
        senderName,
        content,
        ...(replyTo ? { replyTo } : {}),
        ...(forwardedFrom ? { forwardedFrom } : {}),
        ...(attachment ? { attachment } : {}),
        ...(articleCard ? { articleCard } : {}),
        readBy: [],
        reactions: {},
        createdAt: new Date().toISOString(),
      }),
    })
  },

  // Simpan reaksi emoji pesan (map emoji → daftar username)
  async react(messageId, reactions) {
    return request(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ reactions }),
    })
  },

  // Hapus pesan (soft delete — riwayat & balasan tetap utuh)
  async del(messageId) {
    return request(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ deleted: true }),
    })
  },

  // Tandai semua pesan dalam satu ruang sudah dibaca oleh username
  async markRoomRead(roomId, username, messages) {
    const targets = messages.filter(
      (m) => m.roomId === roomId && m.sender !== username && !(m.readBy || []).includes(username)
    )
    await Promise.all(
      targets.map((m) =>
        request(`/messages/${m.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ readBy: [...(m.readBy || []), username] }),
        })
      )
    )
  },
}
