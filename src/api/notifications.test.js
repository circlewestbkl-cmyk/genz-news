import { describe, it, expect } from 'vitest'
import { isUnread, isVisible } from './notifications'

describe('isVisible (notifikasi)', () => {
  it('notifikasi bertarget → hanya untuk penerimanya', () => {
    const n = { to: 'penulis', type: 'comment_new' }
    expect(isVisible(n, { username: 'penulis', role: 'writer' })).toBe(true)
    expect(isVisible(n, { username: 'editor', role: 'editor' })).toBe(false)
  })

  it('notifikasi broadcast (tanpa to) → editor saja', () => {
    const n = { type: 'article_created' }
    expect(isVisible(n, { username: 'editor', role: 'editor' })).toBe(true)
    expect(isVisible(n, { username: 'penulis', role: 'writer' })).toBe(false)
    expect(isVisible(n, { username: 'admin', role: 'admin' })).toBe(false)
  })

  it('broadcast tampil untuk pemegang izin publish (editor tambahan)', () => {
    const n = { type: 'article_created' }
    expect(isVisible(n, { username: 'w', role: 'writer', permissions: ['publish'] })).toBe(true)
  })

  it('input kosong', () => {
    expect(isVisible(null, { username: 'a', role: 'writer' })).toBe(false)
    expect(isVisible({}, null)).toBe(false)
  })
})

describe('isUnread (notifikasi)', () => {
  it('notifikasi tanpa readBy = belum dibaca', () => {
    expect(isUnread({ readBy: [] }, 'editor')).toBe(true)
    expect(isUnread({}, 'editor')).toBe(true)
  })

  it('dibaca jika username ada di readBy', () => {
    expect(isUnread({ readBy: ['editor'] }, 'editor')).toBe(false)
  })

  it('dibaca oleh satu user tidak memengaruhi user lain', () => {
    const n = { readBy: ['penulis'] }
    expect(isUnread(n, 'editor')).toBe(true)
    expect(isUnread(n, 'penulis')).toBe(false)
  })

  it('input kosong', () => {
    expect(isUnread(null, 'editor')).toBe(false)
    expect(isUnread(undefined, 'editor')).toBe(false)
    expect(isUnread({}, '')).toBe(false)
  })
})
