<template>
  <SwipeContainer
    @swipe-right="goBack"
    @swipe-up="scrollToComments"
    class="min-h-screen"
  >
    <article class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 safe-area-bottom">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-6 overflow-x-auto scrollbar-hide pb-2" aria-label="Breadcrumb">
        <router-link to="/" class="hover:text-brand-600 transition-colors shrink-0">Beranda</router-link>
        <span>›</span>
        <router-link
          v-if="article?.category"
          :to="{ name: 'category', params: { category: article.category.toLowerCase() } }"
          class="hover:text-brand-600 transition-colors shrink-0"
        >
          {{ article.category }}
        </router-link>
        <span v-if="article?.category">›</span>
        <span class="text-slate-600 truncate">{{ article?.title }}</span>
      </nav>

      <!-- Back button (mobile) -->
      <button
        @click="goBack"
        class="md:hidden flex items-center gap-2 text-sm font-bold text-brand-600 mb-4 -ml-2 px-2 py-1 rounded-lg hover:bg-brand-50 transition-all touch-target"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Kembali
      </button>

      <!-- Header -->
      <header class="mb-8">
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <router-link
            v-if="article?.category"
            :to="{ name: 'category', params: { category: article.category.toLowerCase() } }"
            class="px-3 py-1 rounded-full text-xs font-extrabold border-2 border-link-700 bg-grape-600 text-white shadow-[2px_2px_0_#2a1038] hover:bg-grape-500 transition-colors touch-friendly"
          >
            {{ article.category }}
          </router-link>
          <span v-if="article?.publishedAt" class="text-xs font-semibold text-slate-400">
            {{ formatDate(article.publishedAt) }}
          </span>
          <span v-if="article?.readTime" class="text-xs font-semibold text-slate-400">
            • {{ article.readTime }} min read
          </span>
        </div>

        <h1 class="text-2xl sm:text-3xl lg:text-4xl font-groovy font-extrabold text-link-700 leading-tight mb-4">
          {{ article?.title }}
        </h1>

        <p v-if="article?.excerpt" class="text-base sm:text-lg text-slate-500 font-medium leading-relaxed mb-6">
          {{ article.excerpt }}
        </p>

        <!-- Author & actions -->
        <div class="flex flex-wrap items-center justify-between gap-4 pb-6 border-b-2 border-dashed border-slate-200">
          <div class="flex items-center gap-3">
            <UserAvatar :name="article?.author" size="md" />
            <div>
              <p class="text-sm font-extrabold text-link-700">{{ article?.author }}</p>
              <p class="text-xs font-semibold text-slate-400">Penulis</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="toggleReaction('👍')"
              class="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border-2 border-link-700 transition-all touch-friendly"
              :class="hasReacted('👍') ? 'bg-acid-500 shadow-[2px_2px_0_#2a1038]' : 'bg-white hover:bg-slate-50'"
            >
              👍 <span class="text-xs">{{ reactions['👍'] || 0 }}</span>
            </button>
            <button
              @click="toggleReaction('❤️')"
              class="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border-2 border-link-700 transition-all touch-friendly"
              :class="hasReacted('❤️') ? 'bg-rose-100 shadow-[2px_2px_0_#2a1038]' : 'bg-white hover:bg-slate-50'"
            >
              ❤️ <span class="text-xs">{{ reactions['❤️'] || 0 }}</span>
            </button>
            <button
              @click="shareArticle"
              class="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold border-2 border-link-700 bg-white hover:bg-brand-50 transition-all touch-friendly"
            >
              🔗 Share
            </button>
          </div>
        </div>
      </header>

      <!-- Featured Image -->
      <div v-if="article?.image" class="mb-8">
        <img
          :src="article.image"
          :alt="article.title"
          class="w-full h-48 sm:h-64 lg:h-80 object-cover rounded-2xl border-2 border-link-700 shadow-[4px_4px_0_#2a1038]"
          loading="lazy"
        />
      </div>

      <!-- Content -->
      <div class="prose prose-lg max-w-none mb-12 text-slate-700 leading-relaxed">
        <div v-html="article?.content"></div>
      </div>

      <!-- Tags -->
      <div v-if="article?.tags?.length" class="flex flex-wrap gap-2 mb-8">
        <span
          v-for="tag in article.tags"
          :key="tag"
          class="px-3 py-1 rounded-full text-xs font-bold border-2 border-link-700 bg-slate-100 text-slate-600 shadow-[2px_2px_0_#2a1038]"
        >
          #{{ tag }}
        </span>
      </div>

      <!-- Share buttons mobile -->
      <div class="md:hidden flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
        <button
          @click="shareArticle"
          class="flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] hover:bg-brand-50 transition-all touch-target shrink-0"
        >
          🔗 Salin Link
        </button>
        <button
          class="flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] hover:bg-blue-50 transition-all touch-target shrink-0"
        >
          📱 WhatsApp
        </button>
        <button
          class="flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] hover:bg-blue-50 transition-all touch-target shrink-0"
        >
          🐦 Twitter
        </button>
      </div>

      <!-- Comments Section -->
      <section ref="commentsSection" class="border-t-2 border-dashed border-slate-200 pt-8">
        <h2 class="text-xl font-groovy font-extrabold text-link-700 mb-6">
          💬 Komentar ({{ comments.length }})
        </h2>

        <!-- Comment form -->
        <div class="mb-8 p-4 rounded-2xl border-2 border-link-700 bg-slate-50 shadow-[3px_3px_0_#2a1038]">
          <textarea
            v-model="newComment"
            placeholder="Tulis komentar seru..."
            class="w-full bg-white rounded-xl border-2 border-slate-200 px-4 py-3 text-sm placeholder-slate-400 focus:outline-none focus:border-brand-600 transition-colors resize-none min-h-[80px]"
            rows="3"
          ></textarea>
          <div class="flex justify-end mt-3">
            <button
              @click="submitComment"
              :disabled="!newComment.trim()"
              class="px-5 py-2.5 rounded-full text-sm font-extrabold border-2 border-link-700 shadow-[2px_2px_0_#2a1038] transition-all touch-target"
              :class="newComment.trim() ? 'bg-brand-600 text-white hover:bg-brand-500' : 'bg-slate-200 text-slate-400 cursor-not-allowed'"
            >
              Kirim 🚀
            </button>
          </div>
        </div>

        <!-- Comments list -->
        <div class="space-y-4">
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="p-4 rounded-2xl border-2 border-link-700 bg-white shadow-[3px_3px_0_#2a1038]"
          >
            <div class="flex items-start gap-3">
              <UserAvatar :name="comment.author" size="sm" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-extrabold text-link-700">{{ comment.author }}</span>
                  <span class="text-xs font-semibold text-slate-400">{{ formatDate(comment.date) }}</span>
                </div>
                <p class="text-sm text-slate-600 leading-relaxed">{{ comment.text }}</p>
                <div class="flex items-center gap-3 mt-2">
                  <button class="text-xs font-bold text-slate-400 hover:text-brand-600 transition-colors touch-target">
                    👍 {{ comment.likes || 0 }}
                  </button>
                  <button class="text-xs font-bold text-slate-400 hover:text-brand-600 transition-colors touch-target">
                    Balas
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Swipe hint (mobile) -->
      <div class="md:hidden text-center text-xs text-slate-400 mt-8 mb-4">
        👈 Geser ke kiri untuk kembali
      </div>
    </article>
  </SwipeContainer>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { articleApi } from '../api/articles'
