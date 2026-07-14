import type { ImgHTMLAttributes } from 'react'
import { getThumbByKey, getUrlByKey } from '../utils/charStore'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  storageKey: string
  thumbWidth?: number
}

export default function GameImage({ storageKey, thumbWidth = 240, onError, ...props }: Props) {
  const original = getUrlByKey(storageKey)
  const thumbnail = getThumbByKey(storageKey, thumbWidth)
  if (!thumbnail) return null
  return <img {...props} src={thumbnail} decoding="async" loading={props.loading ?? 'lazy'}
    onError={event => {
      if (original && event.currentTarget.src !== original) event.currentTarget.src = original
      else onError?.(event)
    }} />
}
