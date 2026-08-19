<script setup>
import { ref, computed, onMounted } from 'vue'
import { articleApi } from '../../api/articles'
import { commentApi } from '../../api/comments'
import { auth } from '../../api/auth'
import { userApi } from '../../api/users'
import { auditApi } from '../../api/audit'
import { notifyCommentAdded } from '../../api/notifications'
import { formatDate, getInitials } from '../../utils/format'
import { commenterInfo } from '../../utils/commentIdentity'
import ConfirmModal from '../../components/ConfirmModal.vue'

const me = auth.current()
const isAdmin = me?.role === 'admin'

const articles = ref([])
const comments = ref([])
const users = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')
const modal = ref({ open: false, title: '', message: '', confirmText: '', loading: false })
const modalComment = ref(null)

// Balasan komentar
const replyForm = ref({ openId: null, text: '' })
const replySending = ref(false)
const replyError = ref('')

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 3000)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [arts, coms, allUsers] = await Promise.all([articleApi.list(), commentApi.listAll(), userApi.list().catch(() => [])])
    users.value = allUsers
    // Admin melihat semua artikel; penulis/editor hanya melihat artikel miliknya
    const visible = isAdmin ? arts : arts.filter((a) => a.createdBy === me?.username)
    const ids = new Set(visible.map((a) => String(a.id)))
    articles.value = visible
    comments.value = coms.filter((c) => ids.has(String(c.articleId)))
  } catch {
    error.value = 'Gagal memuat data interaksi. Pastikan JSON Server berjalan.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const articleMap = computed(() => {
  const map = {}
  for (const a of articles.value) map[a.id] = a
  return map
})

function articleTitle(comment) {
  return articleMap.value[comment.articleId]?.title || `Artikel #${comment.articleId}`
}

// Bisa membalas komentar: admin semua, penulis/editor pada artikel miliknya
function canReply(comment) {
  const article = articleMap.value[comment.articleId]
  return isAdmin || article?.createdBy === me?.username
}

// Info badge/avatar untuk satu komentar
function infoOf(c) {
  return commenterInfo(c, { article: articleMap.value[c.articleId], users: users.value })
}

// Kelompokkan komentar: komentar utama + balasannya (satu level)
// Komentar utama diurutkan terbaru di atas; balasan tetap kronologis dalam thread
const commentThreads = computed(() => {
  const top = comments.value
    .filter((c) => !c.parentId)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return top.map((c) => ({
    ...c,
    replies: comments.value.filter((r) => r.parentId === c.id),
  }))
})

function toggleReply(c) {
  replyForm.value.openId = replyForm.value.openId === c.id ? null : c.id
  replyForm.value.text = ''
  replyError.value = ''
}

async function sendReply(c) {
  replyError.value = ''
  if (!replyForm.value.text.trim()) {
    replyError.value = 'Tulis isi balasan terlebih dahulu.'
    return
  }
  replySending.value = true
  try {
    const created = await commentApi.create({
      articleId: c.articleId,
      author: (me?.penName || me?.name || '').trim() || 'Anonim',
      content: replyForm.value.text.trim(),
      parentId: c.id,
      replyTo: c.author,
      authorRole: me?.role || 'guest',
      authorUsername: me?.username || '',
      isArticleAuthor: !!me && articleMap.value[c.articleId]?.createdBy === me.username,
    })
    comments.value.push(created)
    auditApi.log('comment_reply', `Balasan untuk komentar dari "${c.author}"`)
    const targetArticle = articleMap.value[c.articleId]
    notifyCommentAdded({
      articleId: c.articleId,
      title: targetArticle?.title,
      to: targetArticle?.createdBy,
      byName: (me?.penName || me?.name || '').trim(),
      commentType: 'balasan',
    })
    replyForm.value.openId = null
    replyForm.value.text = ''
    showToast('Balasan terkirim.')
  } catch {
    replyError.value = 'Gagal mengirim balasan. Pastikan server data berjalan.'
  } finally {
    replySending.value = false
  }
}

function askDeleteComment(c) {
  modalComment.value = c
  modal.value = {
    open: true,
    title: 'Hapus Komentar',
    message: `Hapus komentar dari "${c.author}"? Tindakan ini tidak dapat dibatalkan.`,
    confirmText: 'Hapus Komentar',
    loading: false,
  }
}

async function runDelete() {
  modal.value.loading = true
  try {
    await commentApi.remove(modalComment.value.id)
    comments.value = comments.value.filter((c) => c.id !== modalComment.value.id)
    auditApi.log('comment_delete', `Komentar dari "${modalComment.value.author}" dihapus`)
    modal.value.open = false
    showToast('Komentar berhasil dihapus.')
  } catch {
    modal.value.open = false
    showToast('Gagal menghapus komentar. Pastikan server data berjalan.')
  } finally {
    modal.value.loading = false
  }
}
</script>

