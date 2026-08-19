<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getPreviewAd, clearPreviewAd } from '../api/previewAd'
import { adPositionInfo } from '../data/adPositions'

const router = useRouter()
const ad = getPreviewAd()

if (!ad) {
  router.replace('/')
}

const slot = computed(() => adPositionInfo(ad?.position || ''))
const height = computed(() => ad?.height || slot.value.height || 250)

function back() {
  clearPreviewAd()
  router.push('/admin/iklan')
}
</script>

<template>
  <div v-if="ad" class="min-h-screen flex flex-col bg-slate-100">
    <!-- Bar pratinjau -->
    <div class="bg-link-700 text-white border-b-4 border-acid-500 safe-area-top">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
        <p class="font-groovy font-black uppercase tracking-widest text-[10px] sm:text-xs text-acid-400">👁 Mode Pratinjau Iklan</p>
        <button
          @click="back"
          class="text-[10px] sm:text-xs font-groovy font-black uppercase tracking-wide bg-acid-500 text-link-700 border-2 border-link-700 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 shadow-[2px_2px_0_#2a1038] hover:-translate-y-0.5 transition-transform touch-target"
        >
          ← <span class="hidden sm:inline">Kembali ke Kelola Iklan</span><span class="sm:hidden">Kembali</span>
        </button>
      </div>
    </div>

    <!-- Mock navbar -->
    <div class="bg-white border-b-2 border-slate-200">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-4 sm:gap-6">
        <p class="font-groovy font-black text-base sm:text-lg text-link-700">gen z news</p>
        <div class="hidden sm:flex gap-4 text-xs font-bold text-slate-500">
          <span>Terkini</span><span>Nasional</span><span>Hiburan</span><span>Ekonomi</span><span>Tentang</span>
        </div>
      </div>
    </div>

    <main class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
      <!-- Slot iklan — dirender persis seperti di website -->
      <a
        :href="ad.linkUrl || '#'"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="group relative block w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100"
        :style="{ height: height + 'px' }"
        :aria-label="'Iklan: ' + (ad.title || '')"
      >
        <img
          :src="ad.imageUrl"
          :alt="ad.title || 'Iklan'"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span class="absolute top-2 left-2.5 text-[8px] sm:text-[9px] font-groovy font-black uppercase tracking-[0.2em] text-slate-500 bg-white/80 border border-slate-200 px-1.5 py-0.5 rounded-full">
          Iklan
        </span>
      </a>

      <div class="mt-3 sm:mt-4 bg-white rounded-2xl border-2 border-slate-200 p-3 sm:p-4 text-xs sm:text-sm">
        <p class="font-bold text-link-700">{{ ad.title }}</p>
        <p class="text-slate-500 text-[10px] sm:text-xs mt-1 font-semibold">
          📍 {{ slot.label }} · 📐 Ukuran slot {{ slot.width }} × {{ height }} px · 🔗 {{ ad.linkUrl || 'tanpa link' }}
        </p>
      </div>
    </main>

    <!-- Mock footer -->
    <div class="bg-link-700 text-white/70 text-xs font-semibold py-6 sm:py-8 text-center">© 2026 Gen Z News — Pratinjau Iklan</div>
  </div>
</template>
