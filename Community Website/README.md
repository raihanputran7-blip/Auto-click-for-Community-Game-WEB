# XCLUB CLICKER (v2.0.0)

Project ini menyediakan alat otomasi persetujuan distribusi klan pada website **XCashShop** (`https://xcashshop.club/`). Tersedia dalam 2 versi:

1. **PC / Desktop**: Chrome Extension (Menggunakan kontrol popup, tanpa overlay di web).
2. **Mobile / Android**: Userscript Tampermonkey (Menggunakan overlay panel di layar).

---

## Fitur Baru & Perubahan di v2.0.0

- **Domain Baru**: Migrasi penuh ke domain `https://xcashshop.club/`.
- **Auto-Start**: Bot secara otomatis mendeteksi ketika Anda membuka halaman inbox `https://xcashshop.club/clans/inbox` dan langsung memulai proses auto-click jika status bot aktif.
- **Deteksi Cerdas (Warna & Teks)**: Bot membedakan tiket yang belum diproses (warna putih/terang & memiliki kata `"menunggu"`) dan tiket yang sudah selesai (warna abu-abu/redup). Tiket yang sudah selesai akan otomatis dilewati.
- **Siklus Loop Cepat**: Bot memproses tiket satu per satu, menyetujuinya, lalu kembali ke halaman inbox untuk mengambil tiket berikutnya dari atas.
- **Auto Load More**: Bot akan otomatis mengklik tombol `"Muat Lebih Banyak"` secara terus-menerus jika tidak ada tiket putih yang tersisa di layar, sampai seluruh halaman selesai dipindai.
- **Notifikasi Selesai**: Memunculkan notifikasi pop-up `"sudah selesai"` ketika seluruh tiket dari atas hingga paling bawah telah berhasil diproses.
- **Optimasi Kecepatan**: Waktu tunggu (*delay*) antar-aksi dipercepat secara optimal tanpa mengorbankan stabilitas.

---

## 1. Panduan PC (Chrome Extension)

### Cara Pemasangan:
1. Buka browser Google Chrome di PC.
2. Masuk ke halaman **`chrome://extensions/`**.
3. Aktifkan **Developer mode** di pojok kanan atas.
4. Klik tombol **Load unpacked** di pojok kiri atas.
5. Pilih folder project ini (tempat file `manifest.json`, `content.js`, dan `popup.html` berada).

### Cara Pakai:
1. Login ke akun XCashShop di browser Chrome Anda.
2. Buka halaman inbox: `https://xcashshop.club/clans/inbox`.
3. Klik ikon extension **XCLUB CLICKER** di browser untuk membuka pop-up.
4. Klik tombol **Mulai**. Bot akan berjalan secara otomatis di tab tersebut.
5. Layar akan memunculkan pop-up `"sudah selesai"` jika proses telah rampung.
6. Anda bisa mengklik **Stop** kapan saja untuk menghentikan bot secara instan.

---

## 2. Panduan Mobile (Android Userscript)

### Cara Pemasangan di Android:
1. Install **Lemur Browser** atau **Kiwi Browser** dari Google Play Store.
2. Buka browser tersebut, cari dan install extension **Tampermonkey** dari Chrome Web Store.
3. Salin (*copy*) seluruh isi kode dari file [xclub-android-clicker.user.js]
4. Buka dashboard **Tampermonkey** di browser Android Anda.
5. Buat script baru (*Create a new script*), hapus kode bawaan, lalu paste kode yang telah disalin.
6. Simpan (*Save*) script tersebut dan pastikan statusnya aktif (Enabled).

### Cara Pakai di Android:
1. Login ke akun XCashShop di browser Android Anda.
2. Masuk ke halaman inbox: `https://xcashshop.club/clans/inbox`.
3. Panel overlay **XCLUB CLICKER** akan otomatis muncul di pojok kanan bawah layar.
4. Tekan tombol **Mulai** pada panel tersebut untuk menjalankan otomasi.
5. Panel akan menampilkan jumlah sukses klik **Setuju** dan **Skip**.
6. Jika semua tiket selesai diproses, layar HP akan memunculkan notifikasi `"sudah selesai"`.

---

## Catatan Penting
- Jangan menutup tab browser saat bot sedang berjalan.
- Bot mendeteksi status berdasarkan elemen visual (teks `"menunggu"` dan warna). Jika web melakukan update UI besar-besaran di kemudian hari, selector elemen di dalam script mungkin perlu disesuaikan kembali.
