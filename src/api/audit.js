// Audit log: mencatat aksi penting (login, kelola berita, kelola user)
import { auth } from './auth'

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

export const auditApi = {
  // Catat aksi. Tidak pernah melempar error agar tidak mengganggu alur utama.
  async log(action, detail = '') {
    try {
      const user = auth.current()
      await request('/auditLogs', {
        method: 'POST',
        body: JSON.stringify({
          username: user?.username || 'guest',
          name: user?.name || '',
          role: user?.role || 'guest',
          action,
          detail,
          createdAt: new Date().toISOString(),
        }),
      })
    } catch {
      /* abaikan — audit tidak boleh memblokir aksi utama */
    }
  },

  // Ambil daftar log (terbaru dulu)
  async list() {
    return request('/auditLogs?_sort=createdAt&_order=desc&_limit=200')
  },
}

// Label & warna badge untuk tiap jenis aksi
export const auditActionInfo = {
  login: { label: 'Login', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  login_failed: { label: 'Login Gagal', badge: 'bg-red-50 text-red-700 border-red-200' },
  logout: { label: 'Logout', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  article_create: { label: 'Tulis Berita', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  article_update: { label: 'Edit Berita', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  article_publish: { label: 'Terbitkan', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  article_ready: { label: 'Siap Terbit', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  article_schedule: { label: 'Jadwalkan Terbit', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  article_revision: { label: 'Minta Revisi', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  article_trash: { label: 'Hapus (Bin)', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  article_restore: { label: 'Pulihkan', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  article_delete: { label: 'Hapus Permanen', badge: 'bg-red-50 text-red-700 border-red-200' },
  user_create: { label: 'Tambah User', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  user_update: { label: 'Edit User', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  user_delete: { label: 'Hapus User', badge: 'bg-red-50 text-red-700 border-red-200' },
  user_verify: { label: 'Verifikasi User', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  user_disable: { label: 'Nonaktifkan User', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  user_enable: { label: 'Aktifkan User', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  password_change: { label: 'Ganti Password', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  comment_delete: { label: 'Hapus Komentar', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  comment_reply: { label: 'Balas Komentar', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  category_create: { label: 'Tambah Kategori', badge: 'bg-lime-50 text-lime-700 border-lime-200' },
  category_update: { label: 'Ubah Status Kategori', badge: 'bg-lime-50 text-lime-700 border-lime-200' },
  ad_create: { label: 'Tambah Iklan', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  ad_update: { label: 'Edit Iklan', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  ad_delete: { label: 'Hapus Iklan', badge: 'bg-rose-50 text-rose-600 border-rose-200' },
}
