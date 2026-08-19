<script setup>
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Konfirmasi' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: 'Ya, Lanjutkan' },
  cancelText: { type: String, default: 'Batal' },
  // danger | success | warning | info
  variant: { type: String, default: 'danger' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

const styles = {
  danger: {
    iconWrap: 'bg-red-100 text-red-600',
    confirmBtn: 'bg-red-600 hover:bg-red-700 shadow-red-600/30',
  },
  success: {
    iconWrap: 'bg-emerald-100 text-emerald-600',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30',
  },
  warning: {
    iconWrap: 'bg-amber-100 text-amber-600',
    confirmBtn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30',
  },
  info: {
    iconWrap: 'bg-brand-100 text-brand-600',
    confirmBtn: 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/30',
  },
}

const iconPaths = {
  danger: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  success: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
}

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
          class="modal-card relative bg-white sm:rounded-2xl border-2 border-[#2a1038] sm:shadow-[6px_6px_0_#2a1038] w-full sm:max-w-sm sm:p-6 sm:p-7 p-6 rounded-t-2xl sm:rounded-2xl shadow-[0_-4px_30px_rgba(42,16,56,0.3)] safe-area-bottom"
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
            <!-- Ikon -->
            <div
              class="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl grid place-items-center"
              :class="styles[variant]?.iconWrap || styles.danger.iconWrap"
            >
              <svg class="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" :d="iconPaths[variant] || iconPaths.danger" />
              </svg>
            </div>

            <h3 class="mt-4 font-display font-black text-lg sm:text-xl text-slate-900">{{ title }}</h3>
            <p class="mt-2 text-sm text-slate-500 leading-relaxed">{{ message }}</p>
          </div>

          <!-- Mobile: stacked buttons. Desktop: side-by-side -->
          <div class="mt-6 flex flex-col sm:grid sm:grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              :disabled="loading"
              @click="emit('cancel')"
              class="order-2 sm:order-1 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-link-700 border-2 border-link-700 bg-white shadow-[2px_2px_0_#2a1038] hover:bg-slate-50 disabled:opacity-60 transition-all touch-target"
            >
              {{ cancelText }}
            </button>
            <button
              type="button"
              :disabled="loading"
              @click="emit('confirm')"
              class="order-1 sm:order-2 inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-white border-2 border-link-700 shadow-[3px_3px_0_#2a1038] disabled:opacity-60 transition-all touch-target"
              :class="styles[variant]?.confirmBtn || styles.danger.confirmBtn"
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
              {{ loading ? 'Memproses...' : confirmText }}
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
