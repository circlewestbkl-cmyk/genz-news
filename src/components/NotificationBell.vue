<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../api/auth'
import { notificationApi, notificationTypeInfo, isUnread, isVisible } from '../api/notifications'
import { timeAgo } from '../utils/format'

const router = useRouter()
const open = ref(false)
const notifications = ref([])
const unread = ref(0)
let timer = null

const currentUser = computed(() => auth.current())
const currentUsername = computed(() => currentUser.value?.username)

// Hanya notifikasi yang relevan untuk user ini (target ke dia / broadcast utk editor)
const visibleNotifications = computed(() =>
  notifications.value.filter((n) => isVisible(n, currentUser.value))
)

function typeInfo(n) {
  return notificationTypeInfo[n.type] || {
    label: 'Notifikasi',
    icon: '🔔',
    desc: () => 'Aktivitas baru',
  }
}

async function refresh() {
  try {
    const list = await notificationApi.list()
    notifications.value = list
    unread.value = list
      .filter((n) => isVisible(n, currentUser.value))
      .filter((n) => isUnread(n, currentUsername.value)).length
  } catch {
    /* server data tidak aktif — abaikan */
  }
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 20000)
  // Chat dibaca di halaman chat → langsung sinkronkan angka notifikasi
  window.addEventListener('genz:chat-read', refresh)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('genz:chat-read', refresh)
})

function toggle() {
  open.value = !open.value
  if (open.value) refresh()
}

async function openNotification(n) {
  const me = currentUsername.value
  if (me && isUnread(n, me)) {
    try {
      await notificationApi.markRead(n.id, me)
      n.readBy = [...(n.readBy || []), me]
      unread.value = Math.max(0, unread.value - 1)
    } catch {
      /* abaikan */
    }
  }
  open.value = false
  if (n.type === 'article_created') {
    router.push({ name: 'preview', params: { id: n.articleId } })
  } else if (n.type === 'comment_new') {
    router.push({ name: 'article', params: { id: n.articleId } })
  } else if (n.type === 'chat_mention') {
    router.push({ name: 'admin-chat', query: { room: n.roomId || 'group' } })
  } else if (n.type === 'chat_autoblock') {
    router.push({ name: 'admin-chat' })
  } else if (n.type === 'article_new') {
    router.push({ name: 'article', params: { id: n.articleId } })
  }
}

async function markAll() {
  const me = currentUser.value
  if (!me) return
  try {
    await notificationApi.markAllRead(me)
    notifications.value.forEach((n) => {
      if (isVisible(n, me)) n.readBy = [...(n.readBy || []), me.username]
    })
    unread.value = 0
  } catch {
    /* abaikan */
  }
}
</script>

<template>
  <div class="relative">
    <!-- Tombol bell -->
    <button
      @click="toggle"
      class="relative p-2 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-50 transition-colors touch-target"
      title="Notifikasi"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span
        v-if="unread"
        class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center"
      >
        {{ unread > 99 ? '99+' : unread }}
      </span>
    </button>

    <!-- Overlay penutup saat klik di luar -->
    <div v-if="open" class="fixed inset-0 z-40" @click="open = false"></div>

    <!-- Dropdown -->
    <Transition name="notif">
      <div
        v-if="open"
        class="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 lg:w-96 bg-white rounded-xl border-2 border-slate-200 shadow-xl overflow-hidden z-50 max-h-[70vh] sm:max-h-80"
      >
        <div class="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 flex items-center justify-between gap-2 sm:gap-3">
          <p class="font-display font-bold text-xs sm:text-sm text-slate-900">Notifikasi</p>
          <button
            v-if="unread"
            @click="markAll"
            class="text-[10px] sm:text-xs font-semibold text-brand-600 hover:underline shrink-0 touch-friendly"
          >
            Tandai semua dibaca
          </button>
        </div>

        <div class="overflow-y-auto max-h-[60vh] sm:max-h-80">
          <div v-if="!visibleNotifications.length" class="text-center py-8 sm:py-10 text-slate-400 text-xs sm:text-sm">
            Belum ada notifikasi.
          </div>
          <button
            v-for="n in visibleNotifications"
            :key="n.id"
            @click="openNotification(n)"
            class="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 flex gap-2.5 sm:gap-3 border-b border-slate-50 hover:bg-slate-50 transition-colors touch-friendly"
            :class="isUnread(n, currentUsername) ? 'bg-brand-50/40' : 'opacity-70'"
          >
            <span class="text-base sm:text-lg shrink-0">{{ typeInfo(n).icon }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-[10px] sm:text-xs font-semibold text-slate-900">{{ typeInfo(n).desc(n) }}</span>
              <span class="block text-xs sm:text-sm text-slate-700 truncate">{{ n.title }}</span>
              <span class="block text-[9px] sm:text-[11px] text-slate-400 mt-0.5">{{ timeAgo(n.createdAt) }}</span>
            </span>
            <span
              v-if="isUnread(n, currentUsername)"
              class="ml-auto mt-1 sm:mt-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0"
            ></span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notif-enter-active,
.notif-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.notif-enter-from,
.notif-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
