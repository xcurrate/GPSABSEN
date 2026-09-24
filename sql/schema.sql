-- ============================================================
-- SISTEM ABSENSI GURU - DATABASE SCHEMA
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: profiles (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  nip TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'guru' CHECK (role IN ('admin', 'guru')),
  subject TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: settings (konfigurasi sekolah & absensi)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- TABLE: attendance (data absensi guru)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  latitude_out DECIMAL(10, 8),
  longitude_out DECIMAL(11, 8),
  status TEXT NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir', 'terlambat', 'izin', 'sakit', 'alfa')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================================
-- TABLE: schedules (agenda/rencana kegiatan)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  event_type TEXT DEFAULT 'agenda' CHECK (event_type IN ('agenda', 'libur', 'rapat', 'kegiatan')),
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: leave_requests (pengajuan izin/sakit oleh guru)
-- Pengajuan dipisahkan dari attendance agar status kehadiran hanya
-- terbentuk setelah diverifikasi admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('izin', 'sakit')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 5),
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT leave_request_date_range CHECK (end_date >= start_date)
);

-- ============================================================
-- INDEXES untuk performa
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_event_date ON public.schedules(event_date);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_dates ON public.leave_requests(user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- POLICIES: profiles
CREATE POLICY "Profiles visible to authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- POLICIES: attendance
CREATE POLICY "Users can view own attendance"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can insert own attendance"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update attendance"
  ON public.attendance FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete attendance"
  ON public.attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- POLICIES: settings
CREATE POLICY "Settings readable by authenticated"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admin can modify settings"
  ON public.settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- POLICIES: schedules
CREATE POLICY "Schedules readable by authenticated"
  ON public.schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage schedules"
  ON public.schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- POLICIES: leave requests
CREATE POLICY "Users can view own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can create own leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'menunggu' AND reviewed_by IS NULL AND reviewed_at IS NULL);

CREATE POLICY "Users can cancel pending own leave requests"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'menunggu');

CREATE POLICY "Admin can update leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- FUNCTION: auto-create profile after signup
-- ============================================================
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
    COALESCE(NEW.raw_user_meta_data->>'role', 'guru'),
    NULLIF(NEW.raw_user_meta_data->>'nip', ''),
    NULLIF(NEW.raw_user_meta_data->>'subject', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE((NEW.raw_user_meta_data->>'is_active')::BOOLEAN, true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger after user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: update updated_at otomatis
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER schedules_updated_at BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- FUNCTION: import absensi oleh admin tanpa service role frontend
-- ============================================================
CREATE OR REPLACE FUNCTION public.import_attendance_as_admin(attendance_rows JSONB)
RETURNS INTEGER AS $$
DECLARE
  imported_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Hanya admin yang diizinkan import absensi'
      USING ERRCODE = '42501';
  END IF;

  IF attendance_rows IS NULL OR jsonb_typeof(attendance_rows) <> 'array' THEN
    RAISE EXCEPTION 'attendance_rows wajib berupa array';
  END IF;

  IF jsonb_array_length(attendance_rows) = 0 THEN
    RAISE EXCEPTION 'Tidak ada data absensi untuk diimport';
  END IF;

  IF jsonb_array_length(attendance_rows) > 1000 THEN
    RAISE EXCEPTION 'Maksimal 1000 baris per import';
  END IF;

  WITH parsed_rows AS (
    SELECT *
    FROM jsonb_to_recordset(attendance_rows) AS row_data(
      user_id UUID,
      date DATE,
      check_in_time TIME,
      check_out_time TIME,
      status TEXT,
      notes TEXT
    )
  ), upserted_rows AS (
    INSERT INTO public.attendance (
      user_id,
      date,
      check_in_time,
      check_out_time,
      status,
      notes
    )
    SELECT
      user_id,
      date,
      check_in_time,
      check_out_time,
      COALESCE(status, 'hadir'),
      notes
    FROM parsed_rows
    ON CONFLICT (user_id, date) DO UPDATE SET
      check_in_time = EXCLUDED.check_in_time,
      check_out_time = EXCLUDED.check_out_time,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes
    RETURNING 1
  )
  SELECT COUNT(*) INTO imported_count FROM upserted_rows;

  RETURN imported_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.import_attendance_as_admin(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_attendance_as_admin(JSONB) TO authenticated;

-- Menyetujui/menolak pengajuan dan mencatat izin/sakit pada hari kerja.
-- Data check-in yang sudah ada tidak pernah ditimpa oleh proses persetujuan.
CREATE OR REPLACE FUNCTION public.review_leave_request(request_id UUID, decision TEXT, note TEXT DEFAULT NULL)
RETURNS public.leave_requests AS $$
DECLARE
  request_row public.leave_requests;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Hanya admin yang diizinkan meninjau pengajuan' USING ERRCODE = '42501';
  END IF;
  IF decision NOT IN ('disetujui', 'ditolak') THEN RAISE EXCEPTION 'Keputusan tidak valid'; END IF;

  UPDATE public.leave_requests
  SET status = decision, admin_note = NULLIF(trim(note), ''), reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = request_id AND status = 'menunggu'
  RETURNING * INTO request_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan atau sudah ditinjau'; END IF;

  IF decision = 'disetujui' THEN
    INSERT INTO public.attendance (user_id, date, status, notes)
    SELECT request_row.user_id, day::DATE, request_row.leave_type,
      'Pengajuan ' || request_row.leave_type || ' disetujui: ' || request_row.reason
    FROM generate_series(request_row.start_date, request_row.end_date, INTERVAL '1 day') AS day
    WHERE EXTRACT(ISODOW FROM day) BETWEEN 1 AND 5
    ON CONFLICT (user_id, date) DO NOTHING;
  END IF;
  RETURN request_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.review_leave_request(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_leave_request(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- SEED DATA: Settings default
-- ============================================================
INSERT INTO public.settings (key, value, description) VALUES
  ('school_name', 'SMA Negeri 1 Contoh', 'Nama sekolah'),
  ('school_address', 'Jl. Pendidikan No. 1, Kota Contoh', 'Alamat sekolah'),
  ('school_latitude', '-6.200000', 'Latitude lokasi sekolah'),
  ('school_longitude', '106.816666', 'Longitude lokasi sekolah'),
  ('attendance_radius', '100', 'Radius absensi dalam meter'),
  ('check_in_start', '06:30', 'Jam mulai absensi masuk'),
  ('check_in_end', '08:00', 'Jam batas absensi masuk'),
  ('check_out_start', '14:00', 'Jam mulai absensi pulang'),
  ('check_out_end', '17:00', 'Jam batas absensi pulang')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- NOTE: Untuk seed user, buat melalui Supabase Auth Dashboard
-- atau gunakan SQL berikut setelah membuat user di Auth:
-- 
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'UUID_ADMIN_ANDA';
-- ============================================================
  
