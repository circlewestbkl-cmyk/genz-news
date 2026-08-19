<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { defaultScheduleValue, fromDateTimeLocal, formatDateTime } from '../utils/format'

const props = defineProps({
  open: { type: Boolean, default: false },
  article: { type: Object, default: null },
  // true → tombol utama berlabel "Simpan Jadwal" & default mode jadwal
  scheduleOnly: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['publish', 'schedule', 'cancel'])

const mode = ref('now') // 'now' | 'schedule'
const scheduleValue = ref('')
const scheduleError = ref('')

function reset() {
  mode.value = props.scheduleOnly ? 'schedule' : 'now'
  scheduleValue.value = defaultScheduleValue(1)
  scheduleError.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
    document.body.style.overflow = open ? 'hidden' : ''
  }
)

function onKeydown(e) {
  if (e.key === 'Escape' && props.open) emit('cancel')
}
window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})

function confirm() {
  if (mode.value === 'now') {
    emit('publish')
    return
  }
  const iso = fromDateTimeLocal(scheduleValue.value)
  if (!iso) {
    scheduleError.value = 'Pilih tanggal & jam terbit dulu.'
    return
  }
  if (new Date(iso).getTime() <= Date.now()) {
    scheduleError.value = 'Waktu terbit harus di masa depan.'
    return
  }
  emit('schedule', iso)
}

const schedulePreview = () => {
  const iso = fromDateTimeLocal(scheduleValue.value)
  return iso ? formatDateTime(iso) : ''
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-link-700/60 backdrop-blur-sm" @click="!loading && emit('cancel')"></div>

        <!-- Kartu modal - bottom sheet on mobile, centered on desktop -->
        <div
          class="modal-card relative bg-white sm:rounded-2xl border-2 border-link-700 sm:shadow-[6px_6px_0_#2a1038] w-full sm:max-w-md sm:p-6 sm:p-7 p-5 rounded-t-2xl sm:rounded-2xl shadow-[0_-4px_30px_rgba(42,16,56,0.3)] safe-area-bottom"
          role="dialog"
          aria-modal="true"
        >
          <!-- Drag handle for mobile -->
          <div class="w-10 h-1 rounded-full bg-slate-300 mx-auto mb-4 sm:hidden"></div>

          <button
            v-if="!loading"
            class="absolute top-4 right-4 text-slate-300 hover:text-slate-600 transition-colors touch-target hidden sm:grid"
            @click="emit('cancel')"
            title="Tutup"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="text-center">
            <div class="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl grid place-items-center bg-brand-100 text-brand-600">
              <svg class="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="mt-4 font-groovy font-black text-lg sm:text-xl text-link-700">Terbitkan Berita</h3>
            <p class="mt-2 text-sm font-semibold text-slate-500 leading-relaxed line-clamp-2">
              "{{ article?.title || '' }}"
            </p>
          </div>

          <!-- Pilihan mode -->
          <div class="mt-4 sm:mt-5 grid grid-cols-2 gap-1.5 sm:gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              :disabled="loading || scheduleOnly"
              @click="mode = 'now'"
              class="px-2.5 sm:px-3 py-2.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-groovy font-black uppercase tracking-wide transition-all touch-target"
              :class="mode === 'now' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50'"
            >
              ⚡ Terbitkan Sekarang
            </button>
            <button
              type="button"
              :disabled="loading"
              @click="mode = 'schedule'"
              class="px-2.5 sm:px-3 py-2.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-groovy font-black uppercase tracking-wide transition-all touch-target"
              :class="mode === 'schedule' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
            >
              📅 Jadwalkan Terbit
            </button>
          </div>

          <!-- Form jadwal -->
          <div v-if="mode === 'schedule'" class="mt-3 sm:mt-4 bg-brand-50/60 border-2 border-brand-200 rounded-2xl p-3 sm:p-4">
            <label class="block text-xs font-groovy font-black uppercase tracking-wide text-brand-700 mb-1.5">
              Tanggal & Jam Terbit
            </label>
            <input
              v-model="scheduleValue"
              type="datetime-local"
              class="w-full border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-brand-600"
            />
            <p v-if="schedulePreview()" class="text-xs font-semibold text-slate-500 mt-2">
              🕐 Akan otomatis terbit <b class="text-brand-700">{{ schedulePreview() }}</b> — tidak perlu tindakan lagi.
            </p>
            <p v-if="scheduleError" class="text-xs font-bold text-rose-600 mt-2">{{ scheduleError }}</p>
          </div>

          <p v-else class="mt-3 sm:mt-4 text-xs font-semibold text-slate-400 text-center">
            Artikel langsung tampil di halaman publik begitu disimpan.
          </p>

          <!-- Mobile: stacked buttons. Desktop: side-by-side -->
          <div class="mt-5 sm:mt-6 flex flex-col sm:grid sm:grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              :disabled="loading"
              @click="emit('cancel')"
              class="order-2 sm:order-1 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-link-700 border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] hover:bg-slate-50 disabled:opacity-60 transition-all touch-target"
            >
              Batal
            </button>
            <button
              type="button"
              :disabled="loading"
              @click="confirm"
              class="order-1 sm:order-2 inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:bg-brand-500 disabled:opacity-60 transition-all touch-target"
            >
              <svg
                v-if="loading"
                class="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ loading ? 'Memproses...' : mode === 'now' ? 'Ya, Terbitkan' : 'Simpan Jadwal' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .modal-card {
  animation: modal-pop 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-leave-active .modal-card {
  animation: modal-shrink 0.15s ease forwards;
}
@keyframes modal-pop {
  from {
    transform: scale(0.9) translateY(14px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
@keyframes modal-shrink {
  to {
    transform: scale(0.95) translateY(6px);
    opacity: 0;
  }
}
</style>
