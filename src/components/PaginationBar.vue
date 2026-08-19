<script setup>
import { computed } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  // Mode kompak: satu baris, tanpa teks "Sebelumnya/Berikutnya" (hanya ikon) —
  // dipakai di kolom sempit seperti daftar iklan admin
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['change'])

const pageNumbers = computed(() => {
  const total = props.totalPages
  const current = props.page
  const candidates = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b)
  const result = []
  let prev = 0
  for (const n of candidates) {
    if (n - prev > 1) result.push('...')
    result.push(n)
    prev = n
  }
  return result
})

function go(p) {
  if (p < 1 || p > props.totalPages || p === props.page) return
  emit('change', p)
}
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="flex items-center justify-center gap-1.5 flex-wrap"
    :class="compact ? 'flex-nowrap gap-1' : 'mt-8 sm:mt-10 gap-1.5 sm:gap-2'"
    aria-label="Paginasi"
  >
    <button
      @click="go(page - 1)"
      :disabled="page === 1"
      class="inline-flex items-center rounded-xl border-2 border-link-700 bg-acid-500 text-link-700 shadow-[3px_3px_0_#2a1038] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#2a1038] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#2a1038] active:scale-95 transition-all touch-target"
      :class="compact ? 'w-9 h-9 justify-center' : 'gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-extrabold'"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <span v-if="!compact" class="hidden sm:inline">Sebelumnya</span>
    </button>

    <template v-for="(n, i) in pageNumbers" :key="n + '-' + i">
      <span v-if="n === '...'" class="px-0.5 sm:px-1 font-groovy text-link-700 select-none" :class="compact ? 'text-xs' : ''">…</span>
      <button
        v-else
        @click="go(n)"
        class="rounded-xl border-2 font-groovy font-bold transition-all active:scale-95 touch-target"
        :class="[
          compact ? 'w-9 h-9 text-xs' : 'w-10 h-10 sm:w-11 sm:h-11 text-xs sm:text-sm shadow-[3px_3px_0_#2a1038]',
          n === page
            ? 'bg-brand-600 border-link-700 text-white ' + (compact ? '' : '-translate-y-0.5')
            : 'bg-white border-link-700 text-link-700 hover:bg-brand-50 hover:-translate-y-0.5',
        ]"
      >
        {{ n }}
      </button>
    </template>

    <button
      @click="go(page + 1)"
      :disabled="page === totalPages"
      class="inline-flex items-center rounded-xl border-2 border-link-700 bg-acid-500 text-link-700 shadow-[3px_3px_0_#2a1038] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_#2a1038] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#2a1038] active:scale-95 transition-all touch-target"
      :class="compact ? 'w-9 h-9 justify-center' : 'gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-extrabold'"
    >
      <span v-if="!compact" class="hidden sm:inline">Berikutnya</span>
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </nav>
</template>
