<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { siteCategories } from '../api/categories'
import { auth } from '../api/auth'
import BrandLogo from './BrandLogo.vue'

const route = useRoute()
const router = useRouter()
const query = ref('')
const mobileMenuOpen = ref(false)
const mobileSearchOpen = ref(false)
const mobileSearchInput = ref(null)

// Swipe gesture for closing mobile menu
const touchStartX = ref(0)
const touchStartY = ref(0)

function handleTouchStart(e) {
  if (!mobileMenuOpen.value) return
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}

function handleTouchMove(e) {
  if (!mobileMenuOpen.value) return
  const deltaX = e.touches[0].clientX - touchStartX.value
  const deltaY = Math.abs(e.touches[0].clientY - touchStartY.value)
  
  // If swiping left (deltaX < -50) and horizontal swipe (deltaX > deltaY)
  if (deltaX < -50 && Math.abs(deltaX) > deltaY) {
    mobileMenuOpen.value = false
  }
}

// Status login pembaca (sesi disimpan di localStorage; disegarkan tiap pindah rute)
const user = ref(auth.current())
watch(
  () => route.fullPath,
  () => {
    user.value = auth.current()
    mobileMenuOpen.value = false
  }
)
const reader = computed(() => (user.value?.role === 'reader' ? user.value : null))

const today = new Date().toLocaleDateString('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function submitSearch() {
  if (!query.value.trim()) return
  router.push({ name: 'search', query: { q: query.value.trim() } })
  query.value = ''
  mobileSearchOpen.value = false
  mobileMenuOpen.value = false
}

function readerLogout() {
  auth.logout()
  user.value = null
  mobileMenuOpen.value = false
  router.push('/')
}

function toggleMobileSearch() {
  mobileSearchOpen.value = !mobileSearchOpen.value
  if (mobileSearchOpen.value) {
    setTimeout(() => mobileSearchInput.value?.focus(), 100)
  }
}

