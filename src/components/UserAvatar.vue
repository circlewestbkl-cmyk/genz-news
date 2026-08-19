<script setup>
import { ref, computed, watch } from 'vue'
import { getInitials } from '../utils/format'

// Avatar pengguna: menampilkan foto profil (photoUrl) bila ada,
// fallback ke inisial nama bila belum ada / gambar gagal dimuat.
const props = defineProps({
  photoUrl: { type: String, default: '' },
  name: { type: String, default: '' },
  // Ukuran preset: sm / msg / md / lg / xl
  size: { type: String, default: 'md' },
  // Kelas latar + warna teks saat fallback inisial
  fallbackClass: { type: String, default: 'bg-brand-600 text-white' },
})

const sizes = {
  sm: 'w-7 h-7 rounded-lg text-[10px]',
  msg: 'w-8 h-8 rounded-xl text-[10px]',
  md: 'w-9 h-9 rounded-xl text-xs',
  lg: 'w-10 h-10 rounded-xl text-sm',
  xl: 'w-24 h-24 rounded-3xl text-3xl',
}
const sizeClass = computed(() => sizes[props.size] || sizes.md)
const initials = computed(() => getInitials(props.name))

// Bila gambar gagal dimuat → tampilkan inisial
const broken = ref(false)
watch(
  () => props.photoUrl,
  () => (broken.value = false)
)
</script>

<template>
  <span
    class="inline-flex items-center justify-center overflow-hidden shrink-0 border-2 border-link-700 shadow-[2px_2px_0_#2a1038] select-none bg-slate-100"
    :class="[sizeClass, !photoUrl || broken ? fallbackClass : '']"
  >
    <img
      v-if="photoUrl && !broken"
      :src="photoUrl"
      :alt="name || 'Avatar'"
      class="w-full h-full object-cover"
      loading="lazy"
      @error="broken = true"
    />
    <span v-else class="font-groovy font-black leading-none">{{ initials }}</span>
  </span>
</template>
