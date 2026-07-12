import { useState } from 'react'
import { supabase } from '../utils/supabase'

export default function Login() {
  const [mode,    setMode]    = useState<'login' | 'register'>('login')
  const [email,   setEmail]   = useState('danny7102003@gmail.com')
  const [pass,    setPass]    = useState('123456789')
  const [msg,     setMsg]     = useState('')
  const [isErr,   setIsErr]   = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email || !pass) return
    setLoading(true); setMsg(''); setIsErr(false)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (error) { setMsg(error.message); setIsErr(true) }
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pass })
        if (error) { setMsg(error.message); setIsErr(true) }
        else setMsg('確認信已送出，請至信箱點擊連結後再登入')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="title" style={{ fontSize: '2.2rem', marginBottom: 4 }}>
          奇蹟之盤 <span>Chanceboard</span>
        </div>
        <div className="title-sub" style={{ marginBottom: 28 }}>TACTICAL CARD GAME</div>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setMsg('') }}
          >登入</button>
          <button
            className={`login-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setMsg('') }}
          >建立帳號</button>
        </div>

        <input
          className="input" type="email" placeholder="電子郵件"
          style={{ letterSpacing: 'normal', fontSize: 14 }}
          value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoComplete="email"
        />
        <input
          className="input" type="password" placeholder="密碼（至少 6 位）"
          style={{ letterSpacing: 'normal', fontSize: 14 }}
          value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

        {msg && (
          <div className="login-msg" style={{ color: isErr ? '#ee4466' : '#22cc77' }}>
            {msg}
          </div>
        )}

        <button
          className="btn primary"
          onClick={submit}
          disabled={loading || !email || !pass}
          style={{ marginTop: 4 }}
        >
          {loading ? '請稍候…' : mode === 'login' ? '登入' : '建立帳號'}
        </button>
      </div>
    </div>
  )
}
