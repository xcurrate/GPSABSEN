# 📍 Sistem Absensi Guru Berbasis GPS

Sistem absensi guru berbasis lokasi GPS yang modern, mobile-friendly, dan production-ready.

---

## 📁 Struktur Folder

```
absensi-guru/
├── index.html          → Halaman login
├── dashboard.html      → Dashboard guru (absensi GPS)
├── rekap.html          → Rekap absensi guru
├── admin.html          → Panel admin lengkap
├── netlify.toml        → Konfigurasi Netlify
├── vercel.json         → Konfigurasi Vercel
├── js/
│   └── supabase.js     → Konfigurasi & helper Supabase
└── sql/
    └── schema.sql      → SQL schema lengkap
```

---

## ⚙️ LANGKAH 1: Setup Supabase

### 1.1 Buat Project Supabase
1. Buka https://supabase.com dan login
2. Klik **New Project**
3. Isi nama project, password database, pilih region (Singapore untuk Indonesia)
4. Tunggu project selesai dibuat (~2 menit)

### 1.2 Jalankan SQL Schema
1. Di Supabase Dashboard, klik **SQL Editor** di sidebar kiri
2. Buka file `sql/schema.sql`
3. Copy-paste seluruh isi file ke SQL Editor
4. Klik **Run** (atau tekan Ctrl+Enter)
5. Pastikan tidak ada error merah

### 1.3 Konfigurasi Auth
1. Di Supabase, buka **Authentication → Settings**
2. Pada **Email**, pastikan "Enable Email Signup" aktif
3. Opsional: matikan "Confirm email" untuk kemudahan testing
   - Authentication → Settings → Email → matikan "Enable email confirmations"

### 1.4 Dapatkan API Keys
1. Di Supabase, buka **Settings → API**
2. Salin:
   - **Project URL** (contoh: `https://abcdefgh.supabase.co`)
   - **anon/public key** (key yang panjang)

### 1.5 Buat Akun Admin Pertama
**Cara A - Melalui Supabase Dashboard (Direkomendasikan):**
1. Buka **Authentication → Users**
2. Klik **Add User** → **Create New User**
3. Isi email dan password admin
4. Centang "Auto Confirm User"
5. Klik **Create User**
6. Salin UUID user yang baru dibuat
7. Buka **SQL Editor**, jalankan:
   ```sql
   UPDATE public.profiles 
   SET role = 'admin', full_name = 'Nama Admin Anda'
   WHERE id = 'UUID-YANG-DISALIN';
   ```

**Cara B - Daftar lewat aplikasi lalu set admin:**
1. Buka aplikasi, klik register (atau gunakan endpoint signup)
2. Buka Supabase SQL Editor, jalankan:
   ```sql
   UPDATE public.profiles SET role = 'admin' 
   WHERE id = (SELECT id FROM auth.users WHERE email = 'email-admin@anda.com');
   ```

---

## 🔧 LANGKAH 2: Konfigurasi Aplikasi

Buka file `js/supabase.js` dan ganti 2 baris ini:

```javascript
const SUPABASE_URL = 'https://XXXXXXXXXXXXXXXX.supabase.co';
// Ganti dengan Project URL Anda

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXXXXXXXXXXXXX';
// Ganti dengan anon/public key Anda
```

---

## 🚀 LANGKAH 3: Deploy

### Deploy ke Netlify (Gratis, Direkomendasikan)

**Cara 1 - Drag & Drop (Paling Mudah):**
1. Buka https://netlify.com dan login/daftar
2. Di dashboard, ada kotak "Want to deploy a new site without connecting to Git?"
3. **Drag & drop seluruh folder** `absensi-guru` ke kotak tersebut
4. Tunggu upload selesai
5. Netlify otomatis memberikan URL seperti `https://random-name.netlify.app`
6. Selesai! Akses URL tersebut

**Cara 2 - Via GitHub:**
1. Upload folder ke GitHub repository baru
2. Di Netlify dashboard, klik **New site from Git**
3. Hubungkan GitHub dan pilih repository
4. Build settings: kosongkan semua (static site)
5. Klik **Deploy site**

### Deploy ke Vercel

**Cara 1 - Vercel CLI:**
```bash
npm install -g vercel
cd absensi-guru
vercel
# Ikuti instruksi, pilih "Static Site"
```

**Cara 2 - Via Dashboard:**
1. Buka https://vercel.com dan login
2. Klik **New Project** → **Import Git Repository**
3. Pilih repository → Deploy

---

## 💻 LANGKAH 4: Jalankan Lokal

Tidak perlu instalasi apapun. Cukup:

**Windows:**
- Klik kanan folder `absensi-guru` → Open with → klik `index.html`
- ATAU gunakan VS Code dengan extension **Live Server**

