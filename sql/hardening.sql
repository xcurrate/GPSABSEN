-- ============================================================
-- PATCH KEAMANAN UNTUK INSTALASI YANG SUDAH BERJALAN
-- Jalankan di Supabase SQL Editor.
--
-- Menutup dua celah eskalasi hak akses:
--   1. Guru bisa mengubah kolom `role`/`is_active` di profilnya sendiri
--      lewat policy "Users can update own profile" tanpa batas kolom.
--   2. Trigger handle_new_user mempercayai `role` dari metadata pendaftaran,
--      sehingga pendaftaran publik bisa membuat akun admin.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Trigger signup: role SELALU 'guru' (abaikan metadata klien)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.sch\.id$' THEN
    RAISE EXCEPTION 'Email harus menggunakan domain sekolah berakhiran .sch.id, contoh nama@mitakbr.sch.id';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, nip, subject, phone, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'guru',
    NULLIF(NEW.raw_user_meta_data->>'nip', ''),
    NULLIF(NEW.raw_user_meta_data->>'subject', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 2. Ganti self-update profil dengan RPC aman (hanya kolom non-sensitif)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.update_my_profile(
  new_full_name TEXT DEFAULT NULL,
  new_phone TEXT DEFAULT NULL,
  new_avatar_url TEXT DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  updated public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Harus login' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET
    full_name = COALESCE(NULLIF(trim(new_full_name), ''), full_name),
    phone = COALESCE(new_phone, phone),
    avatar_url = COALESCE(new_avatar_url, avatar_url)
  WHERE id = auth.uid()
  RETURNING * INTO updated;

  RETURN updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 3. Pastikan tidak ada user non-admin yang sudah menaikkan role-nya
-- ------------------------------------------------------------
-- Tinjau manual daftar berikut dan turunkan role yang tidak seharusnya admin:
--   SELECT id, full_name, role FROM public.profiles WHERE role = 'admin';


-- ============================================================
-- 4. Validasi absensi di sisi server
-- Menutup celah: guru sebelumnya bisa insert/update baris attendance-nya
-- sendiri lewat REST (memalsukan tanggal, status, atau lokasi di luar radius).
-- Sekarang guru wajib lewat RPC check_in()/check_out().
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admin can update attendance" ON public.attendance;

CREATE POLICY "Admin can insert attendance"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update attendance"
  ON public.attendance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.check_in(
  in_lat DOUBLE PRECISION,
  in_lng DOUBLE PRECISION,
  at_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS public.attendance AS $$
DECLARE
  s_lat DOUBLE PRECISION;
  s_lng DOUBLE PRECISION;
  radius DOUBLE PRECISION;
  start_t TIME;
  end_t TIME;
  local_date DATE;
  local_time TIME;
  dist DOUBLE PRECISION;
  final_status TEXT;
  result public.attendance;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Harus login' USING ERRCODE = '42501';
  END IF;

  SELECT value::DOUBLE PRECISION INTO s_lat FROM public.settings WHERE key = 'school_latitude';
  SELECT value::DOUBLE PRECISION INTO s_lng FROM public.settings WHERE key = 'school_longitude';
  SELECT COALESCE(value::DOUBLE PRECISION, 100) INTO radius FROM public.settings WHERE key = 'attendance_radius';
  SELECT value::TIME INTO start_t FROM public.settings WHERE key = 'check_in_start';
  SELECT value::TIME INTO end_t FROM public.settings WHERE key = 'check_in_end';

  s_lat := COALESCE(s_lat, -6.200000);
  s_lng := COALESCE(s_lng, 106.816666);
  radius := COALESCE(radius, 100);
  start_t := COALESCE(start_t, TIME '06:30');
  end_t := COALESCE(end_t, TIME '08:00');

  dist := 6371000 * 2 * asin(sqrt(
    power(sin(radians(in_lat - s_lat) / 2), 2) +
    cos(radians(s_lat)) * cos(radians(in_lat)) *
    power(sin(radians(in_lng - s_lng) / 2), 2)
  ));

  IF dist > radius THEN
    RAISE EXCEPTION 'Anda berada %m dari sekolah. Absen hanya dalam radius %m.', round(dist), round(radius) USING ERRCODE = '22023';
  END IF;

  local_date := (at_time AT TIME ZONE 'Asia/Jakarta')::date;
  local_time := (at_time AT TIME ZONE 'Asia/Jakarta')::time;

  IF local_time < start_t THEN
    RAISE EXCEPTION 'Absen belum dibuka. Mulai jam %.', to_char(start_t, 'HH24:MI') USING ERRCODE = '22023';
  END IF;

  final_status := CASE WHEN local_time > end_t THEN 'terlambat' ELSE 'hadir' END;

  INSERT INTO public.attendance (user_id, date, check_in_time, latitude, longitude, status)
  VALUES (auth.uid(), local_date, local_time, in_lat, in_lng, final_status)
  ON CONFLICT (user_id, date) DO NOTHING
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anda sudah absen hari ini' USING ERRCODE = '23505';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.check_in(DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in(DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_out(
  in_lat DOUBLE PRECISION,
  in_lng DOUBLE PRECISION,
  at_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS public.attendance AS $$
DECLARE
  s_lat DOUBLE PRECISION;
  s_lng DOUBLE PRECISION;
  radius DOUBLE PRECISION;
  local_date DATE;
  local_time TIME;
  dist DOUBLE PRECISION;
  result public.attendance;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Harus login' USING ERRCODE = '42501';
  END IF;

  SELECT value::DOUBLE PRECISION INTO s_lat FROM public.settings WHERE key = 'school_latitude';
  SELECT value::DOUBLE PRECISION INTO s_lng FROM public.settings WHERE key = 'school_longitude';
  SELECT COALESCE(value::DOUBLE PRECISION, 100) INTO radius FROM public.settings WHERE key = 'attendance_radius';
  s_lat := COALESCE(s_lat, -6.200000);
  s_lng := COALESCE(s_lng, 106.816666);
  radius := COALESCE(radius, 100);

  dist := 6371000 * 2 * asin(sqrt(
    power(sin(radians(in_lat - s_lat) / 2), 2) +
    cos(radians(s_lat)) * cos(radians(in_lat)) *
    power(sin(radians(in_lng - s_lng) / 2), 2)
  ));

  IF dist > radius THEN
    RAISE EXCEPTION 'Anda berada %m dari sekolah. Absen pulang hanya dalam radius %m.', round(dist), round(radius) USING ERRCODE = '22023';
  END IF;

  local_date := (at_time AT TIME ZONE 'Asia/Jakarta')::date;
  local_time := (at_time AT TIME ZONE 'Asia/Jakarta')::time;

  UPDATE public.attendance
  SET check_out_time = local_time, latitude_out = in_lat, longitude_out = in_lng
  WHERE user_id = auth.uid() AND date = local_date AND check_in_time IS NOT NULL
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Belum ada absen masuk hari ini' USING ERRCODE = '22023';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.check_out(DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_out(DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ) TO authenticated;

-- Catatan: pastikan frontend (dashboard.html) versi terbaru sudah memakai
-- sb.rpc('check_in', ...) dan sb.rpc('check_out', ...). Tanpa update frontend,
-- tombol absen guru akan gagal karena policy insert/update langsung dicabut.
