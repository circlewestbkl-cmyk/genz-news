<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { articleApi } from '../../api/articles'
import { chatApi, unreadCountFor } from '../../api/chat'
import { userApi } from '../../api/users'
import { auth } from '../../api/auth'
import { auditApi } from '../../api/audit'
import { categories, chipOf } from '../../api/categories'
import { formatDateTime, DEFAULT_IMAGE } from '../../utils/format'
import { statusInfo } from '../../data/articleStatus'
import { topArticlesByViews, viewsTrend, lastDays } from '../../utils/analytics'
import ConfirmModal from '../../components/ConfirmModal.vue'
import RevisionModal from '../../components/RevisionModal.vue'
import SchedulePublishModal from '../../components/SchedulePublishModal.vue'

const user = auth.current()

const articles = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')

// Badge pada kartu menu (gaya Android: titik notifikasi)
const pendingCount = ref(0)
const trashCount = ref(0)
const reviewCount = ref(0)
const readyScheduledCount = ref(0)
const chatUnread = ref(0)
const canReview = computed(() => user?.role === 'editor' || auth.hasPermission('publish'))

// Badge chat: pesan belum dibaca untuk user ini
let chatTimer = null
async function refreshChatUnread() {
  try {
    const msgs = await chatApi.list()
    chatUnread.value = unreadCountFor(msgs, user.username)
  } catch {
    /* server tidak aktif — abaikan */
  }
}

// Filter & pencarian
const searchQuery = ref('')
const statusFilter = ref('all')
const categoryFilter = ref('all')

const filteredArticles = computed(() => {
  let list = articles.value
  if (statusFilter.value !== 'all') {
    list = list.filter((a) => a.status === statusFilter.value)
  }
  if (categoryFilter.value !== 'all') {
    list = list.filter((a) => a.category === categoryFilter.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((a) =>
      `${a.title} ${a.excerpt || ''}`.toLowerCase().includes(q)
    )
  }
  return list
})

// Set id artikel yang dicentang untuk aksi hapus massal
const selected = ref(new Set())
const selectAllBox = ref(null)

// Artikel yang bisa dipilih untuk aksi massal (mengikuti izin canDelete)
const selectableArticles = computed(() => filteredArticles.value.filter(canDelete))

// Status checkbox "pilih semua" di header tabel
const allSelected = computed(() => {
  const list = selectableArticles.value
  return list.length > 0 && list.every((a) => selected.value.has(a.id))
})
const someSelected = computed(() => selectableArticles.value.some((a) => selected.value.has(a.id)))

// Tampilkan state "terpilih sebagian" (dash) di checkbox header
watch([allSelected, someSelected], () => {
  if (selectAllBox.value) {
    selectAllBox.value.indeterminate = someSelected.value && !allSelected.value
  }
})

function toggleSelect(id) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleSelectAll() {
  selected.value = allSelected.value
    ? new Set()
    : new Set(selectableArticles.value.map((a) => a.id))
}

const stats = computed(() => {
  const total = articles.value.length
  const published = articles.value.filter((a) => a.status === 'published').length
  const drafts = articles.value.filter((a) => a.status === 'draft').length
  const ready = articles.value.filter((a) => a.status === 'ready').length
  const scheduled = articles.value.filter((a) => a.status === 'scheduled').length
  const views = articles.value.reduce((sum, a) => sum + (a.views || 0), 0)
  return { total, published, drafts, ready, scheduled, views }
})

// ==== Analitik artikel: terpopuler 7 hari + tren pembaca ====
const ANALYTICS_DAYS = 7
const topArticles = computed(() =>
  topArticlesByViews(articles.value.filter((a) => a.status === 'published'), ANALYTICS_DAYS, 5)
)
// Total pembaca semua artikel per hari (7 hari terakhir) untuk bar chart
const totalTrend = computed(() => {
  const keys = lastDays(ANALYTICS_DAYS)
  const allPublished = articles.value.filter((a) => a.status === 'published')
  return keys.map((key) => {
    let value = 0
    for (const a of allPublished) {
      value += (a.viewsByDay && a.viewsByDay[key]) || 0
    }
    return { key, label: key.slice(5), value }
  })
})
const trendMax = computed(() => Math.max(1, ...totalTrend.value.map((d) => d.value)))
const weekViews = computed(() => totalTrend.value.reduce((s, d) => s + d.value, 0))

function viewsIn7(a) {
  const t = viewsTrend(a, 7)
  return t.reduce((s, d) => s + d.value, 0)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    // Kecualikan artikel yang ada di recycle bin
    articles.value = await articleApi.list({ notTrashed: true })
    // Badge menu: pendaftar menunggu verifikasi (admin)
    if (user?.role === 'admin' || auth.hasPermission('manageUsers')) {
      userApi.list().then((us) => {
        pendingCount.value = us.filter((u) => u.status === 'pending').length
      }).catch(() => {})
    }
    // Badge menu: recycle bin
    if (user?.role === 'admin' || user?.role === 'editor' || auth.hasPermission('manageTrash')) {
      articleApi.listTrashed().then((t) => (trashCount.value = t.length)).catch(() => {})
    }
    // Badge menu: antrean tinjauan editor
    if (canReview.value) {
      articleApi.list({ status: 'draft' }).then((ds) => {
        reviewCount.value = ds.filter(
          (a) => a.createdBy !== user.username && !(a.revisionNote && !a.revisionDoneAt)
        ).length
      }).catch(() => {})
      // Badge menu: artikel Siap Terbit + Terjadwal
      Promise.all([articleApi.listReady(), articleApi.listScheduled()])
        .then(([ready, scheduled]) => {
          readyScheduledCount.value = ready.length + scheduled.length
        })
        .catch(() => {})
    }
  } catch (e) {
    error.value = 'Gagal memuat data. Pastikan JSON Server berjalan (npm run server).'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  refreshChatUnread()
  chatTimer = setInterval(refreshChatUnread, 10000)
})

