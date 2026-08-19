# ⚡ Gen Z News — Portal Berita (Vue 3 + Vite + Tailwind CSS)

Aplikasi web portal berita dengan halaman publik untuk pembaca dan **backoffice** multi-role untuk mengelola berita & user.

> 🎨 **Tema terinspirasi "Goal – Sports Recovery" (Ancora Themes)**: font **Roboto** (isi) + **Roboto Slab** (judul), warna utama **sage green `#4a8565`** (hover `#3d7c5a`), judul **dark olive `#2a311e`**, latar putih dengan seksi alternatif off-white `#F9F9F7`, border hangat `#E5E7DE`, seksi gelap (footer/CTA) **navy `#1F242E`**.

## ✨ Fitur

**Halaman Publik**
- Beranda: hero berita utama, breaking news bar (marquee), grid **Berita Terbaru dengan pagination**, daftar terpopuler
- Detail berita: **meta SEO + Open Graph** per artikel, **jumlah pembaca dinamis** (live, polling + animasi count-up), tombol bagikan (WA/X), berita terkait
- **Profil penulis publik** (`/penulis/:username`): kartu profil (nama pena, role, statistik artikel/views/kata/suka) + kumpulan artikel terbitnya — nama penulis di halaman berita bisa diklik
- **Like, dislike & komentar** di halaman artikel: 👍/👎 artikel tanpa login (dilacak per browser); **komentar & balasan wajib login sebagai Pembaca** (simulasi "Masuk dengan Google" di `/masuk` — akun dibuat otomatis dari alamat Gmail, nama tampil diturunkan dari email); like/dislike juga bisa pada komentar & balasan; **identitas komentator dibedakan badge + warna avatar** (🛡 Admin merah, ✏️ Editor biru, ✍️ Penulis Artikel hijau, pembaca biasa tanpa badge); **komentar dipaginasi** (10 per halaman) + **anti-spam ringan** (jeda 30 detik antar kirim komentar/balasan)
- **Konten kaya**: sub-judul (`##`), kutipan (`>`), tebal (`**tebal**`), miring (`*miring*`)
- **Kategori dinamis** (`/admin/kategori`, khusus **Editor**): kategori disimpan di database (`categories` di `db.json`) — hanya **Editor** yang bisa menambah (nama + warna chip) **dan mengubah statusnya** (Aktif/Tidak Aktif); **tidak bisa dihapus oleh siapapun** agar artikel lama aman; halaman website (navbar, footer, seksi beranda) menampilkan **semua kategori berstatus Aktif yang memiliki minimal 1 artikel terbit** (kategori tanpa artikel tidak tampil; tanpa batas jumlah); warna chip & dropdown kategori di form artikel otomatis mengikuti database
- Halaman per kategori & pencarian — keduanya **dengan pagination**; halaman kategori & artikel punya **sidebar kanan: daftar berita Trending** (terbanyak dibaca) **+ slot iklan**; beranda punya **slot iklan leaderboard** (di bawah breaking news & di sidebar Terpopuler), dan di halaman artikel **slot iklan disisipkan di tengah isi tulisan** (bila artikel cukup panjang) — semua slot iklan berupa kartu placeholder rapi yang tidak mengganggu pembaca (sidebar disembunyikan di layar kecil)
- **Headline Utama (Editor's Pick)**: Admin/Editor menandai artikel terbit sebagai ⭐ Headline di dashboard (tombol "⭐ Jadikan Headline" pada baris artikel) — artikel yang ditandai **tampil pertama di hero beranda** dengan badge "⭐ Headline Utama" (artikel non-headline tetap mengikuti urutan terbaru)
- **Simpan Artikel (bookmark)**: pembaca yang login bisa menyimpan artikel dengan tombol **🔖 Simpan** di halaman artikel — tersimpan di halaman **`/disimpan`** (link "🔖 Disimpan" di navbar) dan bisa dihapus dari daftar
- **Follow Penulis**: pembaca yang login bisa **Follow/Unfollow** penulis dari profil penulis (`/penulis/:username`) — kartu jumlah pengikut ditampilkan; saat penulis **menerbitkan artikel baru**, semua pengikutnya otomatis mendapat **notifikasi** "⭐ Penulis Favorit" di bel notifikasi
- **Pendaftaran user** (`/daftar`) — dengan **Nama Pena** (unik antar penulis, dibandingkan tanpa membedakan huruf besar/kecil); saat menulis artikel, kolom Penulis otomatis terisi nama pena dan tidak bisa diubah; **saat artikel diedit (termasuk oleh Editor), nama pena penulis aslinya tetap dipertahankan** — tidak ikut terganti nama pengedit; otomatis berperan Penulis & menunggu verifikasi Admin
- `robots.txt` + `sitemap.xml`

**Backoffice** (`/admin`)
- Login multi-user 3 role: **Admin**, **Editor**, **Penulis** (password di-hash SHA-256, status akun diperiksa)
- Dashboard: statistik, **filter & pencarian berita** (judul/status/kategori), link pratinjau draft
- **Berita Saya** (`/admin/berita-saya`): setiap user (termasuk Penulis) melihat status berita yang pernah ditulis — Terbit, Draft, atau Recycle Bin — dengan filter status, ringkasan jumlah, serta aksi lihat/pratinjau/edit
- **Tampilan backoffice gaya Android** (bukan AdminLTE): tanpa sidebar — top bar ramping (logo, role, nama, bel notifikasi, keluar, tombol kembali) + beranda berisi **grid kartu menu berwarna ala layar aplikasi Android** (ikon emoji di kotak gradient, badge notifikasi, filter per role); setiap kartu membuka seksinya masing-masing
- **Perlu Ditinjau** (`/admin/tinjauan`): menu khusus Editor — antrean draft tulisan penulis (badge *Baru* / *Perlu Revisi* / *Siap Ditinjau*) untuk diterbitkan atau diminta revisi, lengkap dengan badge jumlah antrean
- **Notifikasi**: bell notifikasi untuk semua role — Editor menerima notifikasi "tulisan baru" dari Penulis, dan **Penulis menerima notifikasi saat artikelnya dikomentari/dibalas** (polling otomatis, badge belum dibaca, tandai semua dibaca)
- **Chat Redaksi** (`/admin/pesan`): komunikasi realtime antar Admin, Editor & Penulis — **ruang grup** "Ruangan Redaksi" untuk semua tim + **chat privat 1-on-1** per user; pesan baru muncul otomatis (polling 4 detik), badge belum dibaca di kartu menu dashboard & ikon top bar, riwayat tersimpan di koleksi `messages` (`db.json`); **status online** — user yang membuka Chat Redaksi mengirim heartbeat (koleksi `presence`, tiap 30 detik) dan ditandai **titik hijau + teks "Sedang online"** di daftar percakapan, header DM, pesan grup, @mention, & modal percakapan baru (dianggap offline setelah ±45 detik tidak aktif, diperbarui tiap 15 detik); fitur **balas** (quote), **forward**, **hapus** (soft delete), **reaksi emoji**, **link preview**, @mention dengan notifikasi, **anti-spam** (batas kecepatan, spam duplikat, panjang maks), dan **blokir user dari chat** oleh Admin/Editor (user diblokir hanya bisa membaca); **spam chat berlebihan → diblokir otomatis** (3× penolakan karena terlalu cepat) dengan notifikasi ke Admin, dan **hanya Admin yang bisa membuka blokir** (termasuk membuka blokir dirinya sendiri); halaman **Kelola User** juga punya tombol Blokir/Buka Blokir Chat untuk semua user (dengan konfirmasi & audit log), jadi admin bisa memulihkan akun siapa pun — termasuk dirinya — tanpa lewat halaman chat
- **Penghasilan Penulis**: setiap kata pada artikel yang berhasil terbit dihargai **Rp100** — penghasilan = total kata dari semua artikel terbit × Rp100, ditampilkan di Berita Saya beserta pendapatan per artikel (draft/recycle bin tidak dihitung)
- **Rekap Penghasilan** (`/admin/rekap-penghasilan`): khusus **Admin** — ringkasan total (penghasilan, artikel terbit, total kata, jumlah penulis) + tabel penghasilan per penulis, diurutkan dari terbesar
- **Manajemen Media** (`/admin/media`): **pustaka gambar** — upload gambar sekali (kompresi otomatis), tersimpan di koleksi `media`; bisa **dipakai ulang** di editor artikel (tombol "🗂️ Pilih dari Media") dan form iklan (tombol "🗂️ Media") lewat modal pemilih; salin URL, hapus dari pustaka (artikel yang sudah memakai tetap tampil)
- **Analitik Artikel** (dashboard): **grafik pembaca 7 hari terakhir** (bar chart dari `viewsByDay`) + daftar **artikel terpopuler 7 hari** — bahan evaluasi editor tanpa halaman terpisah
- **Autosave draft**: editor artikel baru menyimpan draf **otomatis ke localStorage** (800 ms setelah berhenti mengetik) — draf dipulihkan saat kembali, dengan indikator waktu simpan & tombol "Buang draft & mulai baru"; draf dihapus setelah artikel berhasil disimpan
- **Kelola Iklan** (`/admin/iklan`, khusus **Admin**): form tayangkan iklan — unggah **gambar** + **link** (hyperlink, terbuka di tab baru saat diklik), pilih **posisi slot** (bawah navbar, footer, beranda, kategori, artikel — posisi slot tetap sesuai tata letak yang ada), serta **masa kontrak tayang** (mulai & selesai, dengan durasi cepat 1–90 hari); iklan otomatis tampil/berhenti sesuai jadwal & status aktif, dan slot menampilkan placeholder "Pasang Iklan Disini" bila tidak ada iklan aktif. **Gambar yang diunggah otomatis di-crop & di-resize** agar pas dengan ukuran slot yang dipilih (mis. footer 1280×250, sidebar 300×250/600, tengah artikel 764×110). Fitur pendukung: **statistik klik** per iklan (terhitung otomatis saat link diklik), **booking kampanye** (iklan di posisi yang sudah terisi otomatis jadi "Menunggu Slot" dan tayang saat slot kosong — antrean FIFO), **peringatan kontrak hampir habis** (< 7 hari), **pratinjau di website** (tombol di form, membuka halaman mock dengan ukuran slot asli), serta **label internal** untuk pembukuan, dan **grafik klik iklan 7 hari terakhir** (bar chart per hari dari `clicksByDay`)
- **Interaksi Pembaca** (`/admin/interaksi`): tersedia untuk **semua role** — **Admin** melihat semua artikel, **Penulis/Editor** melihat artikel miliknya saja; berisi **daftar komentar saja** (dengan reaksi 👍/👎, badge identitas, & balasan); **Penulis/Editor bisa membalas komentar** pada tulisannya, Admin bisa balas + hapus komentar; balasan tampil bersarang di halaman artikel publik
- Editor: unggah gambar (kompresi otomatis), pratinjau live, modal "Berhasil Diterbitkan", **peringatan saat meninggalkan halaman dengan perubahan belum disimpan"
- **Minta Revisi**: saat Editor tidak menyetujui draft penulis, Editor bisa mengirim pesan revisi (tombol "Minta Revisi" di dashboard) — penulis melihat pesannya di **Berita Saya** dan banner saat mengedit. Setelah penulis menyimpan perbaikan, artikel ditandai **Revisi Selesai** (badge hijau di Berita Saya) dan di dashboard editor muncul chip **Siap Ditinjau** untuk ditinjau ulang; pesan terhapus otomatis saat artikel diterbitkan
- **Siap Terbit** (`/admin/siap-terbit`, khusus Editor): artikel yang sudah disetujui Editor bisa ditandai **Siap Terbit** (dari halaman Perlu Ditinjau / form artikel / dashboard) — tersimpan di halaman khusus ini dan **belum tampil di website** sampai diterbitkan; dari sini Editor bisa menerbitkan sekarang, menjadwalkan, mengembalikan ke draft, atau menghapus
- **Penjadwalan Terbit**: saat menerbitkan, Editor bisa memilih **Terbitkan Sekarang** atau **Jadwalkan Terbit** dengan tanggal & jam (status *Terjadwal*, `scheduledAt`); artikel otomatis terbit tepat waktu (scheduler sisi klien selama aplikasi terbuka, cek tiap 30 detik) tanpa tindakan lagi — dashboard & form artikel juga punya pilihan jadwal
- **Recycle Bin** (admin & editor): hapus = soft delete, pulihkan sebagai draft / hapus permanen
- **Kelola User** (admin): verifikasi pendaftar, aktifkan/nonaktifkan, tambah/hapus di satu halaman; **Edit User di halaman terpisah** (`/admin/users/:id/edit`) — nama, username, & **Nama Pena** tidak bisa diubah (ditetapkan saat pendaftaran, immutable); hanya role, password, & hak akses yang bisa diatur
- **Hak akses granular**: admin bisa memberi izin spesifik per user di luar role-nya — *Terbitkan berita*, *Edit semua berita*, *Hapus berita*, *Kelola user*, *Kelola Recycle Bin*, *Lihat Audit Log*
- **Audit Log** (admin): riwayat semua aksi penting
- **Profil Saya** (`/admin/profil`): ganti password sendiri + **upload/hapus foto profil** (semua role) — foto otomatis dipotong persegi & dikompres (maks 2MB), sesi lokal ikut diperbarui; **Admin juga bisa mengatur foto profil user** dari halaman Edit User; foto tampil di **Chat Redaksi** (avatar pesan, daftar percakapan, header DM, @mention, modal), daftar user, top bar backoffice, profil penulis publik, dan avatar penulis di halaman artikel — fallback otomatis ke inisial nama bila belum ada foto
- Badge jumlah pendaftar & recycle bin dengan polling realtime

**Role & hak akses**

| Role | Hak akses |
|---|---|
| **Admin** (`admin` / `admin123`) | Kelola user, recycle bin & audit log — **tidak** bisa menulis, mengedit, menghapus, atau menerbitkan berita |
| **Editor** (`editor` / `editor123`) | Kelola & terbitkan semua berita + recycle bin |
| **Penulis** (`penulis` / `penulis123`) | Hanya berita miliknya, tersimpan sebagai draft; hanya draft miliknya yang bisa dihapus — artikel yang sudah terbit tidak bisa dihapus/dipindah ke Recycle Bin oleh penulis |
| **Pembaca** (via `/masuk` — simulasi Google login) | Membaca & berkomentar/membalas komentar di website; tidak bisa masuk backoffice |

**Izin granular:** selain izin bawaan role, Admin bisa memberi izin ekstra per user (`permissions` di `db.json`): `publish`, `editAll`, `delete`, `manageUsers`, `manageTrash`, `viewAudit`. Efektif = izin bawaan role ∪ izin tambahan.

**Status akun:** `pending` (menunggu verifikasi), `active`, `inactive` (dinonaktifkan admin).
**Status berita:** `published` (terbit), `ready` (siap terbit — belum tampil di publik), `scheduled` (terjadwal — otomatis terbit saat `scheduledAt` tiba), `draft`, `trashed` (recycle bin).

## 🛠️ Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | Vue 3 (Composition API), Vue Router |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Backend data | JSON Server (file `db.json`) |
| Testing | Vitest |

## 🚀 Cara Menjalankan

Butuh **Node.js 18+**.

```bash
npm install

# Terminal 1 — JSON Server (data) di http://localhost:3001
npm run server

# Terminal 2 — Aplikasi di http://localhost:5173
npm run dev
```

Script lain: `npm run build` (build produksi), `npm run preview`, `npm test` (unit test).

> **URL API** bisa diubah via `.env` (`VITE_API_URL`) — lihat `.env.example`.

## 📁 Struktur Project

```
├── db.json                     # Database (users, articles, auditLogs)
├── index.html
├── vite.config.js
├── public/
│   ├── robots.txt
│   └── sitemap.xml
└── src/
    ├── main.js
    ├── App.vue                 # Layout root + judul halaman per rute
    ├── router/index.js         # Rute + guard autentikasi & role
    ├── api/
    │   ├── articles.js         # CRUD berita (trash/restore, filter trashed)
    │   ├── auth.js             # Login, sesi, verifikasi & ganti password
    │   ├── chat.js             # Chat redaksi (list, kirim, tandai dibaca)
    │   ├── users.js            # CRUD user
    │   └── audit.js            # Audit log
    ├── data/categories.js
    ├── utils/
    │   ├── format.js           # Tanggal, waktu baca, slug, dll
    │   ├── content.js          # Render konten (markdown ringan)
    │   ├── hash.js             # SHA-256 (demo password)
    │   ├── image.js            # Kompresi gambar → data URL
    │   ├── seo.js              # Meta tags + Open Graph
    │   └── *.test.js           # Unit test
    ├── components/             # Navbar, Footer, NewsCard, ConfirmModal, PaginationBar, dll
    └── views/
        ├── HomeView.vue, ArticleView.vue (preview mode), CategoryView.vue,
        ├── SearchView.vue, AboutView.vue, RegisterView.vue
        └── admin/
            ├── AdminLayout.vue, AdminLoginView.vue, AdminDashboardView.vue,
            ├── AdminEditorView.vue, AdminUsersView.vue, AdminTrashView.vue,
            ├── AuditLogView.vue, ProfileView.vue
```

## ⚠️ Batasan (versi demo)

- **Autentikasi demo**: password di-hash SHA-256 tapi hash tetap bisa dibaca dari `db.json` (tidak ada server auth). Untuk produksi: backend sungguhan dengan bcrypt/argon2 + JWT/session httpOnly.
- **SEO**: meta tags + sitemap sudah ada, tapi karena SPA tanpa SSR, konten artikel belum terindeks optimal oleh mesin pencari. Solusi ideal: migrasi ke **Nuxt (SSR)**.
- **Data**: `db.json` lokal; perubahan dari backoffice langsung tersimpan ke file.
