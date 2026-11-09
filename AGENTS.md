# AGENTS.md

Panduan singkat untuk agen/engineer yang bekerja di repositori ini.

## Ringkasan Proyek

Aplikasi absensi guru berbasis GPS. Frontend statis (HTML + Tailwind via CDN) dengan backend Supabase (Postgres, Auth, RLS, RPC). Serverless function untuk operasi istimewa admin tersedia dalam dua varian: `/api/*.js` (Vercel, ESM `export default`) dan `/netlify/functions/*.js` (Netlify, CJS `exports.handler`).

Halaman:
- `index.html` — login & daftar.
- `dashboard.html` — dashboard guru (absensi, riwayat, agenda, pengajuan izin/sakit).
- `admin.html` — panel admin (absensi, rekap, guru, agenda, pengajuan, settings).
- `rekap.html` — rekap bulanan guru.

Logika bersama ada di `js/supabase.js` (klien Supabase + helper: `getTodayStr`, `getCurrentTime`, `calculateDistance`, `formatDate`, `showToast`, `setLoading`, dll). Helper ini dipakai global oleh semua halaman, jadi jangan di-rename tanpa memperbarui seluruh HTML.

## Aturan Penting

- JANGAN pernah menaruh `service_role key` di file frontend mana pun. Kunci itu hanya boleh ada sebagai environment variable pada serverless function.
- Validasi radius GPS dan jam kerja di klien hanyalah lapisan UX. Pengaman data ada di sisi server: absensi guru WAJIB lewat RPC `check_in()` / `check_out()` (yang memvalidasi radius & jam di server). Jangan kembali memakai `insert`/`update` langsung ke tabel `attendance` dari dashboard guru — RLS sudah melarangnya.
- Helper bersama `csvEscape()` dan `fetchAllRows()` ada di `js/supabase.js`. Gunakan `csvEscape` untuk semua ekspor CSV dan `fetchAllRows` untuk query list yang bisa melebihi 1000 baris (batas default PostgREST).
- Setiap kali mengubah skema, perbarui `sql/schema.sql` (instalasi baru) DAN `sql/hardening.sql` (patch untuk instalasi berjalan).
- Gunakan `getTodayStr()` untuk tanggal, jangan `new Date().toISOString()` (bug zona waktu UTC vs WIB).
- Definisi "hadir" sekarang konsisten: `hadir + terlambat` dihitung sebagai kehadiran di `dashboard.html`, `rekap.html`, dan `admin.html`.

## Konvensi Kode

- Bahasa komentar/UI: Indonesia.
- Frontend: JavaScript vanilla, tanpa build step, tanpa `package.json`.
- Escaping HTML manual (`escapeHtml`) dan CSV manual (`csvEscape`) — selalu gunakan saat menyisipkan data pengguna.

## Catatan Teknis / Utang Teknis

- Logika endpoint admin ada di satu tempat: `lib/admin-core.js` (CommonJS). `api/*.js` (Vercel, ESM) dan `netlify/functions/*.js` (Netlify, CJS) hanyalah adapter tipis yang memanggil core. Jangan menduplikasi logika ke adapter.
- Frontend memanggil endpoint admin lewat `/api/<nama>` untuk kedua platform (Netlify diarahkan oleh `netlify.toml`).
- Helper bersama (`escapeHtml`, `csvEscape`, `fetchAllRows`, `getTodayStr`, `formatDate`, `formatTime`) ada di `js/supabase.js`; semua halaman sudah memuatnya. Jangan definisikan ulang di halaman.
- Semua handler `onclick`/`onchange` dan `getElementById` di `admin.html`/`dashboard.html`/`rekap.html` sudah diverifikasi cocok dengan fungsi/elemen yang ada.
- Tidak ada test, linter, atau CI di repo ini.

## Verifikasi

Tidak ada tooling build. Untuk menguji: buka `index.html` di browser dengan koneksi Supabase aktif, atau jalankan static server sederhana (mis. `python3 -m http.server`).
