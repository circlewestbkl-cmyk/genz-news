<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { adApi, ads, adStatus, adStatusInfo, takenPositions, clicksTrend } from '../../api/ads'
import { setPreviewAd } from '../../api/previewAd'
import { AD_POSITIONS, adPositionInfo } from '../../data/adPositions'
import { auditApi } from '../../api/audit'
import { compressImage } from '../../utils/image'
import {
  toDateTimeLocal,
  fromDateTimeLocal,
  formatDateTime,
} from '../../utils/format'
import ConfirmModal from '../../components/ConfirmModal.vue'
import PaginationBar from '../../components/PaginationBar.vue'
import MediaPickerModal from '../../components/MediaPickerModal.vue'

const loading = ref(true)
const error = ref('')
const toast = ref('')

// Form iklan
const form = ref({
  id: null,
  title: '',
  imageUrl: '',
  linkUrl: '',
  position: 'footer',
  startAt: '',
  endAt: '',
  active: true,
  label: '',
})
const uploadingImage = ref(false)
const imageError = ref('')
const saving = ref(false)

// Pemilih gambar dari Pustaka Media
const mediaPickerOpen = ref(false)
function pickFromMedia(url) {
  form.value.imageUrl = url
  mediaPickerOpen.value = false
}

// Ukuran slot yang sedang dipilih + ukuran asli gambar hasil proses (untuk pratinjau)
const slotSize = computed(() => {
  const p = adPositionInfo(form.value.position)
  return { width: p.width, height: p.height }
})
const previewSize = ref(null) // { w, h } piksel asli gambar setelah di-crop/resize
function onPreviewLoad(e) {
  const img = e.target
  previewSize.value = { w: img.naturalWidth, h: img.naturalHeight }
}
// Reset ukuran gambar saat gambar diganti (upload baru / tempel URL / ganti posisi edit)
watch(
  () => form.value.imageUrl,
  () => {
    previewSize.value = null
  }
)

// Durasi kontrak cepat (hari) — mengisi endAt = startAt + N hari
const durationPresets = [
  { days: 1, label: '1 hari' },
  { days: 3, label: '3 hari' },
  { days: 7, label: '7 hari' },
  { days: 14, label: '14 hari' },
  { days: 30, label: '1 bulan' },
  { days: 90, label: '3 bulan' },
]

function addDaysToStart(days) {
  const start = fromDateTimeLocal(form.value.startAt)
  if (!start) {
    toast.value = 'Isi waktu mulai tayang dulu, lalu pilih durasi.'
    setTimeout(() => (toast.value = ''), 3000)
    return
  }
  const end = new Date(new Date(start).getTime() + days * 24 * 3600 * 1000)
  form.value.endAt = toDateTimeLocal(end.toISOString())
}

function resetForm() {
  form.value = {
    id: null,
    title: '',
    imageUrl: '',
    linkUrl: '',
    position: 'footer',
    startAt: toDateTimeLocal(new Date().toISOString()),
    endAt: '',
    active: true,
    label: '',
  }
  imageError.value = ''
}

function editAd(ad) {
  form.value = {
    id: ad.id,
    title: ad.title || '',
    imageUrl: ad.imageUrl || '',
    linkUrl: ad.linkUrl || '',
    position: ad.position || 'footer',
    startAt: toDateTimeLocal(ad.startAt),
    endAt: toDateTimeLocal(ad.endAt),
    active: ad.active !== false,
    label: ad.label || '',
  }
  imageError.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function onUploadImage(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    imageError.value = 'File harus berupa gambar (JPG/PNG/WebP).'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    imageError.value = 'Ukuran gambar maksimal 2MB.'
    return
  }
  uploadingImage.value = true
  imageError.value = ''
  try {
    // Gambar otomatis di-crop & di-resize agar pas dengan ukuran slot yang dipilih
    const slot = adPositionInfo(form.value.position)
    form.value.imageUrl = await compressImage(file, { width: slot.width, height: slot.height })
  } catch (err) {
    imageError.value = err.message || 'Gagal memproses gambar.'
  } finally {
    uploadingImage.value = false
  }
}

