<script setup>
import { ref, computed, onMounted } from 'vue'
import { bookmarkApi } from '../api/engagement'
import { articleApi } from '../api/articles'
import { auth } from '../api/auth'
import NewsCard from '../components/NewsCard.vue'
import PaginationBar from '../components/PaginationBar.vue'

const user = auth.current()
const savedIds = ref([])
const articles = ref([])
const loading = ref(true)
const error = ref('')

const PER_PAGE = 6
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(articles.value.length / PER_PAGE)))
const paged = computed(() => articles.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (!user || user.role !== 'reader') {
      articles.value = []
      return
    }
    const marks = await bookmarkApi.listFor(user.username)
    savedIds.value = marks.map((m) => String(m.articleId))
    if (!marks.length) {
      articles.value = []
      return
    }
    const all = await articleApi.listPublished()
    // Pertahankan urutan penyimpanan (terbaru dulu) & lewati yang sudah dihapus/tidak terbit
    articles.value = marks
      .map((m) => all.find((a) => String(a.id) === String(m.articleId)))
      .filter(Boolean)
  } catch {
    error.value = 'Gagal memuat artikel tersimpan. Pastikan server data berjalan.'
  } finally {
    loading.value = false
  }
}

// Hapus dari daftar simpan
const removingId = ref(null)
async function removeSaved(a) {
  if (!user) return
  removingId.value = a.id
  try {
    await bookmarkApi.toggle(user.username, a.id)
    articles.value = articles.value.filter((x) => x.id !== a.id)
    savedIds.value = savedIds.value.filter((id) => id !== String(a.id))
  } catch {
    /* abaikan */
  } finally {
    removingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
    <div class="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div>
        <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Bacaan kamu ✦</p>
        <h1 class="font-groovy font-black text-xl sm:text-2xl lg:text-3xl text-link-700">🔖 Artikel Tersimpan</h1>
        <p class="text-slate-500 text-xs sm:text-sm mt-1 font-semibold">Kumpulan artikel yang kamu simpan untuk dibaca nanti.</p>
      </div>
      <router-link
        to="/"
        class="text-xs sm:text-sm font-extrabold text-brand-600 border-2 border-brand-600 rounded-full px-3 sm:px-4 py-1.5 hover:bg-brand-600 hover:text-white transition-colors touch-friendly"
      >
        ← Ke Beranda
      </router-link>
    </div>

    <!-- Belum login sebagai pembaca -->
    <div v-if="!user || user.role !== 'reader'" class="bg-white border-2 border-link-700 rounded-2xl p-8 sm:p-10 text-center shadow-[4px_4px_0_#2a1038]">
      <p class="text-4xl sm:text-5xl mb-3">🔒</p>
      <p class="font-groovy font-black text-link-700 mb-1">Masuk sebagai pembaca dulu</p>
      <p class="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-5">Login dengan Google untuk menyimpan &amp; mengelola artikel favoritmu.</p>
      <router-link
        :to="{ name: 'reader-login', query: { redirect: '/disimpan' } }"
        class="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border-2 border-link-700 rounded-full px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-extrabold text-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all touch-target"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Masuk dengan Google
      </router-link>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="bg-slate-200 animate-pulse rounded-3xl h-40 sm:h-48 border-2 border-link-700"></div>
    </div>

    <p v-else-if="error" class="bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-semibold shadow-[3px_3px_0_#b45309]">{{ error }}</p>

    <!-- Kosong -->
    <div v-else-if="!articles.length" class="bg-white border-2 border-dashed border-link-300 rounded-2xl p-8 sm:p-12 text-center">
      <p class="text-4xl sm:text-5xl mb-3">🗂️</p>
      <p class="font-groovy font-black text-link-700 mb-1">Belum ada artikel tersimpan</p>
      <p class="text-xs sm:text-sm text-slate-500">Klik tombol <b>🔖 Simpan</b> di halaman artikel untuk menyimpannya di sini.</p>
    </div>

    <!-- Daftar -->
    <template v-else>
      <div v-if="totalPages > 1" class="mb-3 sm:mb-4 text-xs font-bold text-slate-400">
        Menampilkan {{ (page - 1) * PER_PAGE + 1 }}–{{ Math.min(page * PER_PAGE, articles.length) }} dari {{ articles.length }}
      </div>
      <div class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="a in paged" :key="a.id" class="relative">
          <NewsCard :article="a" />
          <button
            @click="removeSaved(a)"
            :disabled="removingId === a.id"
            class="absolute top-2.5 sm:top-3 right-2.5 sm:right-3 z-10 text-[9px] sm:text-[10px] font-groovy font-black uppercase tracking-wide px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-400 text-link-700 border-2 border-link-700 shadow-[2px_2px_0_#2a1038] hover:bg-rose-500 hover:text-white transition-colors disabled:opacity-60 touch-target"
            title="Hapus dari tersimpan"
          >
            {{ removingId === a.id ? '…' : '🔖 Tersimpan' }}
          </button>
        </div>
      </div>
      <PaginationBar v-if="totalPages > 1" :page="page" :total-pages="totalPages" @change="page = $event" class="mt-6 sm:mt-8" />
    </template>
  </div>
</template>
