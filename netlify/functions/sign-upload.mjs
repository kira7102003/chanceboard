const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'chanceboard'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    const { path } = JSON.parse(event.body ?? '{}')
    if (!path) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing path' }) }

    // Use REST API directly to avoid WebSocket dependency
    const resp = await fetch(
      `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}?upsert=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
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
