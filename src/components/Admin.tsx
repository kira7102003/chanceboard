import { useState, useRef, useEffect, useCallback } from 'react'
import { moves as defaultMoves } from '../data/db'
import { getChars, saveChars, resetChars, getCharImg, saveCharImg, removeCharImg } from '../utils/charStore'
import type { Character } from '../types/character'
import type { Move } from '../types/move'

const EL_COLOR: Record<string, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee' }
const SLOT_COLOR: Record<string, string> = { sword: '#e87733', gun: '#22cc77', magic: '#9955ee', wish: '#ddaa22', passive: '#666688' }
const SLOT_LABEL: Record<string, string> = { sword: '⚔ 劍槽', gun: '🔫 槍槽', magic: '✦ 法槽', wish: '🌠 願槽', passive: '💠 被動' }
const PREVIEW = 260

interface Props { onBack: () => void }

export default function Admin({ onBack }: Props) {
  const [chars, setChars] = useState<Character[]>(() => getChars())
  const [selId, setSelId]   = useState(chars[0]?.id ?? '')
  const [tab, setTab]       = useState<'basic' | 'moves' | 'story'>('basic')
  const importRef = useRef<HTMLInputElement>(null)

  const char  = chars.find(c => c.id === selId)!
  const moves = defaultMoves.filter(m => m.ownerId === selId)

  const update = useCallback((patch: Partial<Character>) => {
    setChars(prev => {
      const next = prev.map(c => c.id === selId ? { ...c, ...patch } : c)
      saveChars(next)
      return next
    })
  }, [selId])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(chars, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'cb_chars.json' })
    a.click(); URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data: Character[] = JSON.parse(ev.target!.result as string)
        saveChars(data); setChars(data)
      } catch { alert('JSON 格式錯誤') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleReset = () => {
    if (!confirm('還原所有角色到預設值（圖片不會清除）？')) return
    resetChars()
    setChars(getChars())
  }

  const selectChar = (id: string) => { setSelId(id); setTab('basic') }

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
              onClick={() => selectChar(c.id)}
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
                {{ basic: '基本資料', moves: '招式', story: '故事' }[t]}
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

// ─── CharPortrait (shared, also exported) ────────────────────────────────────

export function CharPortrait({ id, size = 48, style: extraStyle }: {
  id: string; size?: number; style?: React.CSSProperties
}) {
  const [src, setSrc] = useState<string>(() => getCharImg(id) ?? `/chars/${id}.webp`)
  useEffect(() => { setSrc(getCharImg(id) ?? `/chars/${id}.webp`) }, [id])

  return (
    <img src={src} width={size} height={size}
      style={{ borderRadius: 6, objectFit: 'cover', background: '#111122',
               flexShrink: 0, ...extraStyle }}
      onError={() => setSrc('data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==')}
      alt=""
    />
  )
}

// ─── BasicTab ─────────────────────────────────────────────────────────────────

function BasicTab({ char, onUpdate }: { char: Character; onUpdate: (p: Partial<Character>) => void }) {
  return (
    <div className="adm-basic">
      {/* Image */}
      <div className="adm-section">
        <div className="adm-section-label">角色圖片</div>
        <ImageCrop charId={char.id} />
      </div>

      {/* Identity */}
      <div className="adm-section">
        <div className="adm-section-label">基本資料</div>
        <div className="adm-field-grid">
          <Field label="名稱" value={char.name}    onChange={v => onUpdate({ name: v })} />
          <Field label="稱號" value={char.title}   onChange={v => onUpdate({ title: v })} />
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

      {/* Stats */}
      <div className="adm-section">
        <div className="adm-section-label">數值</div>
        <div className="adm-stats">
          {(['hp','atk','def','spd'] as const).map(stat => (
            <div key={stat} className="adm-stat-row">
              <span className="adm-stat-label">{stat.toUpperCase()}</span>
              <input type="range" min={1} max={20}
                value={char[stat]}
                onChange={e => onUpdate({ [stat]: +e.target.value } as Partial<Character>)}
                className="adm-slider"
              />
              <input type="number" min={1} max={20}
                value={char[stat]}
                onChange={e => onUpdate({ [stat]: Math.min(20, Math.max(1, +e.target.value)) } as Partial<Character>)}
                className="adm-stat-num"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Skill names */}
      <div className="adm-section">
        <div className="adm-section-label">招式名稱</div>
        <div className="adm-field-grid">
          {([
            ['moveNameSword', '⚔ 劍槽'],
            ['moveNameGun',   '🔫 槍槽'],
            ['moveNameMagic', '✦ 法槽'],
            ['moveNameWish',  '🌠 願槽'],
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

// ─── ImageCrop ────────────────────────────────────────────────────────────────

function ImageCrop({ charId }: { charId: string }) {
  const [imgSrc,  setImgSrc]  = useState<string | null>(null)
  const [saved,   setSaved]   = useState<string | null>(() => getCharImg(charId))
  const [offsetX, setOffsetX] = useState(50)
  const [offsetY, setOffsetY] = useState(50)
  const [zoom,    setZoom]    = useState(100)   // 100–300
  const hiddenImg = useRef<HTMLImageElement>(null)
  const previewCanvas = useRef<HTMLCanvasElement>(null)

  // Reset when char changes
  useEffect(() => {
    setSaved(getCharImg(charId))
    setImgSrc(null)
    setOffsetX(50); setOffsetY(50); setZoom(100)
  }, [charId])

  // Redraw preview canvas on any slider change
  const redraw = useCallback(() => {
    const img = hiddenImg.current; const cv = previewCanvas.current
    if (!img || !cv || !img.naturalWidth) return
    drawCrop(img, cv, PREVIEW, offsetX, offsetY, zoom / 100)
  }, [offsetX, offsetY, zoom])

  useEffect(() => { redraw() }, [redraw])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImgSrc(ev.target!.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleImgLoaded = () => { redraw() }

  const handleSave = () => {
    const img = hiddenImg.current; if (!img || !img.naturalWidth) return
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256
    drawCrop(img, cv, 256, offsetX, offsetY, zoom / 100)
    const dataUrl = cv.toDataURL('image/webp', 0.88)
    saveCharImg(charId, dataUrl)
    setSaved(dataUrl); setImgSrc(null)
  }

  const handleRemove = () => {
    removeCharImg(charId); setSaved(null)
  }

  return (
    <div className="img-crop">
      {/* Hidden image for natural dimensions */}
      {imgSrc && (
        <img ref={hiddenImg} src={imgSrc} onLoad={handleImgLoaded}
          style={{ display: 'none' }} alt="" crossOrigin="anonymous" />
      )}

      {/* Saved state */}
      {!imgSrc && (
        <div className="img-crop-saved">
          <div className="img-crop-preview-box">
            {saved
              ? <img src={saved} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : <div className="img-crop-empty">尚無圖片<br /><small>/chars/{charId}.webp</small></div>
            }
          </div>
          <div className="img-crop-actions">
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              {saved ? '更換' : '上傳圖片'}
              <input type="file" accept="image/*" onChange={handleFile} hidden />
            </label>
            {saved && <button className="btn sm danger" onClick={handleRemove}>移除</button>}
          </div>
        </div>
      )}

      {/* Crop tool */}
      {imgSrc && (
        <div className="img-crop-tool">
          <canvas ref={previewCanvas} width={PREVIEW} height={PREVIEW} className="img-crop-canvas" />
          <div className="img-crop-sliders">
            <SliderRow label="水平" value={offsetX} min={0} max={100} onChange={setOffsetX} />
            <SliderRow label="垂直" value={offsetY} min={0} max={100} onChange={setOffsetY} />
            <SliderRow label="縮放" value={zoom}    min={100} max={300} onChange={setZoom} unit="%" />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn primary sm" onClick={handleSave}>裁切並儲存</button>
            <button className="btn sm" onClick={() => setImgSrc(null)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

function drawCrop(img: HTMLImageElement, canvas: HTMLCanvasElement,
                  size: number, ox: number, oy: number, zoom: number) {
  const ctx = canvas.getContext('2d')!
  const nw = img.naturalWidth, nh = img.naturalHeight
  if (!nw || !nh) return
  // Cover the square at zoom=1, then apply extra zoom
  const base  = Math.max(size / nw, size / nh)
  const scale = base * zoom
  const rw = nw * scale, rh = nh * scale
  const ex = Math.max(0, rw - size), ey = Math.max(0, rh - size)
  const sx = (ex * ox / 100) / scale
  const sy = (ey * oy / 100) / scale
  const sw = size / scale, sh = size / scale
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size)
}

function SliderRow({ label, value, min, max, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number
  onChange: (v: number) => void; unit?: string
}) {
  return (
    <label className="img-slider-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)} />
      <span className="img-slider-val">{value}{unit}</span>
    </label>
  )
}

// ─── MovesTab ─────────────────────────────────────────────────────────────────

function MovesTab({ moves }: { moves: Move[] }) {
  if (!moves.length) return <div className="adm-empty">此角色沒有招式資料</div>
  return (
    <div className="adm-moves">
      {moves.map(m => (
        <div key={m.id} className="adm-move" style={{ borderLeftColor: SLOT_COLOR[m.slot] }}>
          <div className="adm-move-hdr">
            <span style={{ color: SLOT_COLOR[m.slot] }}>{SLOT_LABEL[m.slot]}</span>
            <b>{m.name}</b>
          </div>
          <div className="adm-move-desc">{m.description || '—'}</div>
          <div className="adm-move-stats">
            {m.powerRatio != null && <Pill label="威力" val={`×${m.powerRatio}`} />}
            {m.hitRate    != null && <Pill label="命中" val={`${Math.round(m.hitRate * 100)}%`} />}
            {m.critRate   != null && <Pill label="爆擊" val={`${Math.round(m.critRate * 100)}%`} />}
            {m.condition  != null && <Pill label="條件" val={`${m.condition}`} />}
            {m.cooldown   != null && <Pill label="CD" val={`${m.cooldown}回`} />}
            {m.scope      != null && <Pill label="範圍" val={m.scope === 'group' ? '群體' : '單體'} />}
          </div>
        </div>
      ))}
    </div>
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

// ─── StoryTab ─────────────────────────────────────────────────────────────────

function StoryTab({ char, onUpdate }: { char: Character; onUpdate: (p: Partial<Character>) => void }) {
  return (
    <div className="adm-story">
      <div className="adm-section-label">角色故事 / 背景設定</div>
      <textarea
        className="adm-story-textarea"
        placeholder={`在這裡填寫 ${char.name} 的背景故事、設定或台詞...`}
        value={char.story ?? ''}
        onChange={e => onUpdate({ story: e.target.value })}
        rows={18}
      />
      <div className="hint" style={{ marginTop: 6, fontSize: 11 }}>
        故事文字將在角色選擇畫面右側顯示（尚未實作——可先存在這裡）
      </div>
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
