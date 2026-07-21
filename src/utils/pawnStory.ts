import type { StoryFlowNode, StorySegment } from './storyStore'

let serial = 0
const say = (speaker: string, text: string, side: 'left' | 'right' = 'left', boardCharacter = speaker === '小白' ? 'white' : 'black', section = ''): StoryFlowNode => {
  const id = `pawn_${++serial}`
  const segment: StorySegment = { id, speaker, text, side, boardCharacter, pose: 'front', section }
  return { id: `node_${id}`, type: 'common', segment }
}
const choice = (title: string, branches: Array<[string, StoryFlowNode[]]>): StoryFlowNode => ({
  id: `choice_${++serial}`, type: 'branch', title,
  branches: branches.map(([label, nodes], index) => ({ id: `route_${serial}_${index}`, label, nodes })),
})
const scene = (text: string, presentation: NonNullable<StorySegment['presentation']>, section = '', boardCharacter = 'black'): StoryFlowNode => {
  const id = `pawn_${++serial}`
  const isCgKey = presentation === 'cg' && /^01_/.test(text)
  return { id: `node_${id}`, type: 'common', segment: { id, speaker: '系統', text: isCgKey ? '' : text, side: 'left', boardCharacter, pose: 'front', section, presentation, cgKey: isCgKey ? text : undefined } }
}
const battle = (title: string, text = '準備進入戰鬥。', boardCharacter = 'black') => scene(text, 'battle', title, boardCharacter)

const blackBoss = [
  choice('抵達無名戰士前的狀態', [
    ['圖卡勒絲已加入', [say('無名戰士', '你帶著一個害怕死亡的人走到了這裡。', 'right'), say('圖卡勒絲', '害怕死亡，不代表我不敢戰鬥。', 'left', 'black')]],
    ['圖卡勒絲未加入', [say('無名戰士', '你的腳步很穩。看來沒有什麼東西能讓你停下。', 'right'), say('玩家', '我只是知道自己為什麼來到這裡。')]],
  ]),
  say('無名戰士', '我已經贏了九十九次。只要再贏一次，我就能回去。沒有人告訴我第一百次就能實現願望；但是如果不這麼相信，我早就撐不下去了。', 'right', 'black', '第四節　Boss：無名戰士'),
  say('無名戰士', '來吧。只有一個人的願望，能夠抵達終點。', 'right'),
  battle('Boss 戰｜無名戰士', '擊敗已經勝利九十九次、只想回家的無名戰士。'),
  scene('01_04', 'cg', 'Boss 敗北'),
  say('無名戰士', '很好……至少，我是輸給一個還沒放棄的人。我的願望是回家。我只是想再見一個人，告訴她，我沒有故意失約。', 'right'),
  say('小黑', '願望，本來就是踩著別人的失敗，才能實現。'),
  scene('01_05_01', 'cg', '尾聲1　結尾'),
  say('玩家', '沿途戰死的棋子化作光點升向天空。他們去哪了？', 'right'),
  say('小黑', '知道又怎麼樣？你會因為害怕失敗，就停在這裡嗎？'),
  choice('求生意志的結局', [
    ['守住善意', [say('小黑', '你還在試圖救下每一個出現在眼前的人。我很好奇，你究竟會先拯救他們，還是先被他們拖下去。\n「即使身處棋盤，也不是所有生命都該成為代價。」')]],
    ['勝利優先', [say('小黑', '很好。你已經學會第一條規則了：不是每個向你求救的人，都值得你停下腳步。\n「願望不會眷顧弱者，勝利才是唯一的答案。」')]],
  ]),
  scene('遠方，一枚黑白交錯的國王棋緩緩旋轉。黑暗中，一雙眼睛正默默注視著玩家。', 'marquee', '尾聲2　注視的目光'),
  scene('第一章　完', 'chapter', '兵 Pawn'),
]

