<script setup>
import { ref, computed, onMounted } from 'vue'
import { articleApi } from '../../api/articles'
import { auditApi } from '../../api/audit'
import { chipOf } from '../../api/categories'
import { formatDateTime, DEFAULT_IMAGE } from '../../utils/format'
import ConfirmModal from '../../components/ConfirmModal.vue'

const trashed = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')

// Urutkan berdasarkan waktu masuk recycle bin (terbaru dulu)
const sortedTrashed = computed(() =>
  [...trashed.value].sort((a, b) => (b.trashedAt || '').localeCompare(a.trashedAt || ''))
)

// Modal konfirmasi
const modal = ref({ open: false, variant: 'danger', title: '', message: '', confirmText: '', loading: false })
const modalAction = ref(null)

function openModal(config, action) {
  modalAction.value = action
  modal.value = { open: true, loading: false, ...config }
}

async function runModalAction() {
  modal.value.loading = true
  try {
    const msg = await modalAction.value()
    if (msg) showToast(msg)
    modal.value.open = false
  } catch {
    showToast('Gagal. Pastikan server data berjalan.')
    modal.value.open = false
  } finally {
    modal.value.loading = false
  }
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 3000)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    trashed.value = await articleApi.listTrashed()
  } catch (e) {
    error.value = 'Gagal memuat recycle bin.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Pulihkan → kembali sebagai draft
function askRestore(a) {
  openModal(
    {
      variant: 'success',
      title: 'Pulihkan Berita',
      message: `Pulihkan berita "${a.title}" dari Recycle Bin? Berita akan kembali sebagai draft dan bisa diedit/diterbitkan.`,
      confirmText: 'Pulihkan',
    },
    async () => {
      await articleApi.restore(a.id)
      auditApi.log('article_restore', `Berita "${a.title}" dipulihkan sebagai draft`)
      trashed.value = trashed.value.filter((x) => x.id !== a.id)
      return 'Berita dipulihkan sebagai draft.'
    }
  )
}

// Hapus permanen (tidak bisa dikembalikan)
function askDeleteForever(a) {
  openModal(
    {
      variant: 'danger',
      title: 'Hapus Permanen',
      message: `Hapus permanen berita "${a.title}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Hapus Permanen',
    },
    async () => {
      await articleApi.remove(a.id)
      auditApi.log('article_delete', `Berita "${a.title}" dihapus permanen`)
      trashed.value = trashed.value.filter((x) => x.id !== a.id)
      return 'Berita dihapus permanen.'
    }
  )
}

// Kosongkan seluruh recycle bin
function askEmptyBin() {
  if (!trashed.value.length) return
  openModal(
    {
      variant: 'danger',
      title: 'Kosongkan Recycle Bin',
      message: `Hapus permanen semua ${trashed.value.length} berita di Recycle Bin? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Kosongkan',
    },
    async () => {
      for (const a of trashed.value) {
        await articleApi.remove(a.id)
      }
      auditApi.log('article_delete', `Recycle bin dikosongkan (${trashed.value.length} berita)`)
      trashed.value = []
      return 'Recycle Bin dikosongkan.'
    }
  )
}
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

    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">Recycle Bin</h1>
        <p class="text-slate-500 text-sm mt-1">
          Berita yang dihapus masuk ke sini. Pulihkan kembali sebagai draft, atau hapus permanen.
        </p>
      </div>
      <button
        v-if="trashed.length && !loading"
        @click="askEmptyBin"
        class="inline-flex items-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg px-5 py-3 text-sm font-bold transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Kosongkan Recycle Bin
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-5 py-4 text-sm mb-6">
      {{ error }}
    </div>

    <!-- Daftar berita trashed -->
    <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="font-display font-bold text-lg text-slate-900">Berita Terhapus</h2>
        <span class="text-xs text-slate-400">{{ trashed.length }} item</span>
      </div>

      <div v-if="loading" class="divide-y divide-slate-100">
        <div v-for="i in 3" :key="i" class="flex items-center gap-4 p-4 animate-pulse">
          <div class="w-16 h-12 bg-slate-200 rounded-lg"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-slate-200 rounded w-2/3"></div>
            <div class="h-3 bg-slate-200 rounded w-1/3"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!trashed.length" class="text-center py-16 text-slate-400">
        <p class="text-4xl mb-3">🗑️</p>
        <p class="font-semibold text-slate-500 mb-1">Recycle Bin kosong</p>
        <p class="text-sm">Berita yang dihapus dari dashboard akan muncul di sini.</p>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="a in sortedTrashed" :key="a.id" class="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
          <img :src="a.coverImage || DEFAULT_IMAGE" :alt="a.title" class="w-20 h-14 object-cover rounded shrink-0 hidden sm:block" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs px-2 py-0.5 rounded font-semibold border" :class="chipOf(a.category).color">
                {{ a.category }}
              </span>
              <span class="text-xs px-2 py-0.5 rounded font-semibold border bg-slate-100 text-slate-500 border-slate-200">
                Terhapus
              </span>
            </div>
            <p class="font-semibold text-slate-900 truncate">{{ a.title }}</p>
            <p class="text-xs text-slate-400 mt-0.5">
              Masuk recycle bin: {{ formatDateTime(a.trashedAt || a.publishedAt) }}
              <span v-if="a.createdBy"> • oleh {{ a.createdBy }}</span>
            </p>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              @click="askRestore(a)"
              title="Pulihkan sebagai draft"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M4.93 15.07a7 7 0 0111.31-1.64M19.07 8.93a7 7 0 01-11.31 1.64" />
              </svg>
              Pulihkan
            </button>
            <button
              @click="askDeleteForever(a)"
              title="Hapus permanen"
              class="p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal konfirmasi -->
    <ConfirmModal
      :open="modal.open"
      :loading="modal.loading"
      :variant="modal.variant"
      :title="modal.title"
      :message="modal.message"
      :confirm-text="modal.confirmText"
      @confirm="runModalAction"
      @cancel="modal.open = false"
    />
  </div>
</template>