async function save() {
  error.value = ''
  if (!form.value.imageUrl.trim()) {
    error.value = 'Gambar iklan wajib diisi (unggah atau tempel URL).'
    return
  }
  if (form.value.linkUrl.trim() && !/^https?:\/\//i.test(form.value.linkUrl.trim())) {
    error.value = 'Link iklan harus berupa URL lengkap (mis. https://contoh.com).'
    return
  }
  const startIso = fromDateTimeLocal(form.value.startAt)
  const endIso = form.value.endAt ? fromDateTimeLocal(form.value.endAt) : null
  if (!startIso) {
    error.value = 'Waktu mulai tayang wajib diisi.'
    return
  }
  if (endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    error.value = 'Waktu selesai harus setelah waktu mulai.'
    return
  }
  if (!endIso) {
    error.value = 'Waktu selesai kontrak wajib diisi (pakai tombol durasi atau isi manual).'
    return
  }

  // Posisi yang dipilih sedang terisi? → iklan disimpan sebagai booking (menunggu slot)
  const willBook = occupied.value.includes(form.value.position)

  const payload = {
    title: form.value.title.trim(),
    imageUrl: form.value.imageUrl.trim(),
    linkUrl: form.value.linkUrl.trim(),
    position: form.value.position,
    startAt: startIso,
    endAt: endIso,
    active: form.value.active,
    label: form.value.label.trim(),
    booking: willBook,
  }

  saving.value = true
  try {
    if (form.value.id) {
      await adApi.update(form.value.id, payload)
      auditApi.log('ad_update', `Iklan \"${payload.title || form.value.id}\" diperbarui (${adPositionInfo(payload.position).label})`)
      toast.value = willBook ? 'Perubahan disimpan — iklan menunggu slot.' : 'Iklan berhasil diperbarui.'
    } else {
      await adApi.create(payload)
      auditApi.log('ad_create', `Iklan baru \"${payload.title || 'tanpa judul'}\" (${adPositionInfo(payload.position).label})`)
      toast.value = willBook
        ? 'Iklan disimpan sebagai 📅 booking — otomatis tayang setelah slot kosong.'
        : 'Iklan berhasil ditambahkan dan langsung tampil sesuai jadwal.'
    }
    resetForm()
  } catch {
    error.value = 'Gagal menyimpan iklan. Pastikan JSON Server berjalan.'
  } finally {
    saving.value = false
    setTimeout(() => (toast.value = ''), 3500)
  }
}

// Pratinjau di halaman asli (membuka tab baru, data belum perlu disimpan)
function previewOnSite() {
  if (!form.value.imageUrl.trim()) {
    error.value = 'Isi dulu gambar iklan untuk melihat pratinjau.'
    return
  }
  error.value = ''
  const slot = adPositionInfo(form.value.position)
  setPreviewAd({
    title: form.value.title.trim() || 'Pratinjau Iklan',
    imageUrl: form.value.imageUrl.trim(),
    linkUrl: form.value.linkUrl.trim() || '#',
    position: form.value.position,
    width: slot.width,
    height: slot.height,
  })
  window.open('/pratinjau-iklan', '_blank')
}

// Hapus
const deleteTarget = ref(null)
const deleteModal = ref({ open: false, loading: false })

function askDelete(ad) {
  deleteTarget.value = ad
  deleteModal.value = { open: true, loading: false }
}

async function confirmDelete() {
  const ad = deleteTarget.value
  if (!ad) return
  deleteModal.value.loading = true
  try {
    await adApi.remove(ad.id)
    auditApi.log('ad_delete', `Iklan \"${ad.title || ad.id}\" dihapus`)
    deleteModal.value.open = false
    toast.value = 'Iklan dihapus.'
  } catch {
    toast.value = 'Gagal menghapus iklan.'
  } finally {
    deleteModal.value.loading = false
    deleteTarget.value = null
    setTimeout(() => (toast.value = ''), 3000)
  }
}

// Aktif/nonaktif cepat
const togglingId = ref(null)
async function toggleActive(ad) {
  togglingId.value = ad.id
  try {
    await adApi.update(ad.id, { active: ad.active !== false ? false : true })
  } catch {
    toast.value = 'Gagal mengubah status iklan.'
  } finally {
    togglingId.value = null
  }
}

