<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { auth, roleInfo } from '../../api/auth'
import { auditApi } from '../../api/audit'
import BrandLogo from '../../components/BrandLogo.vue'
import LoginSuccessModal from '../../components/LoginSuccessModal.vue'

const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

// Modal sukses login
const successModal = ref({ open: false, username: '', role: '' })

function goAfterLogin() {
  successModal.value.open = false
  router.push(route.query.redirect || { name: 'admin-dashboard' })
}

const demoAccounts = [
  { role: 'Admin', username: 'admin', password: 'admin123', note: 'Akses penuh + kelola user' },
  { role: 'Editor', username: 'editor', password: 'editor123', note: 'Kelola & terbitkan berita' },
  { role: 'Penulis', username: 'penulis', password: 'penulis123', note: 'Buat berita (draft)' },
]

async function login() {
  error.value = ''
  loading.value = true
  try {
    const result = await auth.login(username.value.trim(), password.value)
    if (result.ok) {
      auditApi.log('login', `Login berhasil sebagai ${result.user.role}`)
      successModal.value = {
        open: true,
        username: result.user.username,
        role: roleInfo[result.user.role]?.label || result.user.role,
      }
    } else {
      auditApi.log('login_failed', `Percobaan login username "${username.value.trim()}"`)
      if (result.reason === 'pending') {
        error.value = 'Akun kamu masih menunggu verifikasi Admin. Silakan coba lagi nanti.'
      } else if (result.reason === 'inactive') {
        error.value = 'Akun kamu sedang dinonaktifkan. Hubungi Admin untuk info lebih lanjut.'
      } else {
        error.value = 'Username atau password salah.'
      }
    }
  } catch {
    error.value = 'Gagal terhubung ke server data. Pastikan JSON Server berjalan (npm run server).'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-3 sm:px-4 py-8 sm:py-10">
    <div class="w-full max-w-md">
      <router-link to="/" class="flex items-center justify-center mb-6 sm:mb-8" title="Gen Z News — Beranda">
        <BrandLogo size="lg" />
      </router-link>

      <div class="y2k-card p-5 sm:p-8">
        <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Backoffice ✦ Redaksi</p>
        <h1 class="font-groovy font-black text-xl sm:text-2xl text-link-700">Masuk ke Backoffice</h1>
        <p class="text-slate-500 text-xs sm:text-sm mt-1 mb-5 sm:mb-6 font-semibold">Kelola dan tulis berita di Gen Z News. 🛠️</p>

        <form class="space-y-3.5 sm:space-y-4" @submit.prevent="login">
          <div>
            <label class="block text-xs sm:text-sm font-extrabold text-link-700 mb-1.5">Username</label>
            <input
              v-model="username"
              type="text"
              required
              placeholder="admin"
              class="w-full border-2 border-slate-300 rounded-xl px-3 sm:px-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label class="block text-xs sm:text-sm font-extrabold text-link-700 mb-1.5">Password</label>
            <input
              v-model="password"
              type="password"
              required
              placeholder="••••••••"
              class="w-full border-2 border-slate-300 rounded-xl px-3 sm:px-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600"
            />
          </div>

          <p v-if="error" class="text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 border-2 border-rose-300 rounded-xl px-3 sm:px-4 py-3">{{ error }}</p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white rounded-full py-3.5 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all touch-target"
          >
            {{ loading ? 'Memeriksa...' : 'Masuk 🚀' }}
          </button>
        </form>

        <div class="mt-5 sm:mt-6 bg-acid-100 border-2 border-acid-500 rounded-xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-semibold text-link-700">
          <p class="font-groovy font-black mb-2">🔑 Akun demo</p>
          <ul class="space-y-1.5">
            <li v-for="acc in demoAccounts" :key="acc.username">
              <span class="font-extrabold text-link-700">{{ acc.role }}</span>:
              <code class="bg-white border border-acid-600 px-1.5 py-0.5 rounded">{{ acc.username }}</code> /
              <code class="bg-white border border-acid-600 px-1.5 py-0.5 rounded">{{ acc.password }}</code>
              <span class="text-link-700/60 hidden sm:inline"> — {{ acc.note }}</span>
            </li>
          </ul>
        </div>

        <p class="text-center text-xs font-semibold text-slate-400 mt-4 sm:mt-5">
          Belum punya akun? <router-link to="/daftar" class="text-brand-600 font-extrabold hover:underline">Daftar di sini</router-link>
          &nbsp;•&nbsp; <router-link to="/" class="hover:text-brand-600 font-extrabold">Kembali ke website</router-link>
        </p>
      </div>
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
