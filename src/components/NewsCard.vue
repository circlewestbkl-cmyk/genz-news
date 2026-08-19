<script setup>
import { formatDate, readingTime } from '../utils/format'
import { getCategoryImage } from '../data/categoryImages'

defineProps({
  article: { type: Object, required: true },
  showExcerpt: { type: Boolean, default: true },
})
</script>

<template>
  <router-link
    :to="{ name: 'article', params: { id: article.id } }"
    class="group y2k-card y2k-card-hover flex flex-col overflow-hidden hover:border-brand-600 active:scale-[0.98] transition-transform"
  >
    <div class="relative overflow-hidden aspect-[16/10] bg-slate-100 border-b-2 border-link-700">
      <img
        :src="article.coverImage || getCategoryImage(article.category)"
        :alt="article.title"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      <span
        class="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 rotate-[-3deg] bg-acid-500 text-link-700 border-2 border-link-700 rounded-full px-2 sm:px-2.5 py-0.5 text-[10px] font-groovy font-bold uppercase shadow-[2px_2px_0_#2a1038]"
      >
        ✦ {{ article.category }}
      </span>
    </div>

    <div class="p-4 sm:p-5 flex flex-col flex-1">
      <h3
        class="font-display font-bold text-sm sm:text-base lg:text-lg leading-snug text-link-700 group-hover:text-brand-600 transition-colors line-clamp-2"
        :class="{ 'flex-1': !showExcerpt }"
      >
        {{ article.title }}
      </h3>
      <p v-if="showExcerpt" class="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-2 flex-1">
        {{ article.excerpt }}
      </p>

      <div class="mt-3 sm:mt-4 pt-3 border-t-2 border-dashed border-slate-200 flex items-center justify-between gap-2">
        <div class="min-w-0 text-xs">
          <p class="font-bold text-link-700 truncate">✍️ {{ article.author }}</p>
          <p class="text-slate-400 mt-0.5 truncate">{{ formatDate(article.publishedAt) }} • {{ readingTime(article.content) }}</p>
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span class="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-1.5 sm:px-2 py-1">
            👁 {{ article.views?.toLocaleString('id-ID') }}
          </span>
          <span
            class="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold text-link-700 bg-brand-100 border-2 border-link-700 rounded-full px-2.5 py-1 shadow-[2px_2px_0_#2a1038] transition-all group-hover:bg-brand-600 group-hover:text-white"
          >
            BACA →
          </span>
        </div>
      </div>
    </div>
  </router-link>
</template>
