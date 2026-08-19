<script setup>
defineProps({
  // ukuran logo: sm | md | lg
  size: { type: String, default: 'md' },
  // dark=true untuk latar gelap (footer)
  dark: { type: Boolean, default: false },
})
</script>

<template>
  <span class="inline-flex items-center gap-2.5 shrink-0">
    <!-- Mark: kotak gradien + petir -->
    <span
      class="grid place-items-center rounded-2xl bg-gradient-to-br from-brand-500 via-grape-500 to-cyan-400 border-2 border-link-700 shadow-[3px_3px_0_#2a1038] -rotate-6"
      :class="size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'"
    >
      <svg viewBox="0 0 24 24" class="w-1/2 h-1/2 fill-white" aria-hidden="true">
        <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
      </svg>
    </span>
    <!-- Wordmark: "gen z news" -->
    <span
      class="font-groovy font-black leading-none tracking-tight"
      :class="[
        size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-lg',
        dark ? 'text-white' : 'text-link-700',
      ]"
    >
      gen z <span class="gradient-text">news</span>
    </span>
  </span>
</template>
