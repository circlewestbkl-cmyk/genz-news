<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { userApi } from '../../api/users'
import { PERMISSIONS, ROLE_PERMISSIONS, roleInfo } from '../../api/auth'
import { auditApi } from '../../api/audit'
import { sha256 } from '../../utils/hash'
import { compressImage } from '../../utils/image'
import UserAvatar from '../../components/UserAvatar.vue'

const route = useRoute()
const router = useRouter()

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'writer', label: 'Penulis' },
  { value: 'reader', label: 'Pembaca' },
]

const form = ref({ name: '', username: '', penName: '', password: '', role: 'writer', permissions: [], photoUrl: '' })
const photoSaving = ref(false)
const photoError = ref('')
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notFound = ref(false)
const toast = ref('')

const roleHint = computed(() => {
  const hints = {
    admin: 'Kelola user, recycle bin & audit log — tidak mengelola berita.',
    editor: 'Kelola & terbitkan semua berita.',
    writer: 'Hanya berita miliknya, tersimpan sebagai draft.',
    reader: 'Hanya membaca & berkomentar di website (biasanya via Masuk dengan Google).',
  }
  return hints[form.value.role] || ''
})

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 3000)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const u = await userApi.get(route.params.id)
    if (!u || u.id == null) {
      notFound.value = true
      return
    }
    form.value = {
      name: u.name || '',
      username: u.username || '',
      penName: u.penName || '',
      password: '',
      role: u.role || 'writer',
      permissions: [...(u.permissions || [])],
      photoUrl: u.photoUrl || '',
    }
  } catch (e) {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Unggah foto profil user (dikompres jadi data URL kecil)
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
  try {
    form.value.photoUrl = await compressImage(file, { width: 256, height: 256 })
    showToast('Foto profil diperbarui — simpan perubahan untuk menerapkannya.')
  } catch (err) {
    photoError.value = err.message || 'Gagal memproses gambar.'
  } finally {
    photoSaving.value = false
  }
}

