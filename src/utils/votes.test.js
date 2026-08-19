import { describe, it, expect } from 'vitest'
import { applyVote } from './votes'

const base = () => ({ likes: 0, dislikes: 0, likedBy: [], dislikedBy: [] })

describe('applyVote', () => {
  it('like pertama menambah like', () => {
    const r = applyVote(base(), 'like', 'v1')
    expect(r.likes).toBe(1)
    expect(r.likedBy).toEqual(['v1'])
    expect(r.dislikes).toBe(0)
  })

  it('klik like lagi membatalkan like', () => {
    const item = { ...base(), likes: 1, likedBy: ['v1'] }
    const r = applyVote(item, 'like', 'v1')
    expect(r.likes).toBe(0)
    expect(r.likedBy).toEqual([])
  })

  it('dislike saat sudah like → pindah jadi dislike', () => {
    const item = { ...base(), likes: 1, likedBy: ['v1'] }
    const r = applyVote(item, 'dislike', 'v1')
    expect(r.likes).toBe(0)
    expect(r.likedBy).toEqual([])
    expect(r.dislikes).toBe(1)
    expect(r.dislikedBy).toEqual(['v1'])
  })

  it('like saat sudah dislike → pindah jadi like', () => {
    const item = { ...base(), dislikes: 1, dislikedBy: ['v1'] }
    const r = applyVote(item, 'like', 'v1')
    expect(r.dislikes).toBe(0)
    expect(r.dislikedBy).toEqual([])
    expect(r.likes).toBe(1)
    expect(r.likedBy).toEqual(['v1'])
  })

  it('dislike kedua dari voter berbeda menambah dislike', () => {
    const item = { ...base(), dislikes: 1, dislikedBy: ['v1'] }
    const r = applyVote(item, 'dislike', 'v2')
    expect(r.dislikes).toBe(2)
    expect(r.dislikedBy).toEqual(['v1', 'v2'])
  })

  it('klik dislike lagi membatalkan dislike', () => {
    const item = { ...base(), dislikes: 1, dislikedBy: ['v1'] }
    const r = applyVote(item, 'dislike', 'v1')
    expect(r.dislikes).toBe(0)
    expect(r.dislikedBy).toEqual([])
  })
})
