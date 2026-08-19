// CRUD user (khusus admin) — data tersimpan di JSON Server
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

export const userApi = {
  async list() {
    return request('/users')
  },

  async findByUsername(username) {
    return request(`/users?username=${encodeURIComponent(username)}`)
  },

  // Nama pena unik antar penulis — dibandingkan case-insensitive & setelah di-trim
  async findByPenName(penName) {
    const target = penName.trim().toLowerCase()
    const all = await request('/users')
    return all.filter((u) => (u.penName || '').trim().toLowerCase() === target)
  },

  async get(id) {
    return request(`/users/${id}`)
  },

  async create(data) {
    return request('/users', { method: 'POST', body: JSON.stringify(data) })
  },

  async update(id, data) {
    return request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  },

  async remove(id) {
    return request(`/users/${id}`, { method: 'DELETE' })
  },
}
