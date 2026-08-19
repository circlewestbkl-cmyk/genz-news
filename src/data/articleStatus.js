// Label & warna badge untuk setiap status artikel.
// Dipakai di dashboard, Berita Saya, halaman Siap Terbit, dan lainnya.
export const ARTICLE_STATUS = {
  published: { label: 'Terbit', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ready: { label: 'Siap Terbit', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  scheduled: { label: 'Terjadwal', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  draft: { label: 'Draft', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  trashed: { label: 'Recycle Bin', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
}

// Urutan tampil pada filter status
export const ARTICLE_STATUS_ORDER = ['published', 'ready', 'scheduled', 'draft', 'trashed']

export function statusInfo(status) {
  return ARTICLE_STATUS[status] || { label: status || 'Draft', badge: 'bg-slate-100 text-slate-500 border-slate-200' }
}
