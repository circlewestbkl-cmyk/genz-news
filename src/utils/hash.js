// Hash SHA-256 untuk password.
// Catatan: ini pengganti plain text untuk versi demo. Untuk produksi,
// gunakan bcrypt/argon2 di sisi server (hash client-side tetap bisa dibaca
// oleh siapa pun yang punya akses ke file db.json).
export async function sha256(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
