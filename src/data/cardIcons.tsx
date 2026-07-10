import type { ReactNode } from 'react'

const W: React.SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round',
  style: { display: 'block' },
}
const ico = (c: ReactNode): ReactNode => <svg {...W}>{c}</svg>

export const CARD_ICON: Record<string, ReactNode> = {
  // ── 花色牌 ──────────────────────────────────────────────────────────
  '001': ico(<>                                           {/* 刀劍 sword */}
    <path d="M12 2v15"/>
    <path d="M8 7h8"/>
    <path d="M10 17l2 4 2-4"/>
  </>),

  '002': ico(<>                                           {/* 槍炮 gun */}
    <rect x="2" y="8" width="11" height="5" rx="1"/>
    <path d="M13 9.5v-1.5l5 2.5-5 2.5v-1.5"/>
    <rect x="4" y="13" width="6" height="5" rx="1"/>
  </>),

  '003': ico(<>                                           {/* 魔法 magic circle */}
    <circle cx="12" cy="12" r="8"/>
    <path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7"/>
  </>),

  '004': ico(                                             /* 心願 5-star */
    <path d="M12 2l2.6 7.8h8.3l-6.8 4.7 2.6 7.5L12 17.5l-6.7 4.5 2.6-7.5L1.1 9.8h8.3z"/>
  ),

  // ── 花牌 ─────────────────────────────────────────────────────────────
  '005': ico(<>                                           {/* 惡意 grabbing hand */}
    <path d="M9 11V6a1.5 1.5 0 013 0v5"/>
    <path d="M12 7V5.5a1.5 1.5 0 013 0V11"/>
    <path d="M15 8V6.5a1.5 1.5 0 013 0V13a6 6 0 01-6 6H9l-5-5 1.5-1.5a2 2 0 012.8 0L9 14V11a1.5 1.5 0 013 0"/>
  </>),

  '006': ico(<>                                           {/* 交換 swap */}
    <path d="M4 9h14M14 6l4 3-4 3"/>
    <path d="M20 15H6M10 18l-4-3 4-3"/>
  </>),

  '007': ico(<>                                           {/* 機會 3 cards */}
    <rect x="2" y="9" width="9" height="12" rx="1"/>
    <rect x="7" y="6" width="9" height="12" rx="1"/>
    <rect x="12" y="3" width="9" height="12" rx="1"/>
  </>),

  '008': ico(<>                                           {/* 牽制 discard */}
    <rect x="6" y="4" width="12" height="16" rx="1"/>
    <path d="M9 8l6 6M15 8l-6 6"/>
  </>),

  '009': ico(<>                                           {/* 命運 heal cross */}
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8v8M8 12h8"/>
  </>),

  '010': ico(                                             /* 保護 shield */
    <path d="M12 2l9 4.5v8c0 5-9 9.5-9 9.5s-9-4.5-9-9.5V6.5z"/>
  ),

  '011': ico(<>                                           {/* 回復 refresh */}
    <path d="M20 12a8 8 0 01-14.9 4M20 12V8l-4 4"/>
    <path d="M4 12a8 8 0 0114.9-4M4 12v4l4-4"/>
  </>),

  '012': ico(                                             /* 愛心 heart */
    <path d="M12 21C5 16.5 2 13 2 9.5A5.5 5.5 0 0112 7a5.5 5.5 0 0110 2.5C22 13 19 16.5 12 21z"/>
  ),

  '013': ico(<>                                           {/* 強化 ATK↑ */}
    <path d="M12 20V6"/>
    <path d="M6 12l6-6 6 6"/>
    <path d="M5 20h14"/>
  </>),

  '014': ico(                                             /* 快攻 lightning */
    <path d="M13 2L7 13h6l-2 9 8-10h-7z"/>
  ),

  '015': ico(<>                                           {/* 致命 crit asterisk */}
    <path d="M12 4v16"/>
    <path d="M4 8.5l16 7"/>
    <path d="M4 15.5l16-7"/>
  </>),

  '016': ico(<>                                           {/* 開眼 eye */}
    <path d="M1 12C5 5 19 5 23 12C19 19 5 19 1 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </>),

  '017': ico(                                             /* 機智 ghost */
    <path d="M6 22V11a6 6 0 0112 0v11l-3-2.5-3 2.5-3-2.5-3 2.5"/>
  ),

  '018': ico(<>                                           {/* 鎖定 target */}
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
  </>),

  '019': ico(<>                                           {/* 自由 open lock */}
    <rect x="3" y="11" width="18" height="11" rx="1"/>
    <path d="M7 11V7a5 5 0 0110 0"/>
  </>),

  '020': ico(<>                                           {/* 移動 dash */}
    <path d="M5 12h14M15 7l5 5-5 5"/>
    <path d="M5 7v3M5 14v3"/>
  </>),

  '021': ico(<>                                           {/* 反擊 counter */}
    <path d="M4 9h12M12 6l4 3-4 3"/>
    <path d="M20 15H8M12 18l-4-3 4-3"/>
  </>),

  '022': ico(<>                                           {/* 力量 ×2 chevron */}
    <path d="M4 7l8-4.5 8 4.5"/>
    <path d="M4 17l8-4.5 8 4.5"/>
    <path d="M12 2.5v19"/>
  </>),

  '023': ico(<>                                           {/* 忍耐 dome barrier */}
    <path d="M3 19a9 9 0 0118 0H3z"/>
    <path d="M3 19h18"/>
    <path d="M7 15L3 19M11 12L4 18M15 12L8 18M19 15l-4 4"/>
  </>),

  '024': ico(<>                                           {/* 復活 revive */}
    <circle cx="12" cy="7" r="3"/>
    <path d="M12 22V11"/>
    <path d="M8 16l4-4 4 4"/>
  </>),

  '025': ico(<>                                           {/* 分身 clone */}
    <circle cx="9" cy="12" r="5"/>
    <circle cx="15" cy="12" r="5"/>
  </>),

  '026': ico(<>                                           {/* 透明 invisible */}
    <circle cx="12" cy="12" r="9" strokeDasharray="4 2"/>
    <path d="M8 12h8" strokeDasharray="2 2" strokeOpacity="0.6"/>
  </>),
}