// Close menu on escape
function onKeydown(e) {
  if (e.key === 'Escape') {
    mobileMenuOpen.value = false
    mobileSearchOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header class="sticky top-0 z-40 bg-[#fff9f1] border-b-2 border-link-700 shadow-[0_4px_0_#d6e4ff] safe-area-top">
    <!-- Strip atas -->
    <div class="bg-brand-600 text-white border-b-2 border-link-700">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 h-9 flex items-center justify-between text-xs">
        <span class="font-groovy font-bold uppercase tracking-wider hidden sm:block">✨ Berita Terkini &amp; Terpercaya ✨</span>
        <span class="font-groovy font-bold sm:hidden">Gen Z News</span>
        <span class="flex items-center gap-1.5 sm:gap-3">
          <span class="hidden lg:inline font-medium opacity-90">{{ today }}</span>
          <template v-if="reader">
            <span class="hidden md:inline font-bold">👋 {{ reader.name }}</span>
            <router-link
              to="/disimpan"
              class="font-extrabold bg-amber-400 text-link-700 border-2 border-link-700 rounded-full px-2 sm:px-2.5 py-0.5 shadow-[2px_2px_0_#2a1038] hover:-translate-y-0.5 transition-transform"
            >
              🔖 <span class="hidden sm:inline">Disimpan</span>
            </router-link>
            <button
              @click="readerLogout"
              class="font-extrabold bg-link-700 text-white border border-link-700 rounded-full px-2 sm:px-2.5 py-0.5 hover:bg-white hover:text-link-700 transition-colors"
            >
              <span class="hidden sm:inline">Keluar</span>
              <span class="sm:hidden">✕</span>
            </button>
          </template>
          <router-link
            v-else
            to="/masuk"
            class="font-extrabold bg-acid-500 text-link-700 border-2 border-link-700 rounded-full px-2 sm:px-3 py-0.5 shadow-[2px_2px_0_#2a1038] hover:-translate-y-0.5 transition-transform"
          >
            <span class="hidden sm:inline">Masuk</span> ✌️
          </router-link>
          <router-link
            to="/daftar"
            class="font-extrabold bg-white text-brand-600 border-2 border-link-700 rounded-full px-2 sm:px-3 py-0.5 shadow-[2px_2px_0_#2a1038] hover:-translate-y-0.5 transition-transform"
          >
            <span class="hidden sm:inline">Daftar</span>
            <span class="sm:hidden">+</span>
          </router-link>
          <router-link
            to="/admin"
            class="font-extrabold hover:underline hidden sm:inline"
          >
            Backoffice →
          </router-link>
        </span>
      </div>
    </div>

    <!-- Bar utama -->
    <div class="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
      <router-link to="/" class="flex items-center shrink-0" title="Gen Z News — Beranda">
        <BrandLogo size="lg" />
      </router-link>

      <!-- Desktop search -->
      <form class="hidden md:flex items-center flex-1 max-w-sm ml-auto border-2 border-link-700 rounded-full bg-white shadow-[2px_2px_0_#2a1038] focus-within:border-brand-600 transition-colors" @submit.prevent="submitSearch">
        <input
          v-model="query"
          type="search"
          placeholder="Cari berita seru…"
          class="w-full bg-transparent rounded-full px-5 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          class="shrink-0 m-1.5 bg-acid-500 hover:bg-acid-400 rounded-full px-5 py-2 text-sm font-groovy font-bold text-link-700 transition-colors touch-target"
        >
          Cari 🔎
        </button>
      </form>

      <!-- Desktop date -->
      <span class="hidden xl:block text-xs font-bold text-slate-500 border-2 border-dashed border-slate-300 rounded-full px-3 py-1.5 shrink-0">{{ today }}</span>

      <!-- Mobile search toggle -->
      <button
        @click="toggleMobileSearch"
        class="md:hidden w-10 h-10 rounded-2xl border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] grid place-items-center text-link-700 hover:bg-brand-50 transition-all touch-target"
        title="Cari"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      <!-- Mobile hamburger -->
      <button
        @click="mobileMenuOpen = !mobileMenuOpen"
        class="md:hidden w-10 h-10 rounded-2xl border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] grid place-items-center text-link-700 hover:bg-brand-50 transition-all touch-target"
        :class="{ 'hamburger-open': mobileMenuOpen }"
        title="Menu"
        :aria-expanded="mobileMenuOpen"
        aria-label="Toggle menu"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line class="hamburger-line" x1="3" y1="6" x2="21" y2="6" />
          <line class="hamburger-line" x1="3" y1="12" x2="21" y2="12" />
          <line class="hamburger-line" x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </div>

    <!-- Mobile search overlay -->
    <Transition name="slide">
      <div v-if="mobileSearchOpen" class="md:hidden border-t-2 border-link-700 bg-[#fff9f1] px-3 py-3">
        <form class="flex items-center gap-2 border-2 border-link-700 rounded-full bg-white shadow-[2px_2px_0_#2a1038] focus-within:border-brand-600 transition-colors" @submit.prevent="submitSearch">
          <input
            ref="mobileSearchInput"
            v-model="query"
            type="search"
            placeholder="Cari berita seru…"
            class="flex-1 bg-transparent rounded-full px-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            class="shrink-0 m-1 bg-acid-500 hover:bg-acid-400 rounded-full px-4 py-2 text-sm font-groovy font-bold text-link-700 transition-colors touch-target"
          >
            🔎
          </button>
          <button
            type="button"
            @click="mobileSearchOpen = false"
            class="shrink-0 m-1 w-9 h-9 rounded-full bg-slate-100 border-2 border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-200 transition-colors touch-target"
          >
            ✕
          </button>
        </form>
      </div>
    </Transition>

    <!-- Nav kategori - Desktop -->
    <nav class="hidden md:block border-t-2 border-link-700 bg-[#fff9f1]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <router-link
          to="/"
          class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-extrabold border-2 transition-all shrink-0 touch-friendly"
          :class="
            $route.path === '/'
              ? 'bg-brand-600 border-link-700 text-white shadow-[2px_2px_0_#2a1038] -translate-y-0.5'
              : 'bg-white border-link-700 text-link-700 shadow-[2px_2px_0_#2a1038] hover:bg-brand-50'
          "
        >
          🔥 Terkini
        </router-link>
        <router-link
          v-for="cat in siteCategories"
          :key="cat.name"
          :to="{ name: 'category', params: { category: cat.name.toLowerCase() } }"
          class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold border-2 transition-all shrink-0 touch-friendly"
          :class="
            $route.params.category === cat.name.toLowerCase()
              ? 'bg-grape-600 border-link-700 text-white shadow-[2px_2px_0_#2a1038] -translate-y-0.5'
              : 'bg-white border-link-700 text-link-700 shadow-[2px_2px_0_#2a1038] hover:bg-grape-50'
          "
        >
          {{ cat.name }}
        </router-link>
        <router-link
          to="/tentang"
          class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold border-2 transition-all shrink-0 touch-friendly"
          :class="
            $route.path === '/tentang'
              ? 'bg-acid-500 border-link-700 text-link-700 shadow-[2px_2px_0_#2a1038] -translate-y-0.5'
              : 'bg-white border-link-700 text-link-700 shadow-[2px_2px_0_#2a1038] hover:bg-acid-100'
          "
        >
          Tentang
        </router-link>
      </div>
    </nav>

    <!-- Mobile hamburger menu -->
    <Transition name="slide">
      <div
        v-if="mobileMenuOpen"
        class="md:hidden fixed inset-0 top-0 z-50 flex justify-end"
        @touchstart.passive="handleTouchStart"
        @touchmove.passive="handleTouchMove"
      >
        <!-- Overlay -->
        <div class="absolute inset-0 bg-link-700/60 backdrop-blur-sm" @click="mobileMenuOpen = false"></div>

        <!-- Menu panel -->
        <div class="relative w-[85%] max-w-sm h-full bg-[#fff9f1] border-l-2 border-link-700 shadow-[-8px_0_30px_rgba(42,16,56,0.3)] overflow-y-auto no-overscroll">
          <!-- Swipe hint indicator -->
          <div class="absolute top-4 left-2 text-[10px] text-slate-400 font-semibold flex items-center gap-1 animate-pulse">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Geser tutup
          </div>

          <!-- Menu header -->
          <div class="sticky top-0 z-10 bg-[#fff9f1] border-b-2 border-link-700 px-5 py-4 flex items-center justify-between">
            <BrandLogo size="md" />
            <button
              @click="mobileMenuOpen = false"
              class="w-10 h-10 rounded-2xl border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] grid place-items-center text-link-700 hover:bg-rose-50 hover:text-rose-600 transition-all touch-target"
              aria-label="Tutup menu"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- User info -->
          <div v-if="reader" class="px-5 py-4 border-b-2 border-dashed border-slate-200">
            <div class="flex items-center gap-3">
              <span class="w-12 h-12 rounded-2xl bg-brand-600 border-2 border-link-700 shadow-[3px_3px_0_#2a1038] grid place-items-center text-white font-groovy font-bold text-lg -rotate-3">
                {{ reader.name?.charAt(0) || '👤' }}
              </span>
              <div class="min-w-0">
                <p class="font-extrabold text-link-700 truncate">{{ reader.name }}</p>
                <p class="text-xs font-semibold text-slate-400">{{ reader.email }}</p>
              </div>
            </div>
          </div>

          <!-- Navigation links -->
          <nav class="px-5 py-4 space-y-1">
            <p class="font-groovy font-bold text-xs uppercase tracking-widest text-slate-400 mb-2 px-3">Navigasi</p>

            <router-link
              to="/"
              class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-extrabold transition-all touch-friendly"
              :class="$route.path === '/' ? 'bg-brand-600 text-white' : 'text-link-700 hover:bg-brand-50'"
            >
              🔥 Beranda
            </router-link>

            <router-link
              to="/tentang"
              class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-all touch-friendly"
              :class="$route.path === '/tentang' ? 'bg-grape-600 text-white' : 'text-link-700 hover:bg-grape-50'"
            >
              ℹ️ Tentang
            </router-link>

            <template v-if="reader">
              <router-link
                to="/disimpan"
                class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-link-700 hover:bg-amber-50 transition-all touch-friendly"
              >
                🔖 Artikel Tersimpan
              </router-link>
            </template>
          </nav>

          <!-- Categories -->
          <div class="px-5 pb-4">
            <p class="font-groovy font-bold text-xs uppercase tracking-widest text-slate-400 mb-2 px-3">Kategori</p>
            <div class="flex flex-wrap gap-2 px-3">
              <router-link
                v-for="cat in siteCategories"
                :key="cat.name"
                :to="{ name: 'category', params: { category: cat.name.toLowerCase() } }"
                class="whitespace-nowrap px-3 py-2 rounded-full text-xs font-bold border-2 border-link-700 shadow-[2px_2px_0_#2a1038] transition-all touch-friendly"
                :class="
                  $route.params.category === cat.name.toLowerCase()
                    ? 'bg-grape-600 text-white'
                    : 'bg-white text-link-700 hover:bg-grape-50'
                "
              >
                {{ cat.name }}
              </router-link>
            </div>
          </div>

          <!-- Auth actions -->
          <div class="px-5 pb-6 border-t-2 border-dashed border-slate-200 pt-4">
            <template v-if="reader">
              <button
                @click="readerLogout"
                class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-extrabold text-rose-600 border-2 border-rose-200 hover:bg-rose-50 transition-all touch-friendly"
              >
                🚪 Keluar
              </button>
            </template>
            <template v-else>
              <div class="space-y-2">
                <router-link
                  to="/masuk"
                  class="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-extrabold text-white bg-brand-600 border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:bg-brand-500 transition-all touch-friendly"
                >
                  ✌️ Masuk
                </router-link>
                <router-link
                  to="/daftar"
                  class="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-extrabold text-brand-600 bg-white border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:bg-brand-50 transition-all touch-friendly"
                >
                  ➕ Daftar
                </router-link>
              </div>
            </template>

            <router-link
              to="/admin"
              class="flex items-center justify-center gap-2 w-full px-4 py-3 mt-3 rounded-xl text-xs font-bold text-slate-500 border-2 border-dashed border-slate-300 hover:border-brand-400 hover:text-brand-600 transition-all touch-friendly"
            >
              🛠️ Backoffice Redaksi
            </router-link>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>
