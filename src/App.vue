<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import SiteNavbar from './components/SiteNavbar.vue'
import SiteFooter from './components/SiteFooter.vue'
import AdSlot from './components/AdSlot.vue'
import { resetPageMeta } from './utils/seo'
import { loadCategories } from './api/categories'
import { startPublishScheduler } from './api/publishScheduler'

const route = useRoute()
const isAdminArea = computed(() => route.path.startsWith('/admin'))

// Muat kategori dinamis sekali saat aplikasi mulai
// + scheduler penjadwalan: artikel berstatus 'scheduled' otomatis terbit saat waktunya tiba
let stopPublishScheduler = null
onMounted(() => {
  loadCategories().catch(() => {})
  stopPublishScheduler = startPublishScheduler()
})

onBeforeUnmount(() => {
  if (stopPublishScheduler) stopPublishScheduler()
})

// Judul halaman per rute (SEO). Halaman artikel/preview diatur oleh ArticleView sendiri.
const titles = {
  home: 'Gen Z News — Portal Berita Terkini',
  category: (r) => `Berita ${r.params.category} — Gen Z News`,
  search: 'Pencarian — Gen Z News',
  about: 'Tentang Kami — Gen Z News',
  register: 'Daftar Akun — Gen Z News',
}

watch(
  () => route.name,
  () => {
    if (route.name === 'article' || route.name === 'preview') return
    const t = titles[route.name]
    document.title = typeof t === 'function' ? t(route) : t || 'Gen Z News — Portal Berita Terkini'
    resetPageMeta()
  }
)
</script>

<template>
  <div class="min-h-screen flex flex-col no-overscroll">
    <SiteNavbar v-if="!isAdminArea" />
    <!-- Slot iklan di bawah navbar — tampil di semua halaman publik -->
    <AdSlot
      v-if="!isAdminArea"
      position="nav-bottom"
      :height="250"
      class="max-w-7xl mx-auto w-full px-3 sm:px-6 mt-4 sm:mt-6"
    />
    <main class="flex-1">
      <router-view />
    </main>
    <!-- Slot iklan di atas footer — tampil di semua halaman publik -->
    <AdSlot
      v-if="!isAdminArea"
      position="footer"
      :height="250"
      class="max-w-7xl mx-auto w-full px-3 sm:px-6 mt-10 sm:mt-16 mb-1"
    />
    <SiteFooter v-if="!isAdminArea" />
  </div>
</template>
