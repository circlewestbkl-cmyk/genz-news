<script setup>
import { ref, computed, onMounted } from 'vue'
import { userApi } from '../../api/users'
import { auth, roleInfo, PERMISSIONS, ROLE_PERMISSIONS } from '../../api/auth'
import { auditApi } from '../../api/audit'
import { sha256 } from '../../utils/hash'
import ConfirmModal from '../../components/ConfirmModal.vue'
import UserAvatar from '../../components/UserAvatar.vue'

const users = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')
const showForm = ref(false)
const saving = ref(false)
const filter = ref('all')

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'writer', label: 'Penulis' },
  { value: 'reader', label: 'Pembaca' },
]

const form = ref({ name: '', username: '', penName: '', password: '', role: 'writer', permissions: [] })

function permLabel(key) {
  return PERMISSIONS.find((p) => p.key === key)?.label || key
}
const me = auth.current()

const statusInfo = {
  pending: { label: 'Menunggu', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  active: { label: 'Aktif', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Nonaktif', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
}

const filters = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu Verifikasi' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
]

const filteredUsers = computed(() => {
  if (filter.value === 'all') return users.value
  return users.value.filter((u) => u.status === filter.value)
})

const pendingCount = computed(() => users.value.filter((u) => u.status === 'pending').length)

// Deskripsi singkat tiap role untuk hint di form
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
    users.value = await userApi.list()
  } catch (e) {
    error.value = 'Gagal memuat data user.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  form.value = { name: '', username: '', penName: '', password: '', role: 'writer', permissions: [] }
  error.value = ''
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  error.value = ''
}

async function submit() {
  error.value = ''

  // Mode tambah: semua wajib diisi
  if (!form.value.name.trim() || !form.value.username.trim() || !form.value.password.trim()) {
    error.value = 'Nama, username, dan password wajib diisi.'
    return
  }
  if (form.value.password.length < 6) {
    error.value = 'Password minimal 6 karakter.'
    return
  }

  try {
    const dup = await userApi.findByUsername(form.value.username.trim())
    if (dup.length) {
      error.value = `Username "${form.value.username}" sudah dipakai user lain.`
      return
    }
    // Nama pena unik antar penulis
    if (form.value.penName.trim()) {
      const dupPen = await userApi.findByPenName(form.value.penName.trim())
      if (dupPen.length) {
        error.value = `Nama pena "${form.value.penName}" sudah dipakai user lain. Pilih nama pena yang berbeda.`
        return
      }
    }
  } catch {
    /* lanjutkan */
  }

  saving.value = true
  try {
    await userApi.create({
      name: form.value.name.trim(),
      username: form.value.username.trim(),
      penName: form.value.penName.trim(),
      passwordHash: await sha256(form.value.password.trim()),
      role: form.value.role,
      status: 'active',
      permissions: form.value.permissions,
    })
    auditApi.log(
      'user_create',
      `User "${form.value.username.trim()}" (${form.value.role}) dibuat` +
        (form.value.permissions.length
          ? ` (+${form.value.permissions.length} izin tambahan)`
          : '')
    )
    showToast('User baru berhasil ditambahkan.')
    showForm.value = false
    await load()
  } catch {
    error.value = 'Gagal menyimpan user. Pastikan JSON Server berjalan.'
  } finally {
    saving.value = false
  }
}

// Modal konfirmasi aksi
const modal = ref({ open: false, variant: 'danger', title: '', message: '', confirmText: '', loading: false })
const modalAction = ref(null)

function openModal(config, action) {
  modalAction.value = action
  modal.value = { open: true, loading: false, ...config }
}

async function runModalAction() {
  modal.value.loading = true
  try {
    const msg = await modalAction.value()
    if (msg) showToast(msg)
    modal.value.open = false
  } catch {
    showToast('Gagal. Pastikan server data berjalan.')
    modal.value.open = false
  } finally {
    modal.value.loading = false
  }
}

// Verifikasi pendaftar (pending → active)
function askVerify(u) {
  openModal(
    {
      variant: 'success',
      title: 'Verifikasi User',
      message: `Setujui akun "${u.name}" (@${u.username})? User langsung bisa login setelah diverifikasi.`,
      confirmText: 'Verifikasi',
    },
    async () => {
      await userApi.update(u.id, { status: 'active' })
      u.status = 'active'
      auditApi.log('user_verify', `User "${u.username}" (${u.name}) diverifikasi`)
      return `${u.name} berhasil diverifikasi.`
    }
  )
}

// Nonaktifkan / aktifkan akun
function askSetStatus(u, status) {
  const isInactive = status === 'inactive'
  openModal(
    {
      variant: isInactive ? 'warning' : 'success',
      title: isInactive ? 'Nonaktifkan User' : 'Aktifkan Kembali',
      message: isInactive
        ? `Nonaktifkan akun "${u.name}" (@${u.username})? User tidak akan bisa login sampai diaktifkan kembali.`
        : `Aktifkan kembali akun "${u.name}" (@${u.username})? User bisa langsung login.`,
      confirmText: isInactive ? 'Nonaktifkan' : 'Aktifkan',
    },
    async () => {
      await userApi.update(u.id, { status })
      u.status = status
      auditApi.log(
        isInactive ? 'user_disable' : 'user_enable',
        `User "${u.username}" ${isInactive ? 'dinonaktifkan' : 'diaktifkan kembali'}`
      )
      return isInactive ? `${u.name} dinonaktifkan.` : `${u.name} diaktifkan kembali.`
    }
  )
}

