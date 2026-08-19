// Penjadwalan terbit: artikel berstatus 'scheduled' otomatis diterbitkan
// begitu waktu (scheduledAt) tiba. Karena aplikasi ini SPA + JSON Server
// (tanpa backend cron), scheduler berjalan di sisi klien selama aplikasi terbuka.
import { articleApi } from './articles'

// Jalankan pengecekan berkala. Mengembalikan fungsi untuk menghentikannya.
export function startPublishScheduler(intervalMs = 30000) {
  let running = true

  async function tick() {
    if (!running) return
    try {
      const due = await articleApi.listScheduled()
      const now = Date.now()
      for (const a of due) {
        const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : NaN
        if (!isNaN(at) && at <= now) {
          // Terbitkan dengan waktu sesuai jadwal (bukan waktu sekarang)
          await articleApi.publish(a.id, a.scheduledAt)
        }
      }
    } catch {
      /* server data tidak aktif — coba lagi di tick berikutnya */
    }
  }

  tick()
  const timer = setInterval(tick, intervalMs)
  return () => {
    running = false
    clearInterval(timer)
  }
}
