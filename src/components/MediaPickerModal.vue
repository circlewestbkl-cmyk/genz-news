<script setup>
import { ref, onMounted, watch } from 'vue'
import { mediaApi } from '../api/media'
import { compressImage } from '../utils/image'
import { auth } from '../api/auth'

// Modal pemilih gambar dari Pustaka Media — dipakai di editor artikel & form iklan.
// Emit 'select' dengan url gambar (data URL atau URL eksternal).
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Pilih dari Media' },
})
const emit = defineEmits(['select', 'close'])

const user = auth.current()
const items = ref([])
const loading = ref(false)
const error = ref('')
const uploading = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    items.value = await mediaApi.list()
  } catch {
    error.value = 'Gagal memuat pustaka media.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (props.open) load()
})

// Muat ulang setiap kali dibuka (mungkin ada gambar baru)
watch(
  () => props.open,
  (open) => {
    if (open) load()
  }
)

async function onUpload(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) return
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'Ukuran gambar maksimal 5MB.'
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const url = await compressImage(file)
    await mediaApi.create({
      name: file.name.replace(/\.[^.]+$/, '') || 'gambar',
      url,
      size: file.size,
      type: file.type,
      uploadedBy: user?.username || 'admin',
    })
    await load()
  } catch {
    error.value = 'Gagal mengunggah gambar.'
  } finally {
    uploading.value = false
  }
}

function pick(item) {
  emit('select', item.url)
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 grid place-items-end sm:place-items-center p-0 sm:p-4"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
  >
    <div class="absolute inset-0 bg-link-700/60 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative w-full sm:max-w-2xl bg-[#fff9f1] sm:border-2 sm:border-link-700 sm:rounded-2xl sm:shadow-[8px_8px_0_#2a1038] overflow-hidden rounded-t-2xl sm:rounded-t-2xl max-h-[85vh] flex flex-col safe-area-bottom">
      <!-- Drag handle for mobile -->
      <div class="w-10 h-1 rounded-full bg-slate-300 mx-auto mt-3 sm:hidden shrink-0"></div>

      <div class="px-4 sm:px-5 py-3 sm:py-4 border-b-2 border-link-700 bg-brand-50 flex items-center justify-between gap-3 shrink-0">
        <h3 class="font-groovy font-black text-sm sm:text-base text-link-700">{{ title }}</h3>
        <button
          @click="emit('close')"
          class="text-xs font-groovy font-black uppercase tracking-wide text-slate-500 border-2 border-slate-200 rounded-full px-3 py-1.5 hover:border-brand-400 hover:text-brand-600 transition-colors touch-target"
        >
          ✕ Tutup
        </button>
      </div>

      <div class="p-4 sm:p-5 overflow-y-auto flex-1">
        <label
          class="cursor-pointer inline-flex items-center gap-2 mb-4 border-2 border-dashed border-brand-300 bg-brand-50/50 rounded-xl px-4 py-3 text-sm font-bold text-brand-700 hover:bg-brand-100 transition-colors touch-target"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {{ uploading ? 'Mengunggah…' : 'Upload gambar baru ke pustaka' }}
          <input type="file" accept="image/*" class="hidden" @change="onUpload" :disabled="uploading" />
        </label>

        <p v-if="error" class="mb-3 text-xs font-bold text-rose-700">{{ error }}</p>

        <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div v-for="i in 8" :key="i" class="bg-slate-200 animate-pulse rounded-xl aspect-[4/3] border-2 border-link-700"></div>
        </div>
        <p v-else-if="!items.length" class="text-center py-10 text-slate-400">
          <span class="block text-4xl mb-2">🖼️</span>
          Pustaka kosong — upload gambar dulu.
        </p>
        <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            class="group relative aspect-[4/3] rounded-xl border-2 border-link-700 overflow-hidden bg-slate-100 shadow-[2px_2px_0_#2a1038] hover:-translate-y-0.5 hover:border-brand-600 active:scale-95 transition-all touch-target"
            :title="item.name"
            @click="pick(item)"
          >
            <img :src="item.url" :alt="item.name" class="w-full h-full object-cover" loading="lazy" />
            <span
              class="absolute inset-0 grid place-items-center bg-brand-600/85 text-white text-[11px] font-groovy font-black uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✓ Pilih
            </span>
            <!-- Mobile: always show pick indicator -->
            <span class="sm:hidden absolute bottom-1 right-1 w-6 h-6 rounded-full bg-brand-600 text-white grid place-items-center text-xs border border-white shadow-sm">
              ✓
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
