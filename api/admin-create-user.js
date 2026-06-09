function isSchoolEmail(email) {
  return /^[^\s@]+@[^\s@]+\.sch\.id$/i.test(String(email || '').trim());
}

function parseJwt(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Missing access token' });
    const userId = parseJwt(token).sub;

    const { email, password, full_name, role = 'guru', nip = null, subject = null, phone = null, is_active = true } = req.body || {};
    if (!email || !password || !full_name) return res.status(400).json({ error: 'email, password, full_name wajib diisi' });
    if (!isSchoolEmail(email)) return res.status(400).json({ error: 'Email harus menggunakan domain sekolah berakhiran .sch.id, contoh nama@mitakbr.sch.id.' });

    const projectUrl = process.env.SUPABASE_URL || 'https://sbxtfqidotarniglzban.supabase.co';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum tersedia. Fallback signup publik akan dicoba dari browser.' });
    }

    const adminCheck = await fetch(`${projectUrl}/rest/v1/profiles?select=role&id=eq.${userId}`, { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } });
    const adminData = await adminCheck.json();
    if (!adminCheck.ok || adminData[0]?.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang diizinkan' });

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
