<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { chatApi, dmRoomId } from '../../api/chat'
import { userApi } from '../../api/users'
import { auth, roleInfo } from '../../api/auth'
import { notifyChatMention, notificationApi } from '../../api/notifications'
import { checkChatSpam, CHAT_MAX_LENGTH, CHAT_AUTOBLOCK_REJECTIONS } from '../../utils/chatSpamGuard'
import { presenceApi, isOnline } from '../../api/presence'
import UserAvatar from '../../components/UserAvatar.vue'
import { compressImage } from '../../utils/image'
import { articleApi } from '../../api/articles'

const route = useRoute()
const me = auth.current()
const myUsername = me?.username || ''

const users = ref([])
// Kehadiran online: heartbeat lastSeen tiap user yang membuka chat
const presence = ref([])
const messages = ref([])
const loading = ref(true)
const error = ref('')
const draft = ref('')
const sending = ref(false)
const listEl = ref(null)
const draftEl = ref(null)
const pickerOpen = ref(false)
const mentionQuery = ref(null)
const hoveringId = ref(null)
const emojiPickerId = ref(null)
const deleteConfirmId = ref(null)
const replyTarget = ref(null)
const forwardOpen = ref(false)
const forwardTarget = ref(null)
const notice = ref('')
// Riwayat lama (di luar 100 pesan terbaru) — dimuat bertahap
const olderMessages = ref([])
const hasMore = ref(true)
const loadingOlder = ref(false)
// Pencarian pesan
const searchQuery = ref('')
// Lampiran & kartu artikel yang siap dikirim
const attachment = ref(null)
const pendingArticle = ref(null)
const articlePickerOpen = ref(false)
const articles = ref([])
const articleQuery = ref('')
// Deteksi pesan baru untuk suara/notifikasi
const knownIds = ref(new Set())
let audioCtx = null
const QUICK_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '🎉']
// Riwayat kiriman sendiri (sesi ini) untuk deteksi spam
const myHistory = ref([])
// Penolakan beruntun karena "terlalu cepat" — mencapai ambang → blokir otomatis
const rateViolations = ref(0)
const SPAM_MESSAGES = {
  rate: '⏳ Terlalu cepat! Tunggu sebentar sebelum kirim pesan lagi.',
  duplicate: '🚫 Jangan spam pesan yang sama berulang kali ya!',
  length: `📏 Pesan terlalu panjang (maks ${CHAT_MAX_LENGTH} karakter).`,
}
let timer = null
let noticeTimer = null
let usersTimer = null
let heartbeatTimer = null
let heartbeatBusy = false

// User yang bisa di-DM: Admin/Editor/Penulis, selain diri sendiri
const chatUsers = computed(() =>
  users.value.filter(
    (u) => u.username !== myUsername && ['admin', 'editor', 'writer'].includes(u.role)
  )
)

// User yang sedang online (heartbeat segar) — untuk titik hijau di chat
const onlineUsernames = computed(() =>
  new Set(
    presence.value
      .filter((p) => isOnline(presence.value, p.username))
      .map((p) => p.username)
  )
)
function isOnlineUser(u) {
  return u ? onlineUsernames.value.has(u.username) : false
}

// Cari data user (foto profil) dari username
function userByUsername(username) {
  return users.value.find((x) => x.username === username) || null
}
// Foto profil user untuk avatar chat (fallback inisial otomatis di UserAvatar)
function photoOf(username) {
  return userByUsername(username)?.photoUrl || ''
}

// Status blokir diri sendiri (dari server — sesi lokal bisa basi)
const isMeBlocked = computed(() => {
  const u = users.value.find((x) => x.username === myUsername)
  return !!(u?.chatBlocked ?? me?.chatBlocked)
})

// Admin & Editor boleh memblokir user lain dari chat; hanya Admin yang bisa membuka blokir
const canManageBlock = computed(() => ['admin', 'editor'].includes(me?.role))
const canUnblock = computed(() => me?.role === 'admin')

// Lawan bicara di ruang DM yang sedang dibuka
const selectedPeer = computed(() => {
  if (selectedRoom.value?.type !== 'dm') return null
  return chatUsers.value.find((u) => u.username === selectedRoom.value.username) || null
})

function isUserBlocked(username) {
  return !!users.value.find((u) => u.username === username)?.chatBlocked
}

// Blokir (Admin & Editor) / buka blokir (khusus Admin) user dari chat
async function toggleBlock() {
  const peer = selectedPeer.value
  if (!peer || !canManageBlock.value) return
  const next = !peer.chatBlocked
  if (!next && !canUnblock.value) {
    showNotice('🔒 Hanya admin yang bisa membuka blokir chat.')
    return
  }
  try {
    const updated = await userApi.update(peer.id, { chatBlocked: next })
    const idx = users.value.findIndex((u) => u.id === peer.id)
    if (idx >= 0) users.value[idx] = updated
    const name = peer.penName || peer.name || peer.username
    showNotice(next ? `⛔ ${name} diblokir dari chat.` : `✅ Blokir dicabut untuk ${name}.`)
  } catch {
    error.value = 'Gagal mengubah status blokir.'
  }
}

// Blokir otomatis karena spam chat — hanya admin yang bisa membuka
async function autoBlockMe() {
  const own = users.value.find((u) => u.username === myUsername)
  try {
    await userApi.update(own?.id ?? me?.id, { chatBlocked: true })
    if (own) {
      const idx = users.value.findIndex((u) => u.id === own.id)
      if (idx >= 0) users.value[idx] = { ...users.value[idx], chatBlocked: true }
    }
    // Sinkronkan sesi lokal supaya konsisten di seluruh komponen
    try {
      const session = auth.current()
      if (session) {
        session.chatBlocked = true
        localStorage.setItem('genz_session', JSON.stringify(session))
      }
    } catch {
      /* abaikan */
    }
    showNotice('⛔ Anda diblokir otomatis karena spam chat. Hubungi admin untuk membuka blokir.')
    await notifyAdminAutoBlock()
  } catch {
    error.value = 'Gagal memblokir akun secara otomatis.'
  }
}

// Admin yang terblokir bisa membuka blokir dirinya sendiri (tidak ada admin lain)
async function unblockSelf() {
  if (!canUnblock.value) return
  const own = users.value.find((u) => u.username === myUsername)
  try {
    await userApi.update(own?.id ?? me?.id, { chatBlocked: false })
    if (own) {
      const idx = users.value.findIndex((u) => u.id === own.id)
      if (idx >= 0) users.value[idx] = { ...users.value[idx], chatBlocked: false }
    }
    try {
      const session = auth.current()
      if (session) {
        session.chatBlocked = false
        localStorage.setItem('genz_session', JSON.stringify(session))
      }
    } catch {
      /* abaikan */
    }
    showNotice('✅ Blokir Anda dibuka kembali.')
  } catch {
    error.value = 'Gagal membuka blokir.'
  }
}

// Beri tahu semua Admin bahwa ada user yang diblokir otomatis karena spam
async function notifyAdminAutoBlock() {
  try {
    const admins = users.value.filter((u) => u.role === 'admin' && u.username !== myUsername)
    for (const a of admins) {
      await notificationApi.create({
        type: 'chat_autoblock',
        to: a.username,
        content: myUsername,
        by: myUsername,
        byName: me?.penName || me?.name || myUsername,
        createdAt: new Date().toISOString(),
      })
    }
    window.dispatchEvent(new CustomEvent('genz:chat-read'))
  } catch {
    /* abaikan — notifikasi tidak boleh memblokir alur utama */
  }
}

// Daftar percakapan: ruang grup + DM yang PERNAH di-chat (atau sedang dibuka)
const rooms = computed(() => {
  const list = [
    { id: 'group', type: 'group', name: 'Ruangan Redaksi', desc: 'Semua orang di tim' },
  ]
  for (const u of chatUsers.value) {
    const roomId = dmRoomId(myUsername, u.username)
    const hasChat = messages.value.some((m) => m.roomId === roomId)
    if (hasChat || selectedId.value === roomId) {
      list.push({
        id: roomId,
        type: 'dm',
        name: u.penName || u.name || u.username,
        username: u.username,
        role: u.role,
      })
    }
  }
  return list
})

