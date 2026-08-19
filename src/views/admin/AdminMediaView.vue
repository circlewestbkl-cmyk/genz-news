<script setup>
import { ref, computed, onMounted } from 'vue'
import { mediaApi } from '../../api/media'
import { auditApi } from '../../api/audit'
import { compressImage } from '../../utils/image'
import { auth } from '../../api/auth'
import ConfirmModal from '../../components/ConfirmModal.vue'

const user = auth.current()
const items = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')
const uploading = ref(false)
const uploadError = ref('')

const PER_PAGE = 12
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / PER_PAGE)))
const paged = computed(() => items.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))
const range = computed(() => {
  if (!items.value.length) return ''
  const start = (page.value - 1) * PER_PAGE + 1
  const end = Math.min(page.value * PER_PAGE, items.value.length)
  return `${start}–${end} dari ${items.value.length}`
})
function goPage(p) {
  page.value = p
}

// Ukuran total pustaka (kira-kira, dari field size)
const totalSize = computed(() => {
  const kb = items.value.reduce((s, i) => s + (i.size || 0), 0) / 1024
  return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB'
})

function fmtSize(size) {
  const kb = (size || 0) / 1024
  return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB'
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await mediaApi.list()
  } catch {
    error.value = 'Gagal memuat pustaka media. Pastikan JSON Server berjalan.'
  } finally {
    loading.value = false
  }
}

async function onUpload(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    uploadError.value = 'File harus berupa gambar (JPG/PNG/WebP).'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    uploadError.value = 'Ukuran gambar maksimal 5MB.'
    return
  }
  uploading.value = true
  uploadError.value = ''
  try {
    const url = await compressImage(file)
    const created = await mediaApi.create({
      name: file.name.replace(/\.[^.]+$/, '') || 'gambar',
      url,
      size: file.size,
      type: file.type,
      uploadedBy: user?.username || 'admin',
    })
    items.value.unshift(created)
    auditApi.log('media_upload', `Gambar \"${created.name}\" ditambahkan ke pustaka media`)
    toast.value = 'Gambar berhasil ditambahkan ke pustaka.'
  } catch (err) {
    uploadError.value = err.message || 'Gagal mengunggah gambar.'
  } finally {
    uploading.value = false
    setTimeout(() => (toast.value = ''), 3000)
  }
}

// Salin URL gambar ke clipboard
const copiedId = ref(null)
async function copyUrl(item) {
  try {
    await navigator.clipboard.writeText(item.url)
    copiedId.value = item.id
    setTimeout(() => (copiedId.value = null), 1500)
  } catch {
    /* clipboard tidak tersedia */
  }
}

// Hapus
const deleteTarget = ref(null)
const deleteModal = ref({ open: false, loading: false })
function askDelete(item) {
  deleteTarget.value = item
  deleteModal.value = { open: true, loading: false }
}
async function confirmDelete() {
  const item = deleteTarget.value
  if (!item) return
  deleteModal.value.loading = true
  try {
    await mediaApi.remove(item.id)
    items.value = items.value.filter((i) => i.id !== item.id)
    auditApi.log('media_delete', `Gambar \"${item.name}\" dihapus dari pustaka media`)
    deleteModal.value.open = false
    toast.value = 'Gambar dihapus dari pustaka.'
  } catch {
    toast.value = 'Gagal menghapus gambar.'
  } finally {
    deleteModal.value.loading = false
    deleteTarget.value = null
    setTimeout(() => (toast.value = ''), 3000)
  }
}

onMounted(load)
</script>

