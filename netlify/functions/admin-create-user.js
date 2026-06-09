const isSchoolEmail = (email) => /^[^\s@]+@[^\s@]+\.sch\.id$/i.test(String(email || '').trim());
const parseJwt = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const token = (event.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Missing access token' }) };
    const userId = parseJwt(token).sub;

    const { email, password, full_name, role = 'guru', nip = null, subject = null, phone = null, is_active = true } = JSON.parse(event.body || '{}');
    if (!email || !password || !full_name) return { statusCode: 400, body: JSON.stringify({ error: 'email, password, full_name wajib diisi' }) };
    if (!isSchoolEmail(email)) return { statusCode: 400, body: JSON.stringify({ error: 'Email harus menggunakan domain sekolah berakhiran .sch.id, contoh nama@mitakbr.sch.id.' }) };

    const projectUrl = process.env.SUPABASE_URL || 'https://sbxtfqidotarniglzban.supabase.co';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole) {
      return { statusCode: 500, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY belum tersedia. Fallback signup publik akan dicoba dari browser.' }) };
    }

    const adminCheck = await fetch(`${projectUrl}/rest/v1/profiles?select=role&id=eq.${userId}`, { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } });
    const adminData = await adminCheck.json();
    if (!adminCheck.ok || adminData[0]?.role !== 'admin') return { statusCode: 403, body: JSON.stringify({ error: 'Hanya admin yang diizinkan' }) };

    const normalizedEmail = email.trim().toLowerCase();
    const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
      body: JSON.stringify({ email: normalizedEmail, password, email_confirm: true, user_metadata: { full_name, role, nip, subject, phone, is_active } }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return { statusCode: createRes.status, body: JSON.stringify({ error: createData?.msg || createData?.message || 'Gagal membuat user' }) };

    await fetch(`${projectUrl}/rest/v1/profiles`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id: createData.id, full_name, nip, subject, phone, role, is_active }]),
    });

    return { statusCode: 200, body: JSON.stringify({ id: createData.id }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Unexpected error' }) };
  }
};
