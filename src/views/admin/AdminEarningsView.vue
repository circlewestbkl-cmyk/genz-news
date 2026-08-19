<script setup>
import { ref, computed, onMounted } from 'vue'
import { userApi } from '../../api/users'
import { articleApi } from '../../api/articles'
import { roleInfo } from '../../api/auth'
import { summarizeEarnings, formatRupiah } from '../../utils/format'

const users = ref([])
const articles = ref([])
const loading = ref(true)
const error = ref('')

const summary = computed(() => summarizeEarnings(articles.value, users.value))

// Tampilkan penulis (dengan atau tanpa artikel) + user lain yang punya penghasilan
const rows = computed(() =>
  summary.value.filter((r) => r.role === 'writer' || r.earnings > 0)
)

const totals = computed(() => {
  const writers = rows.value.filter((r) => r.role === 'writer')
  return {
    earnings: rows.value.reduce((s, r) => s + r.earnings, 0),
    articles: rows.value.reduce((s, r) => s + r.articles, 0),
    words: rows.value.reduce((s, r) => s + r.words, 0),
    writers: writers.length,
  }
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [u, a] = await Promise.all([userApi.list(), articleApi.list()])
    users.value = u
    articles.value = a
  } catch {
    error.value = 'Gagal memuat data. Pastikan JSON Server berjalan (npm run server).'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">Rekap Penghasilan</h1>
      <p class="text-slate-500 text-sm mt-1">
        Total penghasilan penulis dari artikel yang berhasil terbit (Rp100/kata). Khusus Admin.
      </p>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-5 py-4 text-sm mb-6">
      {{ error }}
    </div>

    <!-- Ringkasan -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Penghasilan</p>
        <p class="font-display font-black text-3xl text-emerald-600 mt-1 tabular-nums">
          {{ formatRupiah(totals.earnings) }}
        </p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Artikel Terbit</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ totals.articles }}</p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Kata</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1 tabular-nums">
          {{ totals.words.toLocaleString('id-ID') }}
        </p>
      </div>
      <div class="bg-white rounded-lg border border-slate-200 p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Jumlah Penulis</p>
        <p class="font-display font-black text-3xl text-slate-900 mt-1">{{ totals.writers }}</p>
      </div>
    </div>

    <!-- Tabel per penulis -->
    <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="font-display font-bold text-lg text-slate-900">Penghasilan per Penulis</h2>
        <span class="text-xs text-slate-400">{{ rows.length }} user</span>
      </div>

      <div v-if="loading" class="divide-y divide-slate-100">
        <div v-for="i in 4" :key="i" class="flex items-center gap-4 p-4 animate-pulse">
          <div class="w-10 h-10 bg-slate-200 rounded-full"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-slate-200 rounded w-1/3"></div>
            <div class="h-3 bg-slate-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!rows.length" class="text-center py-16 text-slate-400">
        <p class="text-4xl mb-3">📊</p>
        <p class="font-semibold text-slate-500 mb-1">Belum ada data penghasilan</p>
        <p class="text-sm">Penghasilan muncul setelah ada artikel yang berhasil terbit.</p>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="(r, i) in rows" :key="r.username" class="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
          <span class="font-display font-black text-lg w-7 text-center shrink-0" :class="i === 0 ? 'text-amber-500' : 'text-slate-300'">
            {{ i + 1 }}
          </span>
          <div class="w-10 h-10 rounded-full bg-brand-600 text-white grid place-items-center font-display font-bold text-sm shrink-0">
            {{ r.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-slate-900 truncate">
              {{ r.name }}
              <span class="text-xs text-slate-400 font-normal">@{{ r.username }}</span>
            </p>
            <p class="text-xs text-slate-400 mt-0.5">{{ r.articles }} artikel terbit • {{ r.words.toLocaleString('id-ID') }} kata</p>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded shrink-0" :class="roleInfo[r.role]?.badge || 'bg-slate-500 text-white'">
            {{ roleInfo[r.role]?.label || r.role }}
          </span>
          <span class="font-display font-bold text-emerald-600 tabular-nums shrink-0">
            {{ formatRupiah(r.earnings) }}
          </span>
        </div>
      </div>
    </div>

    <p class="mt-6 text-xs text-slate-400">
      💡 Penghasilan dihitung dari jumlah kata pada artikel yang berstatus terbit ×
      <span class="font-semibold text-emerald-600">Rp100</span>. Draft dan artikel di Recycle Bin tidak dihitung.
    </p>
  </div>
</template>