// User yang BELUM punya percakapan — muncul di modal "Percakapan Baru"
const newChatUsers = computed(() =>
  chatUsers.value.filter((u) => !rooms.value.some((r) => r.id === dmRoomId(myUsername, u.username)))
)

// Tujuan forward: ruang grup + semua rekan tim (DM)
const forwardRooms = computed(() => {
  const list = [{ id: 'group', type: 'group', name: 'Ruangan Redaksi', desc: 'Grup semua tim' }]
  for (const u of chatUsers.value) {
    list.push({
      id: dmRoomId(myUsername, u.username),
      type: 'dm',
      name: u.penName || u.name || u.username,
      username: u.username,
      role: u.role,
    })
  }
  return list
})

const selectedId = ref('group')
const selectedRoom = computed(() => rooms.value.find((r) => r.id === selectedId.value))

// Semua pesan: 100 terbaru (polling) + riwayat lama yang sudah dimuat
const allMessages = computed(() => [...olderMessages.value, ...messages.value])

// Pesan ruang aktif, urut dari terlama
const roomMessages = computed(() =>
  allMessages.value
    .filter((m) => m.roomId === selectedId.value)
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
)

// Pesan yang ditampilkan — difilter saat mencari
const displayMessages = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return roomMessages.value
  return roomMessages.value.filter((m) => (m.content || '').toLowerCase().includes(q))
})

// Posisi pemisah "— Pesan baru —" (sebelum pesan pertama yang belum dibaca)
const firstUnreadIndex = computed(() => {
  if (searchQuery.value.trim()) return -1
  return roomMessages.value.findIndex(
    (m) => m.sender !== myUsername && !(m.readBy || []).includes(myUsername)
  )
})

// Ruang yang disenyapkan (mute) untuk user ini — dari server
const mutedRooms = computed(() =>
  users.value.find((u) => u.username === myUsername)?.mutedRooms || []
)

function isMuted(roomId) {
  return mutedRooms.value.includes(roomId)
}

// Highlight kata kunci pencarian di dalam pesan
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderWithHighlight(text) {
  const q = searchQuery.value.trim()
  if (!q) return [{ text: String(text || ''), hl: false }]
  const parts = String(text || '').split(new RegExp('(' + escapeRegExp(q) + ')', 'gi'))
  return parts.map((p) => ({ text: p, hl: p.toLowerCase() === q.toLowerCase() }))
}

function unreadOf(roomId) {
  return allMessages.value.filter(
    (m) => m.roomId === roomId && m.sender !== myUsername && !(m.readBy || []).includes(myUsername)
  ).length
}

// Pratinjau pesan terakhir per percakapan
function lastMessageOf(roomId) {
  const list = allMessages.value.filter((m) => m.roomId === roomId)
  if (!list.length) return ''
  const last = list.reduce((a, b) => (new Date(a.createdAt) > new Date(b.createdAt) ? a : b))
  let content = last.deleted ? '🚫 Pesan dihapus' : last.content
  if (!content) {
    if (last.attachment) content = '📎 Lampiran'
    else if (last.articleCard) content = '📰 Artikel'
  }
  return `${last.sender === myUsername ? 'Kamu: ' : ''}${content}`
}

function roleBadge(role) {
  return roleInfo[role]?.badge || 'bg-slate-500 text-white'
}

function userRoleOf(username) {
  return users.value.find((u) => u.username === username)?.role
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// ==== link preview ====

// Ambil URL pertama dalam teks + info domain & apakah itu gambar langsung
function linkInfo(content) {
  const m = String(content || '').match(/https?:\/\/[^\s<>"')\]\]]+/g)
  if (!m) return null
  let url = m[0].replace(/[.,;:!?]+$/, '')
  let domain = url
  try {
    domain = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    /* biarkan */
  }
  const isImage = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(url.split('?')[0])
  return { url, domain, isImage }
}

// ==== reaksi pesan ====

function reactionsOf(m) {
  return m.reactions || {}
}

function reactedNames(m, emoji) {
  return (m.reactions?.[emoji] || [])
    .map((u) => users.value.find((x) => x.username === u)?.penName || u)
    .join(', ')
}

async function toggleReaction(m, emoji) {
  if (isMeBlocked.value) return
  const cur = { ...(m.reactions || {}) }
  const list = [...(cur[emoji] || [])]
  const idx = list.indexOf(myUsername)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(myUsername)
  if (list.length) cur[emoji] = list
  else delete cur[emoji]
  m.reactions = cur
  try {
    await chatApi.react(m.id, cur)
  } catch {
    error.value = 'Gagal menyimpan reaksi.'
  }
}

// ==== status dibaca (read receipts) ====

function readState(m) {
  if (m.sender !== myUsername) return null
  const readBy = m.readBy || []
  if (selectedRoom.value?.type === 'group') {
    return readBy.length > 0 ? 'read' : 'sent'
  }
  return readBy.includes(selectedRoom.value?.username) ? 'read' : 'sent'
}

function readByNames(m) {
  const names = (m.readBy || []).map((u) => users.value.find((x) => x.username === u)?.penName || u)
  return names.length ? 'Dibaca oleh: ' + names.join(', ') : ''
}

// ==== balas / teruskan / hapus ====

function setReply(m) {
  if (isMeBlocked.value) return
  replyTarget.value = m
  mentionQuery.value = null
  nextTick(() => draftEl.value?.focus())
}

function clearReply() {
  replyTarget.value = null
}

function openForward(m) {
  if (isMeBlocked.value) return
  forwardTarget.value = m
  forwardOpen.value = true
}

async function confirmForward(room) {
  const m = forwardTarget.value
  if (!m || m.deleted || isMeBlocked.value) return
  try {
    await chatApi.send({
      roomId: room.id,
      type: room.type,
      sender: myUsername,
      senderName: me?.penName || me?.name || myUsername,
      content: m.content,
      ...(m.attachment ? { attachment: m.attachment } : {}),
      ...(m.articleCard ? { articleCard: m.articleCard } : {}),
      forwardedFrom: { sender: m.sender, senderName: m.senderName || m.sender, content: m.content },
    })
    forwardOpen.value = false
    forwardTarget.value = null
    showNotice(`Pesan diteruskan ke ${room.name} ✅`)
  } catch {
    error.value = 'Gagal meneruskan pesan.'
  }
}

// ==== lampiran file/gambar ====

async function onFileSelected(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 1.5 * 1024 * 1024) {
    showNotice('📎 File maksimal 1,5 MB.')
    return
  }
  try {
    const isImage = file.type.startsWith('image/')
    const dataUrl = isImage ? await compressImage(file) : await readAsDataURL(file)
    attachment.value = { name: file.name, type: isImage ? 'image' : 'file', dataUrl }
  } catch {
    showNotice('Gagal membaca file.')
  }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Gagal membaca file'))
    r.readAsDataURL(file)
  })
}

function clearAttachment() {
  attachment.value = null
}

// ==== bagikan kartu artikel ====

async function openArticlePicker() {
  articlePickerOpen.value = true
  try {
    articles.value = await articleApi.listPublished({ limit: 50 })
  } catch {
    error.value = 'Gagal memuat daftar artikel.'
  }
}

const filteredArticles = computed(() => {
  const q = articleQuery.value.trim().toLowerCase()
  if (!q) return articles.value
  return articles.value.filter((a) => (a.title || '').toLowerCase().includes(q))
})

function pickArticle(a) {
  pendingArticle.value = a
  articlePickerOpen.value = false
  articleQuery.value = ''
}

async function confirmDelete(m) {
  if (m.sender !== myUsername || isMeBlocked.value) return
  try {
    await chatApi.del(m.id)
    m.deleted = true
    m.reactions = {}
    deleteConfirmId.value = null
  } catch {
    error.value = 'Gagal menghapus pesan.'
  }
}

function showNotice(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 3000)
}

// ==== @mention ====

// Pecah teks jadi segmen biasa vs sebutan @user (untuk highlight)
function renderSegments(text) {
  return String(text || '')
    .split(/(@[\w.-]+)/g)
    .map((p) => ({ text: p, mention: /^@[\w.-]+$/.test(p) }))
}

