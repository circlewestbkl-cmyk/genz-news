<script setup>
import { ref, computed, onMounted } from 'vue'
import { articleApi } from '../api/articles'
import { timeAgo } from '../utils/format'
import { siteCategories } from '../api/categories'
import { getCategoryImage } from '../data/categoryImages'
import FeaturedCard from '../components/FeaturedCard.vue'
import NewsCard from '../components/NewsCard.vue'
import PaginationBar from '../components/PaginationBar.vue'
import AdSlot from '../components/AdSlot.vue'

const articles = ref([])
const loading = ref(true)
const error = ref('')
const subscribed = ref(false)

onMounted(async () => {
  try {
    articles.value = await articleApi.listPublished()
  } catch (e) {
    error.value = e.message || 'Gagal memuat data'
  } finally {
    loading.value = false
  }
})

// Headline Utama (Editor's Pick) tampil pertama di hero; sisanya berita terbaru
const heroPool = computed(() => {
  const featured = articles.value.filter((a) => a.featured)
  const rest = articles.value.filter((a) => !a.featured)
  return [...featured, ...rest]
})
const heroMain = computed(() => heroPool.value[0])
const heroSide = computed(() => heroPool.value.slice(1, 3))
const ticker = computed(() => articles.value.slice(0, 6))
const popular = computed(() =>
  [...articles.value].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5)
)

// Pagination untuk bagian "Berita Terbaru" (setelah 3 berita hero)
const perPage = 6
const page = ref(1)
const latestSection = ref(null)
const latestPool = computed(() => articles.value.slice(3))
const totalPages = computed(() => Math.max(1, Math.ceil(latestPool.value.length / perPage)))
const pagedLatest = computed(() => {
  const start = (page.value - 1) * perPage
  return latestPool.value.slice(start, start + perPage)
})

