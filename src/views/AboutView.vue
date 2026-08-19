<template>
  <div class="max-w-3xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
    <p class="font-groovy font-black uppercase tracking-widest text-xs text-brand-600 mb-1">Tentang Kami ✦</p>
    <h1 class="font-groovy font-black text-2xl sm:text-3xl lg:text-5xl text-link-700 gradient-underline pb-2 sm:pb-3 mb-8 sm:mb-10">Tentang Gen Z News</h1>

    <div class="space-y-4 sm:space-y-6 text-slate-600 leading-relaxed">
      <div class="y2k-card p-5 sm:p-6 lg:p-7">
        <p class="text-base sm:text-lg">
          <strong class="text-link-700">Gen Z News</strong> adalah majalah remaja digital yang menyajikan
          berita kekinian seputar teknologi, ekonomi, olahraga, kesehatan, hiburan, dan isu seru yang
          wajib kamu tahu. Kami percaya berita bisa <em>fresh, gaul,</em> dan tetap akurat. ✨
        </p>
      </div>

      <div class="y2k-card p-5 sm:p-6 lg:p-7">
        <p class="text-sm sm:text-base">
          Website ini dibangun sebagai aplikasi web modern menggunakan
          <strong class="text-link-700">Vue 3</strong>, <strong class="text-link-700">Vite</strong>, dan
          <strong class="text-link-700">Tailwind CSS</strong>. Konten berita dikelola melalui halaman
          backoffice redaksi di <router-link to="/admin" class="text-brand-600 font-extrabold hover:underline">/admin</router-link>.
        </p>
      </div>

      <div class="y2k-card p-5 sm:p-6 lg:p-7">
        <h2 class="section-title mb-4 sm:mb-5">
          <span class="tag" style="background: var(--color-grape-500); color: #fff">✨ Fitur</span>
          <span class="text-sm sm:text-base">Seru-Seruan</span>
        </h2>
        <ul class="space-y-2.5 sm:space-y-3">
          <li v-for="(f, i) in [
            'Beranda dengan sorotan berita utama dan berita terbaru',
            'Kategori berita: Teknologi, Ekonomi, Olahraga, Kesehatan, Hiburan, Politik, dan Nasional',
            'Halaman detail berita lengkap dengan berita terkait dan tombol bagikan',
            'Pencarian berita berdasarkan kata kunci',
            'Backoffice redaksi untuk menulis, mengedit, dan menghapus berita',
          ]" :key="i" class="flex items-start gap-2.5 sm:gap-3">
            <span class="shrink-0 w-6 h-6 sm:w-7 sm:h-7 grid place-items-center rounded-lg bg-acid-500 border-2 border-link-700 shadow-[2px_2px_0_#2a1038] text-xs sm:text-sm">✦</span>
            <span class="font-medium text-sm sm:text-base">{{ f }}</span>
          </li>
        </ul>
      </div>

      <div class="y2k-card p-5 sm:p-6 lg:p-7 bg-grape-100">
        <h2 class="section-title mb-3 sm:mb-4">
          <span class="tag" style="background: var(--color-brand-500); color: #fff">📮 Kontak</span>
          <span class="text-sm sm:text-base">Nyapa Yuk</span>
        </h2>
        <p class="text-sm sm:text-base">
          Kritik, saran, atau kerja sama kirim aja ke
          <a href="mailto:redaksi@genznews.id" class="text-brand-600 font-extrabold hover:underline">redaksi@genznews.id</a>
          — dibaca kok, serius! 💌
        </p>
      </div>
    </div>
  </div>
</template>
