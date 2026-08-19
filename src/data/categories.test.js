import { describe, it, expect } from 'vitest'
import { categories, getCategory } from './categories'

describe('categories', () => {
  it('memiliki 7 kategori utama', () => {
    expect(categories.length).toBe(7)
  })

  it('setiap kategori punya warna chip dan dot', () => {
    for (const c of categories) {
      expect(c.color).toBeTruthy()
      expect(c.dot).toBeTruthy()
    }
  })
})

describe('getCategory', () => {
  it('mengembalikan kategori yang dikenal', () => {
    expect(getCategory('Teknologi').name).toBe('Teknologi')
  })

  it('mengembalikan fallback untuk kategori tak dikenal', () => {
    const fallback = getCategory('Tidak Ada')
    expect(fallback.name).toBe('Tidak Ada')
    expect(fallback.color).toBeTruthy()
  })
})
