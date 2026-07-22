import {useCallback,useEffect,useState} from 'react'
import {getStoryChapters,saveStoryChapters,type StoryChapter} from '../utils/storyStore'
import {subscribeStoryChapters} from './storyRepository'

export function useStoryEditorController(){
  const[chapters,setChapters]=useState(getStoryChapters)
  useEffect(()=>subscribeStoryChapters(setChapters),[])
  const updateChapter=useCallback((index:number,patch:Partial<StoryChapter>)=>{
    setChapters(current=>{const next=current.map((chapter,i)=>i===index?{...chapter,...patch}:chapter);saveStoryChapters(next);return next})
  },[])
  return{chapters,updateChapter}
}