onBeforeUnmount(() => {
  if (chatTimer) clearInterval(chatTimer)
})

// Kartu menu ala layar Android (warna & ikon per fitur, difilter per role)
const menuItems = computed(() => {
  const items = []
  const push = (m) => items.push(m)

  push({ to: '/admin/berita-saya', label: 'Berita Saya', desc: 'Status tulisanmu', icon: '📰', iconBg: 'from-teal-400 to-emerald-600' })
  push({ to: '/admin/pesan', label: 'Chat Redaksi', desc: 'Ngobrol bareng tim', icon: '📨', iconBg: 'from-cyan-400 to-teal-600', badge: chatUnread.value || 0 })
  if (user?.role !== 'admin') {
    push({ to: '/admin/tulis', label: 'Tulis Berita', desc: 'Buat artikel baru', icon: '✍️', iconBg: 'from-sky-400 to-blue-600' })
  }
  if (canReview.value) {
    push({ to: '/admin/tinjauan', label: 'Perlu Ditinjau', desc: 'Antrean tulisan penulis', icon: '✅', iconBg: 'from-amber-400 to-orange-500', badge: reviewCount.value || 0 })
  }
  if (canReview.value) {
    push({ to: '/admin/siap-terbit', label: 'Siap Terbit', desc: 'Artikel siap & terjadwal', icon: '🚀', iconBg: 'from-fuchsia-400 to-purple-600', badge: readyScheduledCount.value || 0 })
  }
  if (user?.role === 'editor') {
    push({ to: '/admin/kategori', label: 'Kategori', desc: 'Tambah kategori baru', icon: '🏷️', iconBg: 'from-lime-400 to-green-600' })
  }
  push({ to: '/admin/interaksi', label: 'Interaksi Pembaca', desc: 'Komentar & reaksi', icon: '💬', iconBg: 'from-violet-400 to-purple-600' })
  if (user?.role === 'admin') {
    push({ to: '/admin/rekap-penghasilan', label: 'Rekap Penghasilan', desc: 'Penghasilan penulis', icon: '💰', iconBg: 'from-emerald-400 to-teal-600' })
  }
  if (user?.role === 'admin') {
    push({ to: '/admin/iklan', label: 'Kelola Iklan', desc: 'Gambar, link & jadwal iklan', icon: '📢', iconBg: 'from-amber-400 to-orange-500' })
  }
  if (user?.role === 'admin' || user?.role === 'editor' || auth.hasPermission('editAll')) {
    push({ to: '/admin/media', label: 'Manajemen Media', desc: 'Pustaka gambar artikel & iklan', icon: '🗂️', iconBg: 'from-pink-400 to-rose-600' })
  }
  if (user?.role === 'admin' || auth.hasPermission('manageUsers')) {
    push({ to: '/admin/users', label: 'Kelola User', desc: 'Tambah & atur akun', icon: '👥', iconBg: 'from-cyan-400 to-sky-600', badge: pendingCount.value || 0 })
  }
  if (user?.role === 'admin' || user?.role === 'editor' || auth.hasPermission('manageTrash')) {
    push({ to: '/admin/sampah', label: 'Recycle Bin', desc: 'Artikel terhapus', icon: '🗑️', iconBg: 'from-slate-400 to-slate-600', badge: trashCount.value || 0 })
  }
  if (user?.role === 'admin' || auth.hasPermission('viewAudit')) {
    push({ to: '/admin/audit', label: 'Audit Log', desc: 'Riwayat aktivitas', icon: '📋', iconBg: 'from-rose-400 to-red-500' })
  }
  push({ to: '/admin/profil', label: 'Profil Saya', desc: 'Foto profil & password', icon: '🪪', iconBg: 'from-sky-400 to-indigo-600' })
  push({ to: '/', label: 'Lihat Website', desc: 'Buka halaman publik', icon: '🌐', iconBg: 'from-indigo-400 to-blue-600' })
  return items
})

