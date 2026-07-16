import { useEffect, useState } from 'react'
import { getChars } from '../utils/charStore'
import { usePlayerStore } from '../store/playerStore'

interface Props {
  onClose: () => void
}

export default function Settings({ onClose }: Props) {
  const {
    username, coins, gems, ownedCharIds,
    setUsername, setCoins, setGems, removeOwnedChar, clearCollection,
  } = usePlayerStore()
  const [usernameInput, setUsernameInput] = useState(username)
  const [coinInput, setCoinInput] = useState(String(coins))
  const [gemInput, setGemInput] = useState(String(gems))
  const chars = getChars()

  useEffect(() => setUsernameInput(username), [username])
  useEffect(() => setCoinInput(String(coins)), [coins])
  useEffect(() => setGemInput(String(gems)), [gems])

  const saveCurrency = () => {
    setUsername(usernameInput)
    setCoins(Number(coinInput) || 0)
    setGems(Number(gemInput) || 0)
  }

  return (
    <div className="panel-overlay">
      <div className="panel-header">
        <button className="panel-back" onClick={onClose}>← 返回</button>
        <span className="panel-title">⚙ 設定</span>
      </div>
      <div className="settings-body">
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
