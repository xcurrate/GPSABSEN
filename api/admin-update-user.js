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
    const projectUrl = process.env.SUPABASE_URL || 'https://sbxtfqidotarniglzban.supabase.co';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum tersedia di server' });
    }

    const auth = await getAuthenticatedAdmin(req, projectUrl, serviceRole);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { user_id, password, full_name, nip = null, subject = null, phone = null, role, is_active } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id wajib diisi' });
    if (password !== undefined && password !== '' && (typeof password !== 'string' || password.length < 6)) {
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
    }

    const profile = {
      full_name: String(full_name || '').trim(),
      nip: nip ? String(nip).trim() : null,
      subject: subject ? String(subject).trim() : null,
      phone: phone ? String(phone).trim() : null,
      role: role === 'admin' ? 'admin' : 'guru',
      is_active: Boolean(is_active),
    };
    if (!profile.full_name) return res.status(400).json({ error: 'Nama wajib diisi' });

    if (password) {
      const updateAuthRes = await fetch(`${projectUrl}/auth/v1/admin/users/${encodeURIComponent(user_id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ password }),
      });
      const updateAuthData = await updateAuthRes.json().catch(() => ({}));
      if (!updateAuthRes.ok) {
        return res.status(updateAuthRes.status).json({
          error: updateAuthData?.msg || updateAuthData?.message || 'Gagal mengubah password',
        });
      }
    }

    const profileRes = await fetch(`${projectUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user_id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(profile),
    });
    const profileData = await profileRes.text();
    if (!profileRes.ok) return res.status(profileRes.status).json({ error: profileData || 'Gagal memperbarui profil guru' });

    return res.status(200).json({ id: user_id, password_updated: Boolean(password) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unexpected error' });
  }
}