**VS Code Live Server (Direkomendasikan):**
1. Install VS Code Extension "Live Server" oleh Ritwick Dey
2. Klik kanan `index.html` → **Open with Live Server**
3. Otomatis buka di `http://localhost:5500`

**Python (jika ada Python):**
```bash
cd absensi-guru
python -m http.server 8080
# Buka http://localhost:8080
```

**Node.js (jika ada Node):**
```bash
cd absensi-guru
npx serve .
# Buka URL yang muncul
```

> ⚠️ **PENTING**: GPS hanya berfungsi di HTTPS atau localhost. Di file:// tidak akan berfungsi.
> Gunakan Live Server atau deploy ke Netlify/Vercel untuk tes GPS.

---

## 📱 Cara Pakai Aplikasi

### Untuk Admin:
1. Login dengan akun admin
2. Otomatis diarahkan ke **Admin Panel**
3. Tersedia 4 tab:
   - **📋 Absensi**: Lihat semua absensi, filter tanggal, export CSV
   - **👨‍🏫 Guru**: Tambah/edit/hapus data guru
   - **📅 Agenda**: Buat agenda/rencana kegiatan
   - **⚙️ Pengaturan**: Atur lokasi sekolah, radius, jam absensi

### Untuk Guru:
1. Login dengan akun guru
2. Otomatis diarahkan ke **Dashboard**
3. Izinkan akses lokasi GPS ketika diminta browser
4. Jika dalam radius sekolah: tombol "Absen Masuk" aktif
5. Klik **Absen Masuk** untuk mencatat kehadiran
6. Klik **Absen Pulang** saat akan pulang
7. Lihat riwayat & rekap di halaman **Rekap**

---

## 🔒 Cara Tambah Guru Baru

### Via Admin Panel (Direkomendasikan):
1. Login sebagai admin → Tab **Guru** → **Tambah**
2. Isi nama, email, password, mata pelajaran
3. Klik **Simpan**
4. Guru akan menerima email konfirmasi (jika konfirmasi diaktifkan)
5. Berikan email dan password ke guru yang bersangkutan

### Via Supabase Dashboard:
1. Authentication → Users → Add User
2. Isi email dan password
3. Di SQL Editor:
   ```sql
   UPDATE public.profiles 
   SET full_name = 'Nama Guru', subject = 'Mata Pelajaran', nip = 'NIP'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'email@guru.com');
   ```

---

## 🗺️ Setup Koordinat Sekolah

1. Login sebagai admin
2. Buka **Admin → Pengaturan**
3. Scroll ke bagian **Lokasi GPS Sekolah**
4. Klik **"Gunakan Lokasi Saya Sekarang"** (jika Anda sedang di sekolah)
   - ATAU cari koordinat sekolah di Google Maps:
     - Buka Google Maps, cari sekolah
     - Klik titik sekolah
     - Koordinat muncul di bawah (contoh: -6.234567, 106.812345)
5. Atur **Radius Absensi** (default: 100 meter)
6. Klik **Simpan**

---

## 📊 Fitur Lengkap

| Fitur | Guru | Admin |
|-------|------|-------|
| Login/Logout | ✅ | ✅ |
| Absen Masuk GPS | ✅ | - |
| Absen Pulang GPS | ✅ | - |
| Validasi Radius | ✅ | - |
| Lihat Agenda Hari Ini | ✅ | ✅ |
| Rekap Absensi Pribadi | ✅ | - |
| Export CSV Pribadi | ✅ | - |
| Statistik Bulanan | ✅ | - |
| Lihat Semua Absensi | - | ✅ |
| Export CSV Semua Guru | - | ✅ |
| CRUD Data Guru | - | ✅ |
| CRUD Agenda | - | ✅ |
| Atur Lokasi Sekolah | - | ✅ |
| Atur Radius & Jam | - | ✅ |
| Hapus Data Absensi | - | ✅ |

---

## ❓ Troubleshooting

**GPS tidak muncul / tombol absen tidak aktif:**
- Pastikan akses lokasi diberikan di browser
- Coba di Chrome/Firefox terbaru
- GPS hanya berfungsi di HTTPS atau localhost

**Login gagal:**
- Pastikan email sudah dikonfirmasi (cek inbox)
- Pastikan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` sudah benar di `js/supabase.js`

**Error "new row violates row-level security":**
- Pastikan SQL schema sudah dijalankan lengkap di Supabase
- Pastikan RLS policies sudah ter-create

**Halaman admin tidak bisa diakses:**
- Pastikan akun sudah di-set sebagai `role = 'admin'` di tabel profiles

---

## 📞 Stack Teknologi

- **Frontend**: HTML5, TailwindCSS CDN, Vanilla JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security)
- **GPS**: Browser Geolocation API + Haversine Formula
- **Hosting**: Netlify / Vercel (Static Hosting)
- **Auth**: Supabase Auth (JWT + Session)

---

*Dibuat dengan ❤️ untuk kemudahan absensi guru Indonesia*
