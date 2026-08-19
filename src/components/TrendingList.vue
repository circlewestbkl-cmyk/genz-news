<script setup>
import { ref, computed, onMounted } from 'vue'
import { articleApi } from '../api/articles'
import { timeAgo } from '../utils/format'

const props = defineProps({
  limit: { type: Number, default: 5 },
  // Artikel yang sedang dibuka — jangan tampilkan di daftar trending
  excludeId: { type: [String, Number], default: null },
  title: { type: String, default: '🔥 Trending' },
})

const articles = ref([])
const loading = ref(true)

// Trending = artikel terbit paling banyak dibaca
const trending = computed(() =>
  [...articles.value]
    .filter((a) => String(a.id) !== String(props.excludeId))
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, props.limit)
)

onMounted(async () => {
  try {
    articles.value = await articleApi.listPublished()
  } catch {
    /* server data tidak aktif — tampilkan kosong */
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <div class="section-title mb-4 sm:mb-6">
      <span class="tag" style="background: var(--color-grape-500); color: #fff">🔥 Hot</span>
      <span class="text-sm sm:text-base">{{ title }}</span>
    </div>

    <div v-if="loading" class="space-y-2.5 sm:space-y-3">
      <div v-for="i in Math.min(limit, 5)" :key="i" class="bg-slate-200 animate-pulse rounded-2xl h-14 sm:h-16 border-2 border-link-700"></div>
    </div>

    <ol v-else-if="trending.length" class="space-y-2.5 sm:space-y-3.5">
      <li v-for="(a, i) in trending" :key="a.id">
        <router-link
          :to="{ name: 'article', params: { id: a.id } }"
          class="group flex gap-2.5 sm:gap-3.5 items-start y2k-card y2k-card-hover p-3 sm:p-3.5 hover:border-brand-600 active:scale-[0.98] transition-transform"
        >
          <span
            class="font-groovy font-black text-xl sm:text-2xl w-6 sm:w-7 text-center shrink-0 leading-none"
            :class="i === 0 ? 'gradient-text' : 'text-outline opacity-60'"
          >
            {{ i + 1 }}
          </span>
          <div class="min-w-0">
            <h3 class="font-display font-bold text-xs sm:text-[13px] leading-snug text-link-700 group-hover:text-brand-600 transition-colors line-clamp-2">
              {{ a.title }}
            </h3>
            <div class="mt-1 sm:mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-semibold text-slate-500">
              <span class="inline-flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-1.5 sm:px-2 py-0.5">
                👁 {{ a.views?.toLocaleString('id-ID') }}
              </span>
              <span>{{ timeAgo(a.publishedAt) }}</span>
            </div>
          </div>
        </router-link>
      </li>
    </ol>

    <p v-else class="text-sm font-semibold text-slate-400 bg-white border-2 border-dashed border-link-300 rounded-2xl px-4 py-6 text-center">
      Belum ada berita trending.
    </p>
  </div>
</template>
