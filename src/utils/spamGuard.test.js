import { describe, it, expect } from 'vitest'
import { cooldownLeft } from './spamGuard'

describe('cooldownLeft', () => {
  const now = 1_000_000

  it('tanpa riwayat → boleh kirim', () => {
    expect(cooldownLeft(0, 30000, now)).toBe(0)
  })

  it('baru kirim → masih menunggu (sisa detik)', () => {
    expect(cooldownLeft(now - 5000, 30000, now)).toBe(25)
  })

  it('tepat di batas → boleh kirim', () => {
    expect(cooldownLeft(now - 30000, 30000, now)).toBe(0)
  })

  it('sudah lewat jeda → boleh kirim', () => {
    expect(cooldownLeft(now - 60000, 30000, now)).toBe(0)
  })
})
