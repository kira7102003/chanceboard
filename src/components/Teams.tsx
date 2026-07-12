import { useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { getChars, getUrlByKey } from '../utils/charStore'

const EL_COLOR: Record<string, string> = { '劍': '#e87733', '槍': '#22cc77', '法': '#9955ee' }
const POS = ['前', '中', '後']
const POS_COL = ['#e85533', '#ddaa22', '#33aacc']

interface Props {
  onClose:      () => void
  onStartBattle: (charIds: string[]) => void
}

export default function Teams({ onClose, onStartBattle }: Props) {
  const { savedTeams, saveTeam, deleteTeam } = usePlayerStore()
  const allChars = getChars().filter(c => c.enabled !== false)

  const [creating,  setCreating]  = useState(false)
  const [picking,   setPicking]   = useState<string[]>([])
  const [teamName,  setTeamName]  = useState('')

  const togglePick = (id: string) =>
    setPicking(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 3 ? [...p, id] : p)

  const confirmCreate = () => {
    if (picking.length !== 3) return
    saveTeam({ name: teamName.trim() || `隊伍 ${savedTeams.length + 1}`, charIds: picking })
    setPicking([]); setTeamName(''); setCreating(false)
  }

  const cancelCreate = () => { setPicking([]); setTeamName(''); setCreating(false) }

  return (
    <div className="panel-overlay">
      <div className="panel-header">
        <button className="panel-back" onClick={creating ? cancelCreate : onClose}>
          {creating ? '← 取消' : '← 返回'}
        </button>
        <span className="panel-title">🛡 隊伍</span>
        {!creating && savedTeams.length < 5 && (
          <button className="panel-action-btn" onClick={() => setCreating(true)}>＋ 新隊伍</button>
        )}
        {creating && (
          <button className="panel-action-btn"
            disabled={picking.length !== 3}
            onClick={confirmCreate}
          >儲存</button>
        )}
      </div>

      <div className="panel-body">

        {/* ── Create mode: pick 3 chars ── */}
        {creating && (
          <>
            <div className="teams-create-bar">
              <input className="input" style={{ flex: 1, fontSize: 13 }}
                placeholder="隊伍名稱（選填）"
                value={teamName} maxLength={12}
                onChange={e => setTeamName(e.target.value)} />
              <span className="hint">{picking.length}/3</span>
            </div>
            <div className="coll-grid" style={{ marginTop: 10 }}>
              {allChars.map(c => {
                const sel    = picking.includes(c.id)
                const selIdx = picking.indexOf(c.id)
                const imgUrl = getUrlByKey(`cb_img_${c.id}`)
                const col    = EL_COLOR[c.element]
                return (
                  <div key={c.id} className={`coll-card owned${sel ? ' team-sel' : ''}`}
                    style={{ cursor: 'pointer' }} onClick={() => togglePick(c.id)}>
                    <div className="coll-portrait"
                      style={{ borderColor: sel ? POS_COL[selIdx] : col + '33',
                               boxShadow: sel ? `0 0 10px ${POS_COL[selIdx]}55` : 'none' }}>
                      {imgUrl
                        ? <img src={imgUrl} alt={c.name} className="coll-img" />
                        : <div className="coll-placeholder" style={{ color: col }}>{c.name[0]}</div>
                      }
                      {sel && (
                        <span className="coll-sel-badge" style={{ background: POS_COL[selIdx] }}>
                          {POS[selIdx]}
                        </span>
                      )}
                    </div>
                    <div className="coll-name">{c.name}</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Team list ── */}
        {!creating && (
          <div className="teams-list">
            {savedTeams.length === 0 && (
              <div className="teams-empty">
                尚未儲存任何隊伍<br />
                <span className="hint">點擊「＋ 新隊伍」選擇 3 位角色</span>
              </div>
            )}
            {savedTeams.map(team => (
              <div key={team.id} className="team-item">
                <div className="team-portraits">
                  {team.charIds.map((cid, i) => {
                    const ch     = allChars.find(c => c.id === cid)
                    const imgUrl = ch ? getUrlByKey(`cb_img_${cid}`) : null
                    const col    = ch ? EL_COLOR[ch.element] : '#888'
                    return (
                      <div key={cid} className="team-portrait-wrap">
                        <div className="team-portrait" style={{ borderColor: POS_COL[i] + '66' }}>
                          {imgUrl
                            ? <img src={imgUrl} className="team-portrait-img" alt="" />
                            : <span style={{ color: col, fontSize: 16 }}>{ch?.name[0]}</span>
                          }
                        </div>
                        <span className="team-pos" style={{ color: POS_COL[i] }}>{POS[i]}</span>
                        <span className="team-cname">{ch?.name ?? '?'}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="team-footer">
                  <span className="team-name">{team.name}</span>
                  <div className="team-actions">
                    <button className="btn primary" style={{ fontSize: 12 }}
                      onClick={() => onStartBattle(team.charIds)}>⚔ 出戰</button>
                    <button className="btn" style={{ fontSize: 12 }}
                      onClick={() => deleteTeam(team.id)}>刪除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