// Set username (huruf kecil) yang disebut dalam teks
function mentionedUsernames(text) {
  const set = new Set()
  const re = /@([\w.-]+)/g
  let m
  while ((m = re.exec(text))) set.add(m[1].toLowerCase())
  return set
}

// Autocomplete: ambil prefiks setelah "@" di posisi kursor
function onDraftInput(e) {
  const caret = e.target.selectionStart ?? draft.value.length
  const before = draft.value.slice(0, caret)
  const match = before.match(/@([\w.-]*)$/)
  mentionQuery.value = match ? match[1] : null
  autoGrow()
}

// Tinggi textarea mengikuti isi (Enter = baris baru) — maksimal ~5 baris.
// Catatan: scrollHeight textarea kosong ikut menghitung placeholder yang panjang,
// jadi saat kosong cukup kembalikan ke tinggi natural (rows=1).
function autoGrow() {
  const ta = draftEl.value
  if (!ta) return
  if (!draft.value.trim()) {
    ta.style.height = ''
    return
  }
  ta.style.height = 'auto'
  ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'
}

const showMentionSuggestions = computed(
  () => selectedRoom.value?.type === 'group' && mentionQuery.value !== null && mentionSuggestions.value.length > 0
)

const mentionSuggestions = computed(() => {
  if (mentionQuery.value === null) return []
  const q = mentionQuery.value.toLowerCase()
  return chatUsers.value
    .filter(
      (u) =>
        (u.penName || u.name || u.username).toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    )
    .slice(0, 6)
})

function insertMention(username) {
  const ta = draftEl.value
  const caret = ta ? ta.selectionStart : draft.value.length
  const before = draft.value.slice(0, caret)
  const after = draft.value.slice(caret)
  const replaced = before.replace(/@[\w.-]*$/, '@' + username + ' ')
  draft.value = replaced + after
  mentionQuery.value = null
  nextTick(() => {
    ta?.focus()
    ta?.setSelectionRange(replaced.length, replaced.length)
  })
}

// ==== muat & polling ====

async function load() {
  loading.value = true
  error.value = ''
  try {
    messages.value = await chatApi.list()
    knownIds.value = new Set(messages.value.map((m) => m.id))
  } catch {
    error.value = 'Gagal memuat chat. Pastikan server data berjalan (npm run server).'
  } finally {
    loading.value = false
    scrollToBottom(true)
  }
}

async function refresh() {
  try {
    const fresh = await chatApi.list()
    // Deteksi pesan baru (bukan dari saya) → bip + notifikasi browser
    const newOnes = fresh.filter((m) => !knownIds.value.has(m.id) && m.sender !== myUsername)
    const audibles = newOnes.filter((m) => !isMuted(m.roomId))
    if (audibles.length) {
      beep()
      notifyBrowser(audibles[0])
    }
    newOnes.forEach((m) => knownIds.value.add(m.id))
    messages.value = fresh
    const hasUnread = allMessages.value.some(
      (m) =>
        m.roomId === selectedId.value &&
        m.sender !== myUsername &&
        !(m.readBy || []).includes(myUsername)
    )
    if (hasUnread) markRead()
  } catch {
    /* server tidak aktif — abaikan */
  }
}

async function markRead() {
  try {
    await chatApi.markRoomRead(selectedId.value, myUsername, allMessages.value)
    allMessages.value.forEach((m) => {
      if (
        m.roomId === selectedId.value &&
        m.sender !== myUsername &&
        !(m.readBy || []).includes(myUsername)
      ) {
        m.readBy = [...(m.readBy || []), myUsername]
      }
    })
  } catch {
    /* abaikan */
  }
  clearRoomMentions(selectedId.value)
}

// Muat pesan yang lebih lama dari yang sudah tampil
async function loadOlder() {
  if (loadingOlder.value || !hasMore.value) return
  loadingOlder.value = true
  try {
    const sorted = allMessages.value
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const oldest = sorted[0]
    if (!oldest) {
      hasMore.value = false
      return
    }
    const older = await chatApi.list(100, oldest.createdAt)
    if (!older.length) {
      hasMore.value = false
      return
    }
    olderMessages.value = [...older, ...olderMessages.value]
    older.forEach((m) => knownIds.value.add(m.id))
    hasMore.value = older.length >= 100
  } catch {
    error.value = 'Gagal memuat pesan lama.'
  } finally {
    loadingOlder.value = false
  }
}

// Senyapkan / aktifkan notifikasi satu ruang (mute per percakapan)
async function toggleMute() {
  const roomId = selectedId.value
  const own = users.value.find((u) => u.username === myUsername)
  const cur = mutedRooms.value
  const muted = cur.includes(roomId)
  const next = muted ? cur.filter((r) => r !== roomId) : [...cur, roomId]
  try {
    await userApi.update(own?.id ?? me?.id, { mutedRooms: next })
    if (own) {
      const idx = users.value.findIndex((u) => u.id === own.id)
      if (idx >= 0) users.value[idx] = { ...users.value[idx], mutedRooms: next }
    }
    showNotice(muted ? `🔔 Notifikasi ${selectedRoom.value?.name || ''} aktif kembali.` : `🔕 ${selectedRoom.value?.name || 'Ruang ini'} disenyapkan.`)
  } catch {
    error.value = 'Gagal mengubah pengaturan senyap.'
  }
}

// Bip singkat saat pesan baru masuk (Web Audio — tanpa file suara)
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.35)
  } catch {
    /* audio tidak tersedia */
  }
}

// Notifikasi browser (saat tab di background) untuk pesan baru
function notifyBrowser(m) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!document.hidden) return
    const name = users.value.find((u) => u.username === m.sender)?.penName || m.senderName || m.sender
    let body = m.content || ''
    if (!body) {
      if (m.attachment) body = '📎 Mengirim lampiran'
      else if (m.articleCard) body = '📰 Membagikan artikel'
    }
    const n = new Notification(`💬 Pesan baru dari ${name}`, {
      body,
      tag: 'genz-chat',
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* notifikasi tidak tersedia */
  }
}

// Notifikasi @mention di ruang ini ikut ditandai dibaca saat chat dibaca/dibuka,
// supaya angka notifikasi di bel tidak nyangkut meski pesannya sudah dibaca.
async function clearRoomMentions(roomId) {
  try {
    const cleared = await notificationApi.markRoomMentionsRead(roomId, myUsername)
    if (cleared > 0) window.dispatchEvent(new CustomEvent('genz:chat-read'))
  } catch {
    /* abaikan */
  }
}

function selectRoom(id) {
  if (selectedId.value === id) return
  selectedId.value = id
  mentionQuery.value = null
  markRead()
}

// ==== kehadiran online (presence) ====

// Kirim heartbeat "saya online" — sekali jalan, jangan menumpuk
async function sendHeartbeat() {
  if (heartbeatBusy || !myUsername) return
  heartbeatBusy = true
  try {
    await presenceApi.heartbeat(myUsername)
  } catch {
    /* server tidak aktif — abaikan */
  } finally {
    heartbeatBusy = false
  }
}

// Muat status online semua user (dipanggil bersama refresh daftar user)
async function refreshPresence() {
  try {
    presence.value = await presenceApi.list()
  } catch {
    /* abaikan */
  }
}

function handleVisibility() {
  if (document.visibilityState === 'visible') {
    sendHeartbeat()
    refreshPresence()
  }
}

// Mulai percakapan pribadi dengan user baru
function startNewChat(u) {
  selectedId.value = dmRoomId(myUsername, u.username)
  pickerOpen.value = false
  mentionQuery.value = null
}

