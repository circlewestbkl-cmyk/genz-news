<script setup>
import { ref, computed, onMounted } from 'vue'
import { ads, loadAds, adForPosition, adApi } from '../api/ads'

const props = defineProps({
  // Tinggi slot dalam piksel (leaderboard ~110, rectangle ~250, skyscraper ~600)
  height: { type: Number, default: 120 },
  label: { type: String, default: 'Iklan' },
  // Posisi slot — iklan aktif di posisi ini (jika ada) menggantikan placeholder
  position: { type: String, default: '' },
})

// Banner placeholder saat slot kosong — desain "Pasang Iklan Disini" (gambar lokal di public/ads)
const PLACEHOLDER_IMG = '/ads/pasang-iklan-disini.png'

// Iklan yang sedang aktif untuk posisi slot ini (null → tampilkan placeholder)
const ad = computed(() => (props.position ? adForPosition(ads.value, props.position) : null))

// Catat klik (statistik) tanpa menghalangi navigasi link
function trackClick() {
  if (ad.value?.id) adApi.incrementClicks(ad.value.id)
}

onMounted(() => {
  loadAds()
})
</script>

<template>
  <!-- Ada iklan aktif → tampilkan gambar + hyperlink -->
  <a
    v-if="ad"
    :href="ad.linkUrl || '#'"
    target="_blank"
    rel="noopener noreferrer nofollow"
    class="group relative block w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100"
    :style="{ height: height + 'px' }"
    :aria-label="'Iklan: ' + (ad.title || '')"
    :title="ad.title || 'Buka iklan'"
    @click="trackClick"
  >
    <img
      :src="ad.imageUrl"
      :alt="ad.title || 'Iklan'"
      class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      loading="lazy"
    />
    <span
      class="absolute top-2 left-2.5 text-[9px] font-groovy font-black uppercase tracking-[0.2em] text-slate-500 bg-white/80 border border-slate-200 px-1.5 py-0.5 rounded-full"
    >
      {{ label }}
    </span>
  </a>

  <!-- Tidak ada iklan aktif → placeholder "Pasang Iklan Disini" -->
  <div
    v-else
    class="relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-white via-slate-50 to-brand-50/40 text-slate-400 select-none"
    :style="{ height: height + 'px' }"
    role="complementary"
    aria-label="Slot iklan"
  >
    <span
      class="absolute top-2 left-2.5 z-10 text-[9px] font-groovy font-black uppercase tracking-[0.2em] text-slate-300 bg-white/70 border border-slate-200 px-1.5 py-0.5 rounded-full"
    >
      {{ label }}
    </span>
    <div class="absolute inset-0 grid place-items-center p-3">
      <img
        :src="PLACEHOLDER_IMG"
        alt="Pasang iklan di sini"
        class="max-w-full max-h-full object-contain"
        loading="lazy"
      />
    </div>
  </div>
</template>
