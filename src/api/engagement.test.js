import { describe, it, expect } from 'vitest'
import { toggleInList } from './engagement'

describe('toggleInList', () => {
  const isId = (id) => (x) => String(x.id) === String(id)
  const make = (id) => ({ id })

  it('menambahkan elemen bila belum ada (added: true)', () => {
    const { added, list } = toggleInList([make(1)], isId(2), () => make(2))
    expect(added).toBe(true)
    expect(list.map((x) => x.id)).toEqual([1, 2])
  })

  it('menghapus elemen bila sudah ada (added: false)', () => {
    const { added, list } = toggleInList([make(1), make(2)], isId(2), () => make(2))
    expect(added).toBe(false)
    expect(list.map((x) => x.id)).toEqual([1])
  })

  it('menangani list kosong / bukan array', () => {
    const { added, list } = toggleInList(null, isId(1), () => make(1))
    expect(added).toBe(true)
    expect(list).toEqual([{ id: 1 }])
  })

  it('makeItem hanya dipanggil saat elemen ditambahkan', () => {
    let calls = 0
    const makeSpy = () => {
      calls += 1
      return make(1)
    }
    toggleInList([make(1)], isId(1), makeSpy)
    expect(calls).toBe(0)
    toggleInList([], isId(1), makeSpy)
    expect(calls).toBe(1)
  })
})