// Status tampilan per iklan (live/expiring/scheduled/booked/expired/inactive)
function statusOf(ad) {
  return adStatusInfo[adStatus(ad, Date.now(), ads.value)] || adStatusInfo.inactive
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await adApi.list()
  } catch {
    error.value = 'Gagal memuat data iklan. Pastikan JSON Server berjalan.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  resetForm()
})

const stats = computed(() => {
  const now = Date.now()
  const s = (a) => adStatus(a, now, ads.value)
  return {
    total: ads.value.length,
    live: ads.value.filter((a) => s(a) === 'live' || s(a) === 'expiring').length,
    booked: ads.value.filter((a) => s(a) === 'booked').length,
    expiring: ads.value.filter((a) => s(a) === 'expiring').length,
  }
})

// Posisi yang sedang sibuk (ada iklan live/scheduled/booked) → iklan baru di posisi
// itu otomatis jadi booking (menunggu slot). Semua posisi tetap bisa dipilih.
const occupied = computed(() => takenPositions(ads.value, Date.now(), form.value.id))

// ==== Grafik klik iklan 7 hari terakhir (semua iklan) ====
const clickTrend = computed(() => {
  const totals = {}
  for (const a of ads.value) {
    for (const [key, v] of Object.entries(a.clicksByDay || {})) {
      totals[key] = (totals[key] || 0) + v
    }
  }
  const days = clicksTrend({ clicksByDay: totals }, 7)
  return days
})
const clickTrendMax = computed(() => Math.max(1, ...clickTrend.value.map((d) => d.value)))
const clicks7 = computed(() => clickTrend.value.reduce((s, d) => s + d.value, 0))

// Pagination daftar iklan — 4 per halaman
const PER_PAGE = 4
const listPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(ads.value.length / PER_PAGE)))
const pagedAds = computed(() =>
  ads.value.slice((listPage.value - 1) * PER_PAGE, listPage.value * PER_PAGE)
)
const listRange = computed(() => {
  if (!ads.value.length) return ''
  const start = (listPage.value - 1) * PER_PAGE + 1
  const end = Math.min(listPage.value * PER_PAGE, ads.value.length)
  return `${start}–${end} dari ${ads.value.length}`
})
function goPage(p) {
  listPage.value = p
}
// Bila halaman melebihi jumlah halaman (mis. item terakhir dihapus), kembali ke halaman terakhir
watch(totalPages, (t) => {
  if (listPage.value > t) listPage.value = t
})
</script>