async function send() {
  const content = draft.value.trim()
  const hasAttachment = !!attachment.value
  const hasCard = !!pendingArticle.value
  if ((!content && !hasAttachment && !hasCard) || !selectedRoom.value || sending.value) return
  if (isMeBlocked.value) {
    showNotice('⛔ Anda diblokir dari mengirim chat — hanya bisa membaca.')
    return
  }
  // Cek status blokir terkini dari server (sesi lokal bisa basi)
  try {
    const fresh = await userApi.findByUsername(myUsername)
    if (fresh?.[0]?.chatBlocked) {
      showNotice('⛔ Anda diblokir dari mengirim chat — hanya bisa membaca.')
      return
    }
  } catch {
    /* server tidak aktif — lanjutkan saja */
  }
  // Anti-spam: kecepatan, duplikat, panjang (hanya untuk pesan berisi teks)
  if (content) {
    const spam = checkChatSpam({ content, history: myHistory.value })
    if (!spam.ok) {
      showNotice(SPAM_MESSAGES[spam.reason] || 'Pesan ditolak.')
      // Terlalu cepat berulang kali → blokir otomatis (hanya admin yang bisa membuka)
      if (spam.reason === 'rate') {
        rateViolations.value += 1
        if (rateViolations.value >= CHAT_AUTOBLOCK_REJECTIONS) {
          await autoBlockMe()
        }
      }
      return
    }
  }
  rateViolations.value = 0
  sending.value = true
  try {
    const payload = {
      roomId: selectedId.value,
      type: selectedRoom.value.type,
      sender: myUsername,
      senderName: me?.penName || me?.name || myUsername,
      content,
    }
    if (replyTarget.value) {
      payload.replyTo = {
        id: replyTarget.value.id,
        sender: replyTarget.value.sender,
        senderName: replyTarget.value.senderName || replyTarget.value.sender,
        content: replyTarget.value.content,
      }
    }
    if (hasAttachment) payload.attachment = attachment.value
    if (hasCard) {
      payload.articleCard = {
        id: pendingArticle.value.id,
        title: pendingArticle.value.title,
        category: pendingArticle.value.category || '',
        coverImage: pendingArticle.value.coverImage || '',
        slug: pendingArticle.value.slug || '',
      }
    }
    const created = await chatApi.send(payload)
    messages.value = [created, ...messages.value]
    if (content) {
      myHistory.value = [{ content, createdAt: created.createdAt }, ...myHistory.value].slice(0, 20)
    }
    draft.value = ''
    nextTick(autoGrow) // kembalikan tinggi textarea ke satu baris
    replyTarget.value = null
    attachment.value = null
    pendingArticle.value = null
    mentionQuery.value = null

    // @mention di chat grup → kirim notifikasi ke user yang disebut
    if (content && selectedRoom.value.type === 'group') {
      const mentioned = chatUsers.value.filter((u) => mentionedUsernames(content).has(u.username.toLowerCase()))
      for (const u of mentioned) {
        await notifyChatMention({
          to: u.username,
          byName: me?.penName || me?.name || myUsername,
          roomId: selectedId.value,
          content,
        })
      }
    }
    scrollToBottom(true)
  } catch {
    error.value = 'Gagal mengirim pesan. Pastikan server data berjalan.'
  } finally {
    sending.value = false
  }
}

function scrollToBottom(force = false) {
  nextTick(() => {
    const el = listEl.value
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    if (force || nearBottom) el.scrollTop = el.scrollHeight
  })
}

