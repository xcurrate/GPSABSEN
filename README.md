# Absensi-Guru-GPS

Aplikasi absensi guru berbasis lokasi GPS, dibangun dengan HTML, CSS, dan JavaScript. Aplikasi ini memungkinkan guru untuk melakukan absensi (check-in dan check-out) hanya di lokasi sekolah yang sudah ditentukan. Admin dapat mengelola data guru, melihat rekap absensi, dan mengatur parameter aplikasi.

## Fitur Utama

-   **Absensi Guru**: Guru dapat melakukan check-in dan check-out melalui aplikasi.
-   **Pengajuan Izin/Sakit**: Guru dapat mengajukan izin atau sakit untuk satu atau beberapa tanggal. Admin meninjau setiap pengajuan; persetujuan otomatis mencatat status pada hari kerja yang belum memiliki absensi tanpa menimpa check-in yang sudah ada.
-   **Validasi GPS**: Absensi hanya bisa dilakukan jika guru berada dalam radius yang ditentukan dari lokasi sekolah.
-   **Panel Admin**: Admin memiliki akses ke panel khusus untuk:
    -   Mengelola data guru (tambah, edit, nonaktifkan).
    -   Melihat riwayat absensi semua guru dengan filter tanggal dan nama.
    -   Melihat rekapitulasi kehadiran (hadir, terlambat, izin, sakit, alfa) per guru dalam rentang waktu tertentu.
    -   Mengelola agenda atau jadwal sekolah.
    -   Mengatur parameter aplikasi seperti nama sekolah, koordinat GPS, radius absensi, dan jam kerja.
-   **Otentikasi**: Sistem otentikasi berbasis email dan password untuk guru dan admin.
-   **Impor/Ekspor Data**: Admin dapat mengimpor data absensi dari file CSV dan mengekspor laporan absensi atau rekap ke dalam format CSV.

## Keamanan

-   Semua tabel dilindungi Row Level Security (RLS). Kunci `service_role` **tidak boleh** ditaruh di frontend; operasi istimewa dijalankan melalui serverless function di `/api` atau `/netlify/functions`.
-   Kolom sensitif pada `profiles` (`role`, `is_active`) hanya dapat diubah oleh admin. Guru mengubah nama/telepon/avatar lewat RPC `update_my_profile`.
-   Role akun baru selalu `guru`; promosi ke admin dilakukan manual di tabel `profiles`.
-   Validasi radius GPS dan jam kerja dilakukan di sisi server melalui RPC `check_in()` / `check_out()`. Klien hanya menampilkan status; guru tidak bisa menulis absensi langsung ke tabel.

## Struktur Proyek

-   `index.html`: Halaman login untuk guru dan admin.
-   `dashboard.html`: Halaman dashboard untuk guru setelah login, menampilkan status absensi, riwayat, dan agenda.
-   `admin.html`: Panel admin untuk mengelola data dan melihat laporan.
-   `rekap.html`: Halaman rekapitulasi absensi bulanan untuk guru.
-   `/css/style.css`: File styling dasar (styling utama memakai Tailwind via CDN).
-   `/js/supabase.js`: Klien dan konfigurasi untuk koneksi ke Supabase.
-   `/sql/schema.sql`: Skema database untuk instalasi baru.
-   `/sql/hardening.sql`: Patch keamanan untuk instalasi yang sudah berjalan.
-   `/api/admin-create-user.js`: Serverless Function (Vercel) untuk membuat user baru dari panel admin. Endpoint ini memerlukan hak akses admin Supabase.
-   `/netlify/functions/`: Versi Netlify Functions dari endpoint admin di atas.

## Backend (Supabase)

