import { describe, it, expect, beforeEach } from 'vitest'
import { activeCategories, findCategory, chipOf, categories } from './categories'

const list = [
  { id: 1, name: 'Teknologi', status: 'active', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-600', createdAt: '2026-08-01T00:00:00Z' },
  { id: 2, name: 'Ekonomi', status: 'active', createdAt: '2026-08-02T00:00:00Z' },
  { id: 3, name: 'Olahraga', status: 'inactive', createdAt: '2026-08-03T00:00:00Z' },
  { id: 4, name: 'Kesehatan', status: 'active', createdAt: '2026-08-04T00:00:00Z' },
  { id: 5, name: 'Hiburan', createdAt: '2026-08-05T00:00:00Z' },
]

describe('activeCategories', () => {
  it('hanya mengembalikan kategori aktif (tanpa batas jumlah)', () => {
    const active = activeCategories(list)
    expect(active.map((c) => c.name)).toEqual(['Teknologi', 'Ekonomi', 'Kesehatan', 'Hiburan'])
  })

  it('kategori tanpa field status dianggap aktif', () => {
    const active = activeCategories(list)
    expect(active.some((c) => c.name === 'Hiburan')).toBe(true)
  })

  it('menangani daftar kosong', () => {
    expect(activeCategories([])).toEqual([])
  })
})

describe('findCategory', () => {
  it('cocok tanpa membedakan huruf besar/kecil', () => {
    expect(findCategory(list, 'teknologi')).toMatchObject({ name: 'Teknologi' })
    expect(findCategory(list, 'TEKNOLOGI')).toMatchObject({ name: 'Teknologi' })
  })
  it('null untuk nama kosong / tidak dikenal', () => {
    expect(findCategory(list, '')).toBeNull()
    expect(findCategory(list, 'Tidak Ada')).toBeNull()
  })
})

describe('chipOf', () => {
  beforeEach(() => {
    categories.value = list
  })
  it('memakai warna kategori yang dikenal', () => {
    const chip = chipOf('teknologi')
    expect(chip.name).toBe('teknologi')
    expect(chip.color).toContain('blue-700')
    expect(chip.dot).toBe('bg-blue-600')
  })
  it('fallback abu-abu untuk kategori tak dikenal', () => {
    const chip = chipOf('Kategori Asing')
    expect(chip.color).toContain('slate-600')
    expect(chip.dot).toBe('bg-slate-400')
  })
})