import { commentApi } from '../api/comments'
import UserAvatar from '../components/UserAvatar.vue'
import SwipeContainer from '../components/SwipeContainer.vue'

const route = useRoute()
const router = useRouter()
const commentsSection = ref(null)

const article = ref(null)
const comments = ref([])
const newComment = ref('')
const reactions = ref({ '👍': 0, '❤️': 0 })
const userReactions = ref(new Set())

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function toggleReaction(emoji) {
  if (userReactions.value.has(emoji)) {
    userReactions.value.delete(emoji)
    reactions.value[emoji] = Math.max(0, (reactions.value[emoji] || 0) - 1)
  } else {
    userReactions.value.add(emoji)
    reactions.value[emoji] = (reactions.value[emoji] || 0) + 1
  }
}

function hasReacted(emoji) {
  return userReactions.value.has(emoji)
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function scrollToComments() {
  commentsSection.value?.scrollIntoView({ behavior: 'smooth' })
}

function shareArticle() {
  if (navigator.share) {
    navigator.share({
      title: article.value?.title,
      url: window.location.href
    })
  } else {
    navigator.clipboard.writeText(window.location.href)
  }
}

async function submitComment() {
  if (!newComment.value.trim()) return
  // Mock comment submission
  comments.value.unshift({
    id: Date.now(),
    author: 'Anda',
    text: newComment.value.trim(),
    date: new Date().toISOString(),
    likes: 0
  })
  newComment.value = ''
}

onMounted(async () => {
  try {
    article.value = await articleApi.get(route.params.id)
    if (article.value) {
      reactions.value = { '👍': article.value.reactions?.like || 0, '❤️': article.value.reactions?.love || 0 }
      comments.value = await commentApi.listByArticle(route.params.id)
    }
  } catch (e) {
    console.error('Failed to load article:', e)
  }
})
</script>
