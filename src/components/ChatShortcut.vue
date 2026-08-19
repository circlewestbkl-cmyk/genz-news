<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { chatApi, unreadCountFor } from '../api/chat'
import { auth } from '../api/auth'

const unread = ref(0)
let timer = null

async function refresh() {
  try {
    const me = auth.current()
    if (!me) return
    const msgs = await chatApi.list()
    unread.value = unreadCountFor(msgs, me.username)
  } catch {
    /* server tidak aktif — abaikan */
  }
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 10000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <router-link
    to="/admin/pesan"
    title="Chat Redaksi"
    class="relative p-2 rounded-2xl border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] text-link-700 hover:bg-brand-50 hover:-translate-y-0.5 transition-all"
  >
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
    </svg>
    <span
      v-if="unread"
      class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black grid place-items-center border border-link-700"
    >
      {{ unread > 99 ? '99+' : unread }}
    </span>
  </router-link>
</template>
