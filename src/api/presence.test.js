import { describe, it, expect } from 'vitest'
import { isOnline, ONLINE_WINDOW_MS } from './presence'

const NOW = Date.now()
const fresh = (username, ageMs = 5000) => ({
  username,
  lastSeen: new Date(NOW - ageMs).toISOString(),
})

describe('isOnline (presence)', () => {
  it('user dengan heartbeat baru-baru ini → online', () => {
    const list = [fresh('editor'), fresh('penulis', 10000)]
    expect(isOnline(list, 'editor', NOW)).toBe(true)
    expect(isOnline(list, 'penulis', NOW)).toBe(true)
  })

  it('user tanpa presence / tanpa lastSeen → offline', () => {
    expect(isOnline([], 'editor', NOW)).toBe(false)
    expect(isOnline([{ username: 'editor' }], 'editor', NOW)).toBe(false)
    expect(isOnline([fresh('editor')], 'penulis', NOW)).toBe(false)
  })

  it('user dengan heartbeat basi (melewati ambang) → offline', () => {
    const list = [fresh('editor', ONLINE_WINDOW_MS + 1000)]
    expect(isOnline(list, 'editor', NOW)).toBe(false)
  })

  it('tepat di ambang masih online', () => {
    const list = [fresh('editor', ONLINE_WINDOW_MS)]
    expect(isOnline(list, 'editor', NOW)).toBe(true)
  })

  it('presence kosong / bukan array → semua offline', () => {
    expect(isOnline(null, 'editor', NOW)).toBe(false)
    expect(isOnline(undefined, 'editor', NOW)).toBe(false)
  })
})
