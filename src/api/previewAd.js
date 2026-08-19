// Penyimpanan iklan yang sedang dipratinjau (belum disimpan) — dipakai tombol
// "Pratinjau di Website" di halaman Kelola Iklan. Menggunakan sessionStorage agar
// tetap tersedia saat halaman pratinjau dibuka di tab baru.
const KEY = 'genz_preview_ad'

export function setPreviewAd(ad) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ad))
  } catch (err) {
    console.error('[previewAd] gagal menyimpan pratinjau:', err)
  }
}

export function getPreviewAd() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

export function clearPreviewAd() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* abaikan */
  }
}
