<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { articleApi } from '../../api/articles'
import { auth } from '../../api/auth'
import { auditApi } from '../../api/audit'
import { notifyArticleCreated } from '../../api/notifications'
import { categories, loadCategories } from '../../api/categories'
import { slugify, formatDateTime, toDateTimeLocal, fromDateTimeLocal, defaultScheduleValue, DEFAULT_IMAGE } from '../../utils/format'
import { renderContent } from '../../utils/content'
import { compressImage } from '../../utils/image'
import ConfirmModal from '../../components/ConfirmModal.vue'
import MediaPickerModal from '../../components/MediaPickerModal.vue'

// Kunci autosave per artikel (draft baru) — tersimpan di localStorage agar
// tidak hilang walau halaman tertutup / browser dimuat ulang.
const AUTOSAVE_KEY = 'genz_article_draft'
const AUTOSAVE_DELAY = 800

const user = auth.current()
// Nama pena dari pendaftaran — kolom Penulis otomatis terisi & tidak bisa diubah
const penName = (user?.penName || '').trim()

const props = defineProps({
  id: { type: [String, Number], default: null },
})

const router = useRouter()
const isEdit = computed(() => props.id != null)

// Kolom Penulis terkunci: saat menulis baru memakai nama pena sendiri;
// saat mengedit, nama penulis asli (penulis artikel) tidak boleh diganti —
// termasuk oleh Editor yang sedang mengedit tulisan penulis.
const authorLocked = computed(() => !!penName || isEdit.value)

const form = ref({
  title: '',
  category: '',
  author: penName,
  coverImage: '',
  excerpt: '',
  content: '',
  tags: '',
  status: 'published',
  scheduledAt: '', // nilai datetime-local (waktu lokal) — dipakai saat status = scheduled
})

// Status artikel saat dimuat (untuk tahu transisi status → published)
const originalStatus = ref(null)

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const forbidden = ref(false)

// Pesan revisi dari Editor (muncul saat penulis mengedit draft)
const revisionInfo = ref(null)

// Unggah gambar (kompresi via canvas → data URL)
const uploadingImage = ref(false)
const imageError = ref('')

async function onUploadImage(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // agar file yang sama bisa dipilih ulang
  if (!file) return
  if (!file.type.startsWith('image/')) {
    imageError.value = 'File harus berupa gambar (JPG/PNG/WebP).'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    imageError.value = 'Ukuran gambar maksimal 5MB.'
    return
  }
  uploadingImage.value = true
  imageError.value = ''
  try {
    form.value.coverImage = await compressImage(file)
  } catch (err) {
    imageError.value = err.message || 'Gagal memproses gambar.'
  } finally {
    uploadingImage.value = false
  }
}

// Peringatan saat meninggalkan halaman dengan perubahan belum disimpan
const dirty = ref(false)
const leavingClean = ref(false)

// ==== Autosave draft (localStorage) — hanya untuk artikel baru ====
const lastAutosave = ref('')
const autosaveTimer = ref(null)
const restoredDraft = ref(false)

function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    /* abaikan */
  }
}

function scheduleAutosave() {
  if (isEdit.value) return // hanya draft baru yang di-autosave
  if (autosaveTimer.value) clearTimeout(autosaveTimer.value)
  autosaveTimer.value = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(form.value))
      lastAutosave.value = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    } catch {
      /* localStorage penuh — abaikan */
    }
  }, AUTOSAVE_DELAY)
}

watch(
  form,
  () => {
    if (!leavingClean.value) dirty.value = true
    scheduleAutosave()
  },
  { deep: true }
)

