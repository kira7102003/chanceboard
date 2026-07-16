const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export const handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  const { OPENAI_API_KEY, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!OPENAI_API_KEY) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: '尚未在 Netlify 設定 OPENAI_API_KEY' }) }
  try {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: '請先登入管理帳號' }) }
    const userResp = await fetch(`${VITE_SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_ROLE_KEY } })
    if (!userResp.ok) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: '登入已失效' }) }
    const user = await userResp.json()
    const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map(value => value.trim()).filter(Boolean)
    if (admins.length && !admins.includes(user.email)) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: '僅限管理員使用' }) }

    const input = JSON.parse(event.body ?? '{}')
    const jobName = String(input.jobName ?? '').trim().slice(0, 40)
    const detail = String(input.detail ?? '').trim().slice(0, 300)
    if (!jobName) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '缺少工作名稱' }) }
    const prompt = `Create one square 8-bit pixel art game icon for a dark gothic chess fantasy RPG. Activity: ${jobName}. ${detail}. Centered single readable symbol, antique gold and steel highlights, deep navy-black background, ornate thin chess-style frame, strong silhouette, no people, no letters, no words, no numbers, no UI mockup. Crisp pixel edges, polished premium game asset.`
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt, size: '1024x1024', quality: 'medium', output_format: 'webp' }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error?.message ?? `OpenAI HTTP ${response.status}`)
    const image = result.data?.[0]?.b64_json
    if (!image) throw new Error('OpenAI 沒有回傳圖片資料')
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ dataUrl: `data:image/webp;base64,${image}` }) }
  } catch (error) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error instanceof Error ? error.message : '圖片生成失敗' }) }
  }
}
