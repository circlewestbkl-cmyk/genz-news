<script setup>
import { ref } from 'vue'
import { auth, roleInfo } from '../../api/auth'
import { userApi } from '../../api/users'
import { auditApi } from '../../api/audit'
import { compressImage } from '../../utils/image'
import UserAvatar from '../../components/UserAvatar.vue'

const user = ref(auth.current())
const role = roleInfo[user.value?.role] || { label: user.value?.role || 'User', badge: 'bg-slate-500 text-white' }

const photoSaving = ref(false)
const photoError = ref('')
const photoSaved = ref(false)

const form = ref({ current: '', next: '', confirm: '' })
const error = ref('')
const success = ref(false)
const loading = ref(false)

// Sinkronkan sesi lokal setelah foto berubah (navbar/admin ikut ter-update)
function refreshSession() {
  try {
    const cur = auth.current()
    if (cur && user.value) {
      cur.photoUrl = user.value.photoUrl
      localStorage.setItem('genz_session', JSON.stringify(cur))
    }
  } catch {
    /* abaikan */
  }
}

// Unggah foto profil (dikompres jadi data URL kecil)
async function onUploadPhoto(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    photoError.value = 'File harus berupa gambar (JPG/PNG/WebP).'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    photoError.value = 'Ukuran gambar maksimal 2MB.'
    return
  }
  photoSaving.value = true
  photoError.value = ''
  photoSaved.value = false
  try {
    const photoUrl = await compressImage(file, { width: 256, height: 256 })
    const updated = await userApi.update(user.value.id, { photoUrl })
    user.value = { ...user.value, photoUrl: updated.photoUrl }
    refreshSession()
    auditApi.log('profile_photo', `Foto profil @${user.value.username} diperbarui`)
    photoSaved.value = true
    setTimeout(() => (photoSaved.value = false), 3000)
  } catch (err) {
    photoError.value = err.message || 'Gagal mengunggah foto. Pastikan server data berjalan.'
  } finally {
    photoSaving.value = false
  }
}

// Hapus foto profil
async function removePhoto() {
  if (!user.value?.photoUrl) return
  photoSaving.value = true
  photoError.value = ''
  try {
    const updated = await userApi.update(user.value.id, { photoUrl: '' })
    user.value = { ...user.value, photoUrl: updated.photoUrl || '' }
    refreshSession()
    auditApi.log('profile_photo', `Foto profil @${user.value.username} dihapus`)
  } catch {
    photoError.value = 'Gagal menghapus foto. Pastikan server data berjalan.'
  } finally {
    photoSaving.value = false
  }
}

async function submit() {
  error.value = ''
  success.value = false
  if (!form.value.current || !form.value.next) {
    error.value = 'Password lama dan password baru wajib diisi.'
    return
  }
  if (form.value.next.length < 6) {
    error.value = 'Password baru minimal 6 karakter.'
    return
  }
  if (form.value.next !== form.value.confirm) {
    error.value = 'Konfirmasi password baru tidak cocok.'
    return
  }

  loading.value = true
  try {
    // Verifikasi password lama dulu
    const ok = await auth.verifyPassword(user.value.username, form.value.current)
    if (!ok) {
      error.value = 'Password lama salah.'
      loading.value = false
      return
    }
    await auth.changePassword(user.value.id, form.value.next)
    auditApi.log('password_change', `Password akun @${user.value.username} diubah`)
    success.value = true
    form.value = { current: '', next: '', confirm: '' }
  } catch {
    error.value = 'Gagal mengubah password. Pastikan server data berjalan.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl">
    <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900 mb-8">Profil Saya</h1>

    <!-- Info akun + foto profil -->
    <div class="bg-white rounded-lg border border-slate-200 p-6 mb-6">
      <div class="flex flex-wrap items-center gap-5">
        <UserAvatar :photo-url="user?.photoUrl" :name="user?.name || user?.username" size="xl" />
        <div class="min-w-0 flex-1">
          <p class="font-bold text-slate-900 text-lg">{{ user?.name }}</p>
          <p class="text-sm text-slate-400">@{{ user?.username }}</p>
          <span class="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded" :class="role.badge">
            {{ role.label }}
          </span>
        </div>
      </div>

      <!-- Unggah / hapus foto -->
      <div class="mt-5 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
        <label
          class="cursor-pointer inline-flex items-center gap-2 border border-slate-300 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {{ photoSaving ? 'Memproses…' : user?.photoUrl ? 'Ganti Foto Profil' : 'Upload Foto Profil' }}
          <input type="file" accept="image/*" class="hidden" @change="onUploadPhoto" :disabled="photoSaving" />
        </label>
        <button
          v-if="user?.photoUrl"
          @click="removePhoto"
          :disabled="photoSaving"
          class="text-sm font-semibold text-rose-600 border border-rose-200 rounded-lg px-4 py-2 hover:bg-rose-50 transition-colors disabled:opacity-50"
        >
          Hapus Foto
        </button>
        <p class="w-full text-xs text-slate-400">Maks 2MB — foto otomatis dipotong persegi &amp; dikompres. Foto ini tampil di Chat Redaksi, daftar user, dan profil penulis.</p>
        <p v-if="photoError" class="w-full text-xs text-red-600">{{ photoError }}</p>
        <p v-if="photoSaved" class="w-full text-xs font-bold text-emerald-600">✅ Foto profil berhasil disimpan.</p>
      </div>
    </div>

    <!-- Ganti password -->
    <div class="bg-white rounded-lg border border-slate-200 p-6">
      <h2 class="font-display font-bold text-lg text-slate-900 mb-1">Ganti Password</h2>
      <p class="text-sm text-slate-500 mb-5">Perbarui password akun kamu secara berkala.</p>

      <p
        v-if="success"
        class="mb-5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3"
      >
        ✅ Password berhasil diubah.
      </p>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">Password Lama</label>
          <input
            v-model="form.current"
            type="password"
            required
            placeholder="Password saat ini"
            class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">Password Baru</label>
          <input
            v-model="form.next"
            type="password"
            required
            minlength="6"
            placeholder="Minimal 6 karakter"
            class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">Konfirmasi Password Baru</label>
          <input
            v-model="form.confirm"
            type="password"
            required
            placeholder="Ulangi password baru"
            class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>

        <p v-if="error" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg px-6 py-2.5 text-sm font-bold transition-colors"
        >
          {{ loading ? 'Menyimpan...' : 'Simpan Password Baru' }}
        </button>
      </form>
    </div>
  </div>
</template>