function onBeforeUnload(e) {
  if (dirty.value && !leavingClean.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
window.addEventListener('beforeunload', onBeforeUnload)

onBeforeRouteLeave(() => {
  if (dirty.value && !leavingClean.value) {
    return window.confirm('Perubahan belum disimpan. Yakin ingin meninggalkan halaman ini?')
  }
  return true
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (autosaveTimer.value) clearTimeout(autosaveTimer.value)
})

// Modal sukses saat tulisan diterbitkan
const successModal = ref({ open: false, title: '', message: '' })
const savedArticleId = ref(null)

function viewArticle() {
  if (savedArticleId.value) {
    router.push({ name: 'article', params: { id: savedArticleId.value } })
  } else {
    router.push({ name: 'admin-dashboard' })
  }
}

function goDashboard() {
  router.push({ name: 'admin-dashboard' })
}

const wordCount = computed(() => (form.value.content.trim().split(/\s+/).filter(Boolean).length))
const contentPreview = computed(() =>
  form.value.content.split(/\n\s*\n/).filter((p) => p.trim())
)

// Pemilih gambar dari Pustaka Media
const mediaPickerOpen = ref(false)
function pickFromMedia(url) {
  form.value.coverImage = url
  mediaPickerOpen.value = false
}

onMounted(async () => {
  // Muat kategori dinamis untuk dropdown; isi default kategori baru
  await loadCategories().catch(() => {})
  if (!isEdit.value && !form.value.category && categories.value.length) {
    form.value.category = categories.value[0].name
    dirty.value = false
  }
  // Autosave: pulihkan draft baru yang tersimpan (hanya jika belum pernah disimpan)
  if (!isEdit.value) {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved && typeof saved === 'object' && (saved.title || saved.content)) {
          form.value = { ...form.value, ...saved }
          restoredDraft.value = true
          lastAutosave.value = 'tersimpan'
        }
      }
    } catch {
      /* draft rusak — abaikan */
    }
  }
  if (!isEdit.value) return
  loading.value = true
  try {
    const article = await articleApi.get(props.id)
    // Penulis hanya boleh mengedit berita miliknya sendiri,
    // kecuali diberi izin granular "editAll"
    if (
      user?.role === 'writer' &&
      !auth.hasPermission('editAll') &&
      article.createdBy !== user.username
    ) {
      forbidden.value = true
      loading.value = false
      return
    }
    form.value = {
      title: article.title,
      category: article.category,
      // Edit: nama pena tetap penulis aslinya, bukan nama editor yang mengedit
      author: article.author || penName,
      coverImage: article.coverImage || '',
      excerpt: article.excerpt || '',
      content: article.content || '',
      tags: (article.tags || []).join(', '),
      status: article.status || 'published',
      scheduledAt: toDateTimeLocal(article.scheduledAt) || defaultScheduleValue(1),
    }
    originalStatus.value = article.status || 'published'
    revisionInfo.value = article.revisionNote
      ? {
          note: article.revisionNote,
          by: article.revisionRequestedBy || 'Editor',
          at: article.revisionRequestedAt || '',
        }
      : null
    dirty.value = false
  } catch {
    error.value = 'Berita tidak ditemukan.'
  } finally {
    loading.value = false
  }
})

