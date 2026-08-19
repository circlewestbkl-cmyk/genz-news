<script setup>
import { ref, computed, onMounted } from 'vue'
import { articleApi } from '../../api/articles'
import { auth } from '../../api/auth'
import { auditApi } from '../../api/audit'
import { chipOf } from '../../api/categories'
import { formatDateTime, DEFAULT_IMAGE } from '../../utils/format'
import ConfirmModal from '../../components/ConfirmModal.vue'
import RevisionModal from '../../components/RevisionModal.vue'
import SchedulePublishModal from '../../components/SchedulePublishModal.vue'

const user = auth.current()

const articles = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')
const filter = ref('all')

// Kategori tinjauan: Baru (kiriman penulis) & Siap Ditinjau (sudah direvisi).
// Tulisan berstatus "Perlu Revisi" (belum diperbaiki penulis) tidak masuk antrean.
function reviewState(a) {
  if (a.revisionNote && a.revisionDoneAt) return 'ready' // siap ditinjau ulang
  return 'new' // baru
}

const stateInfo = {
  new: { label: 'Baru', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  ready: { label: 'Siap Ditinjau', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
}

const filters = [
  { value: 'all', label: 'Semua' },
  { value: 'ready', label: 'Siap Ditinjau' },
  { value: 'new', label: 'Baru' },
]

// Draft milik user lain (tulisan penulis yang menunggu tinjauan editor),
// kecuali yang masih berstatus "Perlu Revisi" (belum diperbaiki penulis).
const drafts = computed(() =>
  articles.value.filter(
    (a) => a.createdBy !== user?.username && !(a.revisionNote && !a.revisionDoneAt)
  )
)

const stats = computed(() => ({
  total: drafts.value.length,
  ready: drafts.value.filter((a) => reviewState(a) === 'ready').length,
  new: drafts.value.filter((a) => reviewState(a) === 'new').length,
}))

const filteredArticles = computed(() => {
  let list = [...drafts.value]
  if (filter.value !== 'all') {
    list = list.filter((a) => reviewState(a) === filter.value)
  }
  // Siap Ditinjau paling atas, lalu terbaru
  return list.sort((a, b) => {
    const ra = reviewState(a) === 'ready' ? 1 : 0
    const rb = reviewState(b) === 'ready' ? 1 : 0
    if (ra !== rb) return rb - ra
    return (b.publishedAt || '').localeCompare(a.publishedAt || '')
  })
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    articles.value = await articleApi.list({ status: 'draft' })
  } catch {
    error.value = 'Gagal memuat data. Pastikan JSON Server berjalan (npm run server).'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Aksi tinjauan — hanya pemegang izin publish (editor)
function canEdit(a) {
  if (!user) return false
  if (auth.hasPermission('editAll')) return true
  return a.createdBy === user.username
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 3000)
}

// Terbitkan / jadwalkan
const publishModal = ref({ open: false, loading: false })
const publishTarget = ref(null)

function askPublish(article) {
  publishTarget.value = article
  publishModal.value = { open: true, loading: false }
}

async function confirmPublish() {
  if (!publishTarget.value) return
  publishModal.value.loading = true
  try {
    await articleApi.publish(publishTarget.value.id, publishTarget.value.publishedAt || new Date().toISOString())
    auditApi.log('article_publish', `Berita "${publishTarget.value.title}" diterbitkan dari tinjauan`)
    articles.value = articles.value.filter((a) => a.id !== publishTarget.value.id)
    publishModal.value.open = false
    showToast(`Berita "${publishTarget.value.title}" berhasil diterbitkan.`)
  } catch {
    showToast('Gagal menerbitkan berita.')
  } finally {
    publishModal.value.loading = false
    publishTarget.value = null
  }
}

async function confirmSchedule(iso) {
  if (!publishTarget.value) return
  publishModal.value.loading = true
  try {
    await articleApi.schedule(publishTarget.value.id, iso)
    auditApi.log('article_schedule', `Berita "${publishTarget.value.title}" dijadwalkan terbit ${formatDateTime(iso)} (dari tinjauan)`)
    articles.value = articles.value.filter((a) => a.id !== publishTarget.value.id)
    publishModal.value.open = false
    showToast(`Berita "${publishTarget.value.title}" dijadwalkan terbit ${formatDateTime(iso)}.`)
  } catch {
    showToast('Gagal menjadwalkan berita.')
  } finally {
    publishModal.value.loading = false
    publishTarget.value = null
  }
}

// Tandai "Siap Terbit" — artikel pindah ke halaman Siap Terbit (belum tampil di publik)
const readyModal = ref({ open: false, loading: false })
const readyTarget = ref(null)

function askReady(article) {
  readyTarget.value = article
  readyModal.value = { open: true, loading: false }
}

async function confirmReady() {
  if (!readyTarget.value) return
  readyModal.value.loading = true
  try {
    await articleApi.markReady(readyTarget.value.id)
    auditApi.log('article_ready', `Berita "${readyTarget.value.title}" ditandai Siap Terbit`)
    articles.value = articles.value.filter((a) => a.id !== readyTarget.value.id)
    readyModal.value.open = false
    showToast(`Berita "${readyTarget.value.title}" ditandai Siap Terbit — pindah ke halaman Siap Terbit.`)
  } catch {
    showToast('Gagal menandai artikel Siap Terbit.')
  } finally {
    readyModal.value.loading = false
    readyTarget.value = null
  }
}

// Minta revisi
const revisionModal = ref({ open: false, loading: false })
const revisionTarget = ref(null)

function askRevision(article) {
  revisionTarget.value = article
  revisionModal.value = { open: true, loading: false }
}

async function confirmRevision(note) {
  if (!revisionTarget.value) return
  if (!note) {
    showToast('Tulis keterangan revisi dulu.')
    return
  }
  revisionModal.value.loading = true
  try {
    await articleApi.requestRevision(revisionTarget.value.id, { note, by: user.username })
    auditApi.log('article_revision', `Revisi diminta untuk berita "${revisionTarget.value.title}" (dari tinjauan)`)
    revisionTarget.value.revisionNote = note
    revisionTarget.value.revisionRequestedBy = user.username
    revisionTarget.value.revisionDoneAt = null
    revisionModal.value.open = false
    showToast('Permintaan revisi terkirim ke penulis.')
  } catch {
    showToast('Gagal mengirim permintaan revisi.')
  } finally {
    revisionModal.value.loading = false
    revisionTarget.value = null
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
      <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">Perlu Ditinjau</h1>
      <p class="text-slate-500 text-sm mt-1">
        Tulisan penulis yang menunggu tinjauan kamu — terbitkan atau minta revisi.
      </p>
    </div>

    <!-- Ringkasan -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Antrean</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.total }}</p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-teal-600">Siap Ditinjau</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.ready }}</p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-blue-600">Baru</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.new }}</p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-5 py-4 text-sm mb-6">
      {{ error }}
    </div>

    <!-- Daftar -->
    <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-display font-bold text-lg text-slate-900">Antrean Tinjauan</h2>
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
        <p class="text-4xl mb-3">✅</p>
        <p class="font-semibold text-slate-500 mb-1">Antrean kosong</p>
        <p>Semua tulisan sudah ditinjau. Penulis baru akan muncul di sini.</p>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div
          v-for="a in filteredArticles"
          :key="a.id"
          class="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
        >
          <img :src="a.coverImage || DEFAULT_IMAGE" :alt="a.title" class="w-20 h-14 object-cover rounded shrink-0 hidden sm:block" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs px-2 py-0.5 rounded font-semibold border" :class="chipOf(a.category).color">
                {{ a.category }}
              </span>
              <span
                class="text-xs px-2 py-0.5 rounded font-semibold border"
                :class="stateInfo[reviewState(a)].badge"
              >
                {{ stateInfo[reviewState(a)].label }}
              </span>
            </div>
            <p class="font-semibold text-slate-900 truncate">{{ a.title }}</p>
            <p class="text-xs text-slate-400 mt-0.5">
              oleh <span class="font-medium text-slate-500">{{ a.createdBy }}</span> •
              {{ formatDateTime(a.publishedAt) }}
            </p>
            <div
              v-if="a.revisionNote"
              class="mt-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800"
            >
              <p class="font-bold">✅ Revisi selesai — permintaan sebelumnya:</p>
              <p class="mt-0.5 leading-relaxed">{{ a.revisionNote }}</p>
            </div>
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
              v-if="canEdit(a)"
              :to="{ name: 'admin-edit', params: { id: a.id } }"
              title="Edit"
              class="p-2 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </router-link>
            <button
              @click="askRevision(a)"
              title="Minta revisi ke penulis"
              class="px-2.5 py-1.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white transition-colors"
            >
              Minta Revisi
            </button>
            <button
              @click="askReady(a)"
              title="Tandai Siap Terbit"
              class="px-2.5 py-1.5 rounded text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-600 hover:text-white transition-colors"
            >
              Siap Terbit
            </button>
            <button
              @click="askPublish(a)"
              title="Terbitkan atau jadwalkan"
              class="px-2.5 py-1.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-colors"
            >
              Terbitkan
            </button>
          </div>
        </div>
      </div>
    </div>

    <p class="mt-6 text-xs text-slate-400">
      💡 <span class="font-semibold text-blue-600">Baru</span> = kiriman penulis yang belum ditinjau.
      <span class="font-semibold text-teal-600">Siap Ditinjau</span> = penulis sudah memperbaiki sesuai permintaan
      revisi. Tulisan yang masih diminta revisi (belum diperbaiki penulis) tidak tampil di sini.
    </p>

    <!-- Modal terbitkan / jadwalkan -->
    <SchedulePublishModal
      :open="publishModal.open"
      :loading="publishModal.loading"
      :article="publishTarget"
      @publish="confirmPublish"
      @schedule="confirmSchedule"
      @cancel="publishModal.open = false"
    />

    <!-- Modal tandai siap terbit -->
    <ConfirmModal
      :open="readyModal.open"
      :loading="readyModal.loading"
      variant="success"
      title="Tandai Siap Terbit"
      :message='`Tandai berita "${readyTarget?.title || ""}" sebagai Siap Terbit? Artikel pindah ke halaman Siap Terbit dan belum tampil di website sampai diterbitkan.`'
      confirm-text="Ya, Tandai Siap"
      @confirm="confirmReady"
      @cancel="readyModal.open = false"
    />

    <!-- Modal minta revisi -->
    <RevisionModal
      :open="revisionModal.open"
      :loading="revisionModal.loading"
      :note="revisionTarget?.revisionNote || ''"
      :message='`Kirim keterangan revisi untuk berita "${revisionTarget?.title || ""}". Penulis akan melihat pesan ini di Berita Saya.`'
      confirm-text="Kirim Permintaan Revisi"
      @confirm="confirmRevision"
      @cancel="revisionModal.open = false"
    />
  </div>
</template>