const blackRoute = [
  say('小黑', '你選擇了執黑。很好，那就讓我看看你會怎麼贏下這盤棋。', 'left', 'black'),
  say('小黑', '這裡叫【初心荒野】。所有人都是從這裡開始。打倒守關者，就能前往下一張地圖。這裡沒有新手保護，一不小心可是真的會死。', 'left', 'black', '第一節　初心荒野'),
  battle('初心荒野｜魔物襲擊', '數隻魔物突然現身。擊退牠們並活下來。'),
  say('小黑', '很好。受傷代表還活著。誰說我在開玩笑？'),
  say('另一位玩家', '別管他。他就是拿來送死的。現在，他已經沒有用了。', 'right', 'black', '第二節　另一位玩家'),
  say('小黑', '看見了嗎？這就是勝利。輸家沒有資格談善良。前提是，你有不捨棄任何人還能獲勝的本事。'),
  say('圖卡勒絲', '不要過來……拜託……救我！', 'right', 'black', '第三節　拯救'),
  choice('是否拯救被魔物包圍的少年？', [
    ['幫忙', [
      say('玩家', '動手。'),
      battle('拯救圖卡勒絲', '玩家帶領隊伍衝入魔物群。'),
      say('圖卡勒絲', '謝謝……如果沒有你，我已經死了。我叫圖卡勒絲，跟原本的玩家走散了。可以請你收留我嗎？', 'right'),
      choice('是否讓圖卡勒絲加入？', [
        ['同意', [
          say('玩家', '跟我們走吧。但是你必須學會保護自己。'),
          say('圖卡勒絲', '我會的！只要……不要再把我一個人留下。\n【獲得角色：圖卡勒絲】【求生意志＋1】', 'right'),
          choice('如何回應責任？', [
            ['我會負責', [say('玩家', '我會為自己的選擇負責。'), say('小黑', '很好。我就等著看，你的責任能撐到什麼時候。')]],
            ['拖累就丟下', [say('玩家', '如果他真的拖累隊伍，我會丟下他。'), say('小黑', '至少你沒有被自己的善意沖昏頭。想留下，就證明自己有用。\n【求生意志＋1】')]],
          ]),
        ]],
        ['不同意', [
          say('玩家', '我救你，只是不想看你死在眼前。但我不能讓你加入。'),
          choice('說明拒絕的理由', [
            ['我的隊伍沒有餘力', [say('玩家', '讓你跟著我，未必比你自己離開更安全。'), say('圖卡勒絲', '我會自己找到其他人。下一次，我不會再求人救我。\n【求生意志＋2】', 'right')]],
            ['弱者只會拖累我', [say('玩家', '因為弱者只會拖累我。'), say('圖卡勒絲', '下一次見面，我不會再是需要你拯救的人。\n【求生意志＋3】', 'right')]],
          ]),
        ]],
      ]),
      ...blackBoss,
    ]],
    ['不幫', [
      say('玩家', '我們走。'),
      say('小黑', '很好。你開始懂得分辨什麼叫必要的戰鬥了。不屬於你的棋子，不值得你冒險。\n【求生意志＋3】'),
      ...blackBoss,
    ]],
  ]),
]

const whiteBoss = [
  choice('抵達無名戰士前的狀態', [
    ['梅朵已加入', [say('無名戰士', '還有人願意跟隨你。看來，你至少沒有獨自走到這裡。', 'right'), say('梅朵．希裴兒', '你要不要也乾脆加入我們啊？', 'left', 'white')]],
    ['沒有幫助村莊', [say('無名戰士', '你沒有在路上浪費時間。那種為了抵達終點、開始學會不再回頭的眼神，我見過很多次。', 'right')]],
  ]),
  say('無名戰士', '九十九次。我贏了九十九次。這會是第一百次。只要再贏一場，我一定能回家。', 'right', 'white', '第四節　Boss：無名戰士'),
  say('無名戰士', '如果你的願望比我的更重要，就來打倒我吧。', 'right'),
  battle('Boss 戰｜無名戰士', '跨越無名戰士最後的願望。', 'white'),
  scene('01_04', 'cg', 'Boss 敗北', 'white'),
  say('無名戰士', '棋盤最殘忍的地方，就是永遠讓人覺得自己只差最後一步。我的願望只是回家，再看一眼家門前的樹，還有在樹下等我的人。', 'right'),
  say('小白', '每天，棋盤都會迎來新的棋子，也會送走許多棋子。棋盤只會留下其中一個願望。我希望總有一天，不必再有人踏入這裡。'),
  scene('01_05_02', 'cg', '尾聲1　結尾', 'white'),
  choice('守護之心的結局', [
    ['仍願守護', [say('小白', '你不一定能救下所有人。但是今天，至少有人因為你的選擇看見了明天。\n「每一枚棋子，都有值得被守護的願望。」')]],
    ['記住失去', [say('小白', '我不會要求你永遠選擇善良。但是請記得那些被留下的人，他們也曾經擁有名字。\n「無法守護所有人，至少不要忘記他們的名字。」')]],
  ]),
  scene('遠方，一枚黑白交錯的國王棋緩緩轉動。黑暗中，一雙眼睛正靜靜注視著玩家。', 'marquee', '尾聲2　注視的目光', 'white'),
  scene('第一章　完', 'chapter', '兵 Pawn', 'white'),
]