async function save() {
  error.value = ''
  if (!form.value.title.trim()) {
    error.value = 'Judul berita wajib diisi.'
    return
  }
  if (!form.value.content.trim()) {
    error.value = 'Isi berita wajib diisi.'
    return
  }
  if (!form.value.author.trim()) {
    error.value = 'Nama penulis wajib diisi.'
    return
  }

  // Tanpa izin "publish", artikel selalu disimpan sebagai draft
  // (diterbitkan oleh Editor/Admin atau user yang diberi izin).
  const finalStatus = auth.hasPermission('publish') ? form.value.status : 'draft'

  // Validasi jadwal terbit: wajib diisi & di masa depan
  if (finalStatus === 'scheduled') {
    const iso = fromDateTimeLocal(form.value.scheduledAt)
    if (!iso) {
      error.value = 'Pilih tanggal & jam terbit untuk artikel terjadwal.'
      return
    }
    if (new Date(iso).getTime() <= Date.now()) {
      error.value = 'Waktu terbit harus di masa depan.'
      return
    }
  }

  saving.value = true
  const payload = {
    title: form.value.title.trim(),
    slug: slugify(form.value.title),
    category: form.value.category,
    author: form.value.author.trim(),
    coverImage: form.value.coverImage.trim() || DEFAULT_IMAGE,
    excerpt: form.value.excerpt.trim(),
    content: form.value.content.trim(),
    tags: form.value.tags.split(',').map((t) => t.trim()).filter(Boolean),
    status: finalStatus,
  }

  // Status yang sudah "disetujui" (terbit/siap terbit/terjadwal): pesan revisi tidak relevan lagi
  if (finalStatus === 'scheduled') {
    payload.scheduledAt = fromDateTimeLocal(form.value.scheduledAt)
    payload.revisionNote = ''
    payload.revisionRequestedAt = null
    payload.revisionRequestedBy = null
    payload.revisionDoneAt = null
    // Transisi dari draft/ready → terjadwal: publishedAt diisi saat benar-benar terbit nanti
  } else if (finalStatus === 'published') {
    payload.scheduledAt = null
    payload.revisionNote = ''
    payload.revisionRequestedAt = null
    payload.revisionRequestedBy = null
    payload.revisionDoneAt = null
    // Artikel yang tadinya belum terbit kini diterbitkan → perbarui waktu terbit
    if (!isEdit.value || originalStatus.value !== 'published') {
      payload.publishedAt = new Date().toISOString()
    }
  } else if (finalStatus === 'ready') {
    payload.scheduledAt = null
    payload.revisionNote = ''
    payload.revisionRequestedAt = null
    payload.revisionRequestedBy = null
    payload.revisionDoneAt = null
  } else if (revisionInfo.value) {
    // Draft yang tadinya diminta revisi dan kini disimpan penulis
    // ditandai selesai → editor tahu untuk meninjau ulang.
    payload.revisionDoneAt = new Date().toISOString()
  }

  try {
    let savedId = null
    if (isEdit.value) {
      await articleApi.update(props.id, payload)
      savedId = props.id
    } else {
      payload.publishedAt = new Date().toISOString()
      payload.views = 0
      payload.createdBy = user?.username || 'admin'
      const created = await articleApi.create(payload)
      savedId = created.id
      // Kirim notifikasi ke Editor setiap penulis membuat tulisan
      if (user?.role === 'writer') {
        await notifyArticleCreated({ articleId: created.id, title: payload.title })
      }
    }
    saving.value = false
    leavingClean.value = true
    clearAutosave()
    auditApi.log(
      isEdit.value ? 'article_update' : 'article_create',
      `Berita "${payload.title}" disimpan (${finalStatus === 'published' ? 'terbit' : finalStatus === 'ready' ? 'siap terbit' : finalStatus === 'scheduled' ? 'terjadwal' : 'draft'})`
    )
    if (finalStatus === 'published') {
      auditApi.log('article_publish', `Berita "${payload.title}" diterbitkan`)
      savedArticleId.value = savedId
      successModal.value = {
        open: true,
        title: 'Berhasil Diterbitkan',
        message: `Tulisan dengan judul "${payload.title}" berhasil diterbitkan dan tampil di website.`,
      }
    } else if (finalStatus === 'scheduled') {
      auditApi.log('article_schedule', `Berita "${payload.title}" dijadwalkan terbit ${formatDateTime(payload.scheduledAt)}`)
      savedArticleId.value = null
      successModal.value = {
        open: true,
        title: 'Terbit Dijadwalkan 📅',
        message: `Artikel "${payload.title}" akan otomatis terbit pada ${formatDateTime(payload.scheduledAt)}.`,
      }
    } else if (finalStatus === 'ready') {
      auditApi.log('article_ready', `Berita "${payload.title}" ditandai Siap Terbit`)
      savedArticleId.value = null
      successModal.value = {
        open: true,
        title: 'Disimpan Siap Terbit 🚀',
        message: `Artikel "${payload.title}" tersimpan di halaman Siap Terbit dan belum tampil di website.`,
      }
    } else {
      router.push({ name: 'admin-dashboard' })
    }
  } catch (e) {
    error.value = 'Gagal menyimpan berita. Pastikan JSON Server berjalan (npm run server).'
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">
          {{ isEdit ? 'Edit Berita' : 'Tulis Berita Baru' }}
        </h1>
        <p class="text-slate-500 text-sm mt-1">
          {{ isEdit ? 'Perbarui konten berita yang sudah ada.' : 'Lengkapi formulir di bawah untuk menerbitkan berita.' }}
        </p>
      </div>
      <div class="flex items-center gap-4">
        <router-link
          v-if="isEdit"
          :to="{ name: 'preview', params: { id: props.id } }"
          target="_blank"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Pratinjau
        </router-link>
        <router-link to="/admin" class="text-sm text-slate-500 hover:text-brand-600 font-medium">
          ← Kembali
        </router-link>
      </div>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 4" :key="i" class="bg-slate-200 animate-pulse rounded-lg h-16"></div>
    </div>

    <!-- Tidak berhak mengedit -->
    <div v-else-if="forbidden" class="bg-white border border-red-200 rounded-lg p-8 text-center">
      <p class="text-4xl mb-3">🔒</p>
      <h2 class="font-display font-bold text-lg text-slate-900 mb-1">Kamu tidak berhak mengedit berita ini</h2>
      <p class="text-sm text-slate-500 mb-5">Sebagai penulis, kamu hanya bisa mengedit berita yang kamu buat sendiri.</p>
      <router-link to="/admin" class="text-sm font-bold text-brand-600 hover:underline">← Kembali ke Dashboard</router-link>
    </div>

    <!-- Indikator autosave draft (hanya artikel baru) -->
    <div
      v-if="!isEdit && (restoredDraft || lastAutosave)"
      class="mb-6 flex flex-wrap items-center gap-2 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg px-4 py-2.5 text-xs font-semibold"
    >
      <span>💾 Draft tersimpan otomatis di browser{{ lastAutosave ? ' • ' + lastAutosave : '' }}.</span>
      <span v-if="restoredDraft" class="text-teal-700">Perubahan yang belum disimpan sebelumnya sudah dipulihkan.</span>
      <button
        type="button"
        @click="clearAutosave(); restoredDraft = false; lastAutosave = ''; form.title = ''; form.content = ''; form.excerpt = ''; form.coverImage = ''; form.tags = '';"
        class="ml-auto text-teal-700 underline hover:text-teal-900"
      >
        Buang draft &amp; mulai baru
      </button>
    </div>

    <!-- Banner permintaan revisi dari Editor (tetap tampil bersama form) -->
    <div
      v-if="revisionInfo"
      class="mb-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-5 py-4 text-sm"
    >
      <p class="font-bold mb-1">📝 Permintaan revisi dari {{ revisionInfo.by }}</p>
      <p class="text-rose-700 leading-relaxed">{{ revisionInfo.note }}</p>
      <p v-if="revisionInfo.at" class="text-xs text-rose-400 mt-1">
        {{ formatDateTime(revisionInfo.at) }} — perbaiki lalu simpan, Editor akan meninjaunya kembali.
      </p>
    </div>

    <form class="space-y-6" @submit.prevent="save">
      <div class="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <!-- Judul -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">Judul Berita <span class="text-red-500">*</span></label>
          <input
            v-model="form.title"
            type="text"
            placeholder="Contoh: Startup Lokal Raih Pendanaan Rp 1 Triliun"
            class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
          <p class="text-xs text-slate-400 mt-1">Slug otomatis: <span class="font-mono">{{ slugify(form.title) || '—' }}</span></p>
        </div>

        <!-- Baris: kategori, penulis, status -->
        <div class="grid sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Kategori</label>
            <select
              v-model="form.category"
              class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            >
              <option v-for="c in categories" :key="c.name" :value="c.name">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Penulis <span class="text-red-500">*</span></label>
            <input
              v-model="form.author"
              type="text"
              :disabled="authorLocked"
              :placeholder="authorLocked ? penName : 'Nama penulis'"
              class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            <p v-if="authorLocked" class="text-xs text-slate-400 mt-1">
              ✍️ {{ isEdit ? 'Nama pena penulis asli — tidak bisa diubah.' : 'Nama pena dari pendaftaran — tidak bisa diubah.' }}
            </p>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
            <select
              v-model="form.status"
              :disabled="!auth.hasPermission('publish')"
              class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="published">Terbit</option>
              <option value="ready">Siap Terbit</option>
              <option value="scheduled">Terjadwal</option>
              <option value="draft">Draft</option>
            </select>
            <p v-if="!auth.hasPermission('publish')" class="text-xs text-amber-600 mt-1">
              Tanpa izin "Terbitkan berita", artikel disimpan sebagai draft dan menunggu persetujuan Editor/Admin.
            </p>
            <p v-else-if="form.status === 'ready'" class="text-xs text-teal-600 mt-1">
              🚀 Artikel tersimpan di halaman <b>Siap Terbit</b> dan belum tampil di website sampai diterbitkan.
            </p>
            <p v-else-if="form.status === 'scheduled'" class="text-xs text-violet-600 mt-1">
              📅 Artikel akan otomatis terbit sesuai tanggal &amp; jam di bawah.
            </p>
          </div>
        </div>

        <!-- Jadwal terbit otomatis (hanya untuk status Terjadwal) -->
        <div
          v-if="form.status === 'scheduled'"
          class="rounded-xl border-2 border-violet-200 bg-violet-50/60 p-4"
        >
          <label class="block text-sm font-semibold text-violet-800 mb-1.5">
            📅 Jadwal Terbit Otomatis <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.scheduledAt"
            type="datetime-local"
            class="w-full sm:w-auto border border-slate-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20"
          />
          <p class="text-xs text-violet-700/80 mt-1.5">
            Artikel belum tampil di website sampai waktu ini tiba — setelah itu otomatis terbit tanpa tindakan apa pun.
          </p>
        </div>

        <!-- Gambar sampul -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">URL Gambar Sampul</label>
          <input
            v-model="form.coverImage"
            type="url"
            placeholder="https://contoh.com/gambar.jpg (opsional, kosongkan untuk gambar default)"
            class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
          <div class="mt-3 flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <label
                class="cursor-pointer inline-flex items-center gap-2 self-start border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ uploadingImage ? 'Memproses gambar...' : 'Unggah Gambar' }}
                <input type="file" accept="image/*" class="hidden" @change="onUploadImage" :disabled="uploadingImage" />
              </label>
              <button
                type="button"
                @click="mediaPickerOpen = true"
                class="inline-flex items-center gap-2 self-start border border-slate-300 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-colors"
              >
                🗂️ Pilih dari Media
              </button>
            </div>
            <p class="text-xs text-slate-400">Maks 5MB — gambar otomatis dikompres & diubah jadi data URL (opsional, bisa juga pakai URL di atas atau pilih dari pustaka media).</p>
            <p v-if="imageError" class="text-xs text-red-600">{{ imageError }}</p>
            <div class="rounded-lg overflow-hidden aspect-[16/7] bg-slate-100 border border-slate-200">
              <img
                :src="form.coverImage || DEFAULT_IMAGE"
                alt="Pratinjau sampul"
                class="w-full h-full object-cover"
                @error="$event.target.src = DEFAULT_IMAGE"
              />
            </div>
          </div>
        </div>

        <!-- Ringkasan -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">Ringkasan / Lead</label>
          <textarea
            v-model="form.excerpt"
            rows="2"
            placeholder="Ringkasan singkat berita (1-2 kalimat) yang tampil di kartu berita."
            class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 resize-none"
          ></textarea>
        </div>

        <!-- Isi -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">Isi Berita <span class="text-red-500">*</span></label>
          <textarea
            v-model="form.content"
            rows="12"
            placeholder="Tulis isi berita di sini. Pisahkan antar paragraf dengan satu baris kosong. Gunakan ## untuk sub-judul, > untuk kutipan, **tebal** untuk menebalkan teks."
            class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm font-mono text-slate-800 placeholder-slate-400 leading-relaxed focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          ></textarea>
          <p class="text-xs text-slate-400 mt-1">Format: <code class="bg-slate-100 px-1 rounded">## Sub-judul</code> • <code class="bg-slate-100 px-1 rounded">&gt; Kutipan</code> • <code class="bg-slate-100 px-1 rounded">**tebal**</code> • <code class="bg-slate-100 px-1 rounded">*miring*</code></p>
          <p class="text-xs text-slate-400 mt-1 text-right">{{ wordCount }} kata</p>
        </div>

        <!-- Tags -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">Tags</label>
          <input
            v-model="form.tags"
            type="text"
            placeholder="Pisahkan dengan koma, contoh: AI, Startup, Teknologi"
            class="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
      </div>

      <!-- Pratinjau konten -->
      <div v-if="contentPreview.length" class="bg-white rounded-lg border border-slate-200 p-6">
        <h2 class="font-display font-bold text-lg text-slate-900 mb-4">Pratinjau</h2>
        <article class="article-content text-sm">
          <h1 class="text-xl font-extrabold text-slate-900 mb-2 !font-display">{{ form.title || 'Judul berita' }}</h1>
          <p class="text-slate-500 italic text-xs mb-4">Oleh {{ form.author || 'Penulis' }}</p>
          <div v-html="renderContent(form.content)"></div>
        </article>
      </div>

      <p v-if="error" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{{ error }}</p>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg px-8 py-3 text-sm font-bold transition-colors"
        >
          {{ saving ? 'Menyimpan...' : !auth.hasPermission('publish') ? 'Simpan sebagai Draft' : form.status === 'scheduled' ? 'Jadwalkan Terbit' : form.status === 'ready' ? 'Simpan Siap Terbit' : isEdit ? 'Simpan Perubahan' : 'Terbitkan Berita' }}
        </button>
        <router-link to="/admin" class="text-sm text-slate-500 hover:text-slate-700 font-medium">Batal</router-link>
      </div>
    </form>

    <!-- Pemilih gambar dari Pustaka Media -->
    <MediaPickerModal
      :open="mediaPickerOpen"
      title="Pilih Gambar Sampul dari Media"
      @select="pickFromMedia"
      @close="mediaPickerOpen = false"
    />

    <!-- Modal sukses diterbitkan -->
    <ConfirmModal
      :open="successModal.open"
      variant="success"
      :title="successModal.title"
      :message="successModal.message"
      :confirm-text="savedArticleId ? 'Lihat Berita' : 'Ke Dashboard'"
      cancel-text="Ke Dashboard"
      @confirm="viewArticle"
      @cancel="goDashboard"
    />
  </div>
</template>