<template>
  <div>
    <!-- Toast -->
    <div
      v-if="toast"
      class="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm px-5 py-3 rounded-lg shadow-lg"
    >
      {{ toast }}
    </div>

    <div class="mb-8">
      <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Monetisasi ✦</p>
      <h1 class="font-groovy font-black text-2xl sm:text-3xl text-link-700">Kelola Iklan 📢</h1>
      <p class="text-slate-500 text-sm mt-1 font-semibold">
        Atur gambar iklan yang tampil di website — pilih posisi slot, masa kontrak, dan link tujuan.
      </p>
    </div>

    <!-- Ringkasan -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-slate-400">Total Iklan</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.total }}</p>
      </div>
      <div class="bg-emerald-50 rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-emerald-600">Sedang Tayang</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.live }}</p>
      </div>
      <div class="bg-violet-50 rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-violet-600">Menunggu Slot 📅</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.booked }}</p>
      </div>
      <div class="bg-amber-50 rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-amber-600">Hampir Habis ⏰</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.expiring }}</p>
      </div>
    </div>

    <!-- Grafik klik iklan 7 hari -->
    <div class="bg-white rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038] mb-8">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 class="font-groovy font-black text-sm text-link-700">📊 Klik Iklan 7 Hari Terakhir</h3>
        <span class="text-[11px] font-bold text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2.5 py-1">{{ clicks7.toLocaleString('id-ID') }} klik total</span>
      </div>
      <div v-if="!clickTrend.length" class="text-xs text-slate-400 py-4 text-center">Belum ada data klik.</div>
      <div v-else class="flex items-end gap-1.5 h-24">
        <div v-for="d in clickTrend" :key="d.key" class="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <span class="text-[9px] font-bold text-slate-400 tabular-nums">{{ d.value || '' }}</span>
          <div
            class="w-full rounded-t-md bg-gradient-to-t from-amber-500 to-acid-400 border border-link-700/30 transition-all"
            :style="{ height: Math.max(3, (d.value / clickTrendMax) * 100) + '%' }"
            :title="d.label + ': ' + d.value + ' klik'"
          ></div>
          <span class="text-[9px] font-bold text-slate-400 truncate">{{ d.label }}</span>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-2xl px-5 py-4 text-sm font-semibold mb-6 shadow-[3px_3px_0_#b45309]">
      {{ error }}
    </div>

    <div class="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-8 items-start">
      <!-- ===== Form ===== -->
      <div class="bg-white rounded-2xl border-2 border-link-700 overflow-hidden shadow-[5px_5px_0_#2a1038]">
        <div class="px-6 py-4 border-b-2 border-slate-200 bg-brand-50/40 flex items-center justify-between gap-3">
          <h2 class="font-groovy font-black text-lg text-link-700">
            {{ form.id ? '✏️ Edit Iklan' : '➕ Tayangkan Iklan Baru' }}
          </h2>
          <button
            v-if="form.id"
            @click="resetForm"
            class="text-xs font-groovy font-black uppercase tracking-wide text-slate-500 border-2 border-slate-200 rounded-full px-3 py-1.5 hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            Batal Edit
          </button>
        </div>

        <form class="p-6 space-y-5" @submit.prevent="save">
          <!-- Label internal -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Label Internal (untuk pembukuan, opsional)</label>
            <input
              v-model="form.label"
              type="text"
              placeholder="Contoh: Promosi Internal / Iklan Berbayar"
              class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>
          <!-- Judul -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Nama Iklan (opsional)</label>
            <input
              v-model="form.title"
              type="text"
              placeholder="Contoh: Promo Ramadhan 2026"
              class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <!-- Gambar -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Gambar Iklan <span class="text-red-500">*</span></label>
            <div class="flex flex-wrap gap-3">
              <label
                class="cursor-pointer inline-flex items-center gap-2 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ uploadingImage ? 'Memproses…' : 'Unggah Gambar' }}
                <input type="file" accept="image/*" class="hidden" @change="onUploadImage" :disabled="uploadingImage" />
              </label>
              <input
                v-model="form.imageUrl"
                type="url"
                placeholder="atau tempel URL gambar https://…"
                class="flex-1 min-w-[220px] border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
              />
              <button
                type="button"
                @click="mediaPickerOpen = true"
                class="inline-flex items-center gap-2 border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-colors"
              >
                🗂️ Media
              </button>
            </div>
            <div class="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                @click="previewOnSite"
                class="inline-flex items-center gap-1.5 text-[11px] font-groovy font-black uppercase tracking-wide px-3 py-1.5 rounded-full border-2 border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white transition-colors"
              >
                👁 Pratinjau di Website
              </button>
            </div>
            <p v-if="imageError" class="text-xs text-red-600 mt-1.5">{{ imageError }}</p>
            <div
              class="mt-3 rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50 relative"
              :style="{
                height: '180px',
                backgroundImage:
                  'linear-gradient(45deg, #f1f5f9 25%, transparent 25%, transparent 75%, #f1f5f9 75%), linear-gradient(45deg, #f1f5f9 25%, #fff 25%, #fff 75%, #f1f5f9 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 10px 10px',
              }"
            >
              <img
                v-if="form.imageUrl"
                :src="form.imageUrl"
                alt="Pratinjau iklan"
                class="w-full h-full object-contain"
                @load="onPreviewLoad"
              />
              <span v-else class="absolute inset-0 grid place-items-center text-xs font-semibold text-slate-400">Pratinjau gambar iklan</span>
              <span
                class="absolute top-2 left-2.5 text-[10px] font-groovy font-black uppercase tracking-wide px-2 py-1 rounded-full bg-link-700/85 text-white border border-white/30"
              >
                📐 Slot: {{ slotSize.width }} × {{ slotSize.height }} px
              </span>
              <span
                v-if="previewSize"
                class="absolute bottom-2 right-2.5 text-[10px] font-groovy font-black uppercase tracking-wide px-2 py-1 rounded-full bg-white/95 text-link-700 border border-slate-300"
              >
                🖼️ Gambar: {{ previewSize.w }} × {{ previewSize.h }} px
              </span>
            </div>
          </div>

          <!-- Link -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Link Iklan (hyperlink saat diklik)</label>
            <input
              v-model="form.linkUrl"
              type="url"
              placeholder="https://contoh.com/landing-page"
              class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            <p class="text-xs text-slate-400 mt-1.5">Iklan akan terbuka di tab baru saat diklik.</p>
          </div>

          <!-- Posisi -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Posisi Slot Iklan <span class="text-red-500">*</span></label>
            <select
              v-model="form.position"
              class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            >
              <option v-for="p in AD_POSITIONS" :key="p.key" :value="p.key">
                {{ p.label }}{{ occupied.includes(p.key) ? ' — 📅 booking' : '' }}
              </option>
            </select>
            <p class="text-xs text-slate-400 mt-1.5">{{ adPositionInfo(form.position).desc }}</p>
            <p class="text-[11px] font-semibold text-brand-600 mt-1">
              📐 Gambar yang diunggah otomatis disesuaikan (crop + resize) ke ukuran slot ini:
              {{ adPositionInfo(form.position).width }} × {{ adPositionInfo(form.position).height }} px
            </p>
            <p
              v-if="occupied.includes(form.position)"
              class="text-[11px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 mt-1.5"
            >
              📅 Posisi ini sudah ada iklan aktif — iklan akan disimpan sebagai <b>booking</b> (Menunggu Slot)
              dan otomatis tayang setelah iklan yang berjalan selesai.
            </p>
          </div>

          <!-- Masa kontrak -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Masa Kontrak Tayang <span class="text-red-500">*</span></label>
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">Mulai Tayang</label>
                <input
                  v-model="form.startAt"
                  type="datetime-local"
                  class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:border-brand-600"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-400 mb-1">Selesai Tayang</label>
                <input
                  v-model="form.endAt"
                  type="datetime-local"
                  class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:border-brand-600"
                />
              </div>
            </div>
            <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] font-bold text-slate-500 mr-1">Durasi cepat:</span>
              <button
                v-for="d in durationPresets"
                :key="d.days"
                type="button"
                @click="addDaysToStart(d.days)"
                class="text-[11px] font-groovy font-black uppercase tracking-wide px-2.5 py-1 rounded-full border-2 border-slate-200 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                {{ d.label }}
              </button>
            </div>
          </div>

          <!-- Aktif -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <input v-model="form.active" type="checkbox" class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
            <span class="text-sm font-semibold text-slate-700">Aktifkan iklan ini</span>
          </label>

          <p v-if="error" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{{ error }}</p>

          <button
            type="submit"
            :disabled="saving"
            class="w-full inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white rounded-xl px-6 py-3 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all"
          >
            {{ saving ? 'Menyimpan…' : form.id ? 'Simpan Perubahan Iklan' : 'Tayangkan Iklan' }}
          </button>
        </form>
      </div>

      <!-- ===== Daftar iklan ===== -->
      <div class="bg-white rounded-2xl border-2 border-link-700 overflow-hidden shadow-[5px_5px_0_#2a1038]">
        <div class="px-6 py-4 border-b-2 border-slate-200 bg-brand-50/40">
          <h2 class="font-groovy font-black text-lg text-link-700">📋 Daftar Iklan</h2>
        </div>

        <div v-if="loading" class="divide-y divide-slate-100">
          <div v-for="i in 3" :key="i" class="p-4 animate-pulse">
            <div class="h-24 bg-slate-200 rounded-lg"></div>
            <div class="h-3 bg-slate-200 rounded w-2/3 mt-3"></div>
          </div>
        </div>

        <div v-else-if="!ads.length" class="text-center py-14 text-slate-400 px-6">
          <p class="text-4xl mb-3">📢</p>
          <p class="font-semibold text-slate-500 mb-1">Belum ada iklan</p>
          <p class="text-xs">Isi form di samping untuk menayangkan iklan pertama.</p>
        </div>

        <div v-else class="divide-y divide-slate-200">
          <div class="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <p class="text-[11px] font-bold text-slate-400">Menampilkan {{ listRange }}</p>
            <p class="text-[11px] font-bold text-slate-300">4 per halaman</p>
          </div>
          <div v-for="ad in pagedAds" :key="ad.id" class="p-5 hover:bg-slate-50/60 transition-colors">
            <div class="flex items-start gap-4">
              <div class="w-36 h-24 rounded-xl border-2 border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                <img v-if="ad.imageUrl" :src="ad.imageUrl" :alt="ad.title || 'Iklan'" class="w-full h-full object-cover" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs px-2 py-0.5 rounded font-bold border" :class="statusOf(ad).badge">
                    {{ statusOf(ad).label }}
                  </span>
                  <span class="text-[10px] font-groovy font-black uppercase tracking-wide text-slate-400 truncate">
                    {{ adPositionInfo(ad.position).label }}
                  </span>
                  <span class="text-[10px] font-groovy font-black uppercase tracking-wide text-slate-300">
                    {{ adPositionInfo(ad.position).width }}×{{ adPositionInfo(ad.position).height }}
                  </span>
                </div>
                <p class="font-bold text-[15px] leading-snug text-slate-900 truncate mt-1.5">{{ ad.title || 'Iklan tanpa judul' }}</p>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                  <p class="text-xs font-semibold text-slate-400 truncate">
                    {{ ad.linkUrl ? '🔗 ' + ad.linkUrl : 'Tanpa link' }}
                  </p>
                  <span class="text-xs font-extrabold text-slate-600">🔘 {{ (ad.clicks || 0).toLocaleString('id-ID') }} klik</span>
                  <span v-if="ad.label" class="text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5">
                    🏷️ {{ ad.label }}
                  </span>
                </div>
                <p class="text-xs font-semibold text-slate-400 mt-1">
                  🕐 {{ formatDateTime(ad.startAt) }} → {{ formatDateTime(ad.endAt) }}
                </p>
              </div>
            </div>
            <div class="mt-3.5 flex items-center gap-2">
              <button
                @click="toggleActive(ad)"
                :disabled="togglingId === ad.id"
                class="text-[11px] font-groovy font-black uppercase tracking-wide px-3.5 py-1.5 rounded-full border-2 transition-colors disabled:opacity-50"
                :class="ad.active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white' : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white'"
              >
                {{ ad.active !== false ? '● Aktif' : '○ Nonaktif' }}
              </button>
              <button
                @click="editAd(ad)"
                class="text-[11px] font-groovy font-black uppercase tracking-wide px-3.5 py-1.5 rounded-full border-2 border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                ✏️ Edit
              </button>
              <button
                @click="askDelete(ad)"
                class="text-[11px] font-groovy font-black uppercase tracking-wide px-3 py-1.5 rounded-full border-2 border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-600 transition-colors ml-auto"
              >
                🗑️ Hapus
              </button>
            </div>
          </div>
          <div v-if="totalPages > 1" class="px-4 py-3.5 border-t border-slate-100">
            <PaginationBar compact :page="listPage" :total-pages="totalPages" @change="goPage" />
          </div>
        </div>
      </div>
    </div>

    <p class="mt-8 text-xs text-slate-400">
      💡 Iklan tampil otomatis di posisi yang dipilih selama masa kontrak &amp; status aktif. Bila tidak ada iklan aktif,
      slot menampilkan placeholder. Iklan bisa diklik dan membuka <b class="font-semibold">link</b> di tab baru.
      Semua posisi slot (footer, beranda, kategori, artikel) tetap seperti tata letak yang sudah dibuat.
    </p>

    <!-- Pemilih gambar dari Pustaka Media -->
    <MediaPickerModal
      :open="mediaPickerOpen"
      title="Pilih Gambar Iklan dari Media"
      @select="pickFromMedia"
      @close="mediaPickerOpen = false"
    />

    <!-- Modal hapus -->
    <ConfirmModal
      :open="deleteModal.open"
      :loading="deleteModal.loading"
      variant="danger"
      title="Hapus Iklan"
      :message='`Hapus iklan "${deleteTarget?.title || "tanpa judul"}"? Iklan tidak lagi tampil di website.`'
      confirm-text="Ya, Hapus"
      @confirm="confirmDelete"
      @cancel="deleteModal.open = false"
    />
  </div>
</template>