Aplikasi ini menggunakan [Supabase](https://supabase.com) sebagai backend untuk otentikasi, database, dan fungsi serverless. Anda perlu membuat proyek di Supabase dan mengonfigurasi skema database sesuai dengan file `sql/schema.sql`.

**Penting**: Untuk fitur pembuatan user oleh admin, diperlukan sebuah *serverless function* yang berjalan dengan `service_role_key` Supabase. Contoh implementasi untuk Netlify Functions ada di `/api/admin-create-user.js`. Jika Anda menggunakan platform lain (Vercel, dll.), sesuaikan implementasinya. Jika fungsi ini tidak tersedia, aplikasi akan mencoba membuat user melalui `auth.signUp()` biasa, yang mungkin memerlukan konfirmasi email tergantung pada pengaturan proyek Supabase Anda.

## Instalasi & Konfigurasi

1.  **Clone Repositori**: `git clone https://github.com/xcurrate/GPSABSEN.git`
2.  **Buat Proyek Supabase**: Daftar atau login ke [Supabase](https://supabase.com) dan buat proyek baru.
3.  **Skema Database**: Salin dan jalankan query dari `sql/schema.sql` di *SQL Editor* Supabase untuk membuat tabel dan fungsi yang diperlukan. Untuk instalasi yang sudah berjalan, jalankan `sql/hardening.sql` (menutup celah eskalasi role pada profil & trigger signup) selain bagian tabel `leave_requests`, kebijakan RLS, dan fungsi persetujuan pengajuan.
4.  **Konfigurasi Supabase**: 
    - Masuk ke *Project Settings* > *API*.
    - Salin `URL` dan `anon (public) key`.
    - Tempelkan ke dalam file `js/supabase.js`.

    > **Jangan pernah menaruh `service_role key` di `js/supabase.js` atau file frontend mana pun.** Kunci tersebut melewati seluruh RLS dan hanya boleh dipakai sebagai environment variable pada serverless function (lihat langkah 6).
5.  **Buat User Admin**: 
    - Buka *Authentication* di Supabase.
    - Buat user baru secara manual. 
    - Buka tabel `profiles` di *Table Editor* dan ubah `role` user tersebut menjadi `admin`.
6.  **Konfigurasi Netlify Functions (Opsional)**:
    - Jika Anda hosting di Netlify, buat file `netlify.toml` untuk mengarahkan ke direktori functions.
    - Atur environment variables `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di Netlify.
7.  **Jalankan Lokal**: Buka `index.html` di browser Anda.

## Menghindari Jeda Proyek Supabase (Free Plan)

Supabase **Free Plan** otomatis menjeda proyek yang tidak ada aktivitas database selama 7 hari (mis. saat libur panjang). Proyek yang dijeda bisa dipulihkan dalam 90 hari, tetapi lebih baik dicegah.

Repo ini menyertakan workflow `.github/workflows/keepalive.yml` yang mengirim beberapa request ringan ke REST API setiap hari (4x sehari) agar proyek tetap dianggap aktif. Workflow ini tidak mengubah data apa pun.

**Cara mengaktifkan:**

1. Buka **Settings > Secrets and variables > Actions** di repo GitHub.
2. Tambahkan dua nilai bernama `SUPABASE_URL` dan `SUPABASE_ANON_KEY`, boleh di tab **Secrets** maupun **Variables** (keduanya didukung; secret diprioritaskan bila keduanya ada):
   - `SUPABASE_URL` — URL proyek, mis. `https://xxxx.supabase.co` (sama dengan yang ada di `js/supabase.js`).
   - `SUPABASE_ANON_KEY` — `anon (public) key` proyek.
3. Workflow berjalan otomatis sesuai jadwal, dan bisa diuji manual lewat tab **Actions > Supabase Keep-Alive > Run workflow**.

> Cukup gunakan `anon key` (memang publik, aman ditaruh di Variables). Jangan pernah menyimpan `service_role key` di sini.

## Kontribusi

Kontribusi dalam bentuk apapun sangat diterima! Jika Anda menemukan bug atau memiliki ide untuk fitur baru, silakan buat *issue* atau *pull request*.
