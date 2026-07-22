import {useEffect,useState} from 'react'
import {getStoryChapters,type StoryChapter} from '../utils/storyStore'
import {subscribeStoryChapters} from './storyRepository'

export function useStoryPlaybackController(previewChapters?:StoryChapter[]){
  const[chapters,setChapters]=useState(()=>previewChapters??getStoryChapters())
  useEffect(()=>previewChapters?undefined:subscribeStoryChapters(setChapters),[previewChapters])
  return{chapters,setChapters}
}
