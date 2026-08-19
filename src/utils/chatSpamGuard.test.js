import { describe, it, expect } from 'vitest'
import {
  checkChatSpam,
  normalizeChat,
  CHAT_MAX_LENGTH,
  CHAT_RATE_WINDOW_MS,
  CHAT_RATE_MAX,
  CHAT_DUPLICATE_WINDOW_MS,
  CHAT_DUPLICATE_MAX,
} from './chatSpamGuard'

const NOW = 1_000_000_000_000
const ago = (ms) => ({ createdAt: new Date(NOW - ms).toISOString() })
const msg = (content, msAgo = 0) => ({ content, ...ago(msAgo) })

describe('normalizeChat', () => {
  it('lowercase + trim + rapatkan spasi', () => {
    expect(normalizeChat('  Halo   Dunia  ')).toBe('halo dunia')
    expect(normalizeChat('')).toBe('')
  })
})

describe('checkChatSpam', () => {
  it('pesan normal boleh kirim', () => {
    expect(checkChatSpam({ content: 'halo semua', history: [], now: NOW })).toEqual({ ok: true })
  })

  it('pesan kosong ditolak', () => {
    expect(checkChatSpam({ content: '   ', history: [], now: NOW })).toEqual({
      ok: false,
      reason: 'empty',
    })
  })

  it('pesan terlalu panjang ditolak', () => {
    const long = 'a'.repeat(CHAT_MAX_LENGTH + 1)
    expect(checkChatSpam({ content: long, history: [], now: NOW })).toEqual({
      ok: false,
      reason: 'length',
    })
    const ok = 'a'.repeat(CHAT_MAX_LENGTH)
    expect(checkChatSpam({ content: ok, history: [], now: NOW }).ok).toBe(true)
  })

  it('melebihi batas kecepatan ditolak', () => {
    const history = Array.from({ length: CHAT_RATE_MAX }, (_, i) =>
      msg(`pesan ${i}`, i * 100)
    )
    expect(checkChatSpam({ content: 'pesan baru', history, now: NOW })).toEqual({
      ok: false,
      reason: 'rate',
    })
    // pesan lama di luar jendela tidak terhitung
    const stale = [msg('lama', CHAT_RATE_WINDOW_MS + 1000)]
    expect(checkChatSpam({ content: 'pesan baru', history: stale, now: NOW }).ok).toBe(true)
  })

  it('spam pesan identik ditolak saat mencapai batas', () => {
    // 2 pesan identik dalam jendela → kiriman ketiga ditolak
    const history = [msg('spam banget', 1000), msg('spam banget', 2000)]
    expect(checkChatSpam({ content: 'spam banget', history, now: NOW })).toEqual({
      ok: false,
      reason: 'duplicate',
    })
    // beda case/spasi tetap dianggap sama
    const history2 = [msg('Spam  Banget', 1000), msg(' spam banget ', 2000)]
    expect(checkChatSpam({ content: 'SPAM banget', history: history2, now: NOW })).toEqual({
      ok: false,
      reason: 'duplicate',
    })
    // 1 pesan identik → masih boleh
    expect(checkChatSpam({ content: 'spam banget', history: [msg('spam banget', 1000)], now: NOW }).ok).toBe(true)
    // di luar jendela duplikat → boleh lagi
    const expired = [msg('spam banget', CHAT_DUPLICATE_WINDOW_MS + 1000)]
    expect(checkChatSpam({ content: 'spam banget', history: expired, now: NOW }).ok).toBe(true)
  })

  it('ambang batas duplikat mengikuti CHAT_DUPLICATE_MAX', () => {
    const history = Array.from({ length: CHAT_DUPLICATE_MAX - 1 }, (_, i) =>
      msg('x', i * 500)
    )
    expect(checkChatSpam({ content: 'x', history, now: NOW }).ok).toBe(false)
  })
})
