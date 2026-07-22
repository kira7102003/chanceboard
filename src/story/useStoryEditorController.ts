import {useCallback,useEffect,useState} from 'react'
import {getStoryChapters,saveStoryChapters,type StoryChapter} from '../utils/storyStore'
import {subscribeStoryChapters} from './storyRepository'

export function useStoryEditorController(){
  const[chapters,setChapters]=useState(getStoryChapters)
  useEffect(()=>subscribeStoryChapters(setChapters),[])
  const updateChapter=useCallback((index:number,patch:Partial<StoryChapter>)=>{
    const current=getStoryChapters(),next=current.map((chapter,i)=>i===index?{...chapter,...patch}:chapter)
    setChapters(next)
    saveStoryChapters(next)
  },[])
  return{chapters,updateChapter}
}
