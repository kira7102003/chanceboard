import { useEffect, useState } from 'react'
import { getChars } from '../utils/charStore'
import { usePlayerStore } from '../store/playerStore'
import { applyGlobalFont, FONT_STORAGE_KEY, FREE_FONT_OPTIONS } from '../utils/fontSettings'

interface Props {
  onClose: () => void
}

export default function Settings({ onClose }: Props) {
  const {
    username, coins, gems, ownedCharIds,
    musicEnabled, soundEnabled, musicVolume, soundVolume,
    setUsername, setCoins, setGems, removeOwnedChar, clearCollection, setMusicSettings, setSoundSettings,
  } = usePlayerStore()
  const [usernameInput, setUsernameInput] = useState(username)
  const [coinInput, setCoinInput] = useState(String(coins))
  const [gemInput, setGemInput] = useState(String(gems))
  const [fontId, setFontId] = useState(() => localStorage.getItem(FONT_STORAGE_KEY) ?? 'noto-sans')
  const chars = getChars()

  useEffect(() => setUsernameInput(username), [username])
  useEffect(() => setCoinInput(String(coins)), [coins])
  useEffect(() => setGemInput(String(gems)), [gems])

  const saveCurrency = () => {
    setUsername(usernameInput)
    setCoins(Number(coinInput) || 0)
    setGems(Number(gemInput) || 0)
  }

  const applyAudio = (kind: 'music' | 'sound', enabled: boolean, volume: number) => {
    if (kind === 'music') setMusicSettings(enabled, volume)
    else setSoundSettings(enabled, volume)
    document.querySelectorAll<HTMLAudioElement>(`audio[data-audio-kind="${kind}"]`).forEach(audio => {
      audio.muted = !enabled
      audio.volume = volume / 100
    })
  }

  return (
    <div className="panel-overlay">
      <div className="panel-header">
        <button className="panel-back" onClick={onClose}>← 返回</button>
        <span className="panel-title">⚙ 設定</span>
      </div>
      <div className="settings-body">
        <section className="settings-section font-settings">
          <h3>全系統字體</h3>
          <label><span>免費字體</span><select value={fontId} onChange={event => { const value = applyGlobalFont(event.target.value); setFontId(value) }}>{FREE_FONT_OPTIONS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}</select></label>
          <p>選擇後立即套用到大廳、戰鬥、故事與資料管理，並自動記住設定。</p>
        </section>
        <section className="settings-section audio-settings">
          <h3>聲音設定</h3>
          <div className="audio-setting-row">
            <button className={`audio-toggle ${musicEnabled ? 'active' : ''}`} onClick={() => applyAudio('music', !musicEnabled, musicVolume)}><span>🎵</span><b>音樂</b><small>{musicEnabled ? '開啟' : '關閉'}</small></button>
            <label><span>音樂音量</span><input type="range" min="0" max="100" value={musicVolume} onChange={event => applyAudio('music', musicEnabled, Number(event.target.value))} /><b>{musicVolume}%</b></label>
          </div>
          <div className="audio-setting-row">
            <button className={`audio-toggle ${soundEnabled ? 'active' : ''}`} onClick={() => applyAudio('sound', !soundEnabled, soundVolume)}><span>🔊</span><b>音效</b><small>{soundEnabled ? '開啟' : '關閉'}</small></button>
            <label><span>音效音量</span><input type="range" min="0" max="100" value={soundVolume} onChange={event => applyAudio('sound', soundEnabled, Number(event.target.value))} /><b>{soundVolume}%</b></label>
          </div>
        </section>

        <section className="settings-section">
          <h3>帳號資源</h3>
          <label className="settings-username">
            <span>👤 使用者名稱</span>
            <input maxLength={20} value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)} placeholder="玩家" />
          </label>
          <div className="settings-currency-grid">
            <label>
              <span>🪙 金幣</span>
              <input type="number" min="0" step="1" value={coinInput}
                onChange={e => setCoinInput(e.target.value)} />
            </label>
            <label>
              <span>💎 鑽石</span>
              <input type="number" min="0" step="1" value={gemInput}
                onChange={e => setGemInput(e.target.value)} />
            </label>
          </div>
          <button className="btn primary" onClick={saveCurrency}>儲存帳號設定</button>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>收藏管理 <small>{ownedCharIds.length} 位</small></h3>
            <button className="btn sm settings-danger" disabled={ownedCharIds.length === 0}
              onClick={() => confirm('確定刪除全部收藏角色？') && clearCollection()}>
              清空收藏
            </button>
          </div>
          {ownedCharIds.length === 0
            ? <div className="settings-empty">目前沒有收藏角色</div>
            : <div className="settings-owned-list">
                {ownedCharIds.map(id => {
                  const char = chars.find(c => c.id === id)
                  return (
                    <div className="settings-owned-item" key={id}>
                      <span>{char?.name ?? id}</span>
                      <button className="btn sm settings-danger"
                        onClick={() => removeOwnedChar(id)}>刪除</button>
                    </div>
                  )
                })}
              </div>
          }
        </section>

      </div>
    </div>
  )
}
