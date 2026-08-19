export const DEFAULT_IMAGE = 'https://picsum.photos/seed/genz-default/1200/675'

export function formatDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(iso) {
  if (!iso) return ''
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const intervals = [
    { label: 'tahun', seconds: 31536000 },
    { label: 'bulan', seconds: 2592000 },
    { label: 'minggu', seconds: 604800 },
    { label: 'hari', seconds: 86400 },
    { label: 'jam', seconds: 3600 },
    { label: 'menit', seconds: 60 },
  ]
  for (const { label, seconds: s } of intervals) {
    const value = Math.floor(seconds / s)
    if (value >= 1) return `${value} ${label} lalu`
  }
  return 'baru saja'
}

// Hitung jumlah kata dalam teks artikel.
// Marker markdown ringan (##, >, **, *) tidak dihitung sebagai kata.
export function countWords(text = '') {
  return text
    .replace(/[#>*_]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

// Estimasi waktu baca berdasarkan jumlah kata (±200 kata/menit)
export function readingTime(text = '') {
  const minutes = Math.max(1, Math.round(countWords(text) / 200))
  return `${minutes} menit baca`
}

// Tarif penghasilan penulis: Rp100 per kata pada artikel yang berhasil terbit
export const RATE_PER_WORD = 100

// Pendapatan satu artikel (jumlah kata × tarif per kata)
export function articleEarnings(content = '') {
  return countWords(content) * RATE_PER_WORD
}

// Format angka menjadi Rupiah, mis. 1250000 → "Rp 1.250.000"
export function formatRupiah(value) {
  return 'Rp ' + Math.round(value || 0).toLocaleString('id-ID')
}

// Rekap penghasilan per user (untuk halaman admin).
// Hanya artikel berstatus published yang dihitung; diurutkan dari penghasilan terbesar.
export function summarizeEarnings(articles = [], users = []) {
  const map = new Map()
  for (const u of users) {
    map.set(u.username, {
      username: u.username,
      name: u.name || u.username,
      role: u.role,
      articles: 0,
      words: 0,
      earnings: 0,
    })
  }
  for (const a of articles) {
    if (a.status !== 'published') continue
    const entry = map.get(a.createdBy)
    if (!entry) continue
    const words = countWords(a.content)
    entry.articles += 1
    entry.words += words
    entry.earnings += words * RATE_PER_WORD
  }
  return [...map.values()].sort((x, y) => y.earnings - x.earnings)
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// Konversi ISO → nilai untuk <input type="datetime-local"> (waktu lokal perangkat).
// "2026-08-18T09:00:00.000Z" → "2026-08-18T16:00" (contoh UTC+7)
export function toDateTimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Konversi nilai datetime-local → ISO string (UTC).
// Mengembalikan null bila kosong atau tidak valid.
export function fromDateTimeLocal(value) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

// Nilai default jadwal terbit: sekarang + beberapa jam, dibulatkan ke menit.
export function defaultScheduleValue(hoursFromNow = 1) {
  const d = new Date(Date.now() + hoursFromNow * 3600 * 1000)
  d.setSeconds(0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
