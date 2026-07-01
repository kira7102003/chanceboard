import { useState } from 'react'

interface Props {
  onJoin: (roomId: string) => void
}

export default function Lobby({ onJoin }: Props) {
  const [input, setInput] = useState('')

  const create = () => {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase()
    onJoin(id)
  }

  const join = () => {
    const id = input.trim().toUpperCase()
    if (id.length >= 4) onJoin(id)
  }

  return (
    <div className="lobby">
      <h1 className="title">奇蹟之盤 <span>Chanceboard</span></h1>
      <div className="lobby-card">
        <button className="btn primary" onClick={create}>建立房間</button>
        <div className="divider">— 或 —</div>
        <div className="join-row">
          <input
            className="input"
            placeholder="房間代碼"
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && join()}
            maxLength={8}
          />
          <button className="btn" onClick={join}>加入</button>
        </div>
      </div>
    </div>
  )
}
