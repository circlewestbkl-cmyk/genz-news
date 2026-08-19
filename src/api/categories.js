import { ref } from 'vue'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const BASE = `${BASE_URL}/categories`

// Semua kategori (terbaru dulu) — diisi loadCategories()
export const categories = ref([])

// Kategori berstatus aktif DAN punya artikel terbit — yang tampil di halaman website
export const siteCategories = ref([])

// Nama kategori yang punya artikel berstatus published (diisi saat load)
let publishedCategoryNames = new Set()

// Kategori yang tampil di website: aktif + minimal punya 1 artikel terbit
function computeSiteCategories() {
  return activeCategories(categories.value).filter((c) => publishedCategoryNames.has(c.name))
}

// Palet warna untuk kategori baru (dipilih editor saat menambah)
export const colorOptions = [
  { label: 'Biru', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-600' },
  { label: 'Hijau', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-600' },
  { label: 'Oranye', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  { label: 'Teal', color: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-600' },
  { label: 'Ungu', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-600' },
  { label: 'Merah', color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-600' },
  { label: 'Abu', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-500' },
]

// Kategori yang tampil di website: hanya yang berstatus aktif
// (tidak lagi dibatasi jumlah — semua kategori aktif ikut tampil)
export function activeCategories(list) {
  return list.filter((c) => c.status !== 'inactive')
}

// Cari kategori berdasarkan nama (tanpa membedakan huruf besar/kecil)
export function findCategory(list, name) {
  if (!name) return null
  return list.find((c) => c.name.toLowerCase() === String(name).toLowerCase()) || null
}

// Info chip untuk satu nama kategori (fallback abu-abu bila tidak dikenal)
export function chipOf(name) {
  const c = findCategory(categories.value, name)
  return {
    name,
    color: c?.color || 'bg-slate-100 text-slate-600 border-slate-200',
    dot: c?.dot || 'bg-slate-400',
  }
}

async function fetchJson(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

let loaded = false
let inflight = null

// Muat semua kategori dari server & hitung 7 terbaru (dipanggil sekali saja)
export async function loadCategories(force = false) {
  if (loaded && !force) return
  if (inflight) return inflight
  inflight = (async () => {
    const [list, articles] = await Promise.all([
      fetchJson(BASE),
      fetchJson(`${BASE_URL}/articles?status=published`),
    ])
    categories.value = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    publishedCategoryNames = new Set(articles.map((a) => a.category).filter(Boolean))
    siteCategories.value = computeSiteCategories()
    loaded = true
  })()
  try {
    await inflight
  } finally {
    inflight = null
  }
}

// Tambah kategori baru (hanya editor). Nama harus unik (case-insensitive).
export async function createCategory({ name, color, dot, createdBy }) {
  const clean = String(name || '').trim()
  if (!clean) throw new Error('Nama kategori wajib diisi.')
  if (findCategory(categories.value, clean)) {
    throw new Error(`Kategori "${clean}" sudah ada. Pilih nama yang berbeda.`)
  }
  const created = await fetchJson(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: clean,
      color: color || 'bg-slate-100 text-slate-700 border-slate-200',
      dot: dot || 'bg-slate-500',
      createdBy: createdBy || 'editor',
      status: 'active', // kategori baru langsung aktif
      createdAt: new Date().toISOString(),
    }),
  })
  categories.value = [created, ...categories.value]
  siteCategories.value = computeSiteCategories()
  return created
}

// Ubah status aktif/nonaktif kategori (hanya editor)
export async function updateCategoryStatus(id, status) {
  if (!['active', 'inactive'].includes(status)) {
    throw new Error('Status kategori tidak valid.')
  }
  const updated = await fetchJson(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  categories.value = categories.value.map((c) => (c.id === updated.id ? updated : c))
  siteCategories.value = computeSiteCategories()
  return updated
}