async function submit() {
  error.value = ''
  if (form.value.password && form.value.password.length < 6) {
    error.value = 'Password minimal 6 karakter.'
    return
  }

  saving.value = true
  try {
    const patch = {
      name: form.value.name.trim(),
      username: form.value.username.trim(),
      // Nama pena tidak dikirim saat edit — immutable (hanya ditetapkan saat pendaftaran/tambah)
      role: form.value.role,
      permissions: form.value.permissions,
      photoUrl: form.value.photoUrl,
    }
    if (form.value.password.trim()) {
      patch.passwordHash = await sha256(form.value.password.trim())
    }
    await userApi.update(route.params.id, patch)
    auditApi.log(
      'user_update',
      `User "${patch.username}" diperbarui` +
        (form.value.permissions.length
          ? ` (+${form.value.permissions.length} izin tambahan)`
          : '')
    )
    showToast('User berhasil diperbarui.')
    router.push({ name: 'admin-users' })
  } catch {
    error.value = 'Gagal menyimpan user. Pastikan JSON Server berjalan.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <!-- Toast -->
    <div
      v-if="toast"
      class="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm px-5 py-3 rounded-lg shadow-lg"
    >
      {{ toast }}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">Edit User</h1>
        <p class="text-slate-500 text-sm mt-1">Perbarui role, password, dan hak akses user.</p>
      </div>
      <router-link
        :to="{ name: 'admin-users' }"
        class="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg px-4 py-2.5 transition-colors"
      >
        ← Kembali ke Kelola User
      </router-link>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-lg border border-slate-200 p-8 space-y-4 animate-pulse">
      <div class="h-4 bg-slate-200 rounded w-1/3"></div>
      <div class="h-10 bg-slate-200 rounded w-full"></div>
      <div class="h-10 bg-slate-200 rounded w-full"></div>
    </div>

    <!-- Tidak ditemukan -->
    <div v-else-if="notFound" class="bg-white rounded-lg border border-slate-200 p-10 text-center">
      <p class="text-4xl mb-3">🔍</p>
      <h2 class="font-display font-bold text-xl text-slate-900 mb-2">User tidak ditemukan</h2>
      <p class="text-sm text-slate-500 mb-5">User yang kamu cari mungkin sudah dihapus.</p>
      <router-link
        :to="{ name: 'admin-users' }"
        class="inline-block text-brand-600 font-semibold text-sm hover:underline"
      >
        ← Kembali ke Kelola User
      </router-link>
    </div>

    <!-- Form edit -->
    <div v-else class="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100">
        <h2 class="font-display font-bold text-lg text-slate-900">Edit User</h2>
        <p class="text-xs text-slate-400 mt-0.5">Memperbarui akun @{{ form.username }}</p>
      </div>

      <form class="p-6" @submit.prevent="submit">
        <!-- Foto profil -->
        <div class="mb-6 flex flex-wrap items-center gap-5">
          <UserAvatar :photo-url="form.photoUrl" :name="form.name || form.username" size="lg" />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-700 mb-1.5">Foto Profil</p>
            <div class="flex flex-wrap items-center gap-2">
              <label
                class="cursor-pointer inline-flex items-center gap-2 border border-slate-300 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-brand-600 transition-colors"
              >
                {{ photoSaving ? 'Memproses…' : form.photoUrl ? 'Ganti Foto' : 'Upload Foto' }}
                <input type="file" accept="image/*" class="hidden" @change="onUploadPhoto" :disabled="photoSaving" />
              </label>
              <button
                v-if="form.photoUrl"
                type="button"
                @click="form.photoUrl = ''"
                class="text-sm font-semibold text-rose-600 border border-rose-200 rounded-lg px-4 py-2 hover:bg-rose-50 transition-colors"
              >
                Hapus Foto
              </button>
            </div>
            <p v-if="photoError" class="text-xs text-red-600 mt-1">{{ photoError }}</p>
            <p class="text-xs text-slate-400 mt-1">Maks 2MB — foto tampil di Chat Redaksi &amp; daftar user. Klik "Simpan Perubahan" untuk menerapkan.</p>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Nama Lengkap</label>
            <input
              v-model="form.name"
              type="text"
              disabled
              placeholder="Nama user"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            <p class="text-xs text-slate-400 mt-1.5">Nama tidak bisa diubah oleh Admin.</p>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
            <input
              v-model="form.username"
              type="text"
              disabled
              placeholder="username"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            <p class="text-xs text-slate-400 mt-1.5">Username tidak bisa diubah oleh Admin.</p>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Nama Pena</label>
            <input
              v-model="form.penName"
              type="text"
              disabled
              placeholder="Tidak bisa diubah"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
            <p class="text-xs text-slate-400 mt-1.5">
              🔒 Nama pena ditetapkan saat pendaftaran dan <span class="font-semibold">tidak bisa diubah oleh siapapun</span>, termasuk penulisnya sendiri.
            </p>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Password Baru</label>
            <input
              v-model="form.password"
              type="text"
              placeholder="Kosongkan jika tidak diubah"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            <p class="text-xs text-slate-400 mt-1.5">Biarkan kosong untuk mempertahankan password lama.</p>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Role</label>
            <select
              v-model="form.role"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            >
              <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
            <p class="text-xs text-slate-400 mt-1.5">{{ roleHint }}</p>
          </div>
        </div>

        <!-- Hak akses tambahan (granular) -->
        <div class="mt-5 pt-5 border-t border-slate-100">
          <label class="block text-sm font-semibold text-slate-700 mb-1">Hak Akses Tambahan</label>
          <p class="text-xs text-slate-400 mb-3">
            Beri izin spesifik di luar role-nya. Izin bawaan role (dicentang otomatis) tetap berlaku — centang hanya untuk memberi izin ekstra.
          </p>
          <div class="grid sm:grid-cols-2 gap-2.5">
            <label
              v-for="p in PERMISSIONS"
              :key="p.key"
              class="flex items-start gap-2.5 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
              :class="
                form.permissions.includes(p.key)
                  ? 'border-brand-600/60 bg-brand-50/50'
                  : 'border-slate-200 hover:border-brand-600/40'
              "
            >
              <input
                v-model="form.permissions"
                type="checkbox"
                :value="p.key"
                :disabled="ROLE_PERMISSIONS[form.role]?.includes(p.key)"
                class="mt-0.5 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600/30 disabled:opacity-50"
              />
              <span>
                <span class="block text-sm font-semibold text-slate-800">{{ p.label }}</span>
                <span class="block text-xs text-slate-400">{{ p.desc }}</span>
                <span
                  v-if="ROLE_PERMISSIONS[form.role]?.includes(p.key)"
                  class="inline-block mt-0.5 text-[10px] font-bold text-emerald-600"
                >
                  ✓ sudah dimiliki role {{ roleInfo[form.role]?.label || form.role }}
                </span>
              </span>
            </label>
          </div>
        </div>

        <!-- Pesan error -->
        <p v-if="error" class="mt-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{{ error }}</p>

        <!-- Aksi -->
        <div class="mt-6 pt-5 border-t border-slate-100 flex items-center justify-end gap-3">
          <router-link
            :to="{ name: 'admin-users' }"
            class="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Batal
          </router-link>
          <button
            type="submit"
            :disabled="saving"
            class="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg px-6 py-2.5 text-sm font-bold transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {{ saving ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
