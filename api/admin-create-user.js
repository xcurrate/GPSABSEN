function isSchoolEmail(email) {
  return /^[^\s@]+@[^\s@]+\.sch\.id$/i.test(String(email || '').trim());
}

async function getAuthenticatedAdmin(req, projectUrl, serviceRole) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Missing access token', status: 401 };

  const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: serviceRole, Authorization: `Bearer ${token}` },
  });
  const user = await userRes.json().catch(() => null);
  if (!userRes.ok || !user?.id) return { error: 'Sesi admin tidak valid atau sudah kedaluwarsa', status: 401 };

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, password, full_name, role = 'guru', nip = null, subject = null, phone = null, is_active = true } = req.body || {};
    if (!email || !password || !full_name) return res.status(400).json({ error: 'email, password, full_name wajib diisi' });
    if (!isSchoolEmail(email)) return res.status(400).json({ error: 'Email harus menggunakan domain sekolah berakhiran .sch.id, contoh nama@mitakbr.sch.id.' });

    const projectUrl = process.env.SUPABASE_URL || 'https://sbxtfqidotarniglzban.supabase.co';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum tersedia. Fallback signup publik akan dicoba dari browser.' });
    }

    const auth = await getAuthenticatedAdmin(req, projectUrl, serviceRole);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const normalizedEmail = email.trim().toLowerCase();
    const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify({ email: normalizedEmail, password, email_confirm: true, user_metadata: { full_name, role, nip, subject, phone, is_active } }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return res.status(createRes.status).json({ error: createData?.msg || createData?.message || 'Gagal membuat user baru' });

    await fetch(`${projectUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id: createData.id, full_name, nip, subject, phone, role, is_active }]),
    });

    return res.status(200).json({ id: createData.id });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unexpected error' });
  }
}
