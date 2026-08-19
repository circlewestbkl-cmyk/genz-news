const DEFAULT_TITLE = 'Gen Z News — Portal Berita Terkini'
const DEFAULT_DESCRIPTION =
  'Portal berita terkini dan terpercaya. Teknologi, Ekonomi, Olahraga, dan lainnya.'

function setTag(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function removeTag(attr, key) {
  document.head.querySelectorAll(`meta[${attr}="${key}"]`).forEach((el) => el.remove())
}

// Atur meta untuk halaman tertentu (mis. detail berita)
export function setPageMeta({ title, description, image, url } = {}) {
  document.title = title || DEFAULT_TITLE
  setTag('name', 'description', description || DEFAULT_DESCRIPTION)
  if (image) {
    setTag('property', 'og:image', image)
    setTag('name', 'twitter:image', image)
  } else {
    removeTag('property', 'og:image')
    removeTag('name', 'twitter:image')
  }
  if (url) {
    setTag('property', 'og:url', url)
  }
  setTag('property', 'og:title', title || DEFAULT_TITLE)
  setTag('property', 'og:description', description || DEFAULT_DESCRIPTION)
  setTag('property', 'og:type', 'article')
  setTag('name', 'twitter:card', 'summary_large_image')
  setTag('name', 'twitter:title', title || DEFAULT_TITLE)
  setTag('name', 'twitter:description', description || DEFAULT_DESCRIPTION)
}

// Kembalikan meta ke default
export function resetPageMeta() {
  document.title = DEFAULT_TITLE
  setTag('name', 'description', DEFAULT_DESCRIPTION)
  removeTag('property', 'og:image')
  removeTag('name', 'twitter:image')
  setTag('property', 'og:title', DEFAULT_TITLE)
  setTag('property', 'og:description', DEFAULT_DESCRIPTION)
  setTag('property', 'og:type', 'website')
  setTag('name', 'twitter:card', 'summary')
  setTag('name', 'twitter:title', DEFAULT_TITLE)
  setTag('name', 'twitter:description', DEFAULT_DESCRIPTION)
}
