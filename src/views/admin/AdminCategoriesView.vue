<script setup>
import { ref, computed, onMounted } from 'vue'
import { categories, siteCategories, colorOptions, loadCategories, createCategory, updateCategoryStatus } from '../../api/categories'
import { auditApi } from '../../api/audit'
import { articleApi } from '../../api/articles'
import { formatDate } from '../../utils/format'

const loading = ref(true)
const error = ref('')
const articles = ref([])

// Form tambah kategori
const form = ref({ name: '', color: colorOptions[0].color, dot: colorOptions[0].dot })
const saving = ref(false)
const saveError = ref('')
const saved = ref('')

// Jumlah artikel per kategori (untuk info, bukan penghapusan)
const articleCount = computed(() => {
  const map = {}
  for (const a of articles.value) {
    map[a.category] = (map[a.category] || 0) + 1
  }
  return map
})

onMounted(async () => {
  try {
    await loadCategories(true)
    articles.value = await articleApi.listPublished()
  } catch {
    error.value = 'Gagal memuat data kategori. Pastikan JSON Server berjalan.'
  } finally {
    loading.value = false
  }
})

function pickColor(opt) {
  form.value.color = opt.color
  form.value.dot = opt.dot
}

async function submit() {
  saveError.value = ''
  saved.value = ''
  if (!form.value.name.trim()) {
    saveError.value = 'Nama kategori wajib diisi.'
    return
  }
  saving.value = true
  try {
    await createCategory({
      name: form.value.name,
      color: form.value.color,
      dot: form.value.dot,
      createdBy: 'editor',
    })
    await auditApi.log('category_create', `Kategori "${form.value.name.trim()}" ditambahkan`)
    saved.value = `Kategori "${form.value.name.trim()}" berhasil ditambahkan.`
    form.value.name = ''
  } catch (e) {
    saveError.value = e.message || 'Gagal menambah kategori.'
  } finally {
    saving.value = false
  }
}

// Ubah status aktif/nonaktif (hanya editor — halaman ini khusus editor)
const togglingId = ref(null)
async function toggleStatus(c) {
  if (togglingId.value) return
  togglingId.value = c.id
  try {
    const next = c.status === 'inactive' ? 'active' : 'inactive'
    await updateCategoryStatus(c.id, next)
    await auditApi.log('category_update', `Kategori "${c.name}" diubah status menjadi ${next === 'active' ? 'Aktif' : 'Tidak Aktif'}`)
  } catch {
    saveError.value = 'Gagal mengubah status kategori.'
  } finally {
    togglingId.value = null
  }
}
</script>

<template>
  <div class="max-w-4xl">
    <h1 class="font-display text-2xl font-bold text-slate-900">Kategori</h1>
    <p class="text-sm text-slate-500 mt-1">
      Kategori dikelola dinamis. Halaman website hanya menampilkan kategori berstatus
      <strong>aktif</strong> (saat ini {{ siteCategories.length }} aktif). Kategori tidak bisa
      dihapus agar artikel lama tetap aman — statusnya bisa diubah jadi tidak aktif.
    </p>

    <!-- Form tambah -->
    <div class="mt-6 bg-white border border-slate-200 rounded-lg p-5">
      <h2 class="font-display font-bold text-slate-900">➕ Tambah Kategori Baru</h2>
      <form @submit.prevent="submit" class="mt-4 space-y-4">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">
            Nama Kategori <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            placeholder="mis. Gaming, Travel, Otomotif…"
            maxlength="30"
            class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-600"
          />
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1.5">Warna Chip</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in colorOptions"
              :key="opt.label"
              type="button"
              @click="pickColor(opt)"
              class="px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors"
              :class="[opt.color, form.color === opt.color ? 'ring-2 ring-brand-600 ring-offset-1' : '']"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <p v-if="saveError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ saveError }}</p>
        <p v-if="saved" class="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{{ saved }}</p>

        <button
          type="submit"
          :disabled="saving"
          class="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 transition-colors text-white text-sm font-bold px-4 py-2 rounded-lg"
        >
          {{ saving ? 'Menyimpan…' : 'Simpan Kategori' }}
        </button>
      </form>
    </div>

    <!-- Daftar kategori -->
    <div class="mt-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 class="font-display font-bold text-slate-900">Semua Kategori ({{ categories.length }})</h2>
        <span class="text-xs text-slate-400">🔒 tidak dapat dihapus</span>
      </div>

      <p v-if="loading" class="text-sm text-slate-400 px-5 py-8 text-center">Memuat…</p>
      <p v-else-if="error" class="text-sm text-red-600 px-5 py-8 text-center">{{ error }}</p>
      <table v-else class="w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-5 py-2.5 font-semibold">Kategori</th>
            <th class="px-5 py-2.5 font-semibold">Status</th>
            <th class="px-5 py-2.5 font-semibold">Dibuat oleh</th>
            <th class="px-5 py-2.5 font-semibold">Tanggal</th>
            <th class="px-5 py-2.5 font-semibold text-right">Artikel</th>
            <th class="px-5 py-2.5 font-semibold text-right">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="c in categories" :key="c.id" class="hover:bg-slate-50/60">
            <td class="px-5 py-3">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold" :class="c.color">
                <span class="w-1.5 h-1.5 rounded-full" :class="c.dot"></span>
                {{ c.name }}
              </span>
            </td>
            <td class="px-5 py-3">
              <span
                class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border"
                :class="c.status === 'inactive' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="c.status === 'inactive' ? 'bg-slate-400' : 'bg-emerald-500'"></span>
                {{ c.status === 'inactive' ? 'Tidak Aktif' : 'Aktif' }}
              </span>
            </td>
            <td class="px-5 py-3 text-slate-600">{{ c.createdBy }}</td>
            <td class="px-5 py-3 text-slate-500">{{ formatDate(c.createdAt) }}</td>
            <td class="px-5 py-3 text-right text-slate-600">{{ articleCount[c.name] || 0 }}</td>
            <td class="px-5 py-3 text-right">
              <button
                @click="toggleStatus(c)"
                :disabled="togglingId === c.id"
                class="text-xs font-bold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60"
                :class="c.status === 'inactive' ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500' : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'"
              >
                {{ c.status === 'inactive' ? 'Aktifkan' : 'Nonaktifkan' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