<template>
  <div>
    <!-- Toast -->
    <div v-if="toast" class="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm px-5 py-3 rounded-lg shadow-lg">
      {{ toast }}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Media ✦</p>
        <h1 class="font-groovy font-black text-2xl sm:text-3xl text-link-700">Manajemen Media 🗂️</h1>
        <p class="text-slate-500 text-sm mt-1 font-semibold">
          Upload gambar sekali, pakai berulang di artikel &amp; iklan.
        </p>
      </div>
      <label
        class="cursor-pointer inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white rounded-full px-6 py-3 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        {{ uploading ? 'Mengunggah…' : 'Unggah Gambar' }}
        <input type="file" accept="image/*" class="hidden" @change="onUpload" :disabled="uploading" />
      </label>
    </div>

    <!-- Statistik singkat -->
    <div class="grid grid-cols-3 gap-4 mb-8 max-w-xl">
      <div class="bg-white rounded-2xl border-2 border-link-700 p-4 shadow-[3px_3px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-slate-400">Total Gambar</p>
        <p class="font-groovy font-black text-2xl text-link-700 mt-0.5">{{ items.length }}</p>
      </div>
      <div class="bg-white rounded-2xl border-2 border-link-700 p-4 shadow-[3px_3px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-slate-400">Ukuran Pustaka</p>
        <p class="font-groovy font-black text-2xl text-link-700 mt-0.5">{{ totalSize }}</p>
      </div>
      <div class="bg-white rounded-2xl border-2 border-link-700 p-4 shadow-[3px_3px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-slate-400">Halaman</p>
        <p class="font-groovy font-black text-2xl text-link-700 mt-0.5">{{ totalPages }}</p>
      </div>
    </div>

    <p v-if="uploadError" class="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{{ uploadError }}</p>
    <div v-if="error" class="mb-4 bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-2xl px-5 py-4 text-sm font-semibold shadow-[3px_3px_0_#b45309]">
      {{ error }}
    </div>

    <!-- Grid media -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="i in 8" :key="i" class="bg-slate-200 animate-pulse rounded-2xl aspect-square border-2 border-link-700"></div>
    </div>

    <div v-else-if="!items.length" class="text-center py-20 text-slate-400 bg-white rounded-2xl border-2 border-dashed border-link-300">
      <p class="text-5xl mb-3">🖼️</p>
      <p class="font-groovy font-bold text-slate-500 mb-1">Pustaka media masih kosong</p>
      <p class="text-xs">Klik "Unggah Gambar" untuk menambahkan gambar pertama.</p>
    </div>

    <template v-else>
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-bold text-slate-400">Menampilkan {{ range }}</p>
        <p class="text-xs font-bold text-slate-300">{{ PER_PAGE }} per halaman</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div
          v-for="item in paged"
          :key="item.id"
          class="group bg-white rounded-2xl border-2 border-link-700 overflow-hidden shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all"
        >
          <div class="relative aspect-[4/3] bg-slate-100 overflow-hidden border-b-2 border-link-700">
            <img :src="item.url" :alt="item.name" class="w-full h-full object-cover" loading="lazy" />
            <span class="absolute top-2 left-2 text-[9px] font-groovy font-black uppercase tracking-wide bg-white/90 border border-slate-200 rounded-full px-2 py-0.5 text-slate-500">
              {{ fmtSize(item.size) }}
            </span>
          </div>
          <div class="p-3">
            <p class="font-bold text-sm text-slate-800 truncate" :title="item.name">{{ item.name }}</p>
            <p class="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">{{ fmtDate(item.createdAt) }}</p>
            <div class="mt-2.5 flex items-center gap-1.5">
              <button
                @click="copyUrl(item)"
                class="flex-1 text-[11px] font-groovy font-black uppercase tracking-wide px-2.5 py-1.5 rounded-full border-2 border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                {{ copiedId === item.id ? '✓ Disalin' : '🔗 Salin URL' }}
              </button>
              <button
                @click="askDelete(item)"
                class="text-[11px] font-groovy font-black uppercase tracking-wide px-2.5 py-1.5 rounded-full border-2 border-slate-200 text-slate-400 hover:border-rose-400 hover:text-rose-600 transition-colors"
                title="Hapus dari pustaka"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="mt-6 flex justify-center">
        <div class="flex items-center gap-1.5">
          <button
            :disabled="page <= 1"
            class="px-3 py-1.5 rounded-full text-sm font-bold border-2 border-link-700 bg-white text-link-700 shadow-[2px_2px_0_#2a1038] disabled:opacity-40 disabled:shadow-none transition-all"
            @click="goPage(page - 1)"
          >
            ←
          </button>
          <button
            v-for="p in totalPages"
            :key="p"
            class="w-8 h-8 rounded-full text-sm font-bold border-2 transition-all"
            :class="p === page ? 'bg-brand-600 border-link-700 text-white shadow-[2px_2px_0_#2a1038] -translate-y-0.5' : 'bg-white border-link-700 text-link-700 shadow-[2px_2px_0_#2a1038] hover:bg-brand-50'"
            @click="goPage(p)"
          >
            {{ p }}
          </button>
          <button
            :disabled="page >= totalPages"
            class="px-3 py-1.5 rounded-full text-sm font-bold border-2 border-link-700 bg-white text-link-700 shadow-[2px_2px_0_#2a1038] disabled:opacity-40 disabled:shadow-none transition-all"
            @click="goPage(page + 1)"
          >
            →
          </button>
        </div>
      </div>
    </template>

    <p class="mt-8 text-xs text-slate-400">
      💡 Gambar di pustaka ini bisa dipakai ulang di editor artikel (tombol "Pilih dari Media") dan form iklan —
      cukup klik gambar yang diinginkan, URL-nya langsung terisi.
    </p>

    <!-- Modal hapus -->
    <ConfirmModal
      :open="deleteModal.open"
      :loading="deleteModal.loading"
      variant="danger"
      title="Hapus dari Pustaka"
      :message='`Hapus gambar "${deleteTarget?.name || ""}" dari pustaka media? Artikel/iklan yang sudah memakainya tetap menampilkan gambar (URL tersimpan di artikel), hanya entri pustaka yang dihapus.`'
      confirm-text="Ya, Hapus"
      @confirm="confirmDelete"
      @cancel="deleteModal.open = false"
    />
  </div>
</template>