<template>
  <div>
    <!-- Toast -->
    <div
      v-if="toast"
      class="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm px-5 py-3 rounded-lg shadow-lg"
    >
      {{ toast }}
    </div>

    <div class="mb-6">
      <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900">Interaksi Pembaca</h1>
      <p class="text-slate-500 text-sm mt-1">
        Komentar pembaca pada semua artikel — lengkap dengan reaksinya.
      </p>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="bg-slate-200 animate-pulse rounded-lg h-16"></div>
    </div>

    <p v-else-if="error" class="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-5 py-4 text-sm mb-6">{{ error }}</p>

    <template v-else>
      <!-- Daftar komentar -->
      <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h2 class="font-display font-bold text-lg text-slate-900">Daftar Komentar</h2>
            <p class="text-xs text-slate-400 mt-0.5">Semua komentar dari pembaca, lengkap dengan reaksinya.</p>
          </div>
        </div>
        <div v-if="!comments.length" class="text-center text-slate-400 py-14 text-sm">
          <p class="text-3xl mb-2">💬</p>
          <p>Belum ada komentar dari pembaca.</p>
        </div>
        <div v-else class="divide-y divide-slate-100">
          <div v-for="c in commentThreads" :key="c.id" class="px-5 py-4 hover:bg-slate-50 transition-colors">
            <div class="flex items-start gap-3">
              <div
                class="w-9 h-9 rounded-full grid place-items-center font-display font-bold text-xs shrink-0"
                :class="infoOf(c).avatar"
              >
                {{ getInitials(c.author) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                  <span class="font-bold text-sm text-slate-900">{{ c.author }}</span>
                  <span
                    v-if="infoOf(c).badge"
                    class="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border"
                    :class="infoOf(c).badge"
                  >
                    {{ infoOf(c).icon }} {{ infoOf(c).label }}
                  </span>
                  <span class="text-xs text-slate-400">{{ formatDate(c.createdAt) }}</span>
                </div>
                <router-link
                  :to="{ name: 'article', params: { id: c.articleId } }"
                  class="inline-block text-[11px] font-semibold text-brand-600 bg-brand-50 border border-brand-100 rounded px-2 py-0.5 mb-2 hover:underline"
                >
                  📄 {{ articleTitle(c) }}
                </router-link>
                <p class="text-sm text-slate-700 whitespace-pre-wrap break-words">{{ c.content }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold">
                  <span class="text-emerald-600">👍 {{ (c.likes || 0).toLocaleString('id-ID') }}</span>
                  <span class="text-rose-600">👎 {{ (c.dislikes || 0).toLocaleString('id-ID') }}</span>
                  <button
                    v-if="canReply(c)"
                    @click="toggleReply(c)"
                    class="ml-auto text-xs font-bold text-brand-600 hover:underline"
                  >
                    {{ replyForm.openId === c.id ? 'Tutup' : '💬 Balas' }}
                  </button>
                </div>

                <!-- Form balasan -->
                <div v-if="replyForm.openId === c.id" class="mt-3">
                  <textarea
                    v-model="replyForm.text"
                    rows="2"
                    maxlength="1000"
                    :placeholder="`Balas ${c.author}…`"
                    class="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 resize-y"
                  ></textarea>
                  <p v-if="replyError" class="mt-1.5 text-xs text-red-700">{{ replyError }}</p>
                  <div class="mt-2 flex items-center justify-end gap-2">
                    <button
                      @click="toggleReply(c)"
                      class="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      @click="sendReply(c)"
                      :disabled="replySending"
                      class="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white transition-colors"
                    >
                      {{ replySending ? 'Mengirim…' : 'Kirim Balasan' }}
                    </button>
                  </div>
                </div>
              </div>
              <button
                v-if="isAdmin"
                @click="askDeleteComment(c)"
                title="Hapus komentar"
                class="p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              >
                <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <!-- Balasan -->
            <div v-if="c.replies.length" class="mt-3 ml-6 space-y-2 border-l-2 border-slate-100 pl-4">
              <div
                v-for="r in c.replies"
                :key="r.id"
                class="bg-slate-50 border border-slate-100 rounded-lg p-3.5"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="w-7 h-7 rounded-full grid place-items-center font-display font-bold text-[10px] shrink-0"
                    :class="infoOf(r).avatar"
                  >
                    {{ getInitials(r.author) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                      <span class="font-bold text-xs text-slate-900">
                        {{ r.author }}
                        <span v-if="r.replyTo" class="font-normal text-slate-400">→ {{ r.replyTo }}</span>
                      </span>
                      <span
                        v-if="infoOf(r).badge"
                        class="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border"
                        :class="infoOf(r).badge"
                      >
                        {{ infoOf(r).icon }} {{ infoOf(r).label }}
                      </span>
                      <span class="text-[11px] text-slate-400">{{ formatDate(r.createdAt) }}</span>
                    </div>
                    <p class="text-sm text-slate-700 whitespace-pre-wrap break-words">{{ r.content }}</p>
                    <div class="mt-2 flex items-center gap-3 text-xs font-bold">
                      <span class="text-emerald-600">👍 {{ (r.likes || 0).toLocaleString('id-ID') }}</span>
                      <span class="text-rose-600">👎 {{ (r.dislikes || 0).toLocaleString('id-ID') }}</span>
                    </div>
                  </div>
                  <button
                    v-if="isAdmin"
                    @click="askDeleteComment(r)"
                    title="Hapus balasan"
                    class="p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <svg class="w-4 h-4" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <ConfirmModal
      :open="modal.open"
      :loading="modal.loading"
      variant="danger"
      :title="modal.title"
      :message="modal.message"
      :confirm-text="modal.confirmText"
      @confirm="runDelete"
      @cancel="modal.open = false"
    />
  </div>
</template>
