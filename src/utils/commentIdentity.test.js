import { describe, it, expect } from 'vitest'
import { commentIdentity, commenterInfo } from './commentIdentity'

const article = { author: 'Andra Media', createdBy: 'andra' }
const users = [
  { name: 'Administrator', role: 'admin' },
  { name: 'Editor Utama', role: 'editor' },
  { name: 'Penulis Muda', penName: 'Andra Media', role: 'writer' },
]

describe('commentIdentity (metadata tersimpan)', () => {
  it('pakai authorRole saat tersimpan', () => {
    const c = { author: 'X', authorRole: 'admin', authorUsername: 'admin', isArticleAuthor: false }
    expect(commentIdentity(c, { article, users })).toEqual({ role: 'admin', isArticleAuthor: false })
  })

  it('penulis artikel ditandai via metadata', () => {
    const c = { author: 'Andra Media', authorRole: 'writer', authorUsername: 'andra', isArticleAuthor: true }
    expect(commentIdentity(c, { article, users })).toEqual({ role: 'writer', isArticleAuthor: true })
  })
})

describe('commentIdentity (inferensi komentar lama)', () => {
  it('nama = penulis artikel → writer + isArticleAuthor', () => {
    expect(commentIdentity({ author: 'Andra Media' }, { article, users })).toEqual({
      role: 'writer',
      isArticleAuthor: true,
    })
  })

  it('nama cocok user admin → admin', () => {
    expect(commentIdentity({ author: 'Administrator' }, { article, users })).toEqual({
      role: 'admin',
      isArticleAuthor: false,
    })
  })

  it('nama cocok user editor → editor', () => {
    expect(commentIdentity({ author: 'Editor Utama' }, { article, users })).toEqual({
      role: 'editor',
      isArticleAuthor: false,
    })
  })

  it('nama tidak dikenal → reader biasa', () => {
    expect(commentIdentity({ author: 'Ww' }, { article, users })).toEqual({
      role: 'reader',
      isArticleAuthor: false,
    })
  })

  it('nama kosong → guest', () => {
    expect(commentIdentity({ author: '' }, { article, users })).toEqual({
      role: 'guest',
      isArticleAuthor: false,
    })
  })
})

describe('commenterInfo', () => {
  it('penulis artikel → badge "Penulis Artikel" emerald', () => {
    const info = commenterInfo({ author: 'Andra Media' }, { article, users })
    expect(info.label).toBe('Penulis Artikel')
    expect(info.icon).toBe('✍️')
    expect(info.avatar).toContain('emerald')
  })

  it('admin → badge Admin', () => {
    const info = commenterInfo({ author: 'Administrator' }, { article, users })
    expect(info.label).toBe('Admin')
    expect(info.icon).toBe('🛡')
  })

  it('pembaca biasa → tanpa badge', () => {
    const info = commenterInfo({ author: 'Ww' }, { article, users })
    expect(info.badge).toBeNull()
    expect(info.label).toBe('Pembaca')
  })
})
