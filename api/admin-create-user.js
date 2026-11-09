import adminCore from '../lib/admin-core.js';

const { handleCreateUser } = adminCore;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers || {})) headers[key.toLowerCase()] = value;
    const { status, json } = await handleCreateUser({ headers, body: req.body || {} });
    return res.status(status).json(json);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unexpected error' });
  }
}
