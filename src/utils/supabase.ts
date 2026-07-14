import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
export const BUCKET   = 'chanceboard'

export function storageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

async function signAndUpload(path: string, blob: Blob): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('請先登入後再上傳')
  const signResp = await fetch('/.netlify/functions/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ path, contentType: blob.type, size: blob.size }),
  })
  if (!signResp.ok) {
    const err = await signResp.json().catch(() => ({}))
    throw new Error(err.error ?? `sign-upload HTTP ${signResp.status}`)
  }
  const { token } = await signResp.json()
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, blob, {
    contentType: blob.type,
  })
  if (error) throw error
  return storageUrl(path)
}

export async function uploadDataUrl(path: string, dataUrl: string): Promise<string> {
  const blob = await fetch(dataUrl).then(r => r.blob())
  return signAndUpload(path, blob)
}

export async function uploadBlob(path: string, blob: Blob): Promise<string> {
  return signAndUpload(path, blob)
}

export async function deleteStorageFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}
