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
- Validasi radius GPS dan jam kerja di klien hanyalah lapisan UX. Pengaman data wajib di sisi server/RLS.
- Setiap kali mengubah skema, perbarui `sql/schema.sql` (instalasi baru) DAN `sql/hardening.sql` (patch untuk instalasi berjalan).
- Gunakan `getTodayStr()` untuk tanggal, jangan `new Date().toISOString()` (bug zona waktu UTC vs WIB).
- Definisi "hadir" harus konsisten: di `dashboard.html` dan `rekap.html` status `hadir` dihitung terpisah dari `terlambat`; di `admin.html` keduanya digabung. Perhatikan konteks sebelum mengubah.

## Konvensi Kode

- Bahasa komentar/UI: Indonesia.
- Frontend: JavaScript vanilla, tanpa build step, tanpa `package.json`.
- Escaping HTML manual (`escapeHtml`) dan CSV manual (`csvEscape`) — selalu gunakan saat menyisipkan data pengguna.

## Catatan Teknis / Utang Teknis

- Dua implementasi serverless (`api/` dan `netlify/functions/`) bisa divergen. Jika memperbaiki satu, perbaiki keduanya.
- `getAdminFunctionEndpoint` mendeteksi Netlify lewat `hostname.includes('netlify.app')` (gagal di domain kustom).
- Query list tidak dipaginasi; PostgREST default max-rows 1000 sehingga laporan besar bisa terpotong.
- Ekspor CSV di `rekap.html` dan `exportRekapGuruCSV` belum memakai `csvEscape`.
- Beberapa tombol admin (edit/delete absensi, edit/delete agenda) memanggil fungsi yang perlu diverifikasi masih ada.
- Tidak ada test, linter, atau CI di repo ini.

## Verifikasi

Tidak ada tooling build. Untuk menguji: buka `index.html` di browser dengan koneksi Supabase aktif, atau jalankan static server sederhana (mis. `python3 -m http.server`).
