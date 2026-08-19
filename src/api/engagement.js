// Interaksi pembaca: simpan artikel (bookmark) & follow penulis.
// Data tersimpan di koleksi terpisah (bookmarks / follows) di JSON Server.
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

// Murni & bisa diuji: toggle keanggotaan dalam daftar berdasarkan predikat.
// Mengembalikan { added, list } — `added` true bila elemen ditambahkan (sebelumnya belum ada).
export function toggleInList(list, predicate, makeItem) {
  const arr = Array.isArray(list) ? list : []
  const existing = arr.find(predicate)
  if (existing) {
    return { added: false, list: arr.filter((x) => !predicate(x)) }
  }
  return { added: true, list: [...arr, makeItem()] }
}

// ==== Bookmark (simpan artikel) ====
export const bookmarkApi = {
  async listFor(userId) {
    const all = await request(`/bookmarks?userId=${encodeURIComponent(userId)}&_sort=createdAt&_order=desc`)
    return all
  },

  async isSaved(userId, articleId) {
    const list = await request(
      `/bookmarks?userId=${encodeURIComponent(userId)}&articleId=${encodeURIComponent(articleId)}`
    )
    return list.length > 0
  },

  // Tambah/hapus bookmark. Mengembalikan { added: boolean }
  async toggle(userId, articleId) {
    const existing = await request(
      `/bookmarks?userId=${encodeURIComponent(userId)}&articleId=${encodeURIComponent(articleId)}`
    )
    if (existing.length) {
      await request(`/bookmarks/${existing[0].id}`, { method: 'DELETE' })
      return { added: false }
    }
    await request('/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ userId, articleId: String(articleId), createdAt: new Date().toISOString() }),
    })
    return { added: true }
  },
}

// ==== Follow penulis ====
export const followApi = {
  // Semua follow (untuk hitung & notifikasi) — filter di JS agar aman walau
  // salah satu field tidak ada di data lain.
  async all() {
    return request('/follows')
  },

  async followersOf(authorUsername) {
    const all = await request('/follows')
    return all.filter((f) => f.author === authorUsername)
  },

  async isFollowing(userId, authorUsername) {
    const all = await request('/follows')
    return all.some((f) => f.userId === String(userId) && f.author === authorUsername)
  },

  // Follow/unfollow. Mengembalikan { added: boolean }
  async toggle(userId, authorUsername) {
    const all = await request('/follows')
    const existing = all.find((f) => f.userId === String(userId) && f.author === authorUsername)
    if (existing) {
      await request(`/follows/${existing.id}`, { method: 'DELETE' })
      return { added: false }
    }
    await request('/follows', {
      method: 'POST',
      body: JSON.stringify({ userId: String(userId), author: authorUsername, createdAt: new Date().toISOString() }),
    })
    return { added: true }
  },
}
