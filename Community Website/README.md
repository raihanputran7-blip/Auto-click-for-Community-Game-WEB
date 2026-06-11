# DarkSystem Android Auto Approver

Project ini sekarang difokuskan sebagai userscript Android untuk DarkSystem, bukan extension `Load unpacked`.

File utama yang dipakai:

- `darksystem-android-auto-approver.user.js`

Script ini akan:

- scan halaman `https://darksystem.id/clans/inbox`
- auto scroll dan klik `Muat lebih banyak` bila tombolnya ada
- buka detail inbox distribusi satu per satu
- klik `Lihat TKP`
- klik `Setuju`
- lanjut klik `Konfirmasi` bila popup konfirmasi muncul
- simpan progres sederhana di browser agar proses tetap lanjut saat pindah halaman

## Kenapa Diganti Jadi Userscript

- Di Android, import extension ZIP / folder unpacked sering tidak stabil.
- Userscript lebih ringan dan biasanya lebih mudah dipasang di browser Android yang mendukung script manager.
- Pendekatan yang paling masuk akal untuk Android adalah `Lemur Browser + Tampermonkey`.

Catatan:

- Dukungan Lemur untuk extension dan Tampermonkey saya dasarkan pada listing Google Play Lemur Browser yang menyebut support extension dan Tampermonkey.
- Untuk Tampermonkey, dokumentasi resminya menjelaskan bahwa userscript memang format yang didukung untuk dijalankan oleh extension tersebut.
- Karena flow UI Android bisa berubah antar versi, langkah di bawah saya buat pakai metode yang paling aman: buat script baru lalu paste isi file `.user.js`.

## Cara Pasang di Android

1. Install `Lemur Browser` terlebih dulu.
2. Buka `Lemur Browser`.
3. Tekan ikon kotak persegi empat di menu browser.
4. Masuk ke menu `Extension`.
5. Cari `Tampermonkey`.
6. Download lalu install extension `Tampermonkey`.
7. Download atau buka file `darksystem-android-auto-approver.user.js`.
8. Copy seluruh isi file userscript tersebut.
9. Buka `Tampermonkey` di Lemur.
10. Buat script baru.
11. Hapus isi template bawaan.
12. Paste seluruh isi `darksystem-android-auto-approver.user.js`.
13. Save script.
14. Pastikan script dalam keadaan aktif.

## Cara Pakai

1. Login ke akun DarkSystem di Lemur.
2. Buka website `https://darksystem.id/clans/inbox` atau halaman DarkSystem mana saja.
3. Tunggu panel `DarkSystem Android Auto Approver` muncul di kanan bawah.
4. Atur `Delay antar aksi` kalau perlu. Default `2` detik.
5. Tekan `Mulai`.
6. Biarkan tab tetap terbuka sampai semua inbox selesai diproses.

## Tombol Panel

- `Mulai`: mulai scan inbox dan jalankan automation.
- `Stop`: hentikan proses yang sedang berjalan.
- `Reset`: hapus queue dan status proses sebelumnya.
- `Sembunyikan`: menyembunyikan panel. Untuk memunculkan lagi, tekan tombol kecil `DS`.

## Catatan Penting

- Script ini bekerja untuk akun yang sedang login pada browser tersebut.
- Setiap anggota tetap harus menjalankan script pada akun masing-masing bila persetujuan memang harus dilakukan per akun.
- Jangan menutup tab saat proses sedang berjalan.
- Kalau tampilan HTML DarkSystem berubah, selector di script mungkin perlu disesuaikan.
- Saya belum bisa mengetes langsung ke website target dari lingkungan ini, jadi kalau nanti ada tombol yang teksnya sedikit berbeda, script masih mungkin perlu penyesuaian kecil.

## File Lama

Beberapa file extension lama mungkin masih ada di folder project sebagai sisa versi sebelumnya, tetapi yang dipakai sekarang untuk Android adalah:

- `darksystem-android-auto-approver.user.js`

## Troubleshooting

### Script tidak muncul di halaman

- Pastikan script di Tampermonkey sudah `Enabled`.
- Pastikan metadata `@match` tidak diubah.
- Coba refresh halaman DarkSystem.

### Script sudah aktif tapi tidak jalan

- Pastikan akun DarkSystem sudah login.
- Tekan `Reset`, lalu `Mulai` lagi.
- Cek apakah tombol di website masih memakai teks `Lihat TKP`, `Setuju`, `Konfirmasi`, atau `Muat lebih banyak`.

### Tombol Konfirmasi tidak terklik

- Bisa jadi popup konfirmasi memakai teks lain.
- Kalau itu terjadi, kirim screenshot terbaru agar selector tombol bisa disesuaikan.
