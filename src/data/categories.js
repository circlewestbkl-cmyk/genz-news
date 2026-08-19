// Definisi kategori berita beserta warna untuk chip (light theme)
export const categories = [
  { name: 'Teknologi', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-600' },
  { name: 'Ekonomi', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-600' },
  { name: 'Olahraga', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  { name: 'Kesehatan', color: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-600' },
  { name: 'Hiburan', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-600' },
  { name: 'Politik', color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-600' },
  { name: 'Nasional', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-500' },
]

export function getCategory(name) {
  return categories.find((c) => c.name === name) || {
    name,
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  }
}
