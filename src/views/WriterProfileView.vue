<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { userApi } from '../api/users'
import { articleApi } from '../api/articles'
import { roleInfo } from '../api/auth'
import { countWords } from '../utils/format'
import { followApi } from '../api/engagement'
import { auth } from '../api/auth'
import NewsCard from '../components/NewsCard.vue'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const writer = ref(null)
const articles = ref([])
const loading = ref(true)
const error = ref('')
const notFound = ref(false)

const username = computed(() => route.params.username)
const role = computed(() => roleInfo[writer.value?.role] || { label: writer.value?.role || 'Penulis', badge: 'bg-emerald-600 text-white' })
const displayName = computed(() => writer.value?.penName || writer.value?.name || username.value)

const totalViews = computed(() => articles.value.reduce((s, a) => s + (a.views || 0), 0))

// === Follow penulis (khusus pembaca yang login) ===
const currentUser = auth.current()
const isReader = computed(() => currentUser?.role === 'reader')
const isSelf = computed(() => !!currentUser && currentUser.username === username.value)
const following = ref(false)
const followBusy = ref(false)
const followerCount = ref(0)

async function loadFollow() {
  try {
    const followers = await followApi.followersOf(username.value)
    followerCount.value = followers.length
    if (isReader.value && !isSelf.value) {
      following.value = await followApi.isFollowing(currentUser.username, username.value)
    }
  } catch {
    /* server tidak aktif — abaikan */
  }
}

async function toggleFollow() {
  if (!isReader.value || isSelf.value) return
  followBusy.value = true
  try {
    const { added } = await followApi.toggle(currentUser.username, username.value)
    following.value = added
    followerCount.value += added ? 1 : -1
  } catch {
    /* abaikan */
  } finally {
    followBusy.value = false
  }
}
const totalWords = computed(() => articles.value.reduce((s, a) => s + countWords(a.content), 0))
const totalLikes = computed(() => articles.value.reduce((s, a) => s + (a.likes || 0), 0))