// Blokir / buka blokir chat user (semua user, termasuk diri sendiri bila terblokir)
function askToggleChatBlock(u) {
  const blocking = !u.chatBlocked
  openModal(
    {
      variant: blocking ? 'warning' : 'success',
      title: blocking ? 'Blokir Chat' : 'Buka Blokir Chat',
      message: blocking
        ? `Blokir akses chat "${u.name}" (@${u.username})? User tetap bisa membaca pesan, tapi tidak bisa mengirim apa pun (grup maupun privat).`
        : `Buka blokir chat untuk "${u.name}" (@${u.username})? User bisa mengirim pesan lagi.`,
      confirmText: blocking ? 'Blokir Chat' : 'Buka Blokir',
    },
    async () => {
      await userApi.update(u.id, { chatBlocked: blocking })
      u.chatBlocked = blocking
      auditApi.log(
        blocking ? 'chat_block' : 'chat_unblock',
        `Chat user "${u.username}" (${u.name}) ${blocking ? 'diblokir' : 'dibuka blokirnya'}`
      )
      return blocking ? `${u.name} diblokir dari chat.` : `${u.name} dibuka dari blokir chat.`
    }
  )
}

// Hapus user
function askRemove(u) {
  if (u.username === me?.username) {
    showToast('Kamu tidak bisa menghapus akun sendiri.')
    return
  }
  openModal(
    {
      variant: 'danger',
      title: 'Hapus User',
      message: `Hapus akun "${u.name}" (@${u.username})? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Hapus User',
    },
    async () => {
      await userApi.remove(u.id)
      auditApi.log('user_delete', `User "${u.username}" (${u.name}) dihapus`)
      users.value = users.value.filter((x) => x.id !== u.id)
      return 'User berhasil dihapus.'
    }
  )
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
        <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">Kelola User</h1>
        <p class="text-slate-500 text-sm mt-1">
          Verifikasi pendaftar, aktifkan/nonaktifkan akun, dan atur role.
        </p>
      </div>
      <button
        v-if="!showForm"
        @click="openCreate"
        class="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-5 py-3 text-sm font-bold transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Tambah User
      </button>
    </div>

    <!-- Peringatan pendaftar baru -->
    <div
      v-if="pendingCount"
      class="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-5 py-4 text-sm mb-6 flex items-center gap-3"
    >
      <span class="text-lg">📥</span>
      <p>
        Ada <span class="font-bold">{{ pendingCount }}</span> pendaftar baru yang
        <span class="font-bold">menunggu verifikasi</span>. Klik tombol "Verifikasi" pada user untuk menyetujui akun mereka.
      </p>
    </div>

    <!-- Form tambah/edit -->
    <div v-if="showForm" class="bg-white rounded-lg border border-slate-200 mb-6 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 class="font-display font-bold text-lg text-slate-900">Tambah User Baru</h2>
          <p class="text-xs text-slate-400 mt-0.5">Buat akun baru untuk Admin, Editor, atau Penulis</p>
        </div>
        <button
          type="button"
          @click="cancelForm"
          class="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          title="Tutup"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form class="p-6" @submit.prevent="submit">
        <div class="grid sm:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">
              Nama Lengkap <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="Nama user"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">
              Username <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.username"
              type="text"
              placeholder="username"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Nama Pena</label>
            <input
              v-model="form.penName"
              type="text"
              placeholder="Contoh: Andra Media"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            <p class="text-xs text-slate-400 mt-1.5">
              Nama yang tampil sebagai penulis artikel. Harus unik antar penulis; kosongkan jika tidak memakai nama pena.
            </p>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">
              Password <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.password"
              type="text"
              placeholder="Minimal 6 karakter"
              class="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
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
          <button
            type="button"
            @click="cancelForm"
            class="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg px-6 py-2.5 text-sm font-bold transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {{ saving ? 'Menyimpan...' : 'Tambah User' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Error -->
    <div v-if="error && !showForm" class="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-5 py-4 text-sm mb-6">
      {{ error }}
    </div>

    <!-- Tabel user -->
    <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-display font-bold text-lg text-slate-900">Daftar User</h2>
        <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-xs font-semibold">
          <button
            v-for="f in filters"
            :key="f.value"
            @click="filter = f.value"
            class="px-3 py-1.5 rounded-md transition-colors"
            :class="filter === f.value ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          >
            {{ f.label }}
            <span v-if="f.value === 'pending' && pendingCount" class="text-amber-600">({{ pendingCount }})</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="divide-y divide-slate-100">
        <div v-for="i in 3" :key="i" class="flex items-center gap-4 p-4 animate-pulse">
          <div class="w-10 h-10 bg-slate-200 rounded-full"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-slate-200 rounded w-1/3"></div>
            <div class="h-3 bg-slate-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!filteredUsers.length" class="text-center py-14 text-slate-400">
        <p class="text-3xl mb-2">🗂️</p>
        <p>Tidak ada user pada filter ini.</p>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="u in filteredUsers" :key="u.id" class="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
          <UserAvatar :photo-url="u.photoUrl" :name="u.name || u.username" size="md" />
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-slate-900 truncate">
              {{ u.name }}
              <span v-if="u.username === me?.username" class="text-xs text-slate-400 font-normal">(kamu)</span>
            </p>
            <p class="text-xs text-slate-400">
              @{{ u.username }}<span v-if="u.penName" class="text-slate-500"> • ✍️ {{ u.penName }}</span>
            </p>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded shrink-0" :class="roleInfo[u.role]?.badge || 'bg-slate-500 text-white'">
            {{ roleInfo[u.role]?.label || u.role }}
          </span>
          <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border shrink-0" :class="statusInfo[u.status]?.badge || 'bg-slate-100 text-slate-500 border-slate-200'">
            {{ statusInfo[u.status]?.label || u.status }}
          </span>
          <span
            v-if="u.chatBlocked"
            class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border shrink-0 bg-rose-50 text-rose-700 border-rose-200"
            title="Diblokir dari mengirim chat — hanya bisa membaca"
          >
            ⛔ Chat diblokir
          </span>
          <!-- Chip izin tambahan -->
          <div v-if="u.permissions?.length" class="flex flex-wrap gap-1 shrink-0 max-w-[190px] justify-end">
            <span
              v-for="p in u.permissions"
              :key="p"
              class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 whitespace-nowrap"
              :title="permLabel(p)"
            >
              + {{ permLabel(p) }}
            </span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <!-- Verifikasi pendaftar -->
            <button
              v-if="u.status === 'pending'"
              @click="askVerify(u)"
              title="Verifikasi"
              class="p-2 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </button>
            <!-- Nonaktifkan -->
            <button
              v-if="u.status === 'active' && u.username !== me?.username"
              @click="askSetStatus(u, 'inactive')"
              title="Nonaktifkan"
              class="p-2 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>
            <!-- Aktifkan kembali -->
            <button
              v-if="u.status === 'inactive'"
              @click="askSetStatus(u, 'active')"
              title="Aktifkan kembali"
              class="p-2 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </button>
            <!-- Blokir / buka blokir chat -->
            <button
              v-if="u.chatBlocked || (u.username !== me?.username && ['admin', 'editor', 'writer'].includes(u.role))"
              @click="askToggleChatBlock(u)"
              :title="u.chatBlocked ? 'Buka blokir chat' : 'Blokir chat'"
              class="p-2 rounded transition-colors"
              :class="u.chatBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :d="u.chatBlocked
                    ? 'M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5v-7.5a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5z'
                    : 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z'
                  "
                />
              </svg>
            </button>
            <router-link
              :to="{ name: 'admin-user-edit', params: { id: u.id } }"
              title="Edit"
              class="p-2 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </router-link>
            <button
              @click="askRemove(u)"
              :disabled="u.username === me?.username"
              title="Hapus"
              class="p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Info role & status -->
    <div class="mt-6 bg-white rounded-lg border border-slate-200 p-5 text-sm">
      <h3 class="font-display font-bold text-slate-900 mb-2">Hak akses & status akun</h3>
      <ul class="space-y-1.5 text-slate-500 text-xs">
        <li><span class="font-bold text-brand-600">Admin</span> — kelola user, recycle bin &amp; audit log. Tidak mengelola berita, kecuali diberi izin tambahan.</li>
        <li><span class="font-bold text-blue-600">Editor</span> — kelola &amp; terbitkan semua berita.</li>
        <li><span class="font-bold text-emerald-600">Penulis</span> — hanya berita miliknya, tersimpan sebagai draft hingga disetujui Editor/Admin.</li>
        <li><span class="font-bold text-violet-600">Izin tambahan</span> — bisa diberikan ke user mana pun lewat form "Hak Akses Tambahan" (mis. Penulis yang boleh terbitkan).</li>
        <li><span class="font-bold text-amber-600">Menunggu</span> — pendaftar baru yang belum diverifikasi, belum bisa masuk.</li>
        <li><span class="font-bold text-slate-500">Nonaktif</span> — akun dinonaktifkan Admin, tidak bisa masuk.</li>
      </ul>
    </div>

    <!-- Modal konfirmasi aksi -->
    <ConfirmModal
      :open="modal.open"
      :loading="modal.loading"
      :variant="modal.variant"
      :title="modal.title"
      :message="modal.message"
      :confirm-text="modal.confirmText"
      @confirm="runModalAction"
      @cancel="modal.open = false"
    />
  </div>
</template>
