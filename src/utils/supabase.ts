import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
export const BUCKET   = 'chanceboard'

export function storageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

export async function uploadDataUrl(path: string, dataUrl: string): Promise<string> {
  const blob = await fetch(dataUrl).then(r => r.blob())

  // In production: get a presigned upload token from the Netlify function
  // (service role key lives server-side; anon key cannot write to this bucket)
  const signResp = await fetch('/.netlify/functions/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!signResp.ok) {
    const err = await signResp.json().catch(() => ({}))
    throw new Error(err.error ?? `sign-upload HTTP ${signResp.status}`)
  }
  const { token } = await signResp.json()

  // Upload directly to Supabase using the signed token (bypasses RLS, no size limit)
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, blob, {
    contentType: blob.type || 'image/webp',
  })
  if (error) throw error
  return storageUrl(path)
}

export async function deleteStorageFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}
