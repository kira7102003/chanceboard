const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'chanceboard'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in Netlify env vars.' }),
    }
  }

  try {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) }
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_KEY },
    })
    if (!userResp.ok) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid session' }) }
    const user = await userResp.json()
    const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map(v => v.trim()).filter(Boolean)
    if (admins.length && !admins.includes(user.email)) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Admin only' }) }
    }

    const { path, contentType, size } = JSON.parse(event.body ?? '{}')
    if (!path) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing path' }) }
    if (!/^(?:(?:chars|moves|story|backgrounds|cards)\/[a-zA-Z0-9_.-]+\.(?:webp|json)|chars\.json|moves\.json|image-manifest\.json)$/.test(path)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid path' }) }
    }
    if (typeof size !== 'number' || size < 1 || size > 8 * 1024 * 1024) {
      return { statusCode: 413, headers: CORS, body: JSON.stringify({ error: 'File too large' }) }
    }
    if (!['image/webp', 'application/json'].includes(contentType)) {
      return { statusCode: 415, headers: CORS, body: JSON.stringify({ error: 'Unsupported file type' }) }
    }

    // Use REST API directly to avoid WebSocket dependency
    const resp = await fetch(
      `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'x-upsert': 'true',
        },
        body: JSON.stringify({ upsert: true }),
      }
    )

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.message ?? `Supabase ${resp.status}`)
    }

    const data = await resp.json()
    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ signedUrl: data.url, token: data.token, path: data.path ?? path }),
    }
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) }
  }
}
