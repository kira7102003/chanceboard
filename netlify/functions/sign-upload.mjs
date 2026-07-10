import { createClient } from '@supabase/supabase-js'

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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true })
    if (error) throw error

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({ signedUrl: data.signedUrl, token: data.token, path: data.path }),
    }
  } catch (e) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) }
  }
}
