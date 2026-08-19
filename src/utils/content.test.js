import { describe, it, expect } from 'vitest'
import { renderContent } from './content'

describe('renderContent', () => {
  it('mengubah paragraf yang dipisah baris kosong menjadi <p>', () => {
    const html = renderContent('Paragraf pertama.\n\nParagraf kedua.')
    expect(html).toContain('<p>Paragraf pertama.</p>')
    expect(html).toContain('<p>Paragraf kedua.</p>')
  })

  it('mendukung sub-judul ## menjadi <h2>', () => {
    const html = renderContent('## Dampak Ekonomi')
    expect(html).toContain('<h2>Dampak Ekonomi</h2>')
  })

  it('mendukung kutipan > menjadi <blockquote>', () => {
    const html = renderContent('> Kata pejabat terkait')
    expect(html).toContain('<blockquote>Kata pejabat terkait</blockquote>')
  })

  it('mendukung tebal ** dan miring *', () => {
    const html = renderContent('Ini **penting** dan *catatan*')
    expect(html).toContain('<strong>penting</strong>')
    expect(html).toContain('<em>catatan</em>')
  })

  it('mengabaikan konten kosong', () => {
    expect(renderContent('')).toBe('')
    expect(renderContent('   ')).toBe('')
  })
})
