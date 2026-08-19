// Anti-spam ringan: jeda waktu antar kirim komentar/balasan.
// Disimpan per browser di localStorage; murni & bisa diuji.

export const COMMENT_COOLDOWN_MS = 30000 // 30 detik
const LAST_KEY = 'genz_last_comment'

// Sisa waktu tunggu (detik) sebelum boleh kirim lagi. 0 = boleh kirim.
export function cooldownLeft(lastTs, minMs = COMMENT_COOLDOWN_MS, now = Date.now()) {
  if (!lastTs) return 0
  const remain = minMs - (now - lastTs)
  return remain > 0 ? Math.ceil(remain / 1000) : 0
}

export function getLastCommentTs() {
  if (typeof window === 'undefined') return 0
  const v = Number(window.localStorage.getItem(LAST_KEY))
  return Number.isFinite(v) ? v : 0
}

export function markCommentSent(ts = Date.now()) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_KEY, String(ts))
}
