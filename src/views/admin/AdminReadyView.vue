<script setup>
import { ref, computed, onMounted } from 'vue'
import { articleApi } from '../../api/articles'
import { auth } from '../../api/auth'
import { auditApi } from '../../api/audit'
import { chipOf } from '../../api/categories'
import { formatDateTime, DEFAULT_IMAGE } from '../../utils/format'
import { statusInfo } from '../../data/articleStatus'
import SchedulePublishModal from '../../components/SchedulePublishModal.vue'
import ConfirmModal from '../../components/ConfirmModal.vue'

const user = auth.current()

const articles = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')
const filter = ref('all')

// Halaman ini khusus editor / pemegang izin publish — guard sudah di router,
// tapi tetap amankan aksi di sini.
const canManage = computed(() => user?.role === 'editor' || auth.hasPermission('publish'))

const filters = [
  { value: 'all', label: 'Semua' },
  { value: 'ready', label: 'Siap Terbit' },
  { value: 'scheduled', label: 'Terjadwal' },
]

const stats = computed(() => ({
  total: articles.value.length,
  ready: articles.value.filter((a) => a.status === 'ready').length,
  scheduled: articles.value.filter((a) => a.status === 'scheduled').length,
}))

// Terjadwal paling atas (yang paling cepat terbit), lalu terbaru
const filteredArticles = computed(() => {
  let list = [...articles.value]
  if (filter.value !== 'all') {
    list = list.filter((a) => a.status === filter.value)
  }
  return list.sort((a, b) => {
    const ta = a.status === 'scheduled' ? new Date(a.scheduledAt).getTime() : Infinity
    const tb = b.status === 'scheduled' ? new Date(b.scheduledAt).getTime() : Infinity
    if (ta !== tb) return ta - tb
    return (b.publishedAt || '').localeCompare(a.publishedAt || '')
  })
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [ready, scheduled] = await Promise.all([articleApi.listReady(), articleApi.listScheduled()])
    articles.value = [...ready, ...scheduled]
  } catch {
    error.value = 'Gagal memuat data. Pastikan JSON Server berjalan (npm run server).'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 3000)
}

// Kembalikan ke draft (hanya status ready)
const backToDraftTarget = ref(null)
const backToDraftModal = ref({ open: false, loading: false })

function askBackToDraft(a) {
  backToDraftTarget.value = a
  backToDraftModal.value = { open: true, loading: false }
}

async function confirmBackToDraft() {
  const a = backToDraftTarget.value
  if (!a) return
  backToDraftModal.value.loading = true
  try {
    await articleApi.backToDraft(a.id)
    auditApi.log('article_update', `Berita \"${a.title}\" dikembalikan ke draft dari Siap Terbit`)
    articles.value = articles.value.filter((x) => x.id !== a.id)
    backToDraftModal.value.open = false
    showToast('Artikel dikembalikan ke draft.')
  } catch {
    showToast('Gagal mengembalikan artikel ke draft.')
  } finally {
    backToDraftModal.value.loading = false
    backToDraftTarget.value = null
  }
}

// Batalkan jadwal → kembali ke Siap Terbit
const cancelTarget = ref(null)
const cancelModal = ref({ open: false, loading: false })

function askCancelSchedule(a) {
  cancelTarget.value = a
  cancelModal.value = { open: true, loading: false }
}

async function confirmCancelSchedule() {
  const a = cancelTarget.value
  if (!a) return
  cancelModal.value.loading = true
  try {
    await articleApi.cancelSchedule(a.id)
    auditApi.log('article_schedule', `Jadwal terbit dibatalkan untuk berita \"${a.title}\"`)
    a.status = 'ready'
    a.scheduledAt = null
    cancelModal.value.open = false
    showToast('Jadwal dibatalkan — artikel kembali ke Siap Terbit.')
  } catch {
    showToast('Gagal membatalkan jadwal.')
  } finally {
    cancelModal.value.loading = false
    cancelTarget.value = null
  }
}

// Terbitkan / jadwalkan
const publishModal = ref({ open: false, loading: false })
const publishTarget = ref(null)

function askPublish(a) {
  publishTarget.value = a
  publishModal.value = { open: true, loading: false }
}

