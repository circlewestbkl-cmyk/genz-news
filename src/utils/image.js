// Ubah file gambar menjadi data URL JPEG terkompresi (untuk unggahan demo).
// - Tanpa target: gambar di-resize maksimal MAX_WIDTH agar db.json tidak membengkak.
// - Dengan target { width, height } (dimensi slot iklan): gambar di-crop (cover,
//   bagian tengah dipertahankan) lalu di-resize presisi ke ukuran slot, sehingga
//   tampil pas tanpa distorsi maupun terpotong tak terduga.
const MAX_WIDTH = 1280
const QUALITY = 0.8

export function compressImage(file, target = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('File bukan gambar yang valid'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (target && target.width > 0 && target.height > 0) {
          // --- Crop cover ke rasio slot, lalu resize presisi ke dimensi slot ---
          const targetRatio = target.width / target.height
          const imgRatio = img.width / img.height

          let sx = 0
          let sy = 0
          let sw = img.width
          let sh = img.height

          if (imgRatio > targetRatio) {
            // Gambar lebih lebar dari slot → potong kiri-kanan
            sw = img.height * targetRatio
            sx = (img.width - sw) / 2
          } else {
            // Gambar lebih tinggi dari slot → potong atas-bawah
            sh = img.width / targetRatio
            sy = (img.height - sh) / 2
          }

          // Skala turun agar pas slot (jangan perbesar gambar kecil agar tetap tajam).
          // Koordinat sumber dibiarkan pecahan (canvas menginterpolasi); hanya dimensi
          // output yang dibulatkan agar hasil presisi sesuai ukuran slot.
          const scale = Math.min(1, target.width / sw, target.height / sh)
          const outW = Math.max(1, Math.round(sw * scale))
          const outH = Math.max(1, Math.round(sh * scale))

          canvas.width = outW
          canvas.height = outH
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
        } else {
          // --- Mode umum: batasi lebar maksimum, pertahankan rasio asli ---
          const scale = Math.min(1, MAX_WIDTH / img.width)
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }

        resolve(canvas.toDataURL('image/jpeg', QUALITY))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
