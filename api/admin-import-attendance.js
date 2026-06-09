function parseJwt(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
}

const allowedStatuses = new Set(['hadir', 'terlambat', 'izin', 'sakit', 'alfa']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}:\d{2}$/;

function normalizeAttendanceRows(rows) {
  if (!Array.isArray(rows)) throw new Error('attendance wajib berupa array');
  if (rows.length === 0) throw new Error('Tidak ada data absensi untuk diimport');
  if (rows.length > 1000) throw new Error('Maksimal 1000 baris per import');

  return rows.map((row, index) => {
    const rowNo = index + 1;
    const userId = String(row?.user_id || '').trim();
    const date = String(row?.date || '').trim();
    const status = String(row?.status || '').trim().toLowerCase();
    const checkIn = row?.check_in_time || null;
    const checkOut = row?.check_out_time || null;

    if (!uuidPattern.test(userId)) throw new Error(`Baris import ${rowNo}: user_id tidak valid`);
    if (!datePattern.test(date)) throw new Error(`Baris import ${rowNo}: tanggal tidak valid`);
    if (!allowedStatuses.has(status)) throw new Error(`Baris import ${rowNo}: status tidak valid`);
    if (checkIn !== null && !timePattern.test(String(checkIn))) throw new Error(`Baris import ${rowNo}: jam masuk tidak valid`);
    if (checkOut !== null && !timePattern.test(String(checkOut))) throw new Error(`Baris import ${rowNo}: jam pulang tidak valid`);

    return {
      user_id: userId,
      date,
      check_in_time: checkIn,
      check_out_time: checkOut,
      status,
      notes: row?.notes ? String(row.notes) : null,
    };
  });
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { message: text }; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Missing access token' });
    const userId = parseJwt(token).sub;

    const projectUrl = process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!projectUrl || !serviceRole) return res.status(500).json({ error: 'Konfigurasi Supabase service role belum tersedia' });

    const adminCheck = await fetch(`${projectUrl}/rest/v1/profiles?select=role&id=eq.${userId}`, {
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
    });
    const adminData = await adminCheck.json();
    if (!adminCheck.ok || adminData[0]?.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang diizinkan' });

    const rows = normalizeAttendanceRows(req.body?.attendance);
    const importRes = await fetch(`${projectUrl}/rest/v1/attendance?on_conflict=user_id,date`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (!importRes.ok) {
      const importData = await readJsonResponse(importRes);
      return res.status(importRes.status).json({ error: importData?.message || importData?.msg || importData?.error || 'Gagal import absensi' });
    }

    return res.status(200).json({ imported: rows.length });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unexpected error' });
  }
}
