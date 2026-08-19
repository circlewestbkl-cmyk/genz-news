// API layer untuk JSON Server — sesuaikan lewat VITE_API_URL bila perlu
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

// applyVote dipakai lewat import di bawah agar tidak duplikasi
import { applyVote } from '../utils/votes'

export const articleApi = {
  // Daftar artikel, mendukung filter kategori, pencarian, status, dan urutan terbaru
  // notTrashed=true → kecualikan artikel yang ada di recycle bin (status trashed)
  async list({ category, q, limit, status, notTrashed } = {}) {
    const params = new URLSearchParams({ _sort: 'publishedAt', _order: 'desc' })
    if (category) params.set('category', category)
    if (q) params.set('q', q)
    if (limit) params.set('_limit', limit)
    if (status) params.set('status', status)
    if (notTrashed) params.set('status_ne', 'trashed')
    return request(`/articles?${params.toString()}`)
  },

  // Daftar artikel yang sudah terbit saja (untuk halaman publik)
  async listPublished(opts = {}) {
    return this.list({ ...opts, status: 'published' })
  },

  // Daftar artikel berstatus "Siap Terbit" (halaman khusus editor)
  async listReady() {
    return this.list({ status: 'ready' })
  },

  // Daftar artikel yang terjadwal terbit otomatis
  async listScheduled() {
    return this.list({ status: 'scheduled' })
  },

  // Daftar artikel yang ada di recycle bin
  async listTrashed() {
    return this.list({ status: 'trashed' })
  },

  // Editor menyetujui artikel → tandai "Siap Terbit" (belum tampil di publik)
  async markReady(id) {
    return this.update(id, {
      status: 'ready',
      scheduledAt: null,
      revisionNote: '',
      revisionRequestedAt: null,
      revisionRequestedBy: null,
      revisionDoneAt: null,
    })
  },

  // Jadwalkan terbit otomatis pada waktu tertentu (status → scheduled)
  async schedule(id, scheduledAt) {
    return this.update(id, {
      status: 'scheduled',
      scheduledAt: new Date(scheduledAt).toISOString(),
      revisionNote: '',
      revisionRequestedAt: null,
      revisionRequestedBy: null,
      revisionDoneAt: null,
    })
  },

  // Batalkan jadwal → kembali ke "Siap Terbit"
  async cancelSchedule(id) {
    return this.update(id, { status: 'ready', scheduledAt: null })
  },

  // Terbitkan sekarang (atau saat jadwal tiba) — publishedAt diisi waktu terbit.
  // Setelah terbit, pengikut penulis otomatis mendapat notifikasi (fire-and-forget).
  async publish(id, at = new Date().toISOString()) {
    const updated = await this.update(id, {
      status: 'published',
      publishedAt: new Date(at).toISOString(),
      scheduledAt: null,
      revisionNote: '',
      revisionRequestedAt: null,
      revisionRequestedBy: null,
      revisionDoneAt: null,
    })
    this.notifyFollowersOnPublish(updated).catch(() => {})
    return updated
  },

  // Jadikan / batalkan artikel sebagai Headline Utama (Editor's Pick)
  async setFeatured(id, featured) {
    return this.update(id, { featured: !!featured })
  },

  // Notifikasi ke pengikut penulis saat artikelnya terbit (tidak memblokir alur)
  async notifyFollowersOnPublish(article) {
    const author = article?.createdBy
    if (!author) return
    const { followApi } = await import('./engagement')
    const followers = await followApi.followersOf(author)
    if (!followers.length) return
    const { notificationApi } = await import('./notifications')
    await Promise.all(
      followers.map((f) =>
        notificationApi.create({
          type: 'article_new',
          to: f.userId, // userId follower == username pembaca
          articleId: article.id,
          title: article.title,
          by: author,
          byName: article.author || author,
          createdAt: new Date().toISOString(),
        })
      )
    )
  },

  // Kembalikan artikel (Siap Terbit/Terjadwal) menjadi draft
  async backToDraft(id) {
    return this.update(id, { status: 'draft', scheduledAt: null })
  },

  // Soft delete: pindahkan ke recycle bin (bukan hapus permanen)
  async trash(id) {
    return this.update(id, { status: 'trashed', trashedAt: new Date().toISOString() })
  },

  // Pulihkan dari recycle bin → kembali sebagai draft
  async restore(id) {
    return this.update(id, { status: 'draft', trashedAt: null })
  },

  async get(id) {
    return request(`/articles/${id}`)
  },

  async create(data) {
    return request('/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async update(id, data) {
    return request(`/articles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async remove(id) {
    return request(`/articles/${id}`, { method: 'DELETE' })
  },

  // Tambah pembaca + catat views per hari (untuk analitik)
  async incrementViews(id) {
    const article = await this.get(id)
    const { dayKey } = await import('../utils/analytics')
    const key = dayKey(new Date())
    const viewsByDay = { ...(article.viewsByDay || {}) }
    viewsByDay[key] = (viewsByDay[key] || 0) + 1
    return this.update(id, { views: (article.views || 0) + 1, viewsByDay })
  },

  // Like/dislike artikel — toggle per pengunjung (voterId dari localStorage)
  async vote(id, type, voterId) {
    const article = await this.get(id)
    const updated = applyVote(article, type, voterId)
    return this.update(id, updated)
  },

  // Editor meminta revisi ke penulis — status tetap draft,
  // pesan tersimpan agar terlihat oleh penulis.
  // Permintaan baru membatalkan status "revisi selesai" sebelumnya.
  async requestRevision(id, { note, by }) {
    return this.update(id, {
      revisionNote: note,
      revisionRequestedAt: new Date().toISOString(),
      revisionRequestedBy: by,
      revisionDoneAt: null,
    })
  },
}

export const DEFAULT_IMAGE_URL = 'https://picsum.photos/seed/genz-default/1200/675'
