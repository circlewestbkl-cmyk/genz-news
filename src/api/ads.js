// Kelola iklan (khusus admin): gambar, link, posisi slot, dan masa kontrak.
// Slot iklan di halaman publik mengambil iklan aktif dari sini (reactive store).
import { ref } from 'vue'
import { lastDays } from '../utils/analytics'

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

// ==== Store reaktif bersama — semua slot iklan memakai daftar ini ====
export const ads = ref([])

let loadingPromise = null
let loadedAt = 0
const TTL_MS = 30000

// Muat daftar iklan sekali, lalu cache 30 detik. Semua AdSlot berbagi ref `ads`,
// jadi begitu berubah (mis. usai admin menyimpan), slot langsung ikut ter-update.
export function loadAds(force = false) {
  if (!force && Date.now() - loadedAt < TTL_MS && ads.value.length) {
    return Promise.resolve(ads.value)
  }
  if (!loadingPromise) {
    loadingPromise = request('/ads?_sort=createdAt&_order=desc')
      .then((list) => {
        ads.value = list
        loadedAt = Date.now()
      })
      .catch(() => {
        /* server tidak aktif — slot tetap placeholder */
      })
      .finally(() => {
        loadingPromise = null
      })
  }
  return loadingPromise
}

// Murni & bisa diuji: iklan yang tampil untuk satu posisi pada waktu `now`.
// Hanya iklan berstatus 'live' yang tampil — iklan 'booked' menunggu slot,
// lalu otomatis tampil (jadi 'live') saat iklan yang lebih baru habis/dinonaktifkan.
// Bila ada beberapa yang live, ambil yang paling baru dibuat.
export function adForPosition(list, position, now = Date.now()) {
  const candidates = (list || []).filter(
    (a) => a.position === position && adStatus(a, now, list) === 'live'
  )
  if (!candidates.length) return null
  return [...candidates].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )[0]
}

// Murni & bisa diuji: status iklan saat ini terhadap daftar iklan (`list`).
// - 'live'     : sedang tayang (kontrak berjalan & berhak tampil di posisinya)
// - 'expiring' : live dengan sisa kontrak < 7 hari (untuk peringatan perpanjangan)
// - 'scheduled': belum mulai (startAt di masa depan)
// - 'booked'   : "menunggu slot" — iklan booking (booking: true) yang menunggu slot
//                kosong, atau iklan non-booking yang tergeser iklan lebih baru
// - 'expired'  : kontrak habis
// - 'inactive' : dinonaktifkan admin / data kosong
//
// Aturan: iklan non-booking — yang terbaru di posisinya yang live, sisanya booked.
// Iklan booking (booking: true) — baru live jika TIDAK ada iklan non-booking yang
// berjalan di posisi sama dan tidak ada booking yang lebih dulu (antrean FIFO).
export function adStatus(ad, now = Date.now(), list = null) {
  if (!ad) return 'inactive'
  if (ad.active === false) return 'inactive'
  const start = ad.startAt ? new Date(ad.startAt).getTime() : 0
  const end = ad.endAt ? new Date(ad.endAt).getTime() : Infinity
  if (now < start) return 'scheduled'
  if (now > end) return 'expired'
  const expiringOrLive = () => (end !== Infinity && end - now < 7 * 24 * 3600 * 1000 ? 'expiring' : 'live')

  if (Array.isArray(list)) {
    const same = (list || []).filter(
      (a) =>
        a.id !== ad.id &&
        a.position === ad.position &&
        a.active !== false &&
        (!a.startAt || new Date(a.startAt).getTime() <= now) &&
        (!a.endAt || new Date(a.endAt).getTime() >= now)
    )
    if (ad.booking !== true) {
      // Iklan biasa: ada iklan biasa yang lebih baru? → tergeser (booked)
      const newerNonBooking = same.some(
        (a) => a.booking !== true && new Date(a.createdAt || 0).getTime() > new Date(ad.createdAt || 0).getTime()
      )
      if (newerNonBooking) return 'booked'
      return expiringOrLive()
    }
    // Booking: tunggu sampai tidak ada iklan biasa berjalan & tidak ada booking lebih dulu
    const hasLiveOther = same.some((a) => a.booking !== true)
    const earlierBooking = same.some(
      (a) => a.booking === true && new Date(a.createdAt || 0).getTime() < new Date(ad.createdAt || 0).getTime()
    )
    if (hasLiveOther || earlierBooking) return 'booked'
    return expiringOrLive()
  }
  return expiringOrLive()
}

// Murni & bisa diuji: daftar posisi slot yang "sibuk" — ada iklan aktif berstatus
// live / scheduled / booked (selain `excludeId`). Dipakai form admin untuk
// menandai posisi yang sudah terisi → iklan baru di posisi itu jadi booking.
export function takenPositions(list, now = Date.now(), excludeId = null) {
  return [...new Set(
    (list || [])
      .filter(
        (a) =>
          a.id !== excludeId &&
          ['live', 'scheduled', 'booked'].includes(adStatus(a, now, list))
      )
      .map((a) => a.position)
  )]
}

export const adStatusInfo = {
  live: { label: 'Tayang', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring: { label: 'Hampir Habis', badge: 'bg-amber-50 text-amber-700 border-amber-300' },
  scheduled: { label: 'Terjadwal', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  booked: { label: 'Menunggu Slot', badge: 'bg-violet-50 text-violet-700 border-violet-300' },
  expired: { label: 'Kontrak Habis', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
  inactive: { label: 'Nonaktif', badge: 'bg-rose-50 text-rose-600 border-rose-200' },
}

export const adApi = {
  async list() {
    return request('/ads?_sort=createdAt&_order=desc')
  },

  async create(data) {
    const created = await request('/ads', {
      method: 'POST',
      body: JSON.stringify({ ...data, clicks: 0, clicksByDay: {}, createdAt: new Date().toISOString() }),
    })
    await loadAds(true)
    return created
  },

  async update(id, data) {
    const updated = await request(`/ads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    await loadAds(true)
    return updated
  },

  async remove(id) {
    await request(`/ads/${id}`, { method: 'DELETE' })
    await loadAds(true)
  },

  // Hitung klik iklan + catat per hari (untuk grafik) — fire-and-forget
  async incrementClicks(id) {
    try {
      const ad = await request(`/ads/${id}`)
      const clicks = (ad.clicks || 0) + 1
      const { dayKey } = await import('../utils/analytics')
      const key = dayKey(new Date())
      const clicksByDay = { ...(ad.clicksByDay || {}) }
      clicksByDay[key] = (clicksByDay[key] || 0) + 1
      await request(`/ads/${id}`, { method: 'PATCH', body: JSON.stringify({ clicks, clicksByDay }) })
      const current = ads.value.find((a) => a.id === id)
      if (current) {
        current.clicks = clicks
        current.clicksByDay = clicksByDay
      }
    } catch {
      /* gagal mencatat klik tidak boleh mengganggu buka link */
    }
  },
}

// Murni & bisa diuji: total klik iklan dalam N hari terakhir (dari clicksByDay)
export function clicksInRange(ad, days = 7, now = new Date()) {
  if (!ad || !days) return 0
  const map = ad.clicksByDay || {}
  return lastDays(days, now).reduce((sum, k) => sum + (map[k] || 0), 0)
}

// Murni & bisa diuji: data bar chart klik N hari terakhir → [{ key, label, value }]
export function clicksTrend(ad, days = 7, now = new Date()) {
  const map = ad?.clicksByDay || {}
  return lastDays(days, now).map((key) => ({
    key,
    label: key.slice(5), // 'MM-DD'
    value: map[key] || 0,
  }))
}
