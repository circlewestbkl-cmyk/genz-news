<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Minta Revisi' },
  message: { type: String, default: '' },
  // Keterangan revisi sebelumnya (untuk diedit ulang)
  note: { type: String, default: '' },
  confirmText: { type: String, default: 'Kirim Permintaan Revisi' },
  cancelText: { type: String, default: 'Batal' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

const note = ref('')

// Isi textarea setiap modal dibuka
watch(
  () => props.open,
  (open) => {
    if (open) note.value = props.note || ''
  }
)

// Kunci body scroll saat modal terbuka + tutup dengan tombol Escape
watch(
  () => props.open,
  (open) => {
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
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="!loading && emit('cancel')"></div>

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

          <div class="flex items-start gap-3">
            <div class="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-rose-100 text-rose-600 grid place-items-center">
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div class="min-w-0">
              <h3 class="font-display font-black text-lg sm:text-xl text-slate-900">{{ title }}</h3>
              <p class="mt-1 text-sm text-slate-500 leading-relaxed">{{ message }}</p>
            </div>
          </div>

          <div class="mt-4 sm:mt-5">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">Keterangan Revisi</label>
            <textarea
              v-model="note"
              rows="3"
              :disabled="loading"
              placeholder="Contoh: judul perlu diperjelas, data di paragraf kedua belum ada sumbernya, tolong lengkapi kutipan narasumber..."
              class="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-sm placeholder-slate-400 focus:outline-none focus:border-brand-600 resize-none disabled:opacity-60"
            ></textarea>
            <p class="text-xs text-slate-400 mt-1">Pesan ini akan terlihat oleh penulis di halaman Berita Saya.</p>
          </div>

          <!-- Mobile: stacked buttons. Desktop: side-by-side -->
          <div class="mt-5 sm:mt-6 flex flex-col sm:grid sm:grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              :disabled="loading"
              @click="emit('cancel')"
              class="order-2 sm:order-1 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-semibold text-slate-600 border-2 border-slate-300 hover:bg-slate-50 disabled:opacity-60 transition-colors touch-target"
            >
              {{ cancelText }}
            </button>
            <button
              type="button"
              :disabled="loading || !note.trim()"
              @click="emit('confirm', note.trim())"
              class="order-1 sm:order-2 inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/30 disabled:opacity-60 transition-colors touch-target"
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
              {{ loading ? 'Mengirim...' : confirmText }}
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
