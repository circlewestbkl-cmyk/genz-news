<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { articleApi } from '../api/articles'
import { categories, findCategory, chipOf } from '../api/categories'
import { formatDate } from '../utils/format'
import NewsCard from '../components/NewsCard.vue'
import PaginationBar from '../components/PaginationBar.vue'
import AdSlot from '../components/AdSlot.vue'
import TrendingList from '../components/TrendingList.vue'

const route = useRoute()
const articles = ref([])
const loading = ref(true)
const error = ref('')

// Pagination
const perPage = 9
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(articles.value.length / perPage)))
const pagedArticles = computed(() => {
  const start = (page.value - 1) * perPage
  return articles.value.slice(start, start + perPage)
})

function goToPage(p) {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const slug = computed(() => route.params.category)
const category = computed(() => findCategory(categories.value, slug.value))
const categoryInfo = computed(() => chipOf(category.value?.name))

async function load() {
  loading.value = true
  error.value = ''
  try {
    articles.value = await articleApi.listPublished({ category: category.value.name })
  } catch (e) {
    error.value = 'Gagal memuat berita.'
  } finally {
    loading.value = false
  }
}

// Kategori kini dinamis (async) — muat artikel saat kategori tersedia,
// termasuk saat pengguna berpindah kategori (slug berubah)
onMounted(() => category.value && load())
watch(category, (val) => {
  if (!val) return
  page.value = 1
  load()
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
    <!-- Kategori tidak dikenal -->
    <div v-if="!category" class="text-center py-16 sm:py-20">
      <p class="text-4xl sm:text-5xl mb-4">🔍</p>
      <h1 class="font-display font-extrabold text-xl sm:text-2xl mb-2 text-link-700">Kategori tidak ditemukan</h1>
      <p class="text-slate-500 text-sm mb-6">Kategori "{{ slug }}" tidak tersedia di Gen Z News.</p>
      <router-link to="/" class="text-brand-600 font-extrabold text-sm hover:underline">← Kembali ke Beranda</router-link>
    </div>

    <template v-else>
      <!-- Header kategori -->
      <div class="flex flex-wrap items-center gap-3 sm:gap-5 mb-8 sm:mb-10">
        <span
          class="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl grid place-items-center border-2 border-link-700 shadow-[3px_3px_0_#2a1038] sm:shadow-[4px_4px_0_#2a1038] -rotate-3 text-xl sm:text-2xl"
          :class="categoryInfo.color"
        >
          📂
        </span>
        <div>
          <p class="font-groovy font-black uppercase tracking-widest text-[10px] sm:text-xs text-brand-600 mb-1">Kategori ✦ Liputan</p>
          <h1 class="font-groovy font-black text-2xl sm:text-3xl lg:text-4xl text-link-700">{{ category.name }}</h1>
          <p class="text-slate-500 text-xs sm:text-sm font-semibold mt-1 sm:mt-1.5">
            <span class="inline-flex items-center gap-1 bg-white border-2 border-link-700 rounded-full px-2.5 sm:px-3 py-0.5 shadow-[2px_2px_0_#2a1038]">
              📰 {{ articles.length }} berita
            </span>
          </p>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-semibold shadow-[3px_3px_0_#b45309]">
        {{ error }} Pastikan JSON Server berjalan (<code class="bg-amber-200 px-1 py-0.5 rounded">npm run server</code>).
      </div>

      <!-- Grid + Pagination + sidebar (trending & iklan) -->
      <template v-if="!loading && pagedArticles.length">
        <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 items-start">
          <div class="min-w-0">
            <div class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <NewsCard v-for="a in pagedArticles" :key="a.id" :article="a" />
            </div>
            <PaginationBar :page="page" :total-pages="totalPages" @change="goToPage" />
          </div>

          <!-- Sidebar kanan: iklan + berita trending -->
          <aside class="hidden lg:flex flex-col gap-6 sm:gap-8 mt-8 sm:mt-10 lg:mt-0">
            <AdSlot position="category-sidebar-top" :height="250" />
            <TrendingList :limit="5" />
            <AdSlot position="category-sidebar-bottom" :height="600" />
          </aside>
        </div>
      </template>

      <!-- Kosong -->
      <div v-else-if="!loading" class="text-center py-12 sm:py-16 text-slate-500">
        <p class="text-4xl sm:text-5xl mb-3">🗞️</p>
        <p class="font-groovy font-bold">Belum ada berita pada kategori ini.</p>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="bg-slate-200 animate-pulse rounded-3xl aspect-[16/11] border-2 border-link-700"></div>
      </div>

      <!-- Tanggal -->
      <p v-if="articles.length" class="mt-8 sm:mt-12 text-xs font-semibold text-slate-400">
        Terakhir diperbarui: {{ formatDate(articles[0].publishedAt) }}
      </p>
    </template>
  </div>
</template>
