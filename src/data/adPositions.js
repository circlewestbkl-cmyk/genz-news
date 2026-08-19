// Daftar posisi slot iklan di halaman publik — dipakai admin untuk menargetkan
// posisi mana yang akan menampilkan gambar iklan. Ukuran (lebar × tinggi) adalah
// dimensi slot saat dirender di desktop; gambar iklan yang diunggah otomatis
// di-crop & di-resize agar pas dengan ukuran ini.
export const AD_POSITIONS = [
  {
    key: 'nav-bottom',
    label: 'Bawah Navbar (semua halaman)',
    desc: 'Leaderboard lebar tepat di bawah menu kategori',
    width: 1280,
    height: 250,
  },
  {
    key: 'footer',
    label: 'Atas Footer (semua halaman)',
    desc: 'Leaderboard lebar di atas footer',
    width: 1280,
    height: 250,
  },
  {
    key: 'home-top',
    label: 'Beranda — Bawah Breaking News',
    desc: 'Leaderboard di beranda',
    width: 1280,
    height: 110,
  },
  {
    key: 'home-aside',
    label: 'Beranda — Sidebar Terpopuler',
    desc: 'Rectangle di sidebar beranda',
    width: 375,
    height: 250,
  },
  {
    key: 'category-sidebar-top',
    label: 'Kategori — Sidebar Atas',
    desc: 'Rectangle di atas sidebar kategori',
    width: 300,
    height: 250,
  },
  {
    key: 'category-sidebar-bottom',
    label: 'Kategori — Sidebar Bawah',
    desc: 'Skyscraper di bawah sidebar kategori',
    width: 300,
    height: 600,
  },
  {
    key: 'article-inline',
    label: 'Artikel — Tengah Isi',
    desc: 'Leaderboard di tengah tulisan artikel',
    width: 764,
    height: 110,
  },
  {
    key: 'article-sidebar-top',
    label: 'Artikel — Sidebar Atas',
    desc: 'Rectangle di atas sidebar artikel',
    width: 300,
    height: 250,
  },
  {
    key: 'article-sidebar-bottom',
    label: 'Artikel — Sidebar Bawah',
    desc: 'Skyscraper di bawah sidebar artikel',
    width: 300,
    height: 600,
  },
]

export function adPositionInfo(key) {
  return (
    AD_POSITIONS.find((p) => p.key === key) || {
      label: key || '—',
      desc: '',
      width: 1280,
      height: 120,
    }
  )
}
