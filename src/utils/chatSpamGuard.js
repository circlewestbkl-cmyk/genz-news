// Anti-spam chat sederhana: batas kecepatan, spam pesan duplikat, dan panjang berlebihan.
// Murni & bisa diuji — history & waktu diinjeksi dari luar.

export const CHAT_MAX_LENGTH = 500
export const CHAT_RATE_WINDOW_MS = 10000 // jendela 10 detik
export const CHAT_RATE_MAX = 5 // maks 5 pesan per jendela
export const CHAT_DUPLICATE_WINDOW_MS = 60000 // jendela 60 detik
export const CHAT_DUPLICATE_MAX = 3 // maks 3x pesan identik per jendela
// Penolakan beruntun karena "terlalu cepat" sebelum user diblokir otomatis dari chat
export const CHAT_AUTOBLOCK_REJECTIONS = 3

// Normalisasi teks untuk deteksi duplikat: lowercase, trim, rapatkan spasi
export function normalizeChat(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// history: pesan terakhir user ini (terbaru dulu), tiap item { content, createdAt }
// Mengembalikan { ok: true } atau { ok: false, reason: 'empty' | 'length' | 'rate' | 'duplicate' }
export function checkChatSpam({ content, history = [], now = Date.now() }) {
  const text = normalizeChat(content)
  if (!text) return { ok: false, reason: 'empty' }
  if (text.length > CHAT_MAX_LENGTH) return { ok: false, reason: 'length' }

  const recent = history.filter(
    (m) => now - new Date(m.createdAt).getTime() <= CHAT_RATE_WINDOW_MS
  )
  if (recent.length >= CHAT_RATE_MAX) return { ok: false, reason: 'rate' }

  const identical = history.filter(
    (m) =>
      now - new Date(m.createdAt).getTime() <= CHAT_DUPLICATE_WINDOW_MS &&
      normalizeChat(m.content) === text
  )
  // Sudah ada CHAT_DUPLICATE_MAX - 1 pesan identik → kiriman ini jadi yang ke-CHAT_DUPLICATE_MAX
  if (identical.length >= CHAT_DUPLICATE_MAX - 1) return { ok: false, reason: 'duplicate' }

  return { ok: true }
}
