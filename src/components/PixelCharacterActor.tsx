import './PixelCharacterActor.css'
import { getCharacterBImageFacing, getUrlByKey } from '../utils/charStore'

type PixelPose = 'front' | 'side' | 'back'
type PixelAction = 'idle' | 'walk' | 'mining'

interface Props { charId: string; pose?: PixelPose; action?: PixelAction; face?: 'left' | 'right' }

export default function PixelCharacterActor({ charId, pose = 'side', action = 'idle', face = 'right' }: Props) {
  const key = pose === 'front' ? `cb_extra_a_img_${charId}` : pose === 'back' ? `cb_extra_c_img_${charId}` : `cb_extra_b_img_${charId}`
  const image = getUrlByKey(key) ?? getUrlByKey(`cb_extra_a_img_${charId}`) ?? getUrlByKey(`cb_img_${charId}`)
  const sourceFacing = pose === 'side' ? getCharacterBImageFacing(charId) : face
  const flip = sourceFacing !== face
  return <div className={`pixel-actor pixel-${action}`} aria-label={`8-bit ${action}`}>
    <div className="pixel-actor-stage">
      {image ? <img className="pixel-actor-character" src={image} alt="" style={{ transform: `scaleX(${flip ? -1 : 1})` }} /> : <span className="pixel-actor-missing">8 BIT</span>}
      {action === 'mining' && <><i className="pixel-pickaxe">⛏</i><div className="pixel-rock">◆</div><div className="pixel-sparks"><b /> <b /> <b /> <b /></div></>}
    </div>
  </div>
}
