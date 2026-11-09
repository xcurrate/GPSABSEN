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
