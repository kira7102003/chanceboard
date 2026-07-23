import type { StoryChapter } from '../utils/storyStore'
import { storageUrl, uploadBlob } from '../utils/supabase'

const CLOUD_PATH='story-chapters.json'
const LEGACY_KEY='cb_story_chapters'
let cache:StoryChapter[]=[]
let initialized=false
let saveTimer:ReturnType<typeof setTimeout>|null=null
let saveQueue:Promise<void>=Promise.resolve()
const listeners=new Set<(chapters:StoryChapter[])=>void>()
const clone=(chapters:StoryChapter[])=>structuredClone(chapters)

export function readStoryChapters():StoryChapter[]{return clone(cache)}
export function subscribeStoryChapters(listener:(chapters:StoryChapter[])=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
function publish(){const value=readStoryChapters();listeners.forEach(listener=>listener(value))}

export async function initializeStoryRepository(defaults:StoryChapter[]):Promise<boolean>{
  if(initialized)return true
  try{
    const response=await fetch(`${storageUrl(CLOUD_PATH)}?t=${Date.now()}`,{cache:'no-store'})
    if(!response.ok)throw new Error(`HTTP ${response.status}`)
    const cloud=await response.json() as StoryChapter[]
    if(!Array.isArray(cloud)||!cloud.length)throw new Error('Invalid story data')
    cache=cloud
    initialized=true
    publish()
    return true
  }catch(error){
    console.warn('[storyRepository] cloud story unavailable; defaults are memory-only',error)
    try{
      const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)??'null') as StoryChapter[]|null
      cache=Array.isArray(legacy)&&legacy.length?clone(legacy):clone(defaults)
    }catch{cache=clone(defaults)}
    initialized=true
    publish()
    return false
  }
}

export function replaceStoryChapters(chapters:StoryChapter[]):void{
  cache=clone(chapters)
  initialized=true
  publish()
  if(saveTimer)clearTimeout(saveTimer)
  saveTimer=setTimeout(()=>{void flushStoryChapters()},700)
}

/** Immediately persist the latest complete chapter snapshot. Calls are
 * serialized so an older upload can never finish after and overwrite a newer
 * FLOW MAP edit. */
export function flushStoryChapters():Promise<void>{
  if(saveTimer){clearTimeout(saveTimer);saveTimer=null}
  const snapshot=clone(cache)
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{
    try{await uploadBlob(CLOUD_PATH,new Blob([JSON.stringify(snapshot)],{type:'application/json'}));localStorage.removeItem(LEGACY_KEY)}
    catch(error){console.error('[storyRepository] cloud save failed',error)}
  })
  return saveQueue
}
