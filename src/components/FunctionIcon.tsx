const SPRITES: Record<string, number> = { logistics: 0, explore: 1, tasks: 2, mail: 3, shop: 4, achievements: 5, announcements: 6, collection: 7, friends: 8, duel: 9, story: 10, teams: 11 }

export default function FunctionIcon({ name }: { name: string }) {
  if (name === 'pieces') return <img className="panel-function-icon image" src="/chess-piece.svg" alt="" />
  if (name === 'summon') return <img className="panel-function-icon image" src="/summon-icon.svg" alt="" />
  const index = SPRITES[name] ?? 0
  return <i className="panel-function-icon" style={{ backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 50}%` }} />
}
