// Notifikasi in-app (demo: polling ke JSON Server, tidak ada push realtime)
import { auth, hasPermission } from './auth'

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

// Murni & bisa diuji: apakah notifikasi belum dibaca oleh username tertentu
export function isUnread(notification, username) {
  if (!notification || !username) return false
  return !(Array.isArray(notification.readBy) && notification.readBy.includes(username))
}

// Murni & bisa diuji: apakah notifikasi tampil untuk user ini.
// - Notifikasi bertarget (punya `to`) → hanya untuk penerimanya.
// - Notifikasi broadcast (tanpa `to`, mis. "tulisan baru") → hanya untuk editor / pemegang izin publish.
export function isVisible(notification, user) {
  if (!notification || !user) return false
  if (notification.to) return notification.to === user.username
  return user.role === 'editor' || hasPermission(user, 'publish')
}

export const notificationApi = {
  // Notifikasi terbaru dulu
  async list() {
    return request('/notifications?_sort=createdAt&_order=desc&_limit=50')
  },

  // Notifikasi yang tampil untuk user ini (broadcast utk editor + yang bertarget ke dia)
  async listFor(user) {
    const list = await this.list()
    return list.filter((n) => isVisible(n, user))
  },

  async create(data) {
    return request('/notifications', {
      method: 'POST',
      body: JSON.stringify({ readBy: [], ...data }),
    })
  },

  // Tandai satu notifikasi sudah dibaca oleh user tertentu
  async markRead(id, username) {
    const item = await request(`/notifications/${id}`)
    const readBy = Array.isArray(item.readBy) ? item.readBy : []
    if (readBy.includes(username)) return item
    return request(`/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ readBy: [...readBy, username] }),
    })
  },

  // Tandai semua belum dibaca (hanya yang tampil untuk user ini)
  async markAllRead(user) {
    const list = await this.listFor(user)
    await Promise.all(
      list.filter((n) => isUnread(n, user.username)).map((n) => this.markRead(n.id, user.username))
    )
  },

  // Tandai notifikasi @mention di satu ruang chat sudah dibaca oleh username.
  // Dipanggil saat user membuka/membaca ruang chat — notifikasi mention tidak boleh
  // nyangkut di bel padahal chat-nya sudah dibaca.
  async markRoomMentionsRead(roomId, username) {
    const list = await this.list()
    const targets = list.filter(
      (n) =>
        n.type === 'chat_mention' &&
        n.to === username &&
        (n.roomId || 'group') === roomId &&
        isUnread(n, username)
    )
    await Promise.all(targets.map((n) => this.markRead(n.id, username)))
    return targets.length
  },

  // Notifikasi yang belum dibaca user tertentu
  async unreadFor(user) {
    const list = await this.listFor(user)
    return list.filter((n) => isUnread(n, user.username))
  },
}

// Kirim notifikasi "penulis membuat artikel" ke Editor — tidak pernah gagal
export async function notifyArticleCreated({ articleId, title }) {
  try {
    const user = auth.current()
    if (!user) return
    await notificationApi.create({
      type: 'article_created',
      articleId,
      title,
      by: user.username,
      byName: user.name || user.username,
      createdAt: new Date().toISOString(),
    })
  } catch {
    /* abaikan — notifikasi tidak boleh memblokir alur utama */
  }
}

// Kirim notifikasi ke penulis artikel saat artikelnya dikomentari / dibalas.
// to = username pemilik artikel (createdBy). Tidak mengirim ke diri sendiri.
export async function notifyCommentAdded({ articleId, title, to, byName, commentType = 'komentar' }) {
  try {
    const user = auth.current()
    if (!user || !to || to === user.username) return
    await notificationApi.create({
      type: 'comment_new',
      to,
      articleId,
      title,
      by: user.username,
      byName: byName || user.name || user.username,
      commentType,
      createdAt: new Date().toISOString(),
    })
  } catch {
    /* abaikan — notifikasi tidak boleh memblokir alur utama */
  }
}

// Kirim notifikasi ke user yang disebut (@mention) di chat grup
// to = username yang disebut. Tidak mengirim ke diri sendiri.
export async function notifyChatMention({ to, byName, roomId, content }) {
  try {
    const user = auth.current()
    if (!user || !to || to === user.username) return
    await notificationApi.create({
      type: 'chat_mention',
      to,
      roomId: roomId || 'group',
      content,
      by: user.username,
      byName: byName || user.name || user.username,
      createdAt: new Date().toISOString(),
    })
  } catch {
    /* abaikan — notifikasi tidak boleh memblokir alur utama */
  }
}

// Label & ikon untuk tiap jenis notifikasi
export const notificationTypeInfo = {
  article_created: {
    label: 'Tulisan Baru',
    icon: '📝',
    desc: (n) => `${n.byName || n.by} membuat tulisan baru`,
  },
  comment_new: {
    label: 'Komentar Baru',
    icon: '💬',
    desc: (n) =>
      `${n.byName || n.by} ${n.commentType === 'balasan' ? 'membalas komentar di' : 'berkomentar di'} artikel kamu`,
  },
  chat_mention: {
    label: 'Sebutan di Chat',
    icon: '📣',
    desc: (n) => `${n.byName || n.by} menyebut anda di chat`,
  },
  chat_autoblock: {
    label: 'Blokir Otomatis',
    icon: '⛔',
    desc: (n) => `${n.byName || n.by} (@${n.content || n.by}) diblokir otomatis dari chat karena spam`,
  },
  article_new: {
    label: 'Penulis Favorit',
    icon: '⭐',
    desc: (n) => `${n.byName || n.by} menerbitkan artikel baru`,
  },
}