// Izin granular: "editAll" & "delete" bisa diberikan Admin ke user mana pun.
// Editor mendapat keduanya dari role; Penulis hanya untuk berita miliknya;
// Admin bisa menghapus berita (single & multiple), tapi tidak bisa menulis/mengedit.
function canEdit(a) {
  if (!user) return false
  if (auth.hasPermission('editAll')) return true
  if (user.role === 'admin') return false
  return a.createdBy === user.username
}

function canDelete(a) {
  if (!user) return false
  if (auth.hasPermission('delete')) return true
  // Admin juga bisa menghapus berita (single & multiple delete)
  if (user.role === 'admin') return true
  // Penulis: hanya boleh menghapus draft miliknya — artikel yang sudah terbit
  // tidak bisa dihapus / dipindah ke Recycle Bin.
  return a.createdBy === user.username && a.status === 'draft'
}

// Modal konfirmasi hapus
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
    // Soft delete: pindahkan ke recycle bin (bisa dipulihkan Admin)
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

// Modal konfirmasi hapus massal (soft delete → recycle bin)
const bulkModal = ref({ open: false, loading: false })

function askBulkDelete() {
  if (!selected.value.size) return
  bulkModal.value = { open: true, loading: false }
}

async function confirmBulkDelete() {
  if (!selected.value.size) return
  bulkModal.value.loading = true
  const ids = [...selected.value]
  try {
    for (const id of ids) {
      const article = articles.value.find((a) => a.id === id)
      await articleApi.trash(id)
      if (article) {
        auditApi.log('article_trash', `Berita "${article.title}" dipindah ke recycle bin`)
      }
    }
    articles.value = articles.value.filter((a) => !selected.value.has(a.id))
    // Jaga badge Recycle Bin tetap aktual
    if (user?.role === 'admin' || user?.role === 'editor' || auth.hasPermission('manageTrash')) {
      trashCount.value += ids.length
    }
    bulkModal.value.open = false
    selected.value = new Set()
    toast.value = `${ids.length} berita dipindahkan ke Recycle Bin.`
  } catch {
    toast.value = 'Gagal menghapus sebagian atau seluruh berita.'
  } finally {
    bulkModal.value.loading = false
    setTimeout(() => (toast.value = ''), 3000)
  }
}

// Toggle Headline Utama (Editor's Pick) — hanya untuk artikel yang sudah terbit
const featuringId = ref(null)
async function toggleFeatured(a) {
  if (a.status !== 'published') return
  featuringId.value = a.id
  try {
    const next = !a.featured
    await articleApi.setFeatured(a.id, next)
    auditApi.log('article_featured', `Berita \"${a.title}\" ${next ? 'dijadikan' : 'tidak lagi menjadi'} Headline Utama`)
    a.featured = next
    toast.value = next ? `"${a.title}" kini Headline Utama ⭐` : `"${a.title}" dilepas dari Headline Utama`
  } catch {
    toast.value = 'Gagal mengubah status Headline Utama.'
  } finally {
    featuringId.value = null
    setTimeout(() => (toast.value = ''), 3000)
  }
}

