import { describe, it, expect } from 'vitest'
import { dayKey, lastDays, viewsInRange, topArticlesByViews, viewsTrend } from './analytics'

const NOW = new Date('2026-08-17T12:00:00')

describe('dayKey', () => {
  it('memformat tanggal lokal YYYY-MM-DD', () => {
    expect(dayKey(new Date('2026-08-05T10:00:00'))).toBe('2026-08-05')
  })

  it('menangani input string ISO', () => {
    expect(dayKey('2026-08-05T10:00:00')).toBe('2026-08-05')
  })

  it('tanggal tidak valid → string kosong', () => {
    expect(dayKey('bukan-tanggal')).toBe('')
  })
})

describe('lastDays', () => {
  it('menghasilkan N hari terakhir termasuk hari ini, urut menaik', () => {
    const days = lastDays(3, NOW)
    expect(days).toEqual(['2026-08-15', '2026-08-16', '2026-08-17'])
  })
})

describe('viewsInRange', () => {
  const article = {
    views: 100,
    viewsByDay: { '2026-08-15': 5, '2026-08-16': 7, '2026-08-17': 3, '2026-07-01': 99 },
  }

  it('menjumlahkan views dalam N hari terakhir', () => {
    expect(viewsInRange(article, 3, NOW)).toBe(15)
    expect(viewsInRange(article, 7, NOW)).toBe(15)
  })

  it('days = 0 → total views keseluruhan (fallback tanpa riwayat)', () => {
    expect(viewsInRange(article, 0, NOW)).toBe(100)
  })

  it('artikel tanpa viewsByDay → 0 dalam rentang', () => {
    expect(viewsInRange({ views: 50 }, 7, NOW)).toBe(0)
    expect(viewsInRange(null, 7, NOW)).toBe(0)
  })
})

describe('topArticlesByViews', () => {
  const base = { status: 'published', publishedAt: '2026-08-10T00:00:00Z' }
  const a1 = { ...base, id: 1, viewsByDay: { '2026-08-17': 10 } }
  const a2 = { ...base, id: 2, viewsByDay: { '2026-08-17': 30 } }
  const a3 = { ...base, id: 3, viewsByDay: {} }

  it('mengurutkan artikel terpopuler dalam 7 hari & membatasi jumlah', () => {
    const top = topArticlesByViews([a1, a2, a3], 7, 2, NOW)
    expect(top.map((a) => a.id)).toEqual([2, 1])
  })

  it('daftar kosong → kosong', () => {
    expect(topArticlesByViews([], 7, 5, NOW)).toEqual([])
  })
})

describe('viewsTrend', () => {
  it('menghasilkan 7 titik data dengan label MM-DD', () => {
    const trend = viewsTrend({ viewsByDay: { '2026-08-17': 4 } }, 7, NOW)
    expect(trend).toHaveLength(7)
    expect(trend[6]).toEqual({ key: '2026-08-17', label: '08-17', value: 4 })
    expect(trend[5].value).toBe(0)
  })

  it('artikel tanpa data → semua nol', () => {
    const trend = viewsTrend(null, 3, NOW)
    expect(trend.every((d) => d.value === 0)).toBe(true)
  })
})
