import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
export const BUCKET   = 'chanceboard'

export function storageUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

export async function uploadDataUrl(path: string, dataUrl: string): Promise<string> {
  const res  = await fetch(dataUrl)
  const blob = await res.blob()
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/webp',
    upsert: true,
  })
  if (error) throw error
  return storageUrl(path)
}

export async function deleteStorageFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}
