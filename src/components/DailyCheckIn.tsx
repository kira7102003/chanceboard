import { useState } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { getDailyReward, localDateKey } from '../utils/dailyRewards'

interface Props { userId: string }

export default function DailyCheckIn({ userId }: Props) {
  const { dailyClaims, claimDailyReward } = usePlayerStore()
  const [claimedNow, setClaimedNow] = useState(false)
  const dateKey = localDateKey()
  const alreadyClaimed = (dailyClaims?.[userId] ?? []).includes(dateKey)
  const reward = getDailyReward(dateKey)

  if (alreadyClaimed && !claimedNow) return null
  if (!claimedNow) {
    return (
      <div className="daily-overlay">
        <div className="daily-card">
          <div className="daily-icon">📅</div>
          <h2>每日簽到獎勵</h2>
          <div className="daily-date">{dateKey}</div>
          <div className="daily-rewards">
            <span>💰 金幣 <b>+{reward.coins}</b></span>
            <span>💎 鑽石 <b>+{reward.gems}</b></span>
          </div>
          <button className="btn primary daily-claim" onClick={() => {
            if (claimDailyReward(userId, dateKey, reward.coins, reward.gems)) setClaimedNow(true)
          }}>領取獎勵</button>
        </div>
      </div>
    )
  }

  return (
    <div className="daily-toast">
      📅 每日簽到獎勵：💰 金幣 +{reward.coins}　💎 鑽石 +{reward.gems}
      <button onClick={() => setClaimedNow(false)}>×</button>
    </div>
  )
}
