// Logika like/dislike — murni & bisa diuji.
// Vote dilacak per browser via id pengunjung (tanpa login), disimpan di
// field likedBy/dislikedBy pada artikel & komentar.

const VISITOR_KEY = 'genznews_visitor'

// Id unik pengunjung (persisten di localStorage browser ini)
export function getVisitorId() {
  if (typeof window === 'undefined') return 'server'
  let id = window.localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = 'visitor_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    window.localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

// Terapkan satu aksi vote (like/dislike) ke item { likes, dislikes, likedBy, dislikedBy }.
// Aturan toggle:
// - klik like saat sudah like → batalkan like
// - klik like saat sudah dislike → pindah jadi like
// - klik dislike saat sudah dislike → batalkan dislike
// - klik dislike saat sudah like → pindah jadi dislike
export function applyVote(item, type, voterId) {
  const likes = item.likes || 0
  const dislikes = item.dislikes || 0
  const likedBy = item.likedBy || []
  const dislikedBy = item.dislikedBy || []

  if (type === 'like') {
    if (likedBy.includes(voterId)) {
      return {
        likes: Math.max(0, likes - 1),
        dislikes,
        likedBy: likedBy.filter((v) => v !== voterId),
        dislikedBy,
      }
    }
    return {
      likes: likes + 1,
      dislikes: Math.max(0, dislikes - (dislikedBy.includes(voterId) ? 1 : 0)),
      likedBy: [...likedBy, voterId],
      dislikedBy: dislikedBy.filter((v) => v !== voterId),
    }
  }

  // type === 'dislike'
  if (dislikedBy.includes(voterId)) {
    return {
      likes,
      dislikes: Math.max(0, dislikes - 1),
      likedBy,
      dislikedBy: dislikedBy.filter((v) => v !== voterId),
    }
  }
  return {
    likes: Math.max(0, likes - (likedBy.includes(voterId) ? 1 : 0)),
    dislikes: dislikes + 1,
    likedBy: likedBy.filter((v) => v !== voterId),
    dislikedBy: [...dislikedBy, voterId],
  }
}
