import { describe, it, expect } from 'vitest'
import { dmRoomId, isRoomParticipant, unreadCountFor } from './chat'

describe('dmRoomId', () => {
  it('id DM konsisten dari kedua sisi (urut abjad)', () => {
    expect(dmRoomId('admin', 'editor')).toBe('dm:admin-editor')
    expect(dmRoomId('editor', 'admin')).toBe('dm:admin-editor')
  })
})

describe('isRoomParticipant', () => {
  it('grup terbuka untuk semua orang', () => {
    expect(isRoomParticipant('group', 'admin')).toBe(true)
    expect(isRoomParticipant('group', 'penulis')).toBe(true)
  })

  it('DM hanya untuk salah satu pihak', () => {
    expect(isRoomParticipant('dm:admin-editor', 'admin')).toBe(true)
    expect(isRoomParticipant('dm:admin-editor', 'editor')).toBe(true)
    expect(isRoomParticipant('dm:admin-editor', 'penulis')).toBe(false)
  })

  it('input kosong / ruang tak dikenal', () => {
    expect(isRoomParticipant('', 'admin')).toBe(false)
    expect(isRoomParticipant(null, 'admin')).toBe(false)
    expect(isRoomParticipant('dm:', 'admin')).toBe(false)
  })
})

describe('unreadCountFor', () => {
  const messages = [
    { id: 1, roomId: 'group', sender: 'editor', readBy: [] },
    { id: 2, roomId: 'group', sender: 'editor', readBy: ['admin'] },
    { id: 3, roomId: 'dm:admin-editor', sender: 'editor', readBy: [] },
    { id: 4, roomId: 'dm:editor-penulis', sender: 'editor', readBy: [] }, // DM user lain — TIDAK terhitung
    { id: 5, roomId: 'dm:admin-editor', sender: 'admin', readBy: [] }, // pesan sendiri — TIDAK terhitung
    { id: 6, roomId: 'group', sender: 'penulis', readBy: [] },
  ]

  it('hanya menghitung ruang yang diikuti user', () => {
    expect(unreadCountFor(messages, 'admin')).toBe(3) // id 1, 3, 6
  })

  it('pesan sendiri & pesan yang sudah dibaca tidak dihitung', () => {
    expect(unreadCountFor(messages, 'editor')).toBe(2) // id 5 (DM admin-editor) + id 6 (grup)
  })

  it('input kosong', () => {
    expect(unreadCountFor([], 'admin')).toBe(0)
  })
})
