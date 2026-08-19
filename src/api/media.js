// Pustaka media: gambar diunggah sekali, bisa dipakai berulang (artikel & iklan).
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

export const mediaApi = {
  async list() {
    return request('/media?_sort=createdAt&_order=desc')
  },

  async create({ name, url, size, type, uploadedBy }) {
    return request('/media', {
      method: 'POST',
      body: JSON.stringify({
        name: name || 'gambar',
        url,
        size: size || 0,
        type: type || 'image',
        uploadedBy: uploadedBy || 'admin',
        createdAt: new Date().toISOString(),
      }),
    })
  },

  async remove(id) {
    return request(`/media/${id}`, { method: 'DELETE' })
  },
}