onMounted(async () => {
  // Dari notifikasi "menyebut anda di chat" → buka ruang yang dimaksud
  const roomParam = route.query.room?.toString()
  if (roomParam === 'group' || roomParam?.startsWith('dm:')) {
    selectedId.value = roomParam
  }
  load()
  userApi.list().then((all) => (users.value = all)).catch(() => {})
  // Minta izin notifikasi browser (untuk pesan baru saat tab di background)
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
  // Saat halaman dibuka, notifikasi @mention di ruang aktif ikut dibaca
  clearRoomMentions(selectedId.value)
  timer = setInterval(refresh, 4000)
  // Refresh daftar user berkala supaya status blokir & online terbaru ikut terbaca
  usersTimer = setInterval(() => {
    userApi.list().then((all) => (users.value = all)).catch(() => {})
    refreshPresence()
  }, 15000)
  // Heartbeat berkala — menandai user ini online selama chat terbuka
  sendHeartbeat()
  refreshPresence()
  heartbeatTimer = setInterval(sendHeartbeat, 30000)
  document.addEventListener('visibilitychange', handleVisibility)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (usersTimer) clearInterval(usersTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  document.removeEventListener('visibilitychange', handleVisibility)
})

// Pindah ruang → gulir ke bawah; pesan baru → gulir bila memang di bawah
watch(selectedId, () => scrollToBottom(true))
watch(roomMessages, () => scrollToBottom(false), { flush: 'post' })
</script>

<template>
  <div class="max-w-6xl">
    <div class="mb-6">
      <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Ngobrol ✦</p>
      <h1 class="font-groovy font-black text-2xl sm:text-3xl text-link-700">Chat Redaksi 💬</h1>
      <p class="text-slate-500 text-sm mt-1 font-semibold">Komunikasi Admin, Editor &amp; Penulis — grup atau pribadi.</p>
    </div>

    <p v-if="error" class="mb-5 bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-[3px_3px_0_#b45309]">
      {{ error }}
    </p>

    <p v-if="notice" class="mb-5 bg-emerald-100 border-2 border-emerald-400 text-emerald-900 rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-[3px_3px_0_#047857]">
      {{ notice }}
    </p>

    <div class="grid lg:grid-cols-[320px_1fr] gap-6">
      <!-- Sidebar percakapan -->
      <aside class="bg-white rounded-2xl border-2 border-link-700 shadow-[4px_4px_0_#2a1038] overflow-hidden flex flex-col h-[480px] lg:h-[560px]">
        <div class="px-4 py-3 border-b-2 border-slate-200 bg-brand-50/40 flex items-center justify-between gap-2">
          <p class="font-groovy font-black text-sm text-link-700">💬 Percakapan</p>
          <button
            @click="pickerOpen = true"
            title="Mulai percakapan baru"
            class="w-7 h-7 rounded-full bg-brand-600 text-white border-2 border-link-700 shadow-[2px_2px_0_#2a1038] grid place-items-center font-black text-sm hover:bg-brand-500 hover:-translate-y-0.5 transition-all"
          >
            +
          </button>
        </div>
        <div class="overflow-y-auto flex-1 p-2 space-y-1.5">
          <button
            v-for="r in rooms"
            :key="r.id"
            @click="selectRoom(r.id)"
            class="w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all flex items-center gap-3"
            :class="
              selectedId === r.id
                ? 'bg-brand-600 border-link-700 text-white shadow-[2px_2px_0_#2a1038]'
                : 'bg-white border-slate-200 hover:border-brand-400 hover:-translate-y-0.5'
            "
          >
            <span class="relative shrink-0">
              <UserAvatar
                v-if="r.type !== 'group'"
                :photo-url="photoOf(r.username)"
                :name="r.name"
                size="md"
                fallback-class="bg-grape-100 text-link-700"
              />
              <span
                v-else
                class="w-9 h-9 rounded-xl grid place-items-center border-2 border-link-700 shadow-[2px_2px_0_#2a1038] bg-acid-500"
              >
                👥
              </span>
              <span
                v-if="r.username && isOnlineUser(users.find((x) => x.username === r.username))"
                class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                title="Online"
              ></span>
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block font-extrabold text-sm truncate"
                :class="selectedId === r.id ? 'text-white' : 'text-link-700'"
              >
                {{ r.name }}
                <span
                  v-if="r.role"
                  class="ml-1 inline-block text-[9px] font-groovy font-bold uppercase px-1.5 py-0.5 rounded-full border align-middle"
                  :class="selectedId === r.id ? 'bg-white/20 border-white/40 text-white' : roleBadge(r.role)"
                >
                  {{ roleInfo[r.role]?.label }}
                </span>
                <span v-if="r.username && isUserBlocked(r.username)" class="ml-1 text-[10px]" title="User diblokir dari chat">⛔</span>
                <span v-if="isMuted(r.id)" class="ml-1 text-[10px]" title="Notifikasi ruang ini disenyapkan">🔕</span>
              </span>
              <span
                class="block text-[11px] truncate"
                :class="[
                  unreadOf(r.id) ? 'font-extrabold' : 'font-semibold',
                  selectedId === r.id ? 'text-white/90' : unreadOf(r.id) ? 'text-brand-600' : 'text-slate-400',
                ]"
              >
                {{ lastMessageOf(r.id) || (r.type === 'group' ? 'Sapa tim redaksi!' : 'Mulai obrolan pribadi') }}
                <span v-if="unreadOf(r.id)" class="ml-1">• baru</span>
              </span>
            </span>
            <span
              v-if="unreadOf(r.id)"
              class="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black grid place-items-center border border-link-700"
            >
              {{ unreadOf(r.id) }}
            </span>
          </button>

          <p v-if="!rooms.length" class="text-center text-slate-400 text-xs py-8 font-semibold">
            Belum ada percakapan. Klik <span class="font-black">+</span> untuk chat dengan rekan kerja.
          </p>
        </div>
      </aside>

      <!-- Jendela chat -->
      <section class="bg-white rounded-2xl border-2 border-link-700 shadow-[4px_4px_0_#2a1038] flex flex-col h-[480px] lg:h-[560px]">
        <!-- Header ruang -->
        <header class="px-5 py-3.5 border-b-2 border-slate-200 bg-brand-50/40 flex items-center gap-3">
          <span class="relative shrink-0">
            <UserAvatar
              v-if="selectedRoom?.type === 'dm'"
              :photo-url="selectedPeer?.photoUrl || ''"
              :name="selectedRoom?.name || ''"
              size="lg"
              fallback-class="bg-grape-100 text-link-700"
            />
            <span
              v-else
              class="w-10 h-10 rounded-xl grid place-items-center border-2 border-link-700 text-lg shadow-[2px_2px_0_#2a1038] bg-acid-500"
            >
              👥
            </span>
            <span
              v-if="selectedRoom?.type === 'dm' && selectedPeer && isOnlineUser(selectedPeer)"
              class="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
              title="Online"
            ></span>
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-groovy font-black text-link-700 truncate">
              {{ selectedRoom?.name || 'Chat' }}
              <span v-if="selectedPeer?.chatBlocked" class="ml-1 text-xs" title="User diblokir dari chat">⛔</span>
            </p>
            <p class="text-xs font-semibold" :class="selectedRoom?.type === 'dm' && selectedPeer ? (isOnlineUser(selectedPeer) ? 'text-emerald-600' : 'text-slate-400') : 'text-slate-400'">
              <template v-if="selectedRoom?.type === 'group'">Semua role bisa lihat pesan di sini • pakai @nama untuk menyebut</template>
              <template v-else-if="selectedPeer?.chatBlocked">Diblokir dari mengirim chat — hanya admin yang bisa membuka</template>
              <template v-else-if="selectedPeer">
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" :class="isOnlineUser(selectedPeer) ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                  {{ isOnlineUser(selectedPeer) ? 'Sedang online' : 'Offline' }}
                </span>
              </template>
              <template v-else>Obrolan pribadi</template>
            </p>
          </div>
          <button
            v-if="selectedRoom"
            @click="toggleMute"
            :title="isMuted(selectedId) ? 'Aktifkan notifikasi ruang ini' : 'Senyapkan notifikasi ruang ini'"
            class="shrink-0 w-8 h-8 grid place-items-center rounded-full border-2 transition-all hover:-translate-y-0.5"
            :class="isMuted(selectedId) ? 'bg-slate-200 border-link-700 text-slate-600' : 'bg-white border-slate-300 text-slate-500 hover:border-brand-400'"
          >
            {{ isMuted(selectedId) ? '🔕' : '🔔' }}
          </button>
          <button
            v-if="
              selectedRoom?.type === 'dm' &&
              selectedPeer &&
              (selectedPeer.chatBlocked ? canUnblock : canManageBlock)
            "
            @click="toggleBlock"
            class="shrink-0 text-[10px] font-groovy font-black uppercase tracking-wide px-2.5 py-1.5 rounded-full border-2 transition-all hover:-translate-y-0.5"
            :class="
              selectedPeer.chatBlocked
                ? 'bg-rose-500 border-link-700 text-white shadow-[2px_2px_0_#2a1038]'
                : 'bg-white border-slate-300 text-slate-500 hover:border-rose-400 hover:text-rose-600'
            "
            :title="selectedPeer.chatBlocked ? 'Buka blokir chat' : 'Blokir user ini dari chat'"
          >
            {{ selectedPeer.chatBlocked ? '✅ Buka Blokir' : '⛔ Blokir' }}
          </button>
        </header>

        <!-- Toolbar: cari pesan -->
        <div class="px-4 py-2 border-b-2 border-slate-200 bg-white flex items-center gap-2">
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari pesan di ruang ini…"
              class="w-full border-2 border-slate-200 rounded-xl pl-8 pr-8 py-1.5 text-xs bg-[#fff9f1] focus:outline-none focus:border-brand-600"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-black"
              title="Hapus pencarian"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Daftar pesan -->
        <div ref="listEl" class="flex-1 overflow-y-auto p-5 space-y-3 bg-[#fff9f1]">
          <div v-if="loading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="bg-slate-200 animate-pulse rounded-2xl h-10 w-2/3 border-2 border-link-700"></div>
          </div>
          <template v-else>
          <!-- Muat riwayat lama -->
          <div v-if="hasMore && !searchQuery && roomMessages.length" class="text-center pb-1">
            <button
              @click="loadOlder"
              :disabled="loadingOlder"
              class="text-[10px] font-groovy font-black uppercase tracking-widest text-brand-600 hover:text-brand-500 px-3 py-1.5 rounded-full border-2 border-slate-200 bg-white hover:border-brand-400 disabled:opacity-50 transition-all"
            >
              {{ loadingOlder ? 'Memuat…' : '↑ Muat pesan lebih lama' }}
            </button>
          </div>
          <p v-if="!displayMessages.length" class="text-center text-slate-400 py-16 font-semibold">
            {{ searchQuery ? 'Tidak ada pesan yang cocok dengan pencarian.' : (selectedRoom?.type === 'group' ? 'Belum ada pesan di ruang redaksi. Sapa duluan! 👋' : 'Belum ada pesan. Mulai obrolan! 👋') }}
          </p>
          <template v-else>
            <template v-for="(m, mi) in displayMessages" :key="m.id">
              <div v-if="mi === firstUnreadIndex" class="flex items-center gap-3 my-1">
                <span class="flex-1 h-px bg-brand-300"></span>
                <span class="text-[10px] font-groovy font-black uppercase tracking-widest text-brand-600 bg-brand-50 border border-brand-300 rounded-full px-2.5 py-0.5">Pesan baru</span>
                <span class="flex-1 h-px bg-brand-300"></span>
              </div>
              <div
                class="flex gap-2.5"
                :class="m.sender === myUsername ? 'justify-end' : 'justify-start'"
                @mouseenter="hoveringId = m.id"
                @mouseleave="hoveringId = null"
              >
              <UserAvatar
                v-if="m.sender !== myUsername"
                :photo-url="photoOf(m.sender)"
                :name="m.senderName || m.sender"
                size="msg"
                fallback-class="bg-white text-link-700"
              />
              <div class="max-w-[75%]" :class="m.sender === myUsername ? 'text-right' : ''">
                <p
                  v-if="m.sender !== myUsername && selectedRoom?.type === 'group'"
                  class="text-[11px] font-extrabold text-link-700 mb-0.5 px-1 flex items-center gap-1.5"
                >
                  <span
                    v-if="isOnlineUser(users.find((x) => x.username === m.sender))"
                    class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                    title="Sedang online"
                  ></span>
                  {{ m.senderName || m.sender }}
                  <span
                    v-if="userRoleOf(m.sender)"
                    class="ml-1 text-[9px] font-groovy font-bold uppercase px-1.5 py-0.5 rounded-full border"
                    :class="roleBadge(userRoleOf(m.sender))"
                  >
                    {{ roleInfo[userRoleOf(m.sender)]?.label }}
                  </span>
                </p>
                <div
                  class="rounded-2xl px-4 py-2.5 text-sm font-medium border-2 leading-relaxed break-words whitespace-pre-line inline-block text-left"
                  :class="
                    m.sender === myUsername
                      ? 'bg-brand-600 border-link-700 text-white shadow-[3px_3px_0_#2a1038]'
                      : 'bg-white border-slate-200 text-slate-700 shadow-[3px_3px_0_#2a1038]'
                  "
                >
                  <p
                    v-if="m.forwardedFrom"
                    class="text-[10px] font-groovy font-black uppercase tracking-wide mb-1 flex items-center gap-1"
                    :class="m.sender === myUsername ? 'text-acid-200' : 'text-slate-400'"
                  >
                    ↪️ Diteruskan dari {{ m.forwardedFrom.senderName || m.forwardedFrom.sender }}
                  </p>
                  <div
                    v-if="m.replyTo && !m.deleted"
                    class="mb-1.5 rounded-lg border-l-4 px-2.5 py-1.5 text-xs min-w-0 text-left"
                    :class="
                      m.sender === myUsername
                        ? 'bg-white/15 border-acid-300/70 text-white/90'
                        : 'bg-slate-50 border-brand-400 text-slate-500'
                    "
                  >
                    <span class="font-extrabold block truncate">{{ m.replyTo.senderName || m.replyTo.sender }}</span>
                    <span class="block truncate">{{ m.replyTo.content }}</span>
                  </div>
                  <template v-if="m.deleted">
                    <span class="italic opacity-70">🚫 Pesan ini telah dihapus</span>
                  </template>
                  <template v-else-if="searchQuery">
                    <template v-for="(seg, si) in renderWithHighlight(m.content)" :key="si">
                      <mark v-if="seg.hl" class="bg-acid-300 text-link-700 rounded px-0.5">{{ seg.text }}</mark>
                      <template v-else>{{ seg.text }}</template>
                    </template>
                  </template>
                  <template v-else>
                    <template v-for="(seg, si) in renderSegments(m.content)" :key="si">
                      <span
                        v-if="seg.mention"
                        class="font-extrabold rounded px-1"
                        :class="m.sender === myUsername ? 'bg-white/25 text-acid-200' : 'bg-acid-200 text-link-700'"
                      >
                        {{ seg.text }}
                      </span>
                      <template v-else>{{ seg.text }}</template>
                    </template>
                  </template>

                  <!-- Link preview -->
                  <template v-if="!m.deleted && linkInfo(m.content)">
                    <img
                      v-if="linkInfo(m.content).isImage"
                      :src="linkInfo(m.content).url"
                      alt="Preview gambar"
                      class="mt-2 rounded-xl border-2 max-h-52 w-auto max-w-full"
                      :class="m.sender === myUsername ? 'border-white/40' : 'border-slate-200'"
                    />
                    <a
                      v-else
                      :href="linkInfo(m.content).url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="mt-2 flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 max-w-full transition-transform hover:scale-[1.02]"
                      :class="
                        m.sender === myUsername
                          ? 'bg-white/15 border-white/40 hover:bg-white/25'
                          : 'bg-slate-50 border-slate-200 hover:border-brand-400'
                      "
                    >
                      <img
                        :src="'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(linkInfo(m.content).domain) + '&sz=64'"
                        alt=""
                        class="w-6 h-6 rounded shrink-0"
                      />
                      <span class="min-w-0 text-left">
                        <span
                          class="block text-[10px] font-groovy font-black uppercase tracking-wide truncate"
                          :class="m.sender === myUsername ? 'text-acid-200' : 'text-link-700'"
                        >
                          {{ linkInfo(m.content).domain }}
                        </span>
                        <span
                          class="block text-[10px] font-semibold truncate"
                          :class="m.sender === myUsername ? 'text-white/80' : 'text-slate-400'"
                        >
                          {{ linkInfo(m.content).url }}
                        </span>
                      </span>
                      <span
                        class="ml-auto shrink-0 text-[10px] font-groovy font-black"
                        :class="m.sender === myUsername ? 'text-acid-200' : 'text-brand-600'"
                      >
                        Buka ↗
                      </span>
                    </a>
                  </template>

                  <!-- Lampiran -->
                  <template v-if="!m.deleted && m.attachment">
                    <img
                      v-if="m.attachment.type === 'image'"
                      :src="m.attachment.dataUrl"
                      alt="Lampiran"
                      class="mt-2 rounded-xl border-2 max-h-48 w-auto max-w-full"
                      :class="m.sender === myUsername ? 'border-white/40' : 'border-slate-200'"
                    />
                    <a
                      v-else
                      :href="m.attachment.dataUrl"
                      :download="m.attachment.name"
                      class="mt-2 flex items-center gap-2 rounded-xl border-2 px-3 py-2 max-w-full"
                      :class="m.sender === myUsername ? 'bg-white/15 border-white/40' : 'bg-slate-50 border-slate-200'"
                    >
                      <span class="text-base shrink-0">📎</span>
                      <span class="min-w-0 text-left">
                        <span class="block text-[11px] font-bold truncate" :class="m.sender === myUsername ? 'text-white' : 'text-slate-700'">{{ m.attachment.name }}</span>
                        <span class="block text-[10px] font-semibold" :class="m.sender === myUsername ? 'text-white/70' : 'text-slate-400'">Klik untuk unduh</span>
                      </span>
                    </a>
                  </template>

                  <!-- Kartu artikel -->
                  <a
                    v-if="!m.deleted && m.articleCard"
                    :href="'/berita/' + m.articleCard.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-2 block rounded-xl border-2 overflow-hidden max-w-full text-left transition-transform hover:scale-[1.02]"
                    :class="m.sender === myUsername ? 'border-white/40 bg-white/10' : 'border-slate-200 bg-slate-50'"
                  >
                    <img v-if="m.articleCard.coverImage" :src="m.articleCard.coverImage" alt="" class="w-full h-28 object-cover" />
                    <span class="block px-3 py-2">
                      <span class="block text-[9px] font-groovy font-black uppercase tracking-wide" :class="m.sender === myUsername ? 'text-acid-200' : 'text-brand-600'">
                        📰 {{ m.articleCard.category || 'Artikel' }}
                      </span>
                      <span class="block text-xs font-bold leading-snug line-clamp-2 mt-0.5" :class="m.sender === myUsername ? 'text-white' : 'text-link-700'">
                        {{ m.articleCard.title }}
                      </span>
                      <span class="block text-[10px] font-semibold mt-0.5" :class="m.sender === myUsername ? 'text-white/70' : 'text-slate-400'">
                        Buka di portal ↗
                      </span>
                    </span>
                  </a>
                </div>

                <!-- Aksi hover: balas / teruskan / hapus -->
                <div
                  v-if="hoveringId === m.id && !m.deleted && !isMeBlocked"
                  class="mt-1 px-1 flex items-center gap-1"
                  :class="m.sender === myUsername ? 'justify-end' : 'justify-start'"
                >
                  <button
                    @click="setReply(m)"
                    title="Balas pesan"
                    class="w-6 h-6 grid place-items-center text-xs rounded-full border-2 border-slate-200 bg-white hover:border-brand-400 hover:scale-110 transition-all"
                  >
                    ↩️
                  </button>
                  <button
                    @click="openForward(m)"
                    title="Teruskan pesan"
                    class="w-6 h-6 grid place-items-center text-xs rounded-full border-2 border-slate-200 bg-white hover:border-brand-400 hover:scale-110 transition-all"
                  >
                    ↪️
                  </button>
                  <button
                    v-if="m.sender === myUsername"
                    @click="deleteConfirmId = m.id"
                    title="Hapus pesan"
                    class="w-6 h-6 grid place-items-center text-xs rounded-full border-2 border-slate-200 bg-white hover:border-rose-400 hover:scale-110 transition-all"
                  >
                    🗑️
                  </button>
                  <template v-if="deleteConfirmId === m.id">
                    <span class="text-[10px] font-black text-slate-500 ml-1">Hapus?</span>
                    <button
                      @click="confirmDelete(m)"
                      title="Ya, hapus"
                      class="w-6 h-6 grid place-items-center text-xs rounded-full border-2 border-rose-500 bg-rose-500 text-white hover:scale-110 transition-all"
                    >
                      ✓
                    </button>
                    <button
                      @click="deleteConfirmId = null"
                      title="Batal"
                      class="w-6 h-6 grid place-items-center text-xs rounded-full border-2 border-slate-200 bg-white hover:border-slate-400 transition-all"
                    >
                      ✕
                    </button>
                  </template>
                </div>

                <!-- Reaksi + status dibaca -->
                <div
                  v-if="!m.deleted"
                  class="mt-1 px-1 flex items-center gap-1"
                  :class="m.sender === myUsername ? 'justify-end' : 'justify-start'"
                >
                  <button
                    v-for="(emojis, emoji) in reactionsOf(m)"
                    :key="emoji"
                    @click="toggleReaction(m, emoji)"
                    :title="reactedNames(m, emoji)"
                    class="text-[11px] font-bold px-1.5 py-0.5 rounded-full border-2 transition-all"
                    :class="
                      emojis.includes(myUsername)
                        ? 'bg-brand-600 border-link-700 text-white shadow-[1px_1px_0_#2a1038]'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-brand-400'
                    "
                  >
                    {{ emoji }} {{ emojis.length }}
                  </button>
                  <span v-if="(hoveringId === m.id || emojiPickerId === m.id) && !isMeBlocked" class="inline-flex items-center gap-0.5">
                    <template v-if="emojiPickerId === m.id">
                      <button
                        v-for="e in QUICK_EMOJIS"
                        :key="e"
                        @click="toggleReaction(m, e)"
                        class="w-6 h-6 grid place-items-center text-sm rounded-full border-2 border-slate-200 bg-white hover:bg-brand-50 hover:scale-110 transition-all"
                      >
                        {{ e }}
                      </button>
                      <button
                        @click="emojiPickerId = null"
                        class="text-slate-400 hover:text-slate-700 text-[10px] font-black px-1"
                        title="Tutup"
                      >
                        ✕
                      </button>
                    </template>
                    <button
                      v-else
                      @click="emojiPickerId = m.id"
                      class="w-6 h-6 grid place-items-center text-xs rounded-full border-2 border-slate-200 bg-white text-slate-400 hover:text-brand-600 hover:border-brand-400 transition-all"
                      title="Tambah reaksi"
                    >
                      +
                    </button>
                  </span>
                </div>
                <p
                  class="text-[10px] font-semibold text-slate-400 mt-0.5 px-1 inline-flex items-center gap-1"
                  :class="m.sender === myUsername ? 'justify-end' : ''"
                >
                  {{ formatTime(m.createdAt) }}
                  <span
                    v-if="m.sender === myUsername && !m.deleted"
                    :title="readByNames(m)"
                    class="font-black"
                    :class="readState(m) === 'read' ? 'text-brand-600' : 'text-slate-400'"
                  >
                    {{ readState(m) === 'read' ? '✓✓' : '✓' }}
                  </span>
                </p>
              </div>
            </div>
            </template>
          </template>
          </template>
        </div>

        <!-- Input pesan -->
        <form class="relative p-4 border-t-2 border-slate-200" @submit.prevent="send">
          <!-- User diblokir: hanya bisa membaca -->
          <div
            v-if="isMeBlocked"
            class="rounded-2xl border-2 border-dashed border-rose-400 bg-rose-50 px-4 py-3.5 text-center"
          >
            <p class="text-sm font-groovy font-black text-rose-700">⛔ Anda diblokir dari mengirim chat</p>
            <p class="text-xs font-semibold text-rose-500 mt-1">Anda hanya bisa membaca pesan. Hubungi admin jika ini keliru.</p>
            <button
              v-if="canUnblock"
              @click="unblockSelf"
              class="mt-2.5 text-[11px] font-groovy font-black uppercase tracking-wide px-3.5 py-1.5 rounded-full bg-rose-600 text-white border-2 border-link-700 shadow-[2px_2px_0_#2a1038] hover:bg-rose-500 hover:-translate-y-0.5 transition-all"
            >
              🔓 Buka Blokir Saya
            </button>
          </div>

          <template v-else>
          <!-- Banner balasan -->
          <div
            v-if="replyTarget"
            class="mb-2 flex items-center gap-2 bg-brand-50 border-2 border-brand-300 rounded-xl px-3 py-2"
          >
            <span class="text-xs font-semibold text-slate-600 min-w-0 flex-1 truncate">
              <span class="font-groovy font-black text-brand-600">↩️ Membalas</span>
              <b class="text-link-700">{{ replyTarget.senderName || replyTarget.sender }}</b>:
              “{{ replyTarget.content }}”
            </span>
            <button
              type="button"
              @click="clearReply"
              class="shrink-0 text-slate-400 hover:text-slate-700 font-black"
              title="Batal membalas"
            >
              ✕
            </button>
          </div>

          <!-- Lampiran & kartu artikel yang siap dikirim -->
          <div v-if="attachment || pendingArticle" class="mb-2 flex flex-wrap items-center gap-2">
            <div v-if="attachment" class="flex items-center gap-2 bg-brand-50 border-2 border-brand-300 rounded-xl px-2 py-1.5">
              <img v-if="attachment.type === 'image'" :src="attachment.dataUrl" alt="" class="h-9 w-14 object-cover rounded-lg border border-slate-200" />
              <span v-else class="text-sm">📎</span>
              <span class="text-[11px] font-bold text-link-700 truncate max-w-[150px]">{{ attachment.name }}</span>
              <button type="button" @click="clearAttachment" class="text-slate-400 hover:text-slate-700 font-black text-xs" title="Batal lampirkan">✕</button>
            </div>
            <div v-if="pendingArticle" class="flex items-center gap-2 bg-brand-50 border-2 border-brand-300 rounded-xl px-2 py-1.5 max-w-[280px]">
              <img v-if="pendingArticle.coverImage" :src="pendingArticle.coverImage" alt="" class="h-9 w-14 object-cover rounded-lg border border-slate-200" />
              <span v-else class="text-sm">📰</span>
              <span class="text-[11px] font-bold text-link-700 truncate flex-1">{{ pendingArticle.title }}</span>
              <button type="button" @click="pendingArticle = null" class="text-slate-400 hover:text-slate-700 font-black text-xs" title="Batal bagikan">✕</button>
            </div>
          </div>

          <div class="flex gap-2 items-end">
            <label
              class="shrink-0 w-10 h-10 grid place-items-center rounded-2xl border-2 border-slate-300 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:-translate-y-0.5 transition-all cursor-pointer"
              title="Lampirkan gambar/file (maks 1,5 MB)"
            >
              📎
              <input type="file" class="hidden" accept="image/*,.pdf,.txt,.doc,.docx,.xls,.csv" @change="onFileSelected" />
            </label>
            <button
              type="button"
              @click="openArticlePicker"
              class="shrink-0 w-10 h-10 grid place-items-center rounded-2xl border-2 border-slate-300 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:-translate-y-0.5 transition-all"
              title="Bagikan artikel dari portal"
            >
              📰
            </button>
            <!-- Saran sebutan @nama -->
          <div
            v-if="showMentionSuggestions"
            class="absolute bottom-full left-4 right-4 mb-2 bg-white border-2 border-link-700 rounded-2xl shadow-[4px_4px_0_#2a1038] overflow-hidden z-10"
          >
            <p class="px-3 py-1.5 text-[10px] font-groovy font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
              Sebut orang...
            </p>
            <div class="max-h-44 overflow-y-auto">
              <button
                v-for="u in mentionSuggestions"
                :key="u.username"
                type="button"
                @click="insertMention(u.username)"
                class="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-brand-50 transition-colors"
              >
                <span class="relative shrink-0">
                  <UserAvatar
                    :photo-url="u.photoUrl || ''"
                    :name="u.penName || u.name || u.username"
                    size="sm"
                    :fallback-class="roleBadge(u.role)"
                  />
                  <span
                    v-if="isOnlineUser(u)"
                    class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                    title="Sedang online"
                  ></span>
                </span>
                <span class="min-w-0">
                  <span class="block text-xs font-extrabold text-link-700 truncate">{{ u.penName || u.name || u.username }}</span>
                  <span class="block text-[10px] font-semibold" :class="isOnlineUser(u) ? 'text-emerald-600' : 'text-slate-400'">@{{ u.username }}{{ isOnlineUser(u) ? ' • online' : '' }}</span>
                </span>
              </button>
            </div>
          </div>

          <textarea
            ref="draftEl"
            v-model="draft"
            rows="1"
            :placeholder="selectedRoom?.type === 'group' ? 'Tulis pesan… ketik @ untuk menyebut orang • Enter = baris baru, Shift+Enter = kirim' : 'Tulis pesan… Enter = baris baru, Shift+Enter = kirim'"
            class="flex-1 border-2 border-slate-300 rounded-2xl px-4 py-3 text-sm bg-[#fff9f1] focus:outline-none focus:border-brand-600 resize-none"
            @input="onDraftInput"
            @keydown.shift.enter.exact.prevent="send"
          ></textarea>
              <button
                type="submit"
                :disabled="sending || (!draft.trim() && !attachment && !pendingArticle)"
                class="shrink-0 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl px-5 py-3 text-sm font-groovy font-bold border-2 border-link-700 shadow-[3px_3px_0_#2a1038] hover:-translate-y-0.5 transition-all"
              >
                Kirim ➤
              </button>
            </div>
          </template>
        </form>
      </section>
    </div>

    <p class="mt-5 text-xs font-semibold text-slate-400">
      💡 Pesan baru muncul otomatis setiap beberapa detik. Badge merah = pesan belum dibaca. Di ruang grup, sebut rekan dengan
      <span class="font-extrabold text-link-700">@username</span> dan mereka akan mendapat notifikasi.
    </p>
    <p class="mt-2 text-xs font-semibold text-slate-400 inline-flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
      Titik hijau = user sedang online (membuka Chat Redaksi). Status diperbarui otomatis ±15 detik; user dianggap offline
      setelah ±45 detik tidak aktif.
    </p>

    <!-- Modal: mulai percakapan baru -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="pickerOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-link-700/60 backdrop-blur-sm" @click="pickerOpen = false"></div>
          <div class="relative bg-white rounded-3xl border-2 border-link-700 shadow-[8px_8px_0_#2a1038] w-full max-w-sm overflow-hidden">
            <div class="px-5 py-4 border-b-2 border-slate-200 bg-brand-50/40 flex items-center justify-between gap-3">
              <p class="font-groovy font-black text-link-700">Mulai Percakapan Baru ✨</p>
              <button @click="pickerOpen = false" class="text-slate-400 hover:text-slate-700 font-black shrink-0" title="Tutup">✕</button>
            </div>
            <div class="max-h-72 overflow-y-auto p-2 space-y-1.5">
              <button
                v-for="u in newChatUsers"
                :key="u.username"
                @click="startNewChat(u)"
                class="w-full text-left px-3 py-2.5 rounded-xl border-2 border-slate-200 hover:border-brand-400 hover:-translate-y-0.5 transition-all flex items-center gap-3"
              >
                <span class="relative shrink-0">
                  <UserAvatar
                    :photo-url="u.photoUrl || ''"
                    :name="u.penName || u.name || u.username"
                    size="md"
                    :fallback-class="roleBadge(u.role)"
                  />
                  <span
                    v-if="isOnlineUser(u)"
                    class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                    title="Sedang online"
                  ></span>
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-extrabold text-link-700 truncate">{{ u.penName || u.name || u.username }}</span>
                  <span class="block text-[11px] font-semibold" :class="isOnlineUser(u) ? 'text-emerald-600' : 'text-slate-400'">
                    @{{ u.username }} • {{ roleInfo[u.role]?.label }}
                    <span v-if="isOnlineUser(u)">• <b>online</b></span>
                  </span>
                </span>
              </button>
              <p v-if="!newChatUsers.length" class="text-center text-slate-400 text-xs py-8 font-semibold">
                Semua rekan kerja sudah punya percakapan. 👌
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal: teruskan pesan -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="forwardOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-link-700/60 backdrop-blur-sm" @click="forwardOpen = false"></div>
          <div class="relative bg-white rounded-3xl border-2 border-link-700 shadow-[8px_8px_0_#2a1038] w-full max-w-sm overflow-hidden">
            <div class="px-5 py-4 border-b-2 border-slate-200 bg-brand-50/40 flex items-center justify-between gap-3">
              <p class="font-groovy font-black text-link-700">Teruskan Pesan ↪️</p>
              <button @click="forwardOpen = false" class="text-slate-400 hover:text-slate-700 font-black shrink-0" title="Tutup">✕</button>
            </div>
            <div class="px-5 py-3 bg-slate-50 border-b-2 border-slate-100">
              <p class="text-[11px] font-semibold text-slate-400 line-clamp-2">“{{ forwardTarget?.content }}”</p>
            </div>
            <div class="max-h-72 overflow-y-auto p-2 space-y-1.5">
              <button
                v-for="r in forwardRooms"
                :key="r.id"
                @click="confirmForward(r)"
                class="w-full text-left px-3 py-2.5 rounded-xl border-2 border-slate-200 hover:border-brand-400 hover:-translate-y-0.5 transition-all flex items-center gap-3"
              >
                <span class="relative shrink-0">
                  <UserAvatar
                    v-if="r.type !== 'group'"
                    :photo-url="photoOf(r.username)"
                    :name="r.name"
                    size="md"
                    fallback-class="bg-grape-100 text-link-700"
                  />
                  <span
                    v-else
                    class="w-9 h-9 rounded-xl grid place-items-center shrink-0 border-2 border-link-700 shadow-[2px_2px_0_#2a1038] text-sm bg-acid-500"
                  >
                    👥
                  </span>
                  <span
                    v-if="r.username && isOnlineUser(users.find((x) => x.username === r.username))"
                    class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm"
                    title="Sedang online"
                  ></span>
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-extrabold text-link-700 truncate">{{ r.name }}</span>
                  <span class="block text-[11px] font-semibold" :class="r.type !== 'group' && isOnlineUser(users.find((x) => x.username === r.username)) ? 'text-emerald-600' : 'text-slate-400'">
                    {{ r.type === 'group' ? 'Grup semua tim' : '@' + r.username + ' • ' + roleInfo[r.role]?.label + (isOnlineUser(users.find((x) => x.username === r.username)) ? ' • online' : '') }}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal: bagikan artikel -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="articlePickerOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-link-700/60 backdrop-blur-sm" @click="articlePickerOpen = false"></div>
          <div class="relative bg-white rounded-3xl border-2 border-link-700 shadow-[8px_8px_0_#2a1038] w-full max-w-md overflow-hidden">
            <div class="px-5 py-4 border-b-2 border-slate-200 bg-brand-50/40 flex items-center justify-between gap-3">
              <p class="font-groovy font-black text-link-700">Bagikan Artikel 📰</p>
              <button @click="articlePickerOpen = false" class="text-slate-400 hover:text-slate-700 font-black shrink-0" title="Tutup">✕</button>
            </div>
            <div class="px-5 py-3 border-b-2 border-slate-100">
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">🔍</span>
                <input
                  v-model="articleQuery"
                  type="text"
                  placeholder="Cari judul artikel…"
                  class="w-full border-2 border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs bg-[#fff9f1] focus:outline-none focus:border-brand-600"
                />
              </div>
            </div>
            <div class="max-h-80 overflow-y-auto p-2 space-y-1.5">
              <button
                v-for="a in filteredArticles"
                :key="a.id"
                @click="pickArticle(a)"
                class="w-full text-left px-3 py-2.5 rounded-xl border-2 border-slate-200 hover:border-brand-400 hover:-translate-y-0.5 transition-all flex items-center gap-3"
              >
                <img
                  v-if="a.coverImage"
                  :src="a.coverImage"
                  alt=""
                  class="w-14 h-11 object-cover rounded-lg border border-slate-200 shrink-0"
                />
                <span v-else class="w-14 h-11 grid place-items-center rounded-lg bg-grape-100 border-2 border-link-700 text-lg shrink-0">📰</span>
                <span class="min-w-0">
                  <span class="block text-xs font-extrabold text-link-700 truncate">{{ a.title }}</span>
                  <span class="block text-[10px] font-semibold text-slate-400 mt-0.5">
                    <span class="text-brand-600 font-bold">{{ a.category || 'Artikel' }}</span> • Buka di portal ↗
                  </span>
                </span>
              </button>
              <p v-if="!filteredArticles.length" class="text-center text-slate-400 text-xs py-8 font-semibold">
                Tidak ada artikel terbit yang cocok.
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
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
  animation: modal-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modal-pop {
  from {
    transform: scale(0.92) translateY(10px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
</style>