function goToPage(p) {
  page.value = p
  latestSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Seksi berita per kategori: daftar baris seragam dengan thumbnail ukuran sama
const categorySections = computed(() => {
  const map = {}
  for (const a of articles.value) {
    if (!map[a.category]) map[a.category] = []
    map[a.category].push(a)
  }
  return siteCategories.value
    .filter((c) => (map[c.name]?.length || 0) > 0)
    .map((c) => ({ ...c, items: map[c.name].slice(0, 6) }))
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-6">
    <!-- Banner error saat server data mati -->
    <div
      v-if="error"
      class="mt-6 bg-rose-50 border-2 border-rose-300 text-rose-700 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-sm font-semibold"
    >
      <p class="font-bold mb-1">⚠️ Tidak dapat terhubung ke server data.</p>
      <p>Jalankan <code class="bg-rose-100 px-1.5 py-0.5 rounded">npm run server</code> di terminal, lalu muat ulang halaman.</p>
    </div>

    <!-- Hero -->
    <section v-if="!loading && heroMain" class="pt-6 sm:pt-8 pb-4">
      <div class="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <FeaturedCard :article="heroMain" large :featured="heroMain.featured" />
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6">
          <FeaturedCard v-for="a in heroSide" :key="a.id" :article="a" :featured="a.featured" />
        </div>
      </div>
    </section>

    <!-- Skeleton hero -->
    <section v-if="loading" class="pt-6 sm:pt-8 pb-4">
      <div class="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2 bg-slate-200 animate-pulse rounded-3xl min-h-[250px] sm:min-h-[420px] border-2 border-link-700"></div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6">
          <div class="bg-slate-200 animate-pulse rounded-3xl min-h-[180px] sm:min-h-[240px] border-2 border-link-700"></div>
          <div class="bg-slate-200 animate-pulse rounded-3xl min-h-[180px] sm:min-h-[240px] border-2 border-link-700"></div>
        </div>
      </div>
    </section>

    <!-- Breaking news bar -->
    <section v-if="ticker.length" class="my-4 sm:my-6 bg-brand-600 text-white border-2 border-link-700 rounded-2xl overflow-hidden shadow-[4px_4px_0_#2a1038]">
      <div class="flex items-stretch">
        <span class="shrink-0 z-10 bg-acid-500 text-link-700 text-[10px] sm:text-xs font-groovy font-black uppercase tracking-widest px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-1.5 border-r-2 border-link-700">
          <span class="w-2 h-2 rounded-full bg-link-700 animate-pulse"></span>
          <span class="hidden sm:inline">Terkini</span>
          <span class="sm:hidden">Hot</span>
        </span>
        <div class="flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_3%,black_97%,transparent)]">
          <div class="flex gap-8 sm:gap-10 whitespace-nowrap animate-marquee py-2.5 sm:py-3">
            <span v-for="i in 2" :key="i" class="flex gap-8 sm:gap-10 shrink-0">
              <router-link
                v-for="a in ticker"
                :key="a.id + '-' + i"
                :to="{ name: 'article', params: { id: a.id } }"
                class="text-xs sm:text-sm font-bold text-white hover:text-acid-400 transition-colors"
              >
                {{ a.title }}
              </router-link>
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- Slot iklan leaderboard -->
    <section v-if="!loading && articles.length" class="pt-6 sm:pt-8">
      <AdSlot position="home-top" :height="110" />
    </section>

    <!-- Grid berita terbaru + terpopuler -->
    <section v-if="!loading && articles.length" class="py-6 sm:py-8">
      <div class="grid gap-8 sm:gap-12 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <div class="section-title mb-6 sm:mb-8">
            <span class="tag">⚡ Fresh</span>
            <span class="text-sm sm:text-base">Berita Terbaru</span>
          </div>
          <div ref="latestSection" class="scroll-mt-40 grid sm:grid-cols-2 gap-4 sm:gap-7">
            <NewsCard v-for="a in pagedLatest" :key="a.id" :article="a" />
          </div>

          <!-- Pagination -->
          <PaginationBar :page="page" :total-pages="totalPages" @change="goToPage" />
        </div>

        <!-- Terpopuler -->
        <aside>
          <div class="section-title mb-6 sm:mb-8">
            <span class="tag" style="background: var(--color-grape-400); color: #fff">🔥 Hot</span>
            <span class="text-sm sm:text-base">Terpopuler</span>
          </div>
          <ol class="space-y-3 sm:space-y-4">
            <li v-for="(a, i) in popular" :key="a.id">
              <router-link
                :to="{ name: 'article', params: { id: a.id } }"
                class="group flex gap-3 sm:gap-4 items-start y2k-card y2k-card-hover p-3 sm:p-4 hover:border-brand-600 active:scale-[0.98] transition-transform"
              >
                <span
                  class="font-groovy font-black text-2xl sm:text-3xl w-7 sm:w-9 text-center shrink-0 leading-none"
                  :class="i === 0 ? 'gradient-text' : 'text-outline opacity-60'"
                >
                  {{ i + 1 }}
                </span>
                <div class="min-w-0">
                  <h3 class="font-display font-bold text-xs sm:text-sm leading-snug text-link-700 group-hover:text-brand-600 transition-colors line-clamp-2">
                    {{ a.title }}
                  </h3>
                  <div class="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-semibold text-slate-500">
                    <span class="inline-flex items-center gap-1 bg-acid-100 text-link-700 border border-acid-400 rounded-full px-1.5 sm:px-2 py-0.5">🕒 {{ timeAgo(a.publishedAt) }}</span>
                    <span class="inline-flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-1.5 sm:px-2 py-0.5">👁 {{ a.views?.toLocaleString('id-ID') }}</span>
                  </div>
                </div>
              </router-link>
            </li>
          </ol>
          <!-- Slot iklan rectangle di sidebar -->
          <AdSlot position="home-aside" :height="250" class="mt-6 sm:mt-8" />
        </aside>
      </div>
    </section>

    <!-- Skeleton grid -->
    <section v-if="loading" class="py-6 sm:py-8">
      <div class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 6" :key="i" class="bg-slate-200 animate-pulse rounded-3xl aspect-[16/11] border-2 border-link-700"></div>
      </div>
    </section>

    <!-- Marquee dekoratif -->
    <section v-if="!loading && articles.length" class="py-4 sm:py-6">
      <div class="bg-grape-600 border-2 border-link-700 rounded-2xl overflow-hidden shadow-[4px_4px_0_#2a1038]">
        <div class="flex gap-6 sm:gap-8 whitespace-nowrap animate-marquee py-2 sm:py-2.5 font-groovy font-black uppercase tracking-wider text-white text-xs sm:text-sm">
          <span v-for="i in 2" :key="i" class="flex gap-6 sm:gap-8 shrink-0">
            <span v-for="w in ['Baca Dulu', 'Stay Fresh', 'No Drama', 'Viral Banget', 'Fresh News']" :key="w + i">
              {{ w }} ✦
            </span>
          </span>
        </div>
      </div>
    </section>

    <!-- Seksi berita per kategori -->
    <section v-if="!loading && categorySections.length" class="pb-6 sm:pb-8">
      <div v-for="sec in categorySections" :key="sec.name" class="py-6 sm:py-8">
        <div class="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div class="section-title">
            <span class="tag" :style="{ background: 'var(--color-brand-500)', color: '#fff' }">📂 {{ sec.name }}</span>
            <span class="text-sm sm:text-base">Liputan</span>
          </div>
          <router-link
            :to="{ name: 'category', params: { category: sec.name.toLowerCase() } }"
            class="text-xs sm:text-sm font-extrabold text-brand-600 border-2 border-brand-600 rounded-full px-3 sm:px-4 py-1.5 hover:bg-brand-600 hover:text-white transition-colors shrink-0 touch-friendly"
          >
            Lihat Semua →
          </router-link>
        </div>

        <div class="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2">
          <router-link
            v-for="a in sec.items"
            :key="a.id"
            :to="{ name: 'article', params: { id: a.id } }"
            class="group flex gap-3 sm:gap-4 items-center y2k-card y2k-card-hover p-3 sm:p-3.5 hover:border-brand-600 active:scale-[0.98] transition-transform"
          >
            <div class="w-24 sm:w-32 lg:w-36 aspect-[4/3] shrink-0 overflow-hidden rounded-xl border-2 border-link-700 bg-slate-100">
              <img
                :src="a.coverImage || getCategoryImage(a.category)"
                :alt="a.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="font-display font-bold text-xs sm:text-sm leading-snug text-link-700 group-hover:text-brand-600 transition-colors line-clamp-2">
                {{ a.title }}
              </h3>
              <div class="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold text-slate-500">
                <span class="font-bold text-grape-600 truncate">✍️ {{ a.author }}</span>
                <span class="hidden sm:inline">•</span>
                <span class="shrink-0">{{ timeAgo(a.publishedAt) }}</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </section>

    <!-- CTA Newsletter -->
    <section class="my-8 sm:my-12 bg-[#200b2c] text-white rounded-3xl border-2 border-link-700 shadow-[6px_6px_0_#2a1038] p-6 sm:p-8 lg:p-12 relative overflow-hidden safe-area-bottom">
      <span class="absolute -top-4 -right-4 text-4xl sm:text-5xl rotate-12 select-none">💌</span>
      <span class="absolute bottom-6 left-4 text-3xl sm:text-4xl -rotate-12 select-none">✨</span>
      <span class="absolute top-10 right-24 text-2xl sm:text-3xl rotate-6 select-none hidden sm:block">⭐</span>
      <div class="max-w-xl">
        <p class="font-groovy font-black uppercase tracking-widest text-xs text-acid-500 mb-2">Jangan ketinggalan!</p>
        <h2 class="font-groovy font-black text-xl sm:text-2xl lg:text-4xl mb-3 leading-tight">
          Langganan <span class="gradient-text">Newsletter</span> Gen Z News
        </h2>
        <p class="text-slate-400 mb-4 sm:mb-6 text-sm">Dapatkan rangkuman berita pilihan langsung di inbox kamu. Gratis, tanpa spam. ✨</p>
        <form class="flex flex-col sm:flex-row gap-2.5 sm:gap-3" @submit.prevent="subscribed = true">
          <input
            type="email"
            required
            placeholder="Alamat email kamu"
            class="flex-1 bg-white/10 border-2 border-white/40 rounded-full px-4 sm:px-5 py-3 text-sm placeholder-slate-400 focus:outline-none focus:border-acid-500"
          />
          <button type="submit" class="bg-acid-500 hover:bg-acid-400 text-link-700 rounded-full px-6 sm:px-7 py-3 text-sm font-groovy font-bold border-2 border-white shadow-[3px_3px_0_#ffffff66] transition-colors touch-target">
            Langganan 🚀
          </button>
        </form>
        <p v-if="subscribed" class="mt-4 text-sm font-bold text-acid-500">🎉 Terima kasih! Kamu berhasil berlangganan.</p>
      </div>
    </section>
  </div>
</template>
