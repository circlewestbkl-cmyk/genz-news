<script setup>
import { watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  username: { type: String, default: '' },
  role: { type: String, default: '' },
})

const emit = defineEmits(['continue'])

let timer = null

// Auto-redirect beberapa detik setelah modal terbuka
watch(
  () => props.open,
  (open) => {
    if (timer) clearTimeout(timer)
    if (open) {
      timer = setTimeout(() => emit('continue'), 2600)
    }
  }
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-link-700/60 backdrop-blur-sm"></div>

        <!-- Kartu modal - bottom sheet on mobile -->
        <div
          class="modal-card relative bg-white sm:rounded-3xl border-2 border-link-700 sm:shadow-[8px_8px_0_#2a1038] w-full sm:max-w-sm sm:p-8 p-6 sm:p-8 text-center rounded-t-3xl sm:rounded-3xl shadow-[0_-4px_30px_rgba(42,16,56,0.3)] safe-area-bottom"
          role="dialog"
          aria-modal="true"
        >
          <!-- Drag handle for mobile -->
          <div class="w-10 h-1 rounded-full bg-slate-300 mx-auto mb-4 sm:hidden"></div>

          <!-- Ikon sukses: stiker gradien + centang -->
          <div class="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
            <span
              class="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-brand-500 via-grape-500 to-cyan-400 border-2 border-link-700 shadow-[3px_3px_0_#2a1038] sm:shadow-[4px_4px_0_#2a1038] rotate-6 grid place-items-center"
            >
              <svg class="w-8 h-8 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="#ffffff" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="absolute -top-2 -right-3 text-xl sm:text-2xl rotate-12 select-none">⚡</span>
            <span class="absolute -bottom-2 -left-3 text-lg sm:text-xl -rotate-12 select-none">✨</span>
          </div>

          <p class="mt-5 sm:mt-6 font-groovy font-black text-xl sm:text-2xl text-link-700">Login Berhasil! 🎉</p>
          <p class="mt-2 sm:mt-3 text-xs sm:text-sm font-semibold text-slate-500 leading-relaxed">
            Anda berhasil login dengan username
            <span class="font-extrabold text-brand-600">@{{ username }}</span>
            sebagai
            <span
              class="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-grape-100 border-2 border-grape-500 text-grape-700 font-extrabold"
            >
              {{ role }}
            </span>
          </p>

          <button
            @click="emit('continue')"
            class="mt-5 sm:mt-7 w-full bg-brand-600 hover:bg-brand-500 text-white rounded-full py-3 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all touch-target"
          >
            Lanjut 🚀
          </button>
          <p class="mt-2.5 sm:mt-3 text-[10px] sm:text-[11px] font-semibold text-slate-400">Mengalihkan halaman otomatis...</p>
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
  animation: modal-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modal-pop {
  from {
    transform: scale(0.85) translateY(16px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
</style>