// Modal minta revisi (editor → penulis)
const revisionModal = ref({ open: false, loading: false })
const revisionTarget = ref(null)

function askRevision(article) {
  revisionTarget.value = article
  revisionModal.value = { open: true, loading: false }
}

async function confirmRevision(note) {
  if (!revisionTarget.value) return
  if (!note) {
    toast.value = 'Tulis keterangan revisi dulu.'
    setTimeout(() => (toast.value = ''), 3000)
    return
  }
  revisionModal.value.loading = true
  try {
    await articleApi.requestRevision(revisionTarget.value.id, { note, by: user.username })
    auditApi.log('article_revision', `Revisi diminta untuk berita "${revisionTarget.value.title}"`)
    // Perbarui baris di daftar agar chip indikator langsung muncul
    revisionTarget.value.revisionNote = note
    revisionTarget.value.revisionRequestedBy = user.username
    revisionTarget.value.revisionDoneAt = null
    revisionModal.value.open = false
    toast.value = 'Permintaan revisi terkirim ke penulis.'
  } catch {
    toast.value = 'Gagal mengirim permintaan revisi.'
  } finally {
    revisionModal.value.loading = false
    revisionTarget.value = null
    setTimeout(() => (toast.value = ''), 3000)
  }
}

// Modal terbitkan / jadwalkan (draft/ready/scheduled → published atau scheduled)
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
    auditApi.log('article_publish', `Berita "${publishTarget.value.title}" diterbitkan dari dashboard`)
    publishModal.value.open = false
    toast.value = `Berita "${publishTarget.value.title}" berhasil diterbitkan.`
    await load()
  } catch {
    toast.value = 'Gagal menerbitkan berita.'
  } finally {
    publishModal.value.loading = false
    publishTarget.value = null
    setTimeout(() => (toast.value = ''), 3000)
  }
}

