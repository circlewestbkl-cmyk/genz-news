// API komentar — data tersimpan di koleksi "comments" JSON Server.
// Komentar bisa diberi like/dislike oleh siapa saja (tanpa login, dilacak per browser).
import { applyVote } from '../utils/votes'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`Gagal memuat data (${res.status})`)
  }
  return res.json()
}

export const commentApi = {
  // Semua komentar (terbaru dulu) — untuk admin
  async listAll() {
    return request('/comments?_sort=createdAt&_order=desc')
  },

  // Komentar milik satu artikel (terlama dulu, agar urutan baca natural)
  async listByArticle(articleId) {
    return request(`/comments?articleId=${articleId}&_sort=createdAt&_order=asc`)
  },

  // parentId = id komentar yang dibalas (null untuk komentar utama)
  // replyTo  = nama penulis komentar yang dibalas (untuk konteks tampilan)
  // authorRole / authorUsername / isArticleAuthor = identitas pengirim (untuk badge)
  async create({ articleId, author, content, parentId = null, replyTo = '', authorRole = 'guest', authorUsername = '', isArticleAuthor = false }) {
    return request('/comments', {
      method: 'POST',
      body: JSON.stringify({
        articleId,
        author,
        content,
        parentId,
        replyTo,
        authorRole,
        authorUsername,
        isArticleAuthor,
        likes: 0,
        dislikes: 0,
        likedBy: [],
        dislikedBy: [],
        createdAt: new Date().toISOString(),
      }),
    })
  },

  // Like/dislike komentar — toggle per pengunjung
  async vote(id, type, voterId) {
    const comment = await request(`/comments/${id}`)
    const updated = applyVote(comment, type, voterId)
    return request(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updated),
    })
  },

  async remove(id) {
    return request(`/comments/${id}`, { method: 'DELETE' })
  },
}