async function load() {
  loading.value = true
  error.value = ''
  notFound.value = false
  writer.value = null
  articles.value = []
  try {
    const users = await userApi.list()
    const found = users.find((u) => u.username === username.value)
    if (!found) {
      notFound.value = true
      return
    }
    writer.value = found
    // Hanya artikel yang sudah terbit yang tampil di profil publik
    const all = await articleApi.listPublished()
    articles.value = all.filter((a) => a.createdBy === username.value)
    loadFollow()
  } catch {
    error.value = 'Gagal memuat profil penulis. Pastikan server data berjalan.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(username, load)
</script>

<template>
  <div class="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="bg-slate-200 animate-pulse rounded-3xl h-24 sm:h-28 w-full max-w-md border-2 border-link-700"></div>
      <div class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 3" :key="i" class="bg-slate-200 animate-pulse rounded-3xl h-40 sm:h-48 border-2 border-link-700"></div>
      </div>
    </div>

    <!-- Tidak ditemukan -->
    <div v-else-if="notFound" class="text-center py-16 sm:py-20">
      <p class="text-4xl sm:text-5xl mb-4">👤</p>
      <h1 class="font-display font-extrabold text-xl sm:text-2xl mb-2 text-link-700">Penulis tidak ditemukan</h1>
      <p class="text-slate-500 text-sm mb-6">Penulis "@{{ username }}" tidak ada di Gen Z News.</p>
      <router-link to="/" class="text-brand-600 font-extrabold text-sm hover:underline">← Kembali ke Beranda</router-link>
    </div>

    <p v-else-if="error" class="bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-semibold shadow-[3px_3px_0_#b45309]">{{ error }}</p>

    <template v-else-if="writer">
      <!-- Kartu profil -->
      <div class="y2k-card p-5 sm:p-6 lg:p-8 mb-8 sm:mb-10 flex flex-col sm:flex-row flex-wrap items-center gap-4 sm:gap-6">
        <UserAvatar
          :photo-url="writer.photoUrl"
          :name="displayName"
          size="xl"
          fallback-class="bg-brand-600 text-white"
          class="-rotate-3"
        />
        <div class="min-w-0 text-center sm:text-left">
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 class="font-groovy font-black text-xl sm:text-2xl lg:text-3xl text-link-700 truncate">{{ displayName }}</h1>
            <span class="text-[10px] font-groovy font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border-2 border-link-700 shadow-[2px_2px_0_#2a1038]" :class="role.badge">
              {{ role.label }}
            </span>
          </div>
          <p class="text-xs sm:text-sm font-semibold text-slate-400 mt-1">@{{ writer.username }}</p>
        </div>
        <div class="sm:ml-auto flex flex-col items-center sm:items-end gap-3 w-full sm:w-auto">
          <button
            v-if="isReader && !isSelf"
            @click="toggleFollow"
            :disabled="followBusy"
            class="w-full sm:w-auto text-xs sm:text-sm font-groovy font-black uppercase tracking-wide px-5 sm:px-6 py-2.5 rounded-full border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all disabled:opacity-60 touch-target"
            :class="following ? 'bg-amber-400 text-link-700' : 'bg-brand-600 text-white hover:bg-brand-500'"
          >
            {{ following ? '⭐ Mengikuti' : '＋ Follow Penulis' }}
          </button>
          <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 w-full sm:w-auto">
          <div class="bg-grape-100 border-2 border-grape-500 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 text-center shadow-[2px_2px_0_#6d28d9] sm:shadow-[3px_3px_0_#6d28d9]">
            <p class="font-groovy font-black text-base sm:text-xl text-grape-700">{{ articles.length }}</p>
            <p class="text-[9px] sm:text-[11px] font-bold text-grape-600">📰 Artikel</p>
          </div>
          <div class="bg-brand-50 border-2 border-brand-400 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 text-center shadow-[2px_2px_0_#d10b7b] sm:shadow-[3px_3px_0_#d10b7b]">
            <p class="font-groovy font-black text-base sm:text-xl text-brand-700">{{ totalViews.toLocaleString('id-ID') }}</p>
            <p class="text-[9px] sm:text-[11px] font-bold text-brand-600">👁 Dibaca</p>
          </div>
          <div class="bg-acid-100 border-2 border-acid-500 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 text-center shadow-[2px_2px_0_#93b913] sm:shadow-[3px_3px_0_#93b913]">
            <p class="font-groovy font-black text-base sm:text-xl text-link-700">{{ totalWords.toLocaleString('id-ID') }}</p>
            <p class="text-[9px] sm:text-[11px] font-bold text-link-700">✍️ Kata</p>
          </div>
          <div class="bg-emerald-50 border-2 border-emerald-400 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 text-center shadow-[2px_2px_0_#059669] sm:shadow-[3px_3px_0_#059669]">
            <p class="font-groovy font-black text-base sm:text-xl text-emerald-600">👍 {{ totalLikes.toLocaleString('id-ID') }}</p>
            <p class="text-[9px] sm:text-[11px] font-bold text-emerald-600">Suka</p>
          </div>
          <div class="bg-sky-50 border-2 border-sky-400 rounded-xl sm:rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 text-center shadow-[2px_2px_0_#0284c7] sm:shadow-[3px_3px_0_#0284c7]">
            <p class="font-groovy font-black text-base sm:text-xl text-sky-600">⭐ {{ followerCount.toLocaleString('id-ID') }}</p>
            <p class="text-[9px] sm:text-[11px] font-bold text-sky-600">Pengikut</p>
          </div>
          </div>
        </div>
      </div>

      <!-- Daftar artikel -->
      <div class="section-title mb-6 sm:mb-8">
        <span class="tag" style="background: var(--color-brand-500); color: #fff">✍️ Karya</span>
        <span class="text-sm sm:text-base">Artikel {{ displayName }}</span>
      </div>
      <div v-if="!articles.length" class="text-center py-12 sm:py-16 text-slate-500">
        <p class="text-4xl sm:text-5xl mb-3">📭</p>
        <p class="font-groovy font-bold">Belum ada artikel yang terbit dari penulis ini.</p>
      </div>
      <div v-else class="grid gap-4 sm:gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <NewsCard v-for="a in articles" :key="a.id" :article="a" />
      </div>
    </template>
  </div>
</template>
