# XCLUB CLICKER (v2.3.0)

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

# 📱 Tutorial Instal XCLUB CLICKER di Android (Lemur Browser)

Ikuti langkah-langkah berikut sampai selesai agar script dapat berjalan dengan normal.

## 1. Install aplikasi yang dibutuhkan

Pastikan kamu sudah menginstall:

* Lemur Browser
* Tampermonkey

## 2. Aktifkan Developer Mode di Lemur Browser

**WAJIB dilakukan sebelum melanjutkan.**

Masuk ke:
**Settings → Developer Mode → Aktifkan**

> **⚠️ Penting:** Jika Developer Mode tidak diaktifkan, userscript dapat gagal berjalan atau panel tidak akan muncul.

## 3. Install Script XCLUB CLICKER

Buka link berikut:

https://clipboardnow.com/id/view-paste/?id=033d571602

Kemudian:

1. Copy seluruh isi script.
2. Buka Tampermonkey.
3. Tekan tombol **+ (Create New Script)**.
4. Hapus seluruh isi script bawaan.
5. Paste script yang sudah dicopy.
6. Tekan **Save**.
7. Pastikan status script **Enabled**.

## 4. Login ke Website

Login ke akun XCashShop seperti biasa.

Kemudian buka halaman:

https://xcashshop.club/clans/inbox

Jika semua langkah sudah benar, panel **XCLUB CLICKER** akan muncul otomatis di pojok kanan bawah.

---

# ⚠️ Penting Dibaca

* Pastikan **Developer Mode Lemur sudah aktif**.
* Pastikan script di Tampermonkey dalam keadaan **Enabled**.
* Pastikan kamu membuka halaman **Inbox**, bukan halaman lain.
* Jika panel belum muncul, lakukan **Refresh** halaman satu kali.

---

# 📹 Perhatikan Video Tutorial

Mohon **perhatikan video tutorial dengan baik** dan ikuti setiap langkahnya secara berurutan.

Jangan melewatkan satu langkah pun, terutama pada proses:

* Mengaktifkan Developer Mode.
* Menambahkan script ke Tampermonkey.
* Menyimpan script.
* Mengaktifkan script.

Kesalahan kecil pada salah satu langkah di atas dapat menyebabkan panel tidak muncul.

Ikuti video sampai selesai agar proses instalasi berhasil tanpa kendala.

---

## Catatan Penting
- Jangan menutup tab browser saat bot sedang berjalan.
- Bot mendeteksi status berdasarkan elemen visual (teks `"menunggu"` dan warna). Jika web melakukan update UI besar-besaran di kemudian hari, selector elemen di dalam script mungkin perlu disesuaikan kembali.
