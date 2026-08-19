<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { articleApi } from '../api/articles'
import NewsCard from '../components/NewsCard.vue'
import PaginationBar from '../components/PaginationBar.vue'

const route = useRoute()
const router = useRouter()
const query = ref('')
const results = ref([])
const loading = ref(true)
const searched = ref('')

// Pagination
const perPage = 9
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(results.value.length / perPage)))
const pagedResults = computed(() => {
  const start = (page.value - 1) * perPage
  return results.value.slice(start, start + perPage)
})

function goToPage(p) {
  page.value = p
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const searchQuery = computed(() => (route.query.q || '').toString())

async function doSearch(q) {
  if (!q) {
    results.value = []
    loading.value = false
    return
  }
  loading.value = true
  page.value = 1
  try {
    results.value = await articleApi.listPublished({ q })
    searched.value = q
  } catch {
    results.value = []
  } finally {
    loading.value = false
  }
}

function submit() {
  router.push({ name: 'search', query: { q: query.value.trim() } })
}

onMounted(() => {
  query.value = searchQuery.value
  doSearch(searchQuery.value)
})
watch(searchQuery, (q) => {
  query.value = q
  doSearch(q)
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
    <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Cari-cari ✦</p>
    <h1 class="font-groovy font-black text-2xl sm:text-3xl lg:text-4xl text-link-700 mb-6 sm:mb-8">Pencarian</h1>

    <!-- Form pencarian -->
    <form class="flex gap-2 sm:gap-3 mb-6 sm:mb-8 max-w-2xl" @submit.prevent="submit">
      <input
        v-model="query"
        type="search"
        placeholder="Cari judul, topik, atau kata kunci…"
        class="flex-1 border-2 border-link-700 rounded-full px-4 sm:px-5 py-2.5 sm:py-3 text-sm bg-white shadow-[3px_3px_0_#2a1038] placeholder-slate-400 focus:outline-none focus:border-brand-600"
      />
      <button
        type="submit"
        class="bg-brand-600 hover:bg-brand-500 text-white rounded-full px-5 sm:px-7 py-2.5 sm:py-3 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all touch-target"
      >
        Cari 🔎
      </button>
    </form>

    <p v-if="searched && !loading" class="text-xs sm:text-sm font-semibold text-slate-500 mb-6 sm:mb-8">
      Menampilkan <span class="font-extrabold text-link-700">{{ results.length }}</span> hasil untuk
      "<span class="font-extrabold text-brand-600">{{ searched }}</span>"
    </p>

    <template v-if="!loading && pagedResults.length">
      <div class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <NewsCard v-for="a in pagedResults" :key="a.id" :article="a" />
      </div>
      <PaginationBar :page="page" :total-pages="totalPages" @change="goToPage" />
    </template>

    <div v-else-if="!loading && searched" class="text-center py-12 sm:py-16">
      <p class="text-4xl sm:text-5xl mb-3">🔎</p>
      <p class="font-groovy font-bold text-link-700">Tidak ada berita yang cocok.</p>
      <p class="text-slate-400 text-xs sm:text-sm mt-1">Coba kata kunci lain, misalnya "teknologi" atau "ekonomi".</p>
    </div>

    <div v-if="loading" class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="bg-slate-200 animate-pulse rounded-3xl aspect-[16/11] border-2 border-link-700"></div>
    </div>
  </div>
</template>
