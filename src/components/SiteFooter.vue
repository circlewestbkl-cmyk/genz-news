<script setup>
import { siteCategories } from '../api/categories'
import BrandLogo from './BrandLogo.vue'
</script>

<template>
  <footer class="mt-12 sm:mt-20 bg-[#200b2c] text-slate-300 border-t-2 border-link-700 overflow-hidden safe-area-bottom">
    <!-- Strip marquee ala majalah -->
    <div class="bg-brand-600 border-b-2 border-link-700 overflow-hidden">
      <div class="flex gap-8 whitespace-nowrap animate-marquee py-2.5">
        <span v-for="i in 2" :key="i" class="flex gap-8 shrink-0 font-groovy font-black uppercase tracking-wider text-white text-sm">
          <span v-for="w in ['Trending', 'Viral', 'Fresh News', 'Gen Z Vibes', 'Baca Dulu', 'No Drama', 'Stay Keren']" :key="w + i">
            {{ w }} ✦
          </span>
        </span>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid gap-8 sm:gap-10 md:grid-cols-3">
      <div>
        <div class="mb-4">
          <BrandLogo dark size="lg" />
        </div>
        <p class="text-sm text-slate-400 leading-relaxed">
          Majalah remaja Gen Z — berita kekinian, gaya hidup, dan isu seru yang wajib kamu baca. Stay updated, stay fresh! ✨
        </p>
        <div class="mt-4 flex gap-2 text-lg">
          <span class="w-10 h-10 sm:w-9 sm:h-9 grid place-items-center rounded-xl bg-white/10 border border-white/20 touch-target">📸</span>
          <span class="w-10 h-10 sm:w-9 sm:h-9 grid place-items-center rounded-xl bg-white/10 border border-white/20 touch-target">🎵</span>
          <span class="w-10 h-10 sm:w-9 sm:h-9 grid place-items-center rounded-xl bg-white/10 border border-white/20 touch-target">💬</span>
          <span class="w-10 h-10 sm:w-9 sm:h-9 grid place-items-center rounded-xl bg-white/10 border border-white/20 touch-target">▶️</span>
        </div>
      </div>

      <div>
        <h3 class="font-groovy font-bold text-white uppercase text-sm tracking-widest mb-4">🏷️ Kategori</h3>
        <div class="flex flex-wrap gap-2">
          <router-link
            v-for="cat in siteCategories"
            :key="cat.name"
            :to="{ name: 'category', params: { category: cat.name.toLowerCase() } }"
            class="text-xs font-bold text-link-700 bg-acid-500 border-2 border-white rounded-full px-3 py-2 sm:py-1.5 hover:-translate-y-0.5 hover:bg-acid-400 transition-transform touch-friendly"
          >
            {{ cat.name }}
          </router-link>
        </div>
      </div>

      <div>
        <h3 class="font-groovy font-bold text-white uppercase text-sm tracking-widest mb-4">📍 Tentang</h3>
        <ul class="space-y-2 text-sm">
          <li>
            <router-link to="/tentang" class="inline-flex items-center gap-2 text-slate-400 hover:text-brand-400 transition-colors font-semibold py-1">
              <span class="w-7 h-7 grid place-items-center rounded-lg bg-white/10 border border-white/20 text-xs">ℹ️</span>
              Tentang Kami
            </router-link>
          </li>
          <li>
            <router-link to="/admin" class="inline-flex items-center gap-2 text-slate-400 hover:text-brand-400 transition-colors font-semibold py-1">
              <span class="w-7 h-7 grid place-items-center rounded-lg bg-white/10 border border-white/20 text-xs">🛠️</span>
              Backoffice Redaksi
            </router-link>
          </li>
          <li class="inline-flex items-center gap-2 text-slate-400 font-semibold py-1">
            <span class="w-7 h-7 grid place-items-center rounded-lg bg-white/10 border border-white/20 text-xs">📮</span>
            redaksi@genznews.id
          </li>
        </ul>
      </div>
    </div>

    <!-- Watermark outline -->
    <div class="select-none pointer-events-none text-center leading-none px-4">
      <span class="font-groovy font-black text-[13vw] md:text-[7rem] text-outline opacity-20 tracking-tight">GEN Z NEWS</span>
    </div>

    <div class="border-t-2 border-white/10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 text-xs text-slate-500 flex flex-col sm:flex-row justify-between gap-2">
        <p>© 2026 Gen Z News. Dibuat dengan ✨ buat semua.</p>
        <p>Vue 3 + Tailwind CSS ✦ Y2K Neon Pop</p>
      </div>
    </div>
  </footer>
</template>
