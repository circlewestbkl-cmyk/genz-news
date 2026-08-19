<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth, roleInfo } from '../../api/auth'
import { auditApi } from '../../api/audit'
import NotificationBell from '../../components/NotificationBell.vue'
import BrandLogo from '../../components/BrandLogo.vue'
import UserAvatar from '../../components/UserAvatar.vue'
import ChatShortcut from '../../components/ChatShortcut.vue'

const router = useRouter()
const route = useRoute()
const user = auth.current()
const role = roleInfo[user?.role] || { label: user?.role || 'User', badge: 'bg-slate-500 text-white' }

// Tombol "kembali ke menu" — hanya tampil di luar beranda (gaya Android home button)
const isHome = computed(() => route.path === '/admin')

function goHome() {
  router.push('/admin')
}

function logout() {
  auditApi.log('logout', 'Keluar dari backoffice')
  auth.logout()
  router.push({ name: 'admin-login' })
}
</script>

<template>
  <div class="min-h-screen bg-[#fff9f1] text-link-700">
    <!-- Top app bar -->
    <header class="sticky top-0 z-40 bg-[#fff9f1] border-b-2 border-link-700 shadow-[0_4px_0_#d6e4ff] safe-area-top">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-1.5 sm:gap-3">
        <button
          v-if="!isHome"
          @click="goHome"
          title="Kembali ke menu"
          class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] grid place-items-center text-link-700 hover:bg-brand-50 hover:-translate-y-0.5 transition-all touch-target"
        >
          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <router-link to="/admin" class="flex items-center shrink-0" title="Gen Z News — Backoffice">
          <BrandLogo size="sm" />
        </router-link>

        <span class="text-[9px] sm:text-[10px] font-groovy font-bold uppercase tracking-wide px-2 sm:px-2.5 py-1 rounded-full border-2 border-link-700 shadow-[2px_2px_0_#2a1038] shrink-0" :class="role.badge">
          {{ role.label }}
        </span>

        <div class="ml-auto flex items-center gap-0.5 sm:gap-2">
          <router-link
            to="/admin/profil"
            class="flex items-center gap-1.5 sm:gap-2 group touch-target"
            title="Profil Saya — ubah foto profil &amp; password"
          >
            <UserAvatar :photo-url="user?.photoUrl" :name="user?.name || user?.username" size="sm" />
            <span class="hidden lg:block text-sm font-extrabold text-link-700 truncate max-w-[160px] group-hover:text-brand-600 transition-colors">{{ user?.name }}</span>
          </router-link>
          <ChatShortcut />
          <NotificationBell />
          <button
            @click="logout"
            class="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-extrabold px-2.5 sm:px-3.5 py-2 rounded-full border-2 border-link-700 bg-white text-link-700 shadow-[2px_2px_0_#2a1038] hover:bg-rose-50 hover:text-rose-600 hover:-translate-y-0.5 transition-all touch-target"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span class="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Konten -->
    <main class="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
      <router-view />
    </main>
  </div>
</template>
