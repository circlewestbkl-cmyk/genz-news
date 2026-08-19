<script setup>
import { ref, computed, onMounted } from 'vue'
import { auditApi, auditActionInfo } from '../../api/audit'
import { formatDateTime } from '../../utils/format'

const logs = ref([])
const loading = ref(true)
const error = ref('')
const actionFilter = ref('all')
const searchUser = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    logs.value = await auditApi.list()
  } catch {
    error.value = 'Gagal memuat audit log.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const actions = computed(() => [...new Set(logs.value.map((l) => l.action))])

const filteredLogs = computed(() => {
  let list = logs.value
  if (actionFilter.value !== 'all') {
    list = list.filter((l) => l.action === actionFilter.value)
  }
  const q = searchUser.value.trim().toLowerCase()
  if (q) {
    list = list.filter((l) => `${l.username} ${l.name}`.toLowerCase().includes(q))
  }
  return list
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">Audit Log</h1>
      <p class="text-slate-500 text-sm mt-1">
        Riwayat aksi penting di backoffice — login, kelola berita, dan kelola user.
      </p>
    </div>

    <!-- Filter -->
    <div class="bg-white rounded-lg border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[200px]">
        <svg class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchUser"
          type="search"
          placeholder="Cari berdasarkan user..."
          class="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
      </div>
      <select
        v-model="actionFilter"
        class="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-brand-600"
      >
        <option value="all">Semua Aksi</option>
        <option v-for="a in actions" :key="a" :value="a">
          {{ auditActionInfo[a]?.label || a }}
        </option>
      </select>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-5 py-4 text-sm mb-6">
      {{ error }}
    </div>

    <!-- Tabel log -->
    <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="font-display font-bold text-lg text-slate-900">Riwayat Aktivitas</h2>
        <span class="text-xs text-slate-400">{{ filteredLogs.length }} catatan</span>
      </div>

      <div v-if="loading" class="divide-y divide-slate-100">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4 p-4 animate-pulse">
          <div class="flex-1 space-y-2">
            <div class="h-3 bg-slate-200 rounded w-1/2"></div>
            <div class="h-3 bg-slate-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!filteredLogs.length" class="text-center py-14 text-slate-400">
        <p class="text-3xl mb-2">📜</p>
        <p>Belum ada catatan aktivitas.</p>
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="log in filteredLogs" :key="log.id" class="flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors">
          <div class="w-9 h-9 rounded-full bg-brand-600 text-white grid place-items-center text-xs font-bold shrink-0">
            {{ (log.name || log.username || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-slate-900 text-sm">{{ log.name || log.username }}</span>
              <span class="text-xs text-slate-400">@{{ log.username }}</span>
              <span
                class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border"
                :class="auditActionInfo[log.action]?.badge || 'bg-slate-100 text-slate-600 border-slate-200'"
              >
                {{ auditActionInfo[log.action]?.label || log.action }}
              </span>
            </div>
            <p class="text-sm text-slate-500 mt-0.5">{{ log.detail || '—' }}</p>
            <p class="text-xs text-slate-400 mt-0.5">{{ formatDateTime(log.createdAt) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
