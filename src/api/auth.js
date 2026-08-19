// Autentikasi & manajemen sesi (demo: user & hash password tersimpan di db.json)
import { sha256 } from '../utils/hash'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const SESSION_KEY = 'genz_session'

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

export const auth = {
  // Cari user berdasarkan username & password (dibandingkan via hash), lalu cek status akun
  // Hasil: { ok: true, user } atau { ok: false, reason: 'invalid' | 'pending' | 'inactive' }
  async login(username, password) {
    const passwordHash = await sha256(password || '')
    const users = await request(
      `/users?username=${encodeURIComponent(username)}&passwordHash=${passwordHash}`
    )
    if (!users.length) return { ok: false, reason: 'invalid' }
    const found = users[0]
    if (found.status === 'pending') return { ok: false, reason: 'pending' }
    if (found.status === 'inactive') return { ok: false, reason: 'inactive' }
    // Simpan sesi tanpa password
    const { password: _pw, ...safeUser } = found
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser))
    return { ok: true, user: safeUser }
  },

  // Login pembaca — simulasi "Masuk dengan Google" (demo):
  // user cukup memasukkan alamat Gmail; akun reader dibuat otomatis jika belum ada.
  async readerLogin(email) {
    const em = (email || '').trim().toLowerCase()
    if (!em || !/^[^@\s]+@gmail\.com$/i.test(em)) {
      return { ok: false, reason: 'invalid', message: 'Masukkan alamat Gmail yang valid (nama@gmail.com).' }
    }
    // Cari akun pembaca dengan email yang sama (filter di JS — filter JSON Server
    // mengembalikan semua user bila field `email` tidak ada di data lain)
    const all = await request('/users')
    let user = all.find((u) => (u.email || '').trim().toLowerCase() === em)
    if (!user) {
      user = await request('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: deriveReaderName(em),
          username: em,
          email: em,
          passwordHash: '',
          role: 'reader',
          status: 'active',
          permissions: [],
          provider: 'google',
        }),
      })
    }
    if (user.status === 'inactive') {
      return { ok: false, reason: 'inactive', message: 'Akun pembaca ini dinonaktifkan.' }
    }
    const { password: _pw, ...safeUser } = user
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser))
    return { ok: true, user: safeUser }
  },

  // Verifikasi password lama (untuk ganti password sendiri)
  async verifyPassword(username, password) {
    const passwordHash = await sha256(password || '')
    const users = await request(
      `/users?username=${encodeURIComponent(username)}&passwordHash=${passwordHash}`
    )
    return users.length > 0
  },

  // Ganti password user
  async changePassword(userId, newPassword) {
    const passwordHash = await sha256(newPassword)
    return request(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ passwordHash }),
    })
  },

  logout() {
    localStorage.removeItem(SESSION_KEY)
  },

  current() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY))
    } catch {
      return null
    }
  },

  isAuthed() {
    return !!this.current()
  },

  // Cek apakah role user saat ini termasuk yang diizinkan
  hasRole(...roles) {
    const user = this.current()
    return !!user && roles.includes(user.role)
  },

  // Cek izin granular untuk user yang sedang login (role default ∪ grant manual)
  hasPermission(perm) {
    return hasPermission(this.current(), perm)
  },
}

// Label & warna badge untuk tiap role
export const roleInfo = {
  admin: { label: 'Admin', badge: 'bg-brand-600 text-white' },
  editor: { label: 'Editor', badge: 'bg-blue-600 text-white' },
  writer: { label: 'Penulis', badge: 'bg-emerald-600 text-white' },
  reader: { label: 'Pembaca', badge: 'bg-violet-600 text-white' },
}

// Nama tampil pembaca dari alamat Gmail (simulasi Google login)
// "andi.kusuma@gmail.com" → "Andi Kusuma"
export function deriveReaderName(email) {
  const local = (email || '').split('@')[0] || 'pembaca'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'Pembaca'
}

// Daftar izin granular yang bisa diberikan Admin ke user tertentu (di luar role)
export const PERMISSIONS = [
  { key: 'publish', label: 'Terbitkan berita', desc: 'Menerbitkan draft menjadi artikel publik.' },
  { key: 'editAll', label: 'Edit semua berita', desc: 'Mengedit artikel milik siapa pun, bukan hanya miliknya.' },
  { key: 'delete', label: 'Hapus berita', desc: 'Memindahkan artikel ke Recycle Bin.' },
  { key: 'manageUsers', label: 'Kelola user', desc: 'Tambah/edit/verifikasi/nonaktifkan user.' },
  { key: 'manageTrash', label: 'Kelola Recycle Bin', desc: 'Pulihkan atau hapus permanen artikel dari Recycle Bin.' },
  { key: 'viewAudit', label: 'Lihat Audit Log', desc: 'Melihat riwayat aksi di backoffice.' },
]

// Izin bawaan tiap role — izin di luar ini harus diberikan manual per user.
// Catatan: admin TIDAK punya izin kelola berita secara default.
export const ROLE_PERMISSIONS = {
  admin: ['manageUsers', 'manageTrash', 'viewAudit'],
  editor: ['publish', 'editAll', 'delete', 'manageTrash'],
  writer: [],
  reader: [],
}

// Cek izin user: role default ∪ izin tambahan yang diberikan Admin
// (disimpan di field `permissions` pada user di db.json)
export function hasPermission(user, perm) {
  if (!user) return false
  if ((ROLE_PERMISSIONS[user.role] || []).includes(perm)) return true
  return Array.isArray(user.permissions) && user.permissions.includes(perm)
}
