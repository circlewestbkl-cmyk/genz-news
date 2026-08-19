<script setup>
import { timeAgo, readingTime } from '../utils/format'
import { getCategoryImage } from '../data/categoryImages'

defineProps({
  article: { type: Object, required: true },
  large: { type: Boolean, default: false },
  // Tampilkan badge "Headline Utama" (Editor's Pick)
  featured: { type: Boolean, default: false },
})
</script>

<template>
  <router-link
    :to="{ name: 'article', params: { id: article.id } }"
    class="group y2k-card y2k-card-hover block overflow-hidden hover:border-brand-600 active:scale-[0.98] transition-transform"
    :class="large ? 'h-full' : ''"
  >
    <div class="relative overflow-hidden border-b-2 border-link-700" :class="large ? 'aspect-[16/9]' : 'aspect-[16/9]'">
      <img
        :src="article.coverImage || getCategoryImage(article.category)"
        :alt="article.title"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-link-700/70 via-transparent to-transparent"></div>
      <span
        v-if="featured"
        class="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 rotate-[-3deg] bg-amber-400 text-link-700 border-2 border-link-700 rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] font-groovy font-black uppercase shadow-[2px_2px_0_#2a1038]"
      >
        ⭐ Headline Utama
      </span>
      <span
        v-else
        class="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 rotate-[-3deg] bg-brand-600 text-white border-2 border-link-700 rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] font-groovy font-bold uppercase shadow-[2px_2px_0_#2a1038]"
      >
        ✦ {{ article.category }}
      </span>
    </div>
    <div class="p-4 sm:p-5 lg:p-6">
      <h2
        class="font-display font-extrabold text-link-700 group-hover:text-brand-600 transition-colors leading-snug line-clamp-3"
        :class="large ? 'text-lg sm:text-xl lg:text-2xl' : 'text-base sm:text-lg'"
      >
        {{ article.title }}
      </h2>
      <div class="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold text-slate-500">
        <span class="inline-flex items-center gap-1 bg-grape-100 text-grape-700 border border-grape-300 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1">✍️ {{ article.author }}</span>
        <span class="inline-flex items-center gap-1 bg-acid-100 text-link-700 border border-acid-400 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1">🕒 {{ timeAgo(article.publishedAt) }}</span>
        <span class="inline-flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1">📖 {{ readingTime(article.content) }}</span>
      </div>
    </div>
  </router-link>
</template>
