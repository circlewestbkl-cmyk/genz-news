<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auth, roleInfo } from '../api/auth'
import BrandLogo from '../components/BrandLogo.vue'
import LoginSuccessModal from '../components/LoginSuccessModal.vue'

const route = useRoute()
const router = useRouter()

const email = ref('')
const error = ref('')
const loading = ref(false)
const user = auth.current()

// Modal sukses login
const successModal = ref({ open: false, username: '', role: 'Pembaca' })

function goAfterLogin() {
  successModal.value.open = false
  const redirect = route.query.redirect?.toString() || '/'
  router.push(redirect)
}

// Sudah login → langsung lanjut
if (user) {
  const redirect = route.query.redirect?.toString() || '/'
  router.replace(redirect)
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const res = await auth.readerLogin(email.value)
    if (!res.ok) {
      error.value = res.message || 'Gagal masuk. Coba lagi.'
      return
    }
    successModal.value = {
      open: true,
      username: res.user.username,
      role: 'Pembaca',
    }
  } catch {
    error.value = 'Gagal masuk. Pastikan server data berjalan.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
    <div class="w-full max-w-md">
      <router-link to="/" class="flex items-center justify-center mb-6 sm:mb-8" title="Gen Z News — Beranda">
        <BrandLogo size="lg" />
      </router-link>

      <div class="y2k-card p-5 sm:p-8">
        <div class="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
          <span class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-grape-100 border-2 border-link-700 grid place-items-center text-xl sm:text-2xl shadow-[3px_3px_0_#2a1038] rotate-3">👋</span>
          <div>
            <h1 class="font-groovy font-black text-xl sm:text-2xl text-link-700">Masuk Pembaca</h1>
            <p class="text-slate-500 text-xs sm:text-sm font-semibold">Masuk buat nimbrung di kolom komentar!</p>
          </div>
        </div>

        <form class="space-y-3.5 sm:space-y-4" @submit.prevent="submit">
          <div>
            <label class="block text-xs sm:text-sm font-extrabold text-link-700 mb-1.5">Alamat Gmail</label>
            <div class="relative">
              <input
                v-model="email"
                type="email"
                required
                placeholder="nama@gmail.com"
                class="w-full border-2 border-slate-300 rounded-xl pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600"
              />
              <span class="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2">
                <svg class="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </span>
            </div>
            <p class="text-[10px] sm:text-xs font-semibold text-slate-400 mt-1 sm:mt-1.5">
              Demo: masukkan alamat Gmail apa pun — akun pembaca dibuat otomatis, tanpa verifikasi asli.
            </p>
          </div>

          <p v-if="error" class="text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 border-2 border-rose-300 rounded-xl px-3 sm:px-4 py-3">{{ error }}</p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border-2 border-link-700 rounded-full py-3.5 text-sm font-groovy font-bold text-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all disabled:opacity-60 touch-target"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {{ loading ? 'Memproses…' : 'Masuk dengan Google' }}
          </button>
        </form>

        <p class="text-center text-xs font-semibold text-slate-400 mt-4 sm:mt-5">
          Punya akun penulis/editor/admin? <router-link to="/admin/login" class="text-brand-600 font-extrabold hover:underline">Masuk di Backoffice</router-link>
        </p>
      </div>

      <p class="text-center text-xs font-semibold text-slate-400 mt-4 sm:mt-5">
        <router-link to="/" class="text-brand-600 font-extrabold hover:underline">← Kembali ke Beranda</router-link>
      </p>
    </div>

    <!-- Modal sukses login -->
    <LoginSuccessModal
      :open="successModal.open"
      :username="successModal.username"
      :role="successModal.role"
      @continue="goAfterLogin"
    />
  </div>
</template>
