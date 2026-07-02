import { useState, useRef, useEffect, useCallback } from 'react'
import { moves as defaultMoves } from '../data/db'
import { getChars, saveChars, resetChars, getCharImg } from '../utils/charStore'
import type { Character } from '../types/character'
import type { Move } from '../types/move'

const EL_COLOR: Record<string, string>   = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee' }
const SLOT_COLOR: Record<string, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee', wish: '#ddaa22', passive: '#666688' }
const SLOT_LABEL: Record<string, string> = { sword: '⚔ 劍槽', gun: '🔫 槍槽', magic: '✦ 法槽', wish: '🌠 願槽', passive: '💠 被動' }

interface Props { onBack: () => void }

export default function Admin({ onBack }: Props) {
  const [chars,  setChars]  = useState<Character[]>(() => getChars())
  const [selId,  setSelId]  = useState(chars[0]?.id ?? '')
  const [tab,    setTab]    = useState<'basic' | 'moves' | 'story'>('basic')
  const importRef = useRef<HTMLInputElement>(null)

  const char  = chars.find(c => c.id === selId)!
  const moves = defaultMoves.filter(m => m.ownerId === selId)

  const update = useCallback((patch: Partial<Character>) => {
    setChars(prev => {
      const next = prev.map(c => c.id === selId ? { ...c, ...patch } : c)
      saveChars(next); return next
    })
  }, [selId])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(chars, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: 'cb_chars.json' }).click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const r = new FileReader()
    r.onload = ev => {
      try { const d: Character[] = JSON.parse(ev.target!.result as string); saveChars(d); setChars(d) }
      catch { alert('JSON 格式錯誤') }
    }
    r.readAsText(file); e.target.value = ''
  }

  const handleReset = () => {
    if (!confirm('還原所有角色到預設值（圖片不會清除）？')) return
    resetChars(); setChars(getChars())
  }

  if (!char) return null

  return (
    <div className="adm">
      {/* ── top bar ── */}
      <div className="adm-bar">
        <span className="adm-bar-title">奇蹟之盤 — 資料編輯器</span>
        <div className="adm-bar-actions">
          <button className="btn sm" onClick={handleExport}>↓ 匯出 JSON</button>
          <label className="btn sm" style={{ cursor: 'pointer' }}>
            ↑ 匯入 JSON
            <input ref={importRef} type="file" accept=".json" onChange={handleImport} hidden />
          </label>
          <button className="btn sm danger" onClick={handleReset}>還原預設</button>
          <button className="btn sm" onClick={onBack}>← 返回</button>
        </div>
      </div>

      <div className="adm-body">
        {/* ── character list ── */}
        <div className="adm-list">
          {chars.map(c => (
            <div key={c.id}
              className={`adm-list-item ${c.id === selId ? 'active' : ''}`}
              onClick={() => { setSelId(c.id); setTab('basic') }}
            >
              <CharPortrait id={c.id} size={38} />
              <div className="adm-list-text">
                <div className="adm-list-name" style={{ color: EL_COLOR[c.element] }}>{c.name}</div>
                <div className="adm-list-sub">{c.title}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── editor ── */}
        <div className="adm-editor">
          <div className="adm-tabs">
            {(['basic', 'moves', 'story'] as const).map(t => (
              <button key={t} className={`adm-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {{ basic: '基本資料', moves: '招式圖片', story: '故事 & 插圖' }[t]}
              </button>
            ))}
          </div>

          <div className="adm-panel">
            {tab === 'basic' && <BasicTab char={char} onUpdate={update} />}
            {tab === 'moves' && <MovesTab moves={moves} />}
            {tab === 'story' && <StoryTab char={char} onUpdate={update} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CharPortrait (exported for CharSelect) ───────────────────────────────────

export function CharPortrait({ id, size = 48, style: sx }: {
  id: string; size?: number; style?: React.CSSProperties
}) {
  const [src, setSrc] = useState(() => getCharImg(id) ?? `/chars/${id}.webp`)
  useEffect(() => { setSrc(getCharImg(id) ?? `/chars/${id}.webp`) }, [id])
  return (
    <img src={src} width={size} height={size} alt=""
      style={{ borderRadius: 6, objectFit: 'cover', background: '#111122', flexShrink: 0, ...sx }}
      onError={() => setSrc('data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==')}
    />
  )
}

// ─── BasicTab ─────────────────────────────────────────────────────────────────

function BasicTab({ char, onUpdate }: { char: Character; onUpdate: (p: Partial<Character>) => void }) {
  return (
    <div className="adm-basic">
      <div className="adm-section">
        <div className="adm-section-label">角色圖片</div>
        <ImageCrop storageKey={`cb_img_${char.id}`} previewSize={220} outSize={600} />
      </div>

      <div className="adm-section">
        <div className="adm-section-label">基本資料</div>
        <div className="adm-field-grid">
          <Field label="名稱"  value={char.name}   onChange={v => onUpdate({ name: v })} />
          <Field label="稱號"  value={char.title}  onChange={v => onUpdate({ title: v })} />
          <label className="adm-field">
            <span>元素</span>
            <select className="adm-select" value={char.element}
              onChange={e => onUpdate({ element: e.target.value as Character['element'] })}>
              <option value="sword">⚔ 劍</option>
              <option value="gun">🔫 槍</option>
              <option value="magic">✦ 法</option>
            </select>
          </label>
          <label className="adm-field">
            <span>性別</span>
            <select className="adm-select" value={char.gender}
              onChange={e => onUpdate({ gender: e.target.value as Character['gender'] })}>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </label>
        </div>
      </div>

      <div className="adm-section">
        <div className="adm-section-label">數值</div>
        <div className="adm-stats">
          {(['hp','atk','def','spd'] as const).map(stat => (
            <div key={stat} className="adm-stat-row">
              <span className="adm-stat-label">{stat.toUpperCase()}</span>
              <input type="range" min={1} max={20} className="adm-slider"
                value={char[stat]}
                onChange={e => onUpdate({ [stat]: +e.target.value } as Partial<Character>)} />
              <input type="number" min={1} max={20} className="adm-stat-num"
                value={char[stat]}
                onChange={e => onUpdate({ [stat]: Math.min(20, Math.max(1, +e.target.value)) } as Partial<Character>)} />
            </div>
          ))}
        </div>
      </div>

      <div className="adm-section">
        <div className="adm-section-label">招式名稱</div>
        <div className="adm-field-grid">
          {([
            ['moveNameSword', '⚔ 劍槽'], ['moveNameGun', '🔫 槍槽'],
            ['moveNameMagic', '✦ 法槽'], ['moveNameWish', '🌠 願槽'],
            ['passiveName',   '💠 被動'],
          ] as const).map(([key, label]) => (
            <Field key={key} label={label} value={(char as any)[key] ?? ''}
              onChange={v => onUpdate({ [key]: v } as Partial<Character>)} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MovesTab ─────────────────────────────────────────────────────────────────

function MovesTab({ moves }: { moves: Move[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [rev,    setRev]    = useState<Record<string, number>>({})
  const markSaved = (id: string) => setRev(r => ({ ...r, [id]: (r[id] ?? 0) + 1 }))

  if (!moves.length) return <div className="adm-empty">此角色沒有招式資料</div>
  return (
    <div className="adm-moves">
      {moves.map(m => (
        <div key={m.id} className="adm-move" style={{ borderLeftColor: SLOT_COLOR[m.slot] }}>

          {/* header row */}
          <div className="adm-move-hdr">
            <span style={{ color: SLOT_COLOR[m.slot], fontWeight: 800 }}>{SLOT_LABEL[m.slot]}</span>
            <b style={{ color: '#d8dcf4' }}>{m.name}</b>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MiniImg storageKey={`cb_move_img_${m.id}`} size={38} rev={rev[m.id] ?? 0} />
              <button className="btn sm" onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                {openId === m.id ? '收起' : '設定圖片'}
              </button>
            </div>
          </div>

          <div className="adm-move-desc">{m.description || '—'}</div>

          <div className="adm-move-stats">
            {m.powerRatio != null && <Pill label="威力" val={`×${m.powerRatio}`} />}
            {m.hitRate    != null && <Pill label="命中" val={`${Math.round(m.hitRate * 100)}%`} />}
            {m.critRate   != null && <Pill label="爆擊" val={`${Math.round(m.critRate * 100)}%`} />}
            {m.condition  != null && <Pill label="條件" val={`${m.condition}`} />}
            {m.cooldown   != null && <Pill label="CD"   val={`${m.cooldown}回`} />}
            {m.scope      != null && <Pill label="範圍" val={m.scope === 'group' ? '群體' : '單體'} />}
          </div>

          {openId === m.id && (
            <div className="adm-move-crop">
              <ImageCrop
                storageKey={`cb_move_img_${m.id}`}
                previewSize={200}
                outSize={640}
                onSave={() => markSaved(m.id)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function MiniImg({ storageKey, size, rev }: { storageKey: string; size: number; rev: number }) {
  // rev is only used to re-trigger render after save
  void rev
  const src = localStorage.getItem(storageKey)
  return src
    ? <img src={src} width={size} height={size}
        style={{ borderRadius: 5, objectFit: 'cover', border: '1px solid #333355', flexShrink: 0 }} alt="" />
    : <div style={{
        width: size, height: size, borderRadius: 5, background: 'var(--bg3)',
        border: '1px dashed #252538', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 9, color: '#252540', flexShrink: 0
      }}>無圖</div>
}

// ─── StoryTab ─────────────────────────────────────────────────────────────────

function StoryTab({ char, onUpdate }: { char: Character; onUpdate: (p: Partial<Character>) => void }) {
  return (
    <div className="adm-story">
      <div className="adm-section">
        <div className="adm-section-label">故事插圖</div>
        <ImageCrop storageKey={`cb_story_img_${char.id}`} previewSize={240} outSize={800} />
      </div>

      <div className="adm-section">
        <div className="adm-section-label">故事文字 / 背景設定</div>
        <textarea
          className="adm-story-textarea"
          placeholder={`在這裡填寫 ${char.name} 的背景故事、設定或台詞...`}
          value={char.story ?? ''}
          onChange={e => onUpdate({ story: e.target.value })}
          rows={14}
        />
      </div>
    </div>
  )
}

// ─── ImageCrop — visual crop-box UI ──────────────────────────────────────────

interface CropProps {
  storageKey: string
  previewSize?: number   // unused (kept for API compat)
  outSize?: number       // output image px
  onSave?: () => void
}

type CropDragState =
  | { mode: 'move'; startMx: number; startMy: number; startBx: number; startBy: number }
  | { mode: 'resize'; corner: 'tl'|'tr'|'bl'|'br'
      ax: number; ay: number; dw: number; dh: number; imgX: number; imgY: number }
  | null

// disp: rendered image bounds within fixed-height stage (coords relative to stage origin)
// box:  crop box position/size relative to rendered image (NOT stage)
function ImageCrop({ storageKey, outSize = 256, onSave }: CropProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [saved,  setSaved]  = useState<string | null>(() => localStorage.getItem(storageKey))
  const [disp,   setDisp]   = useState({ w: 0, h: 0, imgX: 0, imgY: 0 })
  const [box,    setBox]    = useState({ x: 0, y: 0, size: 100 })

  const imgRef   = useRef<HTMLImageElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef  = useRef<CropDragState>(null)
  const boxRef   = useRef(box)
  const dispRef  = useRef(disp)
  useEffect(() => { boxRef.current  = box  }, [box])
  useEffect(() => { dispRef.current = disp }, [disp])

  useEffect(() => {
    setSaved(localStorage.getItem(storageKey))
    setImgSrc(null)
  }, [storageKey])

  // compute object-fit:contain rendered size + letterbox offsets
  const initBox = useCallback(() => {
    const img = imgRef.current; const stage = stageRef.current
    if (!img || !stage || !img.naturalWidth) return
    const sw = stage.offsetWidth, sh = stage.offsetHeight
    const nw = img.naturalWidth,  nh = img.naturalHeight
    let rw: number, rh: number, imgX: number, imgY: number
    if (nw / nh >= sw / sh) {
      rw = sw;           rh = sw / nw * nh; imgX = 0;              imgY = (sh - rh) / 2
    } else {
      rh = sh;           rw = sh / nh * nw; imgX = (sw - rw) / 2; imgY = 0
    }
    const d = { w: Math.round(rw), h: Math.round(rh), imgX: Math.round(imgX), imgY: Math.round(imgY) }
    setDisp(d); dispRef.current = d
    const sz = Math.round(Math.min(rw, rh) * 0.7)
    const nb = { x: Math.round((rw - sz) / 2), y: Math.round((rh - sz) / 2), size: sz }
    setBox(nb); boxRef.current = nb
  }, [])

  useEffect(() => {
    const MIN = 40
    const onMove = (e: MouseEvent) => {
      const ds = dragRef.current; if (!ds) return
      const stage = stageRef.current; if (!stage) return

      if (ds.mode === 'move') {
        const dx = e.clientX - ds.startMx
        const dy = e.clientY - ds.startMy
        const { w, h } = dispRef.current
        const b = boxRef.current
        const nb = { ...b,
          x: Math.max(0, Math.min(w - b.size, ds.startBx + dx)),
          y: Math.max(0, Math.min(h - b.size, ds.startBy + dy)),
        }
        setBox(nb); boxRef.current = nb
      } else {
        const rect = stage.getBoundingClientRect()
        // convert mouse → rendered-image coordinates
        const mx = e.clientX - rect.left - ds.imgX
        const my = e.clientY - rect.top  - ds.imgY
        const { corner, ax, ay, dw, dh } = ds
        let nb: { x: number; y: number; size: number }
        if (corner === 'br') {
          const sz = Math.max(MIN, Math.min(mx - ax, my - ay, dw - ax, dh - ay))
          nb = { x: ax, y: ay, size: sz }
        } else if (corner === 'tl') {
          const sz = Math.max(MIN, Math.min(ax - mx, ay - my, ax, ay))
          nb = { x: ax - sz, y: ay - sz, size: sz }
        } else if (corner === 'tr') {
          const sz = Math.max(MIN, Math.min(mx - ax, ay - my, dw - ax, ay))
          nb = { x: ax, y: ay - sz, size: sz }
        } else {
          const sz = Math.max(MIN, Math.min(ax - mx, my - ay, ax, dh - ay))
          nb = { x: ax - sz, y: ay, size: sz }
        }
        setBox(nb); boxRef.current = nb
      }
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  const startMove = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const b = boxRef.current
    dragRef.current = { mode: 'move', startMx: e.clientX, startMy: e.clientY, startBx: b.x, startBy: b.y }
  }

  const startResize = (corner: 'tl'|'tr'|'bl'|'br') => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const b = boxRef.current; const d = dispRef.current
    const ax = corner === 'br' || corner === 'tr' ? b.x : b.x + b.size
    const ay = corner === 'br' || corner === 'bl' ? b.y : b.y + b.size
    dragRef.current = { mode: 'resize', corner, ax, ay, dw: d.w, dh: d.h, imgX: d.imgX, imgY: d.imgY }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImgSrc(ev.target!.result as string)
    reader.readAsDataURL(file); e.target.value = ''
  }

  const handleSave = () => {
    const img = imgRef.current; if (!img || !img.naturalWidth) return
    const d = dispRef.current; if (!d.w || !d.h) return
    const b = boxRef.current
    const sx = img.naturalWidth / d.w, sy = img.naturalHeight / d.h
    const cv = document.createElement('canvas'); cv.width = outSize; cv.height = outSize
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, b.x * sx, b.y * sy, b.size * sx, b.size * sy, 0, 0, outSize, outSize)
    const dataUrl = cv.toDataURL('image/webp', 0.95)
    localStorage.setItem(storageKey, dataUrl)
    setSaved(dataUrl); setImgSrc(null); onSave?.()
  }

  const handleRemove = () => { localStorage.removeItem(storageKey); setSaved(null) }

  const { x, y, size } = box
  const { w, imgX, imgY } = disp
  // crop box in stage coords
  const absX = imgX + x, absY = imgY + y

  return (
    <div className="img-crop">
      {!imgSrc && (
        <div className="img-crop-saved">
          <div className="img-crop-preview-box">
            {saved
              ? <img src={saved} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <div className="img-crop-empty">尚無圖片</div>
            }
          </div>
          <div className="img-crop-actions">
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              {saved ? '更換圖片' : '上傳圖片'}
              <input type="file" accept="image/*" onChange={handleFile} hidden />
            </label>
            {saved && <button className="btn sm danger" onClick={handleRemove}>移除</button>}
          </div>
        </div>
      )}

      {imgSrc && (
        <div className="img-crop-tool">
          <div ref={stageRef} className="img-crop-stage">
            {/* image fills stage via object-fit:contain (CSS) */}
            <img ref={imgRef} src={imgSrc} className="img-crop-src"
              alt="" onLoad={initBox} draggable={false} />

            {w > 0 && <>
              {/* 4 masks inside rendered image, outside crop box */}
              <div className="crop-mask" style={{ top: imgY, left: imgX, width: disp.w, height: y }} />
              <div className="crop-mask" style={{ top: absY + size, left: imgX, width: disp.w, height: disp.h - y - size }} />
              <div className="crop-mask" style={{ top: absY, left: imgX, width: x, height: size }} />
              <div className="crop-mask" style={{ top: absY, left: absX + size, width: disp.w - x - size, height: size }} />

              <div className="crop-box"
                style={{ left: absX, top: absY, width: size, height: size }}
                onMouseDown={startMove}
              >
                <div className="crop-grid-h" style={{ top: '33.3%' }} />
                <div className="crop-grid-h" style={{ top: '66.6%' }} />
                <div className="crop-grid-v" style={{ left: '33.3%' }} />
                <div className="crop-grid-v" style={{ left: '66.6%' }} />
                <div className="crop-handle crop-h-tl" onMouseDown={startResize('tl')} />
                <div className="crop-handle crop-h-tr" onMouseDown={startResize('tr')} />
                <div className="crop-handle crop-h-bl" onMouseDown={startResize('bl')} />
                <div className="crop-handle crop-h-br" onMouseDown={startResize('br')} />
              </div>
            </>}
          </div>

          <div className="img-crop-hint">拖曳框內移動位置 · 拖曳四角縮放大小</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className="btn primary sm" onClick={handleSave}>裁切並儲存</button>
            <button className="btn sm" onClick={() => setImgSrc(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      <input className="adm-input" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function Pill({ label, val }: { label: string; val: string }) {
  return (
    <span className="adm-pill">
      <span className="adm-pill-label">{label}</span>
      <b>{val}</b>
    </span>
  )
}