async function confirmPublishNow() {
  const a = publishTarget.value
  if (!a) return
  publishModal.value.loading = true
  try {
    await articleApi.publish(a.id)
    auditApi.log('article_publish', `Berita \"${a.title}\" diterbitkan dari halaman Siap Terbit`)
    articles.value = articles.value.filter((x) => x.id !== a.id)
    publishModal.value.open = false
    showToast(`Berita \"${a.title}\" berhasil diterbitkan.`)
  } catch {
    showToast('Gagal menerbitkan berita.')
  } finally {
    publishModal.value.loading = false
    publishTarget.value = null
  }
}

async function confirmSchedule(iso) {
  const a = publishTarget.value
  if (!a) return
  publishModal.value.loading = true
  try {
    await articleApi.schedule(a.id, iso)
    auditApi.log('article_schedule', `Berita \"${a.title}\" dijadwalkan terbit ${formatDateTime(iso)}`)
    a.status = 'scheduled'
    a.scheduledAt = iso
    publishModal.value.open = false
    showToast(`Berita \"${a.title}\" dijadwalkan terbit ${formatDateTime(iso)}.`)
  } catch {
    showToast('Gagal menjadwalkan berita.')
  } finally {
    publishModal.value.loading = false
    publishTarget.value = null
  }
}

// Hapus (soft delete → recycle bin)
const deleteTarget = ref(null)
const deleteModal = ref({ open: false, loading: false })

function askDelete(a) {
  deleteTarget.value = a
  deleteModal.value = { open: true, loading: false }
}

