<script setup>
import { ref, computed, onMounted } from 'vue'
import { articleApi } from '../../api/articles'
import { auth } from '../../api/auth'
import { auditApi } from '../../api/audit'
import { chipOf } from '../../api/categories'
import {
  formatDateTime,
  DEFAULT_IMAGE,
  countWords,
  articleEarnings,
  formatRupiah,
  RATE_PER_WORD,
} from '../../utils/format'
import { statusInfo } from '../../data/articleStatus'
import ConfirmModal from '../../components/ConfirmModal.vue'

const user = auth.current()

const articles = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')
const statusFilter = ref('all')

const filters = [
  { value: 'all', label: 'Semua' },
  { value: 'published', label: 'Terbit' },
  { value: 'ready', label: 'Siap Terbit' },
  { value: 'scheduled', label: 'Terjadwal' },
  { value: 'draft', label: 'Draft' },
  { value: 'trashed', label: 'Recycle Bin' },
]

// Hanya artikel yang ditulis oleh user yang sedang login
const myArticles = computed(() =>
  articles.value.filter((a) => a.createdBy === user?.username)
)

const filteredArticles = computed(() => {
  if (statusFilter.value === 'all') return myArticles.value
  return myArticles.value.filter((a) => a.status === statusFilter.value)
})

const stats = computed(() => ({
  total: myArticles.value.length,
  published: myArticles.value.filter((a) => a.status === 'published').length,
  ready: myArticles.value.filter((a) => a.status === 'ready').length,
  scheduled: myArticles.value.filter((a) => a.status === 'scheduled').length,
  draft: myArticles.value.filter((a) => a.status === 'draft').length,
  trashed: myArticles.value.filter((a) => a.status === 'trashed').length,
}))

// Penghasilan penulis: setiap kata pada artikel yang berhasil terbit = Rp100
const publishedArticles = computed(() =>
  myArticles.value.filter((a) => a.status === 'published')
)
const totalWords = computed(() =>
  publishedArticles.value.reduce((sum, a) => sum + countWords(a.content), 0)
)
const earnings = computed(() => totalWords.value * RATE_PER_WORD)

