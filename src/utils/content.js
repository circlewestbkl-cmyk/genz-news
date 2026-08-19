// Render konten artikel dari teks biasa ke HTML.
// Mendukung sintaks ringan:
//   ## Judul sub-bagian   → <h2>
//   > kutipan             → <blockquote>
//   **tebal** dan *miring* → <strong>/<em>
// Paragraf dipisahkan oleh satu baris kosong.
export function renderContent(content = '') {
  const blocks = content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)

  return blocks
    .map((block) => {
      const inline = (text) => inlineFormat(text)
      if (block.startsWith('## ')) {
        return `<h2>${inline(block.slice(3))}</h2>`
      }
      if (block.startsWith('> ')) {
        return `<blockquote>${inline(block.slice(2))}</blockquote>`
      }
      return `<p>${inline(block)}</p>`
    })
    .join('\n')
}

// Format inline: **tebal** dan *miring*
function inlineFormat(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}
