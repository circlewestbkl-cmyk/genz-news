// Helper analitik murni (bisa diuji tanpa fetch) — agregasi views per hari.
// Artikel menyimpan `viewsByDay` = { 'YYYY-MM-DD': jumlah_baca } yang ditambah
// saat halaman artikel dibuka. Bila belum ada riwayat, fallback ke `views` total.

// Kunci tanggal lokal 'YYYY-MM-DD' dari Date (atau string ISO)
export function dayKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Kumpulan kunci hari untuk N hari terakhir (termasuk hari ini), urut menaik
export function lastDays(n, now = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000)
    out.push(dayKey(d))
  }
  return out
}

// Total pembaca artikel dalam N hari terakhir (dari viewsByDay).
// days = 0/undefined → total views keseluruhan (fallback bila tak ada riwayat).
export function viewsInRange(article, days = 7, now = new Date()) {
  if (!article) return 0
  if (!days) return article.views || 0
  const map = article.viewsByDay || {}
  const keys = lastDays(days, now)
  return keys.reduce((sum, k) => sum + (map[k] || 0), 0)
}

// Artikel terpopuler berdasarkan views dalam N hari (terbaru dulu untuk yang sama)
export function topArticlesByViews(list, days = 7, limit = 5, now = new Date()) {
  return [...(list || [])]
    .sort((a, b) => {
      const diff = viewsInRange(b, days, now) - viewsInRange(a, days, now)
      return diff !== 0 ? diff : new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
    })
    .slice(0, limit)
}

// Data bar chart sederhana: 7 hari terakhir → [{ key, label, value }]
export function viewsTrend(article, days = 7, now = new Date()) {
  const map = article?.viewsByDay || {}
  return lastDays(days, now).map((key) => ({
    key,
    label: key.slice(5), // 'MM-DD'
    value: map[key] || 0,
  }))
}
