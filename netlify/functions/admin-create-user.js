const { handleCreateUser } = require('../../lib/admin-core.js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    const headers = {};
    for (const [key, value] of Object.entries(event.headers || {})) headers[key.toLowerCase()] = value;

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

    const { status, json } = await handleCreateUser({ headers, body });
    return { statusCode: status, body: JSON.stringify(json) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Unexpected error' }) };
  }
};
