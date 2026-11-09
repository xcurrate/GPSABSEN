// Logika bersama untuk endpoint admin (create/update user).
// Dipakai oleh adapter Vercel (api/*.js) dan Netlify (netlify/functions/*.js)
// agar tidak ada dua implementasi yang bisa divergen.
//
// Kontrak: setiap fungsi menerima { headers, body } dengan header sudah
// dinormalisasi ke huruf kecil, dan body sudah di-parse menjadi objek.
// Mengembalikan { status, json }.

const DEFAULT_SUPABASE_URL = 'https://sbxtfqidotarniglzban.supabase.co';

function isSchoolEmail(email) {
  return /^[^\s@]+@[^\s@]+\.sch\.id$/i.test(String(email || '').trim());
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

function getConfig() {
  return {
    projectUrl: process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function getAuthenticatedAdmin(headers, projectUrl, serviceRole) {
  const token = String(headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Missing access token', status: 401 };

  const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: serviceRole, Authorization: `Bearer ${token}` },
  });
  const user = await userRes.json().catch(() => null);
  if (!userRes.ok || !user?.id) {
    return { error: 'Sesi admin tidak valid atau sudah kedaluwarsa', status: 401 };
  }

  const profileRes = await fetch(
    `${projectUrl}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`,
    { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } }
  );
  const profiles = await profileRes.json().catch(() => []);
  if (!profileRes.ok || profiles[0]?.role !== 'admin') {
    return { error: 'Hanya admin yang diizinkan', status: 403 };
  }

  return { user };
}

async function handleCreateUser({ headers, body }) {
  const { projectUrl, serviceRole } = getConfig();
  if (!serviceRole) {
    return { status: 500, json: { error: 'SUPABASE_SERVICE_ROLE_KEY belum tersedia. Fallback signup publik akan dicoba dari browser.' } };
  }

  const auth = await getAuthenticatedAdmin(headers, projectUrl, serviceRole);
  if (auth.error) return { status: auth.status, json: { error: auth.error } };

  const { email, password, full_name, role = 'guru', nip = null, subject = null, phone = null, is_active = true } = body || {};
  if (!email || !password || !full_name) return { status: 400, json: { error: 'email, password, full_name wajib diisi' } };
  if (!isSchoolEmail(email)) return { status: 400, json: { error: 'Email harus menggunakan domain sekolah berakhiran .sch.id, contoh nama@mitakbr.sch.id.' } };

  const normalizedEmail = email.trim().toLowerCase();
  const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
    body: JSON.stringify({ email: normalizedEmail, password, email_confirm: true, user_metadata: { full_name, role, nip, subject, phone, is_active } }),
  });
  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok) return { status: createRes.status, json: { error: createData?.msg || createData?.message || 'Gagal membuat user baru' } };

  await fetch(`${projectUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id: createData.id, full_name, nip, subject, phone, role, is_active }]),
  });

  return { status: 200, json: { id: createData.id } };
}

async function handleUpdateUser({ headers, body }) {
  const { projectUrl, serviceRole } = getConfig();
  if (!serviceRole) {
    return { status: 500, json: { error: 'SUPABASE_SERVICE_ROLE_KEY belum tersedia di server' } };
  }

  const auth = await getAuthenticatedAdmin(headers, projectUrl, serviceRole);
  if (auth.error) return { status: auth.status, json: { error: auth.error } };

  const { user_id, password, full_name, nip = null, subject = null, phone = null, role, is_active } = body || {};
  if (!user_id) return { status: 400, json: { error: 'user_id wajib diisi' } };
  if (password !== undefined && password !== '' && !isValidPassword(password)) {
    return { status: 400, json: { error: 'Password baru minimal 6 karakter' } };
  }

  const profile = {
    full_name: String(full_name || '').trim(),
    nip: nip ? String(nip).trim() : null,
    subject: subject ? String(subject).trim() : null,
    phone: phone ? String(phone).trim() : null,
    role: role === 'admin' ? 'admin' : 'guru',
    is_active: Boolean(is_active),
  };
  if (!profile.full_name) return { status: 400, json: { error: 'Nama wajib diisi' } };

  if (password) {
    const updateAuthRes = await fetch(`${projectUrl}/auth/v1/admin/users/${encodeURIComponent(user_id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify({ password }),
    });
    const updateAuthData = await updateAuthRes.json().catch(() => ({}));
    if (!updateAuthRes.ok) {
      return { status: updateAuthRes.status, json: { error: updateAuthData?.msg || updateAuthData?.message || 'Gagal mengubah password' } };
    }
  }

  const profileRes = await fetch(`${projectUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user_id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, Prefer: 'return=minimal' },
    body: JSON.stringify(profile),
  });
  if (!profileRes.ok) {
    const profileData = await profileRes.text().catch(() => '');
    return { status: profileRes.status, json: { error: profileData || 'Gagal memperbarui profil guru' } };
  }

  return { status: 200, json: { id: user_id, password_updated: Boolean(password) } };
}

module.exports = { handleCreateUser, handleUpdateUser };