async function load() {
  loading.value = true
  error.value = ''
  try {
    articles.value = await articleApi.list()
  } catch {
    error.value = 'Gagal memuat data. Pastikan JSON Server berjalan (npm run server).'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Aksi edit/hapus mengikuti izin: penulis hanya untuk berita miliknya
function canEdit(a) {
  if (!user) return false
  if (auth.hasPermission('editAll')) return true
  if (user.role === 'admin') return false
  return a.createdBy === user.username
}

function canDelete(a) {
  if (!user) return false
  if (auth.hasPermission('delete')) return true
  if (user.role === 'admin') return false
  // Penulis: hanya boleh menghapus draft miliknya — artikel yang sudah terbit
  // tidak bisa dihapus / dipindah ke Recycle Bin.
  return a.createdBy === user.username && a.status === 'draft'
}

// Modal konfirmasi hapus (soft delete → recycle bin)
const modal = ref({ open: false, loading: false })
const modalTarget = ref(null)

function askDelete(article) {
  modalTarget.value = article
  modal.value = { open: true, loading: false }
}

async function confirmDelete() {
  if (!modalTarget.value) return
  modal.value.loading = true
  try {
    await articleApi.trash(modalTarget.value.id)
    auditApi.log('article_trash', `Berita "${modalTarget.value.title}" dipindah ke recycle bin`)
    articles.value = articles.value.filter((a) => a.id !== modalTarget.value.id)
    modal.value.open = false
    toast.value = 'Berita dipindahkan ke Recycle Bin.'
  } catch {
    toast.value = 'Gagal menghapus berita.'
  } finally {
    modal.value.loading = false
    modalTarget.value = null
    setTimeout(() => (toast.value = ''), 3000)
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
      <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">Berita Saya</h1>
      <p class="text-slate-500 text-sm mt-1">Status berita yang pernah kamu tulis di Gen Z News.</p>
    </div>

    <!-- Penghasilan penulis -->
    <div
      class="mb-6 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 sm:p-7 flex flex-wrap items-center justify-between gap-5"
    >
      <div>
        <p class="text-xs font-bold uppercase tracking-wide text-slate-400">💰 Penghasilan Penulis</p>
        <p class="font-display font-black text-3xl sm:text-4xl mt-1 text-emerald-400 tabular-nums">
          {{ formatRupiah(earnings) }}
        </p>
        <p class="text-xs text-slate-400 mt-1.5">
          {{ stats.published }} artikel terbit • {{ totalWords.toLocaleString('id-ID') }} kata ×
          Rp{{ RATE_PER_WORD.toLocaleString('id-ID') }}/kata
        </p>
      </div>
      <div class="max-w-xs text-right text-xs text-slate-400 leading-relaxed">
        <p>💡 Setiap kata pada artikel yang <span class="font-semibold text-white">berhasil terbit</span></p>
        <p>
          dihargai <span class="font-bold text-emerald-400">Rp{{ RATE_PER_WORD.toLocaleString('id-ID') }}</span>.
          Artikel draft atau yang dihapus tidak dihitung.
        </p>
      </div>
    </div>

    <!-- Ringkasan status -->
    <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Ditulis</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.total }}</p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-emerald-600">Terbit</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.published }}</p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-teal-600">Siap Terbit</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.ready }}</p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-violet-600">Terjadwal</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.scheduled }}</p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-amber-600">Draft</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.draft }}</p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Recycle Bin</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ stats.trashed }}</p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-5 py-4 text-sm mb-6">
      {{ error }}
    </div>

    <!-- Daftar berita -->
    <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-display font-bold text-lg text-slate-900">Daftar Berita</h2>
        <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-xs font-semibold">
          <button
            v-for="f in filters"
            :key="f.value"
            @click="statusFilter = f.value"
            class="px-3 py-1.5 rounded-md transition-colors"
            :class="statusFilter === f.value ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
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

      <div v-else-if="!filteredArticles.length" class="text-center py-16 text-slate-500">
        <p class="text-5xl mb-3">📝</p>
        <p class="font-groovy font-black text-lg text-link-700 mb-1">Belum ada berita</p>
        <p v-if="myArticles.length">Tidak ada berita dengan filter ini.</p>
        <template v-else>
          <p class="text-sm text-slate-400 mb-6">Kamu belum menulis berita apa pun. Yuk mulai berkarya!</p>
          <router-link
            v-if="user?.role !== 'admin'"
            to="/admin/tulis"
            class="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white rounded-full px-7 py-3 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all"
          >
            ✍️ Tulis Berita Baru
          </router-link>
          <p v-else class="text-xs font-semibold text-slate-400">
            💡 Role Admin tidak bisa menulis berita — hubungi Editor/Penulis.
          </p>
        </template>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="a in filteredArticles" :key="a.id" class="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
          <img :src="a.coverImage || DEFAULT_IMAGE" :alt="a.title" class="w-20 h-14 object-cover rounded shrink-0 hidden sm:block" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs px-2 py-0.5 rounded font-semibold border" :class="chipOf(a.category).color">
                {{ a.category }}
              </span>
              <span class="text-xs px-2 py-0.5 rounded font-semibold border" :class="statusInfo(a.status).badge">
                {{ statusInfo(a.status).label }}
              </span>
              <span
                v-if="a.status === 'scheduled' && a.scheduledAt"
                class="text-xs px-2 py-0.5 rounded font-bold border bg-violet-50 text-violet-700 border-violet-200"
              >
                🕐 {{ formatDateTime(a.scheduledAt) }}
              </span>
              <span
                v-if="a.revisionNote"
                class="text-xs px-2 py-0.5 rounded font-semibold border"
                :class="a.revisionDoneAt ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'"
              >
                {{ a.revisionDoneAt ? 'Revisi Selesai' : 'Perlu Revisi' }}
              </span>
              <span
                v-if="a.status === 'published'"
                class="text-xs px-2 py-0.5 rounded font-bold border bg-emerald-50 text-emerald-700 border-emerald-200"
                :title="`${countWords(a.content).toLocaleString('id-ID')} kata × Rp${RATE_PER_WORD.toLocaleString('id-ID')}`"
              >
                + {{ formatRupiah(articleEarnings(a.content)) }}
              </span>
            </div>
            <p class="font-semibold text-slate-900 truncate">{{ a.title }}</p>
            <p class="text-xs text-slate-400 mt-0.5">
              {{ formatDateTime(a.status === 'trashed' ? a.trashedAt || a.publishedAt : a.publishedAt) }}
              <template v-if="a.status === 'trashed'"> • masuk recycle bin</template>
              <template v-else-if="a.status === 'scheduled'"> • otomatis terbit sesuai jadwal</template>
              <template v-else> • {{ a.views?.toLocaleString('id-ID') }}x dibaca</template>
            </p>

            <!-- Status & pesan revisi dari editor -->
            <div
              v-if="a.revisionNote"
              class="mt-2 rounded-lg border px-3 py-2 text-xs"
              :class="a.revisionDoneAt ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'"
            >
              <p class="font-bold">
                <template v-if="a.revisionDoneAt">✅ Revisi selesai — menunggu tinjauan Editor</template>
                <template v-else>📝 Permintaan revisi dari {{ a.revisionRequestedBy || 'Editor' }}</template>
                <span class="font-normal opacity-70">
                  • {{ formatDateTime(a.revisionDoneAt || a.revisionRequestedAt) }}
                </span>
              </p>
              <p class="mt-0.5 leading-relaxed">{{ a.revisionNote }}</p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <!-- Terbit → lihat di publik -->
            <router-link
              v-if="a.status === 'published'"
              :to="{ name: 'article', params: { id: a.id } }"
              target="_blank"
              title="Lihat"
              class="p-2 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </router-link>

            <!-- Draft/Siap Terbit/Terjadwal → pratinjau & edit -->
            <template v-if="['draft', 'ready', 'scheduled'].includes(a.status) && canEdit(a)">
              <router-link
                :to="{ name: 'preview', params: { id: a.id } }"
                target="_blank"
                title="Pratinjau draft"
                class="p-2 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </router-link>
              <router-link
                :to="{ name: 'admin-edit', params: { id: a.id } }"
                title="Edit"
                class="p-2 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </router-link>
            </template>

            <!-- Hapus (soft delete) -->
            <button
              v-if="a.status !== 'trashed' && canDelete(a)"
              @click="askDelete(a)"
              title="Hapus"
              class="p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <!-- Trashed → info -->
            <span
              v-if="a.status === 'trashed'"
              class="text-[10px] font-semibold text-slate-400 whitespace-nowrap"
              title="Pulihkan hanya bisa dilakukan oleh Editor/Admin"
            >
              Perlu Editor/Admin
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Info -->
    <p class="mt-6 text-xs text-slate-400">
      💡 Status <span class="font-semibold text-amber-600">Draft</span> berarti belum tampil di publik dan menunggu
      diterbitkan Editor/Admin. <span class="font-semibold text-teal-600">Siap Terbit</span> berarti artikel sudah disetujui
      dan tersimpan di halaman Siap Terbit — belum tampil di website. <span class="font-semibold text-violet-600">Terjadwal</span>
      berarti artikel akan otomatis terbit pada waktu yang diatur. Badge <span class="font-semibold text-rose-600">Perlu Revisi</span>
      berarti Editor meminta perbaikan — baca pesannya, lalu edit artikelnya. Setelah kamu menyimpan perbaikannya, badge
      berubah jadi <span class="font-semibold text-emerald-600">Revisi Selesai</span> dan Editor akan meninjau ulang.
      Berita yang dihapus masuk ke <span class="font-semibold text-slate-500">Recycle Bin</span> dan hanya bisa dipulihkan oleh Editor/Admin.
      💰 Setiap kata pada artikel yang terbit bernilai <span class="font-semibold text-emerald-600">Rp{{ RATE_PER_WORD.toLocaleString('id-ID') }}</span>
      dan masuk ke penghasilan kamu. Artikel yang sudah <span class="font-semibold text-emerald-600">terbit</span>
      tidak bisa dihapus oleh penulis — hanya draft yang bisa dihapus.
    </p>

    <!-- Modal konfirmasi hapus -->
    <ConfirmModal
      :open="modal.open"
      :loading="modal.loading"
      variant="danger"
      title="Pindah ke Recycle Bin"
      :message='`Pindahkan berita "${modalTarget?.title || ""}" ke Recycle Bin? Berita tidak hilang permanen dan bisa dipulihkan kembali oleh Editor/Admin.`'
      confirm-text="Pindahkan"
      @confirm="confirmDelete"
      @cancel="modal.open = false"
    />
  </div>
</template>
