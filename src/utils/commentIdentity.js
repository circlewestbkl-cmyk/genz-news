// Identitas penulis komentar — untuk membedakan pembaca biasa, admin, editor,
// dan penulis artikel lewat badge & warna avatar.

// 1) Komentar baru: identitas tersimpan di komentar (authorRole, authorUsername, isArticleAuthor).
// 2) Komentar lama (tanpa metadata): diperkirakan dari nama vs daftar user & penulis artikel.
export function commentIdentity(comment, { article, users } = {}) {
  if (comment?.authorRole && comment?.authorUsername) {
    return {
      role: comment.authorRole,
      isArticleAuthor: !!comment.isArticleAuthor,
    }
  }
  const name = (comment?.author || '').trim().toLowerCase()
  if (!name) return { role: 'guest', isArticleAuthor: false }

  const isArticleAuthor =
    !!article && (article.author || '').trim().toLowerCase() === name

  const match = (users || []).find(
    (u) =>
      (u.name || '').trim().toLowerCase() === name ||
      (u.penName || '').trim().toLowerCase() === name
  )
  return { role: match?.role || 'reader', isArticleAuthor }
}

// Gaya badge & avatar per role (avatar dipakai bila role tidak punya badge)
export const commenterStyle = {
  admin: {
    label: 'Admin',
    icon: '🛡',
    badge: 'bg-red-50 text-red-700 border-red-200',
    avatar: 'bg-red-600 text-white',
  },
  editor: {
    label: 'Editor',
    icon: '✏️',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    avatar: 'bg-blue-600 text-white',
  },
  writer: {
    label: 'Penulis',
    icon: '✍️',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    avatar: 'bg-emerald-600 text-white',
  },
  reader: {
    label: 'Pembaca',
    icon: null,
    badge: null,
    avatar: 'bg-slate-400 text-white',
  },
  guest: {
    label: 'Pengunjung',
    icon: null,
    badge: null,
    avatar: 'bg-slate-400 text-white',
  },
}

// Info tampilan untuk satu komentar: { label, icon, badge, avatar }
// Penulis artikel mendapat badge khusus "Penulis Artikel".
export function commenterInfo(comment, ctx) {
  const id = commentIdentity(comment, ctx)
  if (id.isArticleAuthor) {
    return { ...commenterStyle.writer, label: 'Penulis Artikel' }
  }
  return commenterStyle[id.role] || commenterStyle.reader
}
