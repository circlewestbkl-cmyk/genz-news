<script setup>
import { ref } from 'vue'
import { userApi } from '../api/users'
import { sha256 } from '../utils/hash'
import BrandLogo from '../components/BrandLogo.vue'

const form = ref({ name: '', penName: '', username: '', password: '', confirm: '' })
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function submit() {
  error.value = ''
  if (!form.value.name.trim() || !form.value.penName.trim() || !form.value.username.trim() || !form.value.password.trim()) {
    error.value = 'Nama lengkap, nama pena, username, dan password wajib diisi.'
    return
  }
  if (form.value.password.length < 6) {
    error.value = 'Password minimal 6 karakter.'
    return
  }
  if (form.value.password !== form.value.confirm) {
    error.value = 'Konfirmasi password tidak cocok.'
    return
  }

  loading.value = true
  try {
    // Cek username unik
    const dup = await userApi.findByUsername(form.value.username.trim())
    if (dup.length) {
      error.value = `Username "${form.value.username}" sudah dipakai. Coba username lain.`
      loading.value = false
      return
    }
    // Cek nama pena unik (tidak boleh sama dengan penulis lain)
    const dupPen = await userApi.findByPenName(form.value.penName.trim())
    if (dupPen.length) {
      error.value = `Nama pena "${form.value.penName}" sudah dipakai penulis lain. Pilih nama pena yang berbeda.`
      loading.value = false
      return
    }
    // Semua pendaftar otomatis berperan Penulis & berstatus menunggu verifikasi
    // Password disimpan sebagai hash (bukan plain text)
    const passwordHash = await sha256(form.value.password)
    await userApi.create({
      name: form.value.name.trim(),
      penName: form.value.penName.trim(),
      username: form.value.username.trim(),
      passwordHash,
      role: 'writer',
      status: 'pending',
    })
    done.value = true
  } catch {
    error.value = 'Gagal mendaftar. Pastikan server data berjalan (npm run server).'
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

      <!-- Sukses -->
      <div v-if="done" class="y2k-card p-6 sm:p-8 text-center">
        <div class="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-emerald-100 border-2 border-emerald-600 grid place-items-center mb-4 shadow-[3px_3px_0_#059669]">
          <svg class="w-7 h-7 sm:w-8 sm:h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="font-groovy font-black text-xl sm:text-2xl text-link-700 mb-2">Pendaftaran Berhasil! 🎉</h1>
        <p class="text-xs sm:text-sm text-slate-500 mb-5 sm:mb-6">
          Akun kamu sedang <span class="font-extrabold text-amber-600">menunggu verifikasi Admin</span>.
          Setelah diverifikasi, kamu bisa masuk dan mulai nulis berita.
        </p>
        <router-link
          to="/admin/login"
          class="inline-block bg-brand-600 hover:bg-brand-500 text-white rounded-full px-6 sm:px-8 py-3 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all touch-target"
        >
          Ke Halaman Login →
        </router-link>
      </div>

      <!-- Form daftar -->
      <div v-else class="y2k-card p-5 sm:p-8">
        <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Gabung Yuk ✦</p>
        <h1 class="font-groovy font-black text-xl sm:text-2xl text-link-700">Daftar Akun</h1>
        <p class="text-slate-500 text-xs sm:text-sm mt-1 mb-5 sm:mb-6">Bergabung sebagai penulis di Gen Z News. ✨</p>

        <form class="space-y-3.5 sm:space-y-4" @submit.prevent="submit">
          <div>
            <label class="block text-xs sm:text-sm font-extrabold text-link-700 mb-1.5">Nama Lengkap</label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="Nama kamu"
              class="w-full border-2 border-slate-300 rounded-xl px-3 sm:px-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label class="block text-xs sm:text-sm font-extrabold text-link-700 mb-1.5">Nama Pena</label>
            <input
              v-model="form.penName"
              type="text"
              required
              placeholder="Contoh: Andra Media"
              class="w-full border-2 border-slate-300 rounded-xl px-3 sm:px-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600"
            />
            <p class="text-[10px] sm:text-xs font-semibold text-slate-400 mt-1">✍️ Nama ini yang tampil sebagai penulis artikelmu dan tidak bisa diubah.</p>
          </div>
          <div>
            <label class="block text-xs sm:text-sm font-extrabold text-link-700 mb-1.5">Username</label>
            <input
              v-model="form.username"
              type="text"
              required
              placeholder="username"
              class="w-full border-2 border-slate-300 rounded-xl px-3 sm:px-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label class="block text-xs sm:text-sm font-extrabold text-link-700 mb-1.5">Password</label>
            <input
              v-model="form.password"
              type="password"
              required
              minlength="6"
              placeholder="Minimal 6 karakter"
              class="w-full border-2 border-slate-300 rounded-xl px-3 sm:px-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label class="block text-xs sm:text-sm font-extrabold text-link-700 mb-1.5">Konfirmasi Password</label>
            <input
              v-model="form.confirm"
              type="password"
              required
              placeholder="Ulangi password"
              class="w-full border-2 border-slate-300 rounded-xl px-3 sm:px-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600"
            />
          </div>

          <p v-if="error" class="text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 border-2 border-rose-300 rounded-xl px-3 sm:px-4 py-3">{{ error }}</p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white rounded-full py-3.5 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all touch-target"
          >
            {{ loading ? 'Mendaftar...' : 'Daftar 🚀' }}
          </button>
        </form>

        <div class="mt-4 sm:mt-6 bg-acid-100 border-2 border-acid-500 rounded-xl px-3 sm:px-4 py-3 text-[10px] sm:text-xs font-semibold text-link-700">
          <p>
            📝 Mendaftar sebagai <span class="font-extrabold text-emerald-700">Penulis</span> — berita kamu
            tersimpan sebagai draft dan diterbitkan oleh Editor/Admin. Akun harus
            <span class="font-extrabold text-amber-600">diverifikasi Admin</span> sebelum bisa masuk.
          </p>
        </div>

        <p class="text-center text-xs font-semibold text-slate-400 mt-4 sm:mt-5">
          Sudah punya akun? <router-link to="/admin/login" class="text-brand-600 font-extrabold hover:underline">Masuk di sini</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
