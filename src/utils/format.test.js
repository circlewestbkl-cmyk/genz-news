import { describe, it, expect } from 'vitest'
import {
  slugify,
  readingTime,
  timeAgo,
  getInitials,
  formatDate,
  countWords,
  articleEarnings,
  formatRupiah,
  RATE_PER_WORD,
  summarizeEarnings,
  toDateTimeLocal,
  fromDateTimeLocal,
  defaultScheduleValue,
} from './format'

describe('slugify', () => {
  it('mengubah judul menjadi slug lowercase dengan tanda hubung', () => {
    expect(slugify('Startup AI Lokal Raih Pendanaan')).toBe('startup-ai-lokal-raih-pendanaan')
  })
  it('menghapus karakter khusus', () => {
    expect(slugify('Harga Emas Naik 5%! (rekor)')).toBe('harga-emas-naik-5-rekor')
  })
  it('menangani spasi ganda', () => {
    expect(slugify('A  B   C')).toBe('a-b-c')
  })
})

describe('readingTime', () => {
  it('estimasi waktu baca ±200 kata/menit', () => {
    const text = Array(400).fill('kata').join(' ')
    expect(readingTime(text)).toBe('2 menit baca')
  })
  it('minimal 1 menit untuk teks pendek', () => {
    expect(readingTime('hello')).toBe('1 menit baca')
  })
})

describe('timeAgo', () => {
  it('menampilkan menit lalu', () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(timeAgo(past)).toBe('5 menit lalu')
  })
  it('menampilkan jam lalu', () => {
    const past = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    expect(timeAgo(past)).toBe('3 jam lalu')
  })
  it('menampilkan "baru saja" untuk waktu dekat', () => {
    expect(timeAgo(new Date().toISOString())).toBe('baru saja')
  })
})

describe('getInitials', () => {
  it('mengambil 2 huruf awal nama', () => {
    expect(getInitials('Rina Puspita')).toBe('RP')
  })
  it('satu kata nama', () => {
    expect(getInitials('Budi')).toBe('B')
  })
  it('nama kosong', () => {
    expect(getInitials('')).toBe('')
  })
})

describe('formatDate', () => {
  it('memformat tanggal dalam bahasa Indonesia', () => {
    expect(formatDate('2026-08-16T07:15:00.000Z')).toContain('16')
    expect(formatDate('2026-08-16T07:15:00.000Z')).toContain('Agustus')
    expect(formatDate('2026-08-16T07:15:00.000Z')).toContain('2026')
  })
  it('mengembalikan string kosong jika tidak ada tanggal', () => {
    expect(formatDate('')).toBe('')
  })
})

describe('countWords', () => {
  it('menghitung jumlah kata normal', () => {
    expect(countWords('satu dua tiga')).toBe(3)
  })
  it('mengabaikan marker markdown ringan (##, >, **, *)', () => {
    expect(countWords('## Dampak Ekonomi')).toBe(2)
    expect(countWords('> Kutipan pejabat')).toBe(2)
    expect(countWords('Ini **penting** dan *miring*')).toBe(4)
  })
  it('teks kosong = 0 kata', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
  })
})

describe('penghasilan penulis (Rp100/kata)', () => {
  it('tarif per kata = Rp100', () => {
    expect(RATE_PER_WORD).toBe(100)
  })
  it('pendapatan artikel = jumlah kata × Rp100', () => {
    expect(articleEarnings('satu dua tiga')).toBe(300)
    expect(articleEarnings('')).toBe(0)
  })
  it('artikel 120 kata menghasilkan Rp12.000', () => {
    expect(articleEarnings(Array(120).fill('kata').join(' '))).toBe(12000)
  })
  it('formatRupiah memformat dengan pemisah ribuan', () => {
    expect(formatRupiah(1250000)).toBe('Rp 1.250.000')
    expect(formatRupiah(0)).toBe('Rp 0')
    expect(formatRupiah(12000)).toBe('Rp 12.000')
  })
})

describe('summarizeEarnings (rekap admin)', () => {
  const users = [
    { username: 'penulis1', name: 'Penulis Satu', role: 'writer' },
    { username: 'penulis2', name: 'Penulis Dua', role: 'writer' },
    { username: 'editor', name: 'Editor', role: 'editor' },
  ]
  const articles = [
    // penulis1: 2 artikel terbit = 3 kata + 2 kata = 5 kata → Rp500
    { createdBy: 'penulis1', status: 'published', content: 'satu dua tiga' },
    { createdBy: 'penulis1', status: 'published', content: 'empat lima' },
    // penulis2: 1 artikel terbit = 1 kata → Rp100; 1 draft tidak dihitung
    { createdBy: 'penulis2', status: 'published', content: 'enam' },
    { createdBy: 'penulis2', status: 'draft', content: 'tujuh delapan sembilan sepuluh' },
    // editor: tanpa artikel → Rp0
  ]

  it('menghitung artikel, kata, dan penghasilan per user', () => {
    const result = summarizeEarnings(articles, users)
    const p1 = result.find((r) => r.username === 'penulis1')
    expect(p1.articles).toBe(2)
    expect(p1.words).toBe(5)
    expect(p1.earnings).toBe(500)
    const p2 = result.find((r) => r.username === 'penulis2')
    expect(p2.articles).toBe(1)
    expect(p2.words).toBe(1) // draft tidak dihitung
    expect(p2.earnings).toBe(100)
    const ed = result.find((r) => r.username === 'editor')
    expect(ed.earnings).toBe(0)
  })

  it('diurutkan dari penghasilan terbesar', () => {
    const result = summarizeEarnings(articles, users)
    expect(result[0].username).toBe('penulis1')
    expect(result[0].earnings).toBeGreaterThan(result[1].earnings)
  })

  it('artikel dari user tak dikenal diabaikan', () => {
    const result = summarizeEarnings([{ createdBy: 'ghost', status: 'published', content: 'aaa bbb' }], users)
    expect(result.every((r) => r.earnings === 0)).toBe(true)
  })
})

describe('toDateTimeLocal / fromDateTimeLocal (jadwal terbit)', () => {
  it('ISO → nilai datetime-local (format YYYY-MM-DDTHH:mm)', () => {
    const iso = '2026-08-18T09:00:00.000Z'
    const local = toDateTimeLocal(iso)
    // Waktu lokal bisa UTC+7 → 16:00; validasi format & konversi pulang-pergi saja
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(new Date(local).toISOString()).toBe(iso)
  })

  it('datetime-local → ISO UTC (pulang-pergi konsisten)', () => {
    const local = '2026-08-18T16:00'
    const iso = fromDateTimeLocal(local)
    expect(iso).toBe(new Date('2026-08-18T16:00').toISOString())
    // Bulat: konversi balik ke datetime-local setara
    expect(toDateTimeLocal(iso)).toBe('2026-08-18T16:00')
  })

  it('nilai kosong / tidak valid → null atau string kosong', () => {
    expect(fromDateTimeLocal('')).toBe(null)
    expect(fromDateTimeLocal(null)).toBe(null)
    expect(fromDateTimeLocal('bukan-tanggal')).toBe(null)
    expect(toDateTimeLocal('')).toBe('')
    expect(toDateTimeLocal('bukan-tanggal')).toBe('')
  })

  it('defaultScheduleValue menghasilkan nilai di masa depan, format datetime-local', () => {
    const v = defaultScheduleValue(1)
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(new Date(v).getTime()).toBeGreaterThan(Date.now())
  })
})