const whiteRoute = [
  say('小白', '你選擇了執白。從現在開始，請不要忘記每一枚棋子都只有一次機會。', 'left', 'white'),
  say('小白', '這裡是【初心荒野】。所有棋子的旅程都是從這裡開始。穿越荒野並擊敗守關者，你就能前往下一張地圖。魔物隨時都可能出現。', 'left', 'white', '第一節　初心荒野'),
  battle('初心荒野｜魔物襲擊', '數隻魔物擋住道路。準備戰鬥。', 'white'),
  say('小白', '力量越強，肩負的事物也會越來越多。希望到了那時候，你仍然記得自己為什麼而戰。'),
  say('另一位玩家', '反正只是棋子。少一個，再召喚就好。', 'right', 'white', '第二節　另一位玩家'),
  say('小白', '成為棋子以前，他也曾擁有名字、家人和願望。玩家可以重新開始，但每一位棋子都只有一次機會。'),
  say('梅朵', '快走！所有人都躲進去！這裡交給我！', 'right', 'white', '第三節　守護'),
  choice('是否幫助遭魔物襲擊的村莊？', [
    ['幫忙', [
      say('玩家', '我們去幫她。'),
      battle('村莊保衛戰', '保護村莊與獨自守在村口的少女。', 'white'),
      say('梅朵', '謝謝你。我叫梅朵。即使成為棋子，我也還是有想保護的事物。請讓我加入你的隊伍。', 'right'),
      choice('是否讓梅朵加入？', [
        ['同意', [
          say('系統', '【獲得角色：梅朵】'),
          say('梅朵', '請不要把任何人當成可以隨意捨棄的棋子，包括我。', 'right'),
          choice('如何回答梅朵？', [
            ['我答應妳', [say('玩家', '我答應妳。'), say('小白', '契約已經成立。她就是你的同伴了。\n【守護之心＋2】')]],
            ['我不能保證', [say('玩家', '我不能保證所有人都能活到最後，但在還有選擇時，我不會輕易放棄任何人。'), say('小白', '誠實的承諾，有時比美麗的謊言珍貴。\n【守護之心＋1】')]],
          ]),
        ]],
        ['不同意', [
          say('玩家', '抱歉，我不能讓妳加入。'),
          choice('說明拒絕的理由', [
            ['我的隊伍不適合她', [say('玩家', '讓她加入，不一定是對她最好。'), say('小白', '不輕易許下承諾，也是一種負責。\n【守護之心＋1】')]],
            ['我不想背負她的生命', [say('玩家', '我不想再背負更多人的生命。'), say('小白', '害怕承擔也是一種選擇。請記得，那是你自己的決定。\n【守護之心－1】')]],
          ]),
        ]],
      ]),
      ...whiteBoss,
    ]],
    ['不幫', [
      say('玩家', '我們不能在這裡浪費時間。'),
      say('小白', '你已經做出了選擇。有些結果，也就不再屬於我們了。\n【守護之心－1】'),
      say('村中孩子', '梅朵姐姐說，只要她還站著，魔物就不會進村……可是，她沒有回來。', 'right'),
      ...whiteBoss,
    ]],
  ]),
]

function splitDialogueLines(nodes: StoryFlowNode[]): StoryFlowNode[] {
  return nodes.reduce<StoryFlowNode[]>((result, node) => {
    if (node.type === 'branch') {
      result.push({ ...node, branches: node.branches.map(branch => ({ ...branch, nodes: splitDialogueLines(branch.nodes) })) })
      return result
    }
    const lines = node.segment.text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines.length <= 1) {
      result.push(node)
      return result
    }
    result.push(...lines.map((text, index): StoryFlowNode => ({
      ...node,
      id: `${node.id}_line_${index + 1}`,
      segment: {
        ...node.segment,
        id: `${node.segment.id}_line_${index + 1}`,
        text,
        section: index === 0 ? node.segment.section : '',
      },
    })))
    return result
  }, [])
}

export const PAWN_STORY_FLOW: StoryFlowNode[] = splitDialogueLines([
  scene('第一章　兵（Pawn）', 'chapter', 'CHAPTER 1'),
  scene('棋盤從中央裂開。無數人化作光點從天空墜落，落在棋盤上的身體逐漸成為一枚枚棋子。', 'cg', '開場 CG'),
  scene('每一位來到這裡的人，都懷抱著一個無法放棄的願望。新的棋局，即將開始。', 'narration', '序幕'),
  choice('選擇執棋方', [['執黑', blackRoute], ['執白', whiteRoute]]),
])
