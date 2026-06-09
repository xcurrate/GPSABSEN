const parseJwt = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const token = (event.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Missing access token' }) };
    const userId = parseJwt(token).sub;

    const projectUrl = process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!projectUrl || !serviceRole) return { statusCode: 500, body: JSON.stringify({ error: 'Konfigurasi Supabase service role belum tersedia' }) };

    const adminCheck = await fetch(`${projectUrl}/rest/v1/profiles?select=role&id=eq.${userId}`, {
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
    });
    const adminData = await adminCheck.json();
    if (!adminCheck.ok || adminData[0]?.role !== 'admin') return { statusCode: 403, body: JSON.stringify({ error: 'Hanya admin yang diizinkan' }) };

    const { attendance } = JSON.parse(event.body || '{}');
    const rows = normalizeAttendanceRows(attendance);
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
      return { statusCode: importRes.status, body: JSON.stringify({ error: importData?.message || importData?.msg || importData?.error || 'Gagal import absensi' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ imported: rows.length }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Unexpected error' }) };
  }
};
