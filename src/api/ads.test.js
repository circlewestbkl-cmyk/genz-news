import { describe, it, expect } from 'vitest'
import { adForPosition, adStatus, takenPositions, clicksInRange, clicksTrend } from './ads'

const NOW = new Date('2026-08-17T12:00:00Z').getTime()
const make = (overrides = {}) => ({
  id: 1,
  title: 'Iklan',
  imageUrl: 'https://x.com/a.jpg',
  linkUrl: 'https://x.com',
  position: 'footer',
  startAt: '2026-08-01T00:00:00.000Z',
  endAt: '2026-12-31T00:00:00.000Z',
  active: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

describe('adForPosition', () => {
  it('mengambil iklan aktif yang sesuai posisi & masa kontrak', () => {
    const list = [make({ id: 1, position: 'footer' })]
    const ad = adForPosition(list, 'footer', NOW)
    expect(ad).not.toBe(null)
    expect(ad.id).toBe(1)
  })

  it('mengabaikan iklan di posisi lain', () => {
    const list = [make({ id: 1, position: 'home-top' })]
    expect(adForPosition(list, 'footer', NOW)).toBe(null)
  })

  it('mengabaikan iklan nonaktif', () => {
    const list = [make({ id: 1, active: false })]
    expect(adForPosition(list, 'footer', NOW)).toBe(null)
  })

  it('mengabaikan iklan di luar masa kontrak', () => {
    const past = make({ id: 1, endAt: '2026-01-01T00:00:00.000Z' })
    const future = make({ id: 2, startAt: '2027-01-01T00:00:00.000Z' })
    expect(adForPosition([past], 'footer', NOW)).toBe(null)
    expect(adForPosition([future], 'footer', NOW)).toBe(null)
  })

  it('bila beberapa iklan aktif, pilih yang paling baru dibuat', () => {
    const list = [
      make({ id: 1, createdAt: '2026-08-01T00:00:00.000Z' }),
      make({ id: 2, createdAt: '2026-08-10T00:00:00.000Z' }),
    ]
    expect(adForPosition(list, 'footer', NOW).id).toBe(2)
  })

  it('list kosong / tanpa waktu (tanpa batas kontrak) tetap tampil', () => {
    expect(adForPosition([], 'footer', NOW)).toBe(null)
    const noDates = make({ id: 1, startAt: '', endAt: '' })
    expect(adForPosition([noDates], 'footer', NOW).id).toBe(1)
  })

  it('iklan booked (menunggu slot) tidak tampil', () => {
    const older = make({ id: 1, createdAt: '2026-08-01T00:00:00.000Z' })
    const newer = make({ id: 2, createdAt: '2026-08-10T00:00:00.000Z' })
    // yang tampil hanya yang live (terbaru); yang lama menunggu
    expect(adForPosition([older, newer], 'footer', NOW).id).toBe(2)
    // pesaing habis kontrak → booking otomatis tampil
    const newerExpired = make({ id: 2, createdAt: '2026-08-10T00:00:00.000Z', endAt: '2026-08-11T00:00:00.000Z' })
    expect(adForPosition([older, newerExpired], 'footer', NOW).id).toBe(1)
  })
})

describe('takenPositions', () => {
  it('posisi terisi oleh iklan live (sedang tayang)', () => {
    const list = [make({ id: 1, position: 'footer' })]
    expect(takenPositions(list, NOW)).toEqual(['footer'])
  })

  it('posisi terisi oleh iklan scheduled (akan tayang)', () => {
    const list = [make({ id: 1, position: 'home-top', startAt: '2026-09-01T00:00:00.000Z' })]
    expect(takenPositions(list, NOW)).toEqual(['home-top'])
  })

  it('posisi TIDAK terisi oleh iklan expired / nonaktif', () => {
    const expired = make({ id: 1, position: 'footer', endAt: '2026-01-01T00:00:00.000Z' })
    const inactive = make({ id: 2, position: 'home-aside', active: false })
    expect(takenPositions([expired, inactive], NOW)).toEqual([])
  })

  it('mengabaikan iklan yang sedang diedit (excludeId)', () => {
    const list = [make({ id: 5, position: 'footer' })]
    expect(takenPositions(list, NOW, 5)).toEqual([])
  })

  it('menghasilkan daftar unik beberapa posisi terisi', () => {
    const list = [
      make({ id: 1, position: 'footer' }),
      make({ id: 2, position: 'footer' }),
      make({ id: 3, position: 'home-aside' }),
    ]
    expect(takenPositions(list, NOW)).toEqual(['footer', 'home-aside'])
  })

  it('posisi dengan iklan booked juga dianggap sibuk (bisa booking lagi)', () => {
    const list = [
      make({ id: 1, position: 'footer', createdAt: '2026-08-01T00:00:00.000Z' }),
      make({ id: 2, position: 'footer', createdAt: '2026-08-10T00:00:00.000Z' }),
    ]
    expect(takenPositions(list, NOW)).toEqual(['footer']) // id2 live & id1 booked → footer sibuk
  })
})

describe('clicksInRange & clicksTrend (klik per hari)', () => {
  const NOW = new Date('2026-08-17T12:00:00')
  const ad = { clicksByDay: { '2026-08-15': 2, '2026-08-16': 5, '2026-08-17': 3, '2026-07-01': 99 } }

  it('menjumlahkan klik dalam N hari terakhir', () => {
    expect(clicksInRange(ad, 3, NOW)).toBe(10)
    expect(clicksInRange(ad, 7, NOW)).toBe(10)
  })

  it('iklan tanpa data / input kosong → 0', () => {
    expect(clicksInRange({}, 7, NOW)).toBe(0)
    expect(clicksInRange(null, 7, NOW)).toBe(0)
  })

  it('clicksTrend menghasilkan 7 titik data menaik', () => {
    const trend = clicksTrend(ad, 7, NOW)
    expect(trend).toHaveLength(7)
    expect(trend[0].key).toBe('2026-08-11')
    expect(trend[6]).toEqual({ key: '2026-08-17', label: '08-17', value: 3 })
  })
})

describe('adStatus', () => {
  it('live — dalam masa kontrak & aktif', () => {
    expect(adStatus(make({ active: true }), NOW)).toBe('live')
    expect(adStatus(make({ startAt: '', endAt: '' }), NOW)).toBe('live')
  })

  it('expiring — live dengan sisa kontrak kurang dari 7 hari', () => {
    const near = make({ id: 1, endAt: '2026-08-20T00:00:00.000Z' }) // sisa ~3 hari
    expect(adStatus(near, NOW)).toBe('expiring')
    // sisa > 7 hari tetap live
    expect(adStatus(make({ id: 2, endAt: '2026-09-30T00:00:00.000Z' }), NOW)).toBe('live')
  })

  it('booked — ada iklan lebih baru di posisi sama (menunggu slot)', () => {
    const older = make({ id: 1, createdAt: '2026-08-01T00:00:00.000Z' })
    const newer = make({ id: 2, createdAt: '2026-08-10T00:00:00.000Z' })
    expect(adStatus(older, NOW, [older, newer])).toBe('booked')
    expect(adStatus(newer, NOW, [older, newer])).toBe('live')
    // tanpa list (kompatibilitas) → dianggap live
    expect(adStatus(older, NOW)).toBe('live')
  })

  it('booking otomatis jadi live saat pesaing hilang', () => {
    const older = make({ id: 1, createdAt: '2026-08-01T00:00:00.000Z' })
    const newer = make({ id: 2, createdAt: '2026-08-10T00:00:00.000Z' })
    // pesaing dinonaktifkan → iklan lama kembali live
    const newerOff = { ...newer, active: false }
    expect(adStatus(older, NOW, [older, newerOff])).toBe('live')
  })

  it('scheduled — belum mulai', () => {
    const ad = make({ startAt: '2026-09-01T00:00:00.000Z', endAt: '2026-10-01T00:00:00.000Z' })
    expect(adStatus(ad, NOW)).toBe('scheduled')
  })

  it('expired — kontrak habis', () => {
    const ad = make({ startAt: '2026-01-01T00:00:00.000Z', endAt: '2026-02-01T00:00:00.000Z' })
    expect(adStatus(ad, NOW)).toBe('expired')
  })

  it('inactive — dinonaktifkan admin / data kosong', () => {
    expect(adStatus(make({ active: false }), NOW)).toBe('inactive')
    expect(adStatus(null, NOW)).toBe('inactive')
  })
})
