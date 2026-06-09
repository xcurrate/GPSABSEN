# Absensi-Guru-GPS

Aplikasi absensi guru berbasis lokasi GPS, dibangun dengan HTML, CSS, dan JavaScript. Aplikasi ini memungkinkan guru untuk melakukan absensi (check-in dan check-out) hanya di lokasi sekolah yang sudah ditentukan. Admin dapat mengelola data guru, melihat rekap absensi, dan mengatur parameter aplikasi.

## Fitur Utama

-   **Absensi Guru**: Guru dapat melakukan check-in dan check-out melalui aplikasi.
-   **Validasi GPS**: Absensi hanya bisa dilakukan jika guru berada dalam radius yang ditentukan dari lokasi sekolah.
-   **Panel Admin**: Admin memiliki akses ke panel khusus untuk:
    -   Mengelola data guru (tambah, edit, nonaktifkan).
    -   Melihat riwayat absensi semua guru dengan filter tanggal dan nama.
    -   Melihat rekapitulasi kehadiran (hadir, terlambat, izin, sakit, alfa) per guru dalam rentang waktu tertentu.
    -   Mengelola agenda atau jadwal sekolah.
    -   Mengatur parameter aplikasi seperti nama sekolah, koordinat GPS, radius absensi, dan jam kerja.
-   **Otentikasi**: Sistem otentikasi berbasis email dan password untuk guru dan admin.
-   **Impor/Ekspor Data**: Admin dapat mengimpor data absensi dari file CSV dan mengekspor laporan absensi atau rekap ke dalam format CSV.
-   **PWA (Progressive Web App)**: Aplikasi dapat di-install di perangkat mobile untuk akses yang lebih mudah.

## Struktur Proyek

-   `index.html`: Halaman login untuk guru dan admin.
-   `dashboard.html`: Halaman dashboard untuk guru setelah login, menampilkan status absensi, riwayat, dan agenda.
-   `admin.html`: Panel admin untuk mengelola data dan melihat laporan.
-   `/css/style.css`: File styling utama.
-   `/js/supabase.js`: Klien dan konfigurasi untuk koneksi ke Supabase.
-   `/img/`: Aset gambar.
-   `manifest.json`: Konfigurasi untuk PWA.
-   `sw.js`: Service worker untuk fungsionalitas offline dan PWA.
-   `/api/admin-create-user.js`: Netlify Function (atau backend setara) untuk membuat user baru dari panel admin. Endpoint ini memerlukan hak akses admin Supabase.

## Backend (Supabase)

Aplikasi ini menggunakan [Supabase](https://supabase.com) sebagai backend untuk otentikasi, database, dan fungsi serverless. Anda perlu membuat proyek di Supabase dan mengonfigurasi skema database sesuai dengan file `sql/schema.sql`.

**Penting**: Untuk fitur pembuatan user oleh admin, diperlukan sebuah *serverless function* yang berjalan dengan `service_role_key` Supabase. Contoh implementasi untuk Netlify Functions ada di `/api/admin-create-user.js`. Jika Anda menggunakan platform lain (Vercel, dll.), sesuaikan implementasinya. Jika fungsi ini tidak tersedia, aplikasi akan mencoba membuat user melalui `auth.signUp()` biasa, yang mungkin memerlukan konfirmasi email tergantung pada pengaturan proyek Supabase Anda.

## Instalasi & Konfigurasi

1.  **Clone Repositori**: `git clone https://github.com/xcurrate/GPSABSEN.git`
2.  **Buat Proyek Supabase**: Daftar atau login ke [Supabase](https://supabase.com) dan buat proyek baru.
3.  **Skema Database**: Salin dan jalankan query dari `sql/schema.sql` di *SQL Editor* Supabase untuk membuat tabel dan fungsi yang diperlukan.
4.  **Konfigurasi Supabase**: 
    - Masuk ke *Project Settings* > *API*.
    - Salin `URL` dan `anon (public) key`.
    - Tempelkan ke dalam file `js/supabase.js`.
5.  **Buat User Admin**: 
    - Buka *Authentication* di Supabase.
    - Buat user baru secara manual. 
    - Buka tabel `profiles` di *Table Editor* dan ubah `role` user tersebut menjadi `admin`.
6.  **Konfigurasi Netlify Functions (Opsional)**:
    - Jika Anda hosting di Netlify, buat file `netlify.toml` untuk mengarahkan ke direktori functions.
    - Atur environment variables `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di Netlify.
7.  **Jalankan Lokal**: Buka `index.html` di browser Anda.

## Kontribusi

Kontribusi dalam bentuk apapun sangat diterima! Jika Anda menemukan bug atau memiliki ide untuk fitur baru, silakan buat *issue* atau *pull request*.