async function confirmSchedule(iso) {
  if (!publishTarget.value) return
  publishModal.value.loading = true
  try {
    await articleApi.schedule(publishTarget.value.id, iso)
    auditApi.log('article_schedule', `Berita "${publishTarget.value.title}" dijadwalkan terbit ${formatDateTime(iso)}`)
    publishModal.value.open = false
    toast.value = `Berita "${publishTarget.value.title}" dijadwalkan terbit ${formatDateTime(iso)}.`
    await load()
  } catch {
    toast.value = 'Gagal menjadwalkan berita.'
  } finally {
    publishModal.value.loading = false
    publishTarget.value = null
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

    <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Backoffice ✦ Y2K</p>
        <h1 class="font-groovy font-black text-2xl sm:text-3xl text-link-700">Dashboard 📊</h1>
        <p class="text-slate-500 text-sm mt-1 font-semibold">Kelola seluruh berita di Gen Z News.</p>
      </div>
      <router-link
        v-if="user?.role !== 'admin'"
        to="/admin/tulis"
        class="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white rounded-full px-6 py-3 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Tulis Berita
      </router-link>
    </div>

    <!-- Menu ala Android -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-10">
      <router-link
        v-for="m in menuItems"
        :key="m.to + m.label"
        :to="m.to"
        class="relative group y2k-card y2k-card-hover p-4 flex flex-col gap-3 hover:border-brand-600"
      >
        <span
          v-if="m.badge"
          class="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold grid place-items-center shadow-sm"
        >
          {{ m.badge }}
        </span>
        <span
          class="w-12 h-12 rounded-2xl bg-gradient-to-br text-2xl grid place-items-center text-white border-2 border-link-700 shadow-[2px_2px_0_#2a1038] group-hover:scale-110 group-hover:-rotate-6 transition-transform"
          :class="m.iconBg"
        >
          {{ m.icon }}
        </span>
        <div>
          <p class="font-bold text-sm text-slate-900 leading-tight">{{ m.label }}</p>
          <p class="text-[11px] text-slate-400 mt-0.5 leading-snug">{{ m.desc }}</p>
        </div>
      </router-link>
    </div>

    <!-- Statistik -->
    <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      <div class="bg-grape-100 border-2 border-link-700 rounded-2xl p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-grape-600">🗞️ Total Berita</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.total }}</p>
      </div>
      <div class="bg-emerald-50 border-2 border-link-700 rounded-2xl p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-emerald-600">✅ Terbit</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.published }}</p>
      </div>
      <div class="bg-teal-50 border-2 border-link-700 rounded-2xl p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-teal-600">🚀 Siap Terbit</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.ready }}</p>
      </div>
      <div class="bg-violet-50 border-2 border-link-700 rounded-2xl p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-violet-600">📅 Terjadwal</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.scheduled }}</p>
      </div>
      <div class="bg-amber-50 border-2 border-link-700 rounded-2xl p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-amber-600">📝 Draft</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.drafts }}</p>
      </div>
      <div class="bg-brand-50 border-2 border-link-700 rounded-2xl p-5 shadow-[4px_4px_0_#2a1038]">
        <p class="text-xs font-extrabold uppercase tracking-wide text-brand-600">👁️ Total Pembaca</p>
        <p class="font-groovy font-black text-3xl text-link-700 mt-1">{{ stats.views.toLocaleString('id-ID') }}</p>
      </div>
    </div>

    <!-- Analitik artikel: tren 7 hari + terpopuler -->
    <div v-if="!loading && topArticles.length" class="grid lg:grid-cols-5 gap-6 mb-8">
      <!-- Bar chart tren pembaca 7 hari -->
      <div class="lg:col-span-2 bg-white rounded-2xl border-2 border-link-700 p-5 shadow-[4px_4px_0_#2a1038]">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="font-groovy font-black text-sm text-link-700">📈 Pembaca 7 Hari Terakhir</h3>
          <span class="text-[11px] font-bold text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2.5 py-1">{{ weekViews.toLocaleString('id-ID') }} total</span>
        </div>
        <div class="flex items-end gap-1.5 h-28">
          <div v-for="d in totalTrend" :key="d.key" class="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <span class="text-[9px] font-bold text-slate-400 tabular-nums">{{ d.value || '' }}</span>
            <div
              class="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-acid-400 border border-link-700/30 transition-all"
              :style="{ height: Math.max(3, (d.value / trendMax) * 100) + '%' }"
              :title="d.label + ': ' + d.value + ' pembaca'"
            ></div>
            <span class="text-[9px] font-bold text-slate-400 truncate">{{ d.label }}</span>
          </div>
        </div>
        <p class="text-[10px] text-slate-400 mt-3">Berdasarkan pembacaan artikel terbit (viewsByDay).</p>
      </div>

      <!-- Artikel terpopuler 7 hari -->
      <div class="lg:col-span-3 bg-white rounded-2xl border-2 border-link-700 overflow-hidden shadow-[4px_4px_0_#2a1038]">
        <div class="px-5 py-4 border-b-2 border-slate-200 bg-brand-50/40">
          <h3 class="font-groovy font-black text-sm text-link-700">🔥 Artikel Terpopuler (7 Hari)</h3>
        </div>
        <ol class="divide-y divide-slate-100">
          <li v-for="(a, i) in topArticles" :key="a.id" class="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40 transition-colors">
            <span
              class="font-groovy font-black text-xl w-7 text-center shrink-0"
              :class="i === 0 ? 'gradient-text' : 'text-outline opacity-50'"
            >
              {{ i + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-bold text-sm text-slate-800 truncate">
                <router-link
                  :to="{ name: 'admin-edit', params: { id: a.id } }"
                  class="hover:text-brand-600 transition-colors"
                >
                  {{ a.title }}
                </router-link>
              </p>
              <p class="text-[11px] font-semibold text-slate-400 truncate">
                {{ a.category }} • oleh {{ a.author || a.createdBy }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="font-groovy font-black text-lg text-link-700 tabular-nums">
                {{ viewsIn7(a).toLocaleString('id-ID') }}
              </p>
              <p class="text-[10px] font-bold text-slate-400">dibaca / 7 hari</p>
            </div>
          </li>
        </ol>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-2xl px-5 py-4 text-sm font-semibold mb-6 shadow-[3px_3px_0_#b45309]">
      {{ error }}
    </div>

    <!-- Filter & pencarian -->
    <div class="bg-white rounded-2xl border-2 border-link-700 p-4 mb-6 flex flex-wrap items-center gap-3 shadow-[4px_4px_0_#2a1038]">
      <div class="relative flex-1 min-w-[200px]">
        <svg class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Cari judul berita..."
          class="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      <select
        v-model="statusFilter"
        class="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-brand-600"
      >
        <option value="all">Semua Status</option>
        <option value="published">Terbit</option>
        <option value="ready">Siap Terbit</option>
        <option value="scheduled">Terjadwal</option>
        <option value="draft">Draft</option>
      </select>
      <select
        v-model="categoryFilter"
        class="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-brand-600"
      >
        <option value="all">Semua Kategori</option>
        <option v-for="c in categories" :key="c.name" :value="c.name">{{ c.name }}</option>
      </select>
    </div>

    <!-- Tabel berita -->
    <div class="bg-white rounded-2xl border-2 border-link-700 overflow-hidden shadow-[5px_5px_0_#2a1038]">
      <div class="px-5 py-4 border-b-2 border-slate-200 bg-brand-50/40 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <label
            v-if="selectableArticles.length"
            class="flex items-center gap-2.5 cursor-pointer select-none"
            title="Pilih semua berita yang tampil"
          >
            <input
              ref="selectAllBox"
              type="checkbox"
              :checked="allSelected"
              @change="toggleSelectAll"
              class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600 cursor-pointer"
            />
            <h2 class="font-groovy font-black text-lg text-link-700 truncate">📰 Daftar Berita</h2>
          </label>
          <h2 v-else class="font-groovy font-black text-lg text-link-700">📰 Daftar Berita</h2>
        </div>
        <span class="text-xs font-bold text-slate-500 shrink-0">{{ filteredArticles.length }} item</span>
      </div>

      <!-- Bar aksi hapus massal -->
      <div
        v-if="selected.size"
        class="px-5 py-3 bg-brand-50 border-b border-brand-100 flex flex-wrap items-center justify-between gap-3"
      >
        <p class="text-sm font-semibold text-brand-800">{{ selected.size }} berita dipilih</p>
        <div class="flex items-center gap-2">
          <button
            @click="selected = new Set()"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
          >
            Batal Pilih
          </button>
          <button
            @click="askBulkDelete"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Hapus Terpilih
          </button>
        </div>
      </div>

      <div v-if="loading" class="divide-y divide-slate-100">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4 p-4 animate-pulse">
          <div class="w-16 h-12 bg-slate-200 rounded-lg"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-slate-200 rounded w-2/3"></div>
            <div class="h-3 bg-slate-200 rounded w-1/3"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!filteredArticles.length" class="text-center py-16 text-slate-400">
        <p class="text-4xl mb-3">📭</p>
        <p v-if="articles.length">Tidak ada berita yang cocok dengan filter/pencarian.</p>
        <p v-else>Belum ada berita. Klik "Tulis Berita" untuk membuat yang pertama.</p>
      </div>

      <div v-else class="divide-y divide-slate-200">
        <div v-for="a in filteredArticles" :key="a.id" class="flex items-center gap-4 p-4 hover:bg-brand-50/40 transition-colors">
          <input
            v-if="canDelete(a)"
            type="checkbox"
            :checked="selected.has(a.id)"
            @change="toggleSelect(a.id)"
            class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600 shrink-0"
            :title="'Pilih: ' + a.title"
          />
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
                v-if="a.revisionNote"
                class="text-xs px-2 py-0.5 rounded font-semibold border"
                :class="a.revisionDoneAt ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'"
                :title="a.revisionDoneAt ? 'Penulis sudah merevisi — tinjau ulang' : 'Editor meminta revisi'"
              >
                {{ a.revisionDoneAt ? 'Siap Ditinjau' : 'Revisi' }}
              </span>
            </div>
            <p class="font-semibold text-slate-900 truncate">
              {{ a.title }}
              <span v-if="a.featured" class="ml-1.5 text-[10px] font-groovy font-black uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-1.5 py-0.5 align-middle">⭐ Headline</span>
            </p>
            <p class="text-xs text-slate-400 mt-0.5">
              <template v-if="a.status === 'scheduled' && a.scheduledAt">
                📅 Terbit otomatis {{ formatDateTime(a.scheduledAt) }}
              </template>
              <template v-else>
                {{ formatDateTime(a.publishedAt) }} • {{ a.views?.toLocaleString('id-ID') }}x dibaca
              </template>
              <span v-if="a.createdBy"> • oleh <span class="font-medium text-slate-500">{{ a.createdBy }}</span></span>
              <span v-if="user?.role === 'writer' && a.createdBy === user.username" class="text-emerald-600 font-semibold"> (milik saya)</span>
            </p>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              v-if="a.status === 'published'"
              @click="toggleFeatured(a)"
              :disabled="featuringId === a.id"
              :title="a.featured ? 'Lepas dari Headline Utama' : 'Jadikan Headline Utama (tampil besar di beranda)'"
              class="px-2.5 py-1.5 rounded text-xs font-bold border transition-colors disabled:opacity-50"
              :class="a.featured ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-600 hover:text-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-600'"
            >
              {{ a.featured ? '⭐ Headline' : '⭐ Jadikan Headline' }}
            </button>
            <button
              v-if="a.status === 'draft' && auth.hasPermission('publish')"
              @click="askRevision(a)"
              title="Minta revisi ke penulis"
              class="px-2.5 py-1.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white transition-colors"
            >
              Minta Revisi
            </button>
            <button
              v-if="a.status !== 'published' && auth.hasPermission('publish')"
              @click="askPublish(a)"
              title="Terbitkan"
              class="px-2.5 py-1.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-colors"
            >
              Terbitkan
            </button>
            <router-link
              :to="a.status === 'published' ? { name: 'article', params: { id: a.id } } : { name: 'preview', params: { id: a.id } }"
              target="_blank"
              :title="a.status === 'published' ? 'Lihat' : 'Pratinjau draft'"
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
              v-if="canDelete(a)"
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

    <!-- Info kategori -->
    <p class="mt-6 text-xs text-slate-400">
      Kategori tersedia: {{ categories.map((c) => c.name).join(', ') }}
    </p>

    <!-- Modal konfirmasi pindah ke recycle bin -->
    <ConfirmModal
      :open="modal.open"
      :loading="modal.loading"
      variant="danger"
      title="Pindah ke Recycle Bin"
      :message='`Pindahkan berita "${modalTarget?.title || ""}" ke Recycle Bin? Berita tidak hilang permanen dan bisa dipulihkan kembali oleh Admin.`'
      confirm-text="Pindahkan"
      @confirm="confirmDelete"
      @cancel="modal.open = false"
    />

    <!-- Modal konfirmasi hapus massal -->
    <ConfirmModal
      :open="bulkModal.open"
      :loading="bulkModal.loading"
      variant="danger"
      title="Pindahkan ke Recycle Bin"
      :message='`Pindahkan ${selected.size} berita terpilih ke Recycle Bin? Berita tidak hilang permanen dan bisa dipulihkan kembali.`'
      confirm-text="Pindahkan"
      @confirm="confirmBulkDelete"
      @cancel="bulkModal.open = false"
    />

    <!-- Modal terbitkan / jadwalkan -->
    <SchedulePublishModal
      :open="publishModal.open"
      :loading="publishModal.loading"
      :article="publishTarget"
      @publish="confirmPublish"
      @schedule="confirmSchedule"
      @cancel="publishModal.open = false"
    />

    <!-- Modal minta revisi ke penulis -->
    <RevisionModal
      :open="revisionModal.open"
      :loading="revisionModal.loading"
      :note="revisionTarget?.revisionNote || ''"
      :message='`Kirim keterangan revisi untuk berita "${revisionTarget?.title || ""}". Penulis akan melihat pesan ini di halaman Berita Saya dan saat mengedit draft.`'
      confirm-text="Kirim Permintaan Revisi"
      @confirm="confirmRevision"
      @cancel="revisionModal.open = false"
    />
  </div>
</template>
