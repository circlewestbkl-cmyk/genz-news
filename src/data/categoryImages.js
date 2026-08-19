// Gambar khas per kategori — setiap kategori memakai satu gambar yang konsisten
// agar tampilan seksi kategori seragam dan rapi.
export const categoryImages = {
  Teknologi: 'https://picsum.photos/seed/genz-cat-teknologi/1200/675',
  Ekonomi: 'https://picsum.photos/seed/genz-cat-ekonomi/1200/675',
  Olahraga: 'https://picsum.photos/seed/genz-cat-olahraga/1200/675',
  Kesehatan: 'https://picsum.photos/seed/genz-cat-kesehatan/1200/675',
  Hiburan: 'https://picsum.photos/seed/genz-cat-hiburan/1200/675',
  Politik: 'https://picsum.photos/seed/genz-cat-politik/1200/675',
  Nasional: 'https://picsum.photos/seed/genz-cat-nasional/1200/675',
}

export const DEFAULT_CATEGORY_IMAGE =
  'https://picsum.photos/seed/genz-cat-default/1200/675'

export function getCategoryImage(name) {
  return categoryImages[name] || DEFAULT_CATEGORY_IMAGE
}