async function confirmDelete() {
  const a = deleteTarget.value
  if (!a) return
  deleteModal.value.loading = true
  try {
    await articleApi.trash(a.id)
    auditApi.log('article_trash', `Berita \"${a.title}\" dipindah ke recycle bin (dari Siap Terbit)`)
    articles.value = articles.value.filter((x) => x.id !== a.id)
    deleteModal.value.open = false
    showToast('Berita dipindahkan ke Recycle Bin.')
  } catch {
    showToast('Gagal menghapus berita.')
  } finally {
    deleteModal.value.loading = false
    deleteTarget.value = null
  }
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

    <div class="mb-8">
      <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Kurasi Redaksi ✦</p>
      <h1 class="font-groovy font-black text-2xl sm:text-3xl text-link-700">Siap Terbit 🚀</h1>
      <p class="text-slate-500 text-sm mt-1 font-semibold">
        Artikel yang sudah oke dan siap tayang — belum tampil di website sampai kamu terbitkan atau jadwalkan.
      </p>
    </div>

    <!-- Ringkasan -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-slate-400">Total Menunggu</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.total }}</p>
      </div>
      <div class="bg-teal-50 rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-teal-600">Siap Terbit</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.ready }}</p>
      </div>
      <div class="bg-violet-50 rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-violet-600">Terjadwal</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.scheduled }}</p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-2xl px-5 py-4 text-sm font-semibold mb-6 shadow-[3px_3px_0_#b45309]">
      {{ error }}
    </div>

    <!-- Daftar -->
    <div class="bg-white rounded-2xl border-2 border-link-700 overflow-hidden shadow-[5px_5px_0_#2a1038]">
      <div class="px-5 py-4 border-b-2 border-slate-200 bg-brand-50/40 flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-groovy font-black text-lg text-link-700">Artikel Menunggu Terbit</h2>
        <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-xs font-semibold">
          <button
            v-for="f in filters"
            :key="f.value"
            @click="filter = f.value"
            class="px-3 py-1.5 rounded-md transition-colors"
            :class="filter === f.value ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
            {{ f.label }}
            <span v-if="f.value !== 'all' && stats[f.value]" class="text-slate-400">({{ stats[f.value] }})</span>
          </button>
        </div>
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

      <div v-else-if="!filteredArticles.length" class="text-center py-16 text-slate-400">
        <p class="text-4xl mb-3">🗂️</p>
        <p class="font-semibold text-slate-500 mb-1">Belum ada artikel di sini</p>
        <p>Artikel yang ditandai <b class="text-teal-600">Siap Terbit</b> atau <b class="text-violet-600">Terjadwal</b> akan muncul di halaman ini.</p>
      </div>

      <div v-else class="divide-y divide-slate-200">
        <div v-for="a in filteredArticles" :key="a.id" class="flex items-center gap-4 p-4 hover:bg-brand-50/40 transition-colors">
          <img :src="a.coverImage || DEFAULT_IMAGE" :alt="a.title" class="w-20 h-14 object-cover rounded shrink-0 hidden sm:block" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs px-2 py-0.5 rounded font-semibold border" :class="chipOf(a.category).color">
                {{ a.category }}
              </span>
              <span class="text-xs px-2 py-0.5 rounded font-semibold border" :class="statusInfo(a.status).badge">
                {{ statusInfo(a.status).label }}
              </span>
            </div>
            <p class="font-semibold text-slate-900 truncate">{{ a.title }}</p>
            <p class="text-xs text-slate-400 mt-0.5">
              <template v-if="a.status === 'scheduled'">
                📅 Terbit otomatis <b class="text-violet-600">{{ formatDateTime(a.scheduledAt) }}</b>
              </template>
              <template v-else>
                Disiapkan {{ formatDateTime(a.publishedAt) }}
              </template>
              <span v-if="a.createdBy"> • oleh <span class="font-medium text-slate-500">{{ a.createdBy }}</span></span>
            </p>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <router-link
              :to="{ name: 'preview', params: { id: a.id } }"
              target="_blank"
              title="Pratinjau"
              class="p-2 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </router-link>
            <router-link
              v-if="canManage"
              :to="{ name: 'admin-edit', params: { id: a.id } }"
              title="Edit"
              class="p-2 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </router-link>
            <button
              v-if="a.status === 'scheduled'"
              @click="askCancelSchedule(a)"
              title="Batalkan jadwal"
              class="px-2.5 py-1.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors"
            >
              Batalkan Jadwal
            </button>
            <button
              v-if="a.status === 'ready'"
              @click="askBackToDraft(a)"
              title="Kembalikan ke draft"
              class="px-2.5 py-1.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-600 hover:text-white transition-colors"
            >
              Kembalikan ke Draft
            </button>
            <button
              v-if="canManage"
              @click="askPublish(a)"
              title="Terbitkan atau jadwalkan"
              class="px-2.5 py-1.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-colors"
            >
              Terbitkan
            </button>
            <button
              v-if="canManage"
              @click="askDelete(a)"
              title="Hapus"
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

    <p class="mt-6 text-xs text-slate-400">
      💡 Artikel di halaman ini <b class="font-semibold text-slate-500">tidak tampil di website</b> sampai diterbitkan.
      Pilih <b class="font-semibold text-emerald-600">Terbitkan</b> untuk tayang sekarang, atau
      <b class="font-semibold text-violet-600">jadwalkan</b> tanggal &amp; jam terbitnya — artikel akan otomatis tayang
      begitu waktu tiba (selama aplikasi sedang terbuka).
    </p>

    <!-- Modal terbitkan / jadwalkan -->
    <SchedulePublishModal
      :open="publishModal.open"
      :loading="publishModal.loading"
      :article="publishTarget"
      @publish="confirmPublishNow"
      @schedule="confirmSchedule"
      @cancel="publishModal.open = false"
    />

    <!-- Modal batalkan jadwal -->
    <ConfirmModal
      :open="cancelModal.open"
      :loading="cancelModal.loading"
      variant="warning"
      title="Batalkan Jadwal"
      :message='`Batalkan jadwal terbit untuk berita "${cancelTarget?.title || ""}"? Artikel akan kembali ke status Siap Terbit.`'
      confirm-text="Ya, Batalkan"
      @confirm="confirmCancelSchedule"
      @cancel="cancelModal.open = false"
    />

    <!-- Modal kembali ke draft -->
    <ConfirmModal
      :open="backToDraftModal.open"
      :loading="backToDraftModal.loading"
      variant="warning"
      title="Kembalikan ke Draft"
      :message='`Kembalikan berita "${backToDraftTarget?.title || ""}" menjadi draft? Artikel tidak akan tampil di halaman Siap Terbit.`'
      confirm-text="Ya, Kembalikan"
      @confirm="confirmBackToDraft"
      @cancel="backToDraftModal.open = false"
    />

    <!-- Modal hapus -->
    <ConfirmModal
      :open="deleteModal.open"
      :loading="deleteModal.loading"
      variant="danger"
      title="Pindah ke Recycle Bin"
      :message='`Pindahkan berita "${deleteTarget?.title || ""}" ke Recycle Bin? Artikel tidak hilang permanen dan bisa dipulihkan.`'
      confirm-text="Pindahkan"
      @confirm="confirmDelete"
      @cancel="deleteModal.open = false"
    />
  </div>
</template>
