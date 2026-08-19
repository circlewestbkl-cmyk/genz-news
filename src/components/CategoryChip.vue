<script setup>
import { chipOf } from '../api/categories'

defineProps({
  name: { type: String, required: true },
})
</script>

<template>
  <router-link
    :to="{ name: 'category', params: { category: name.toLowerCase() } }"
    class="sticker text-xs font-extrabold uppercase tracking-wide px-3 py-1 transition-transform hover:rotate-[-3deg] hover:scale-105"
    :class="chipOf(name).color"
  >
    <span class="w-1.5 h-1.5 rounded-full" :class="chipOf(name).dot"></span>
    {{ name }}
  </router-link>
</template>
