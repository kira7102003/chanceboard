export type MiningRewardKey='coins'|'gems'|'silver'|'copper'|'iron'|'swordSoul'|'gunSoul'|'magicSoul'
export interface MiningNodeConfig{id:string;name:string;maxHp:number;respawnSeconds:number;reward:MiningRewardKey;rewardMin:number;rewardMax:number;x:number;y:number}
export interface MiningConfig{durationHours:number;atkPowerPercent:number;spdSpeedPercent:number;maxSpeedBonus:number;weeklyCharacterIds:string[];weeklyPowerPercent:number;weeklySpeedPercent:number;nodes:MiningNodeConfig[]}
export interface MiningJob{nodeId:string;charId:string;startedAt:number;endsAt:number}
export interface MiningRun{jobs:MiningJob[]}
const CONFIG_KEY='cb_mining_config',RUN_KEY='cb_mining_run'
const DAILY_KEY='cb_mining_daily_uses'
export const DEFAULT_MINING_CONFIG:MiningConfig={durationHours:2,atkPowerPercent:100,spdSpeedPercent:3,maxSpeedBonus:60,weeklyCharacterIds:[],weeklyPowerPercent:30,weeklySpeedPercent:20,nodes:[
 {id:'copper',name:'赤礦脈',maxHp:3200,respawnSeconds:20,reward:'swordSoul',rewardMin:1,rewardMax:3,x:20,y:63},
 {id:'silver',name:'白金脈',maxHp:4600,respawnSeconds:30,reward:'gunSoul',rewardMin:1,rewardMax:3,x:50,y:23},
 {id:'crystal',name:'蒼金脈',maxHp:6200,respawnSeconds:45,reward:'magicSoul',rewardMin:1,rewardMax:3,x:82,y:62},
]}
export const getMiningConfig=():MiningConfig=>{try{const saved=JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}'),legacyNames:Record<string,string>={copper:'赤銅礦脈',silver:'白銀晶脈',crystal:'蒼金晶脈'},legacyRewards:Record<string,MiningRewardKey>={copper:'copper',silver:'silver',crystal:'gems'};const nodes=(saved.nodes??DEFAULT_MINING_CONFIG.nodes).map((node:MiningNodeConfig)=>{const defaults=DEFAULT_MINING_CONFIG.nodes.find(item=>item.id===node.id);return defaults&&node.name===legacyNames[node.id]&&node.reward===legacyRewards[node.id]?{...node,name:defaults.name,reward:defaults.reward,rewardMin:defaults.rewardMin,rewardMax:defaults.rewardMax}:node});return{...DEFAULT_MINING_CONFIG,...saved,nodes}}catch{return DEFAULT_MINING_CONFIG}}
export const saveMiningConfig=(value:MiningConfig)=>localStorage.setItem(CONFIG_KEY,JSON.stringify(value))
export const getMiningRun=():MiningRun|null=>{try{const value=JSON.parse(localStorage.getItem(RUN_KEY)||'null');if(!value)return null;if(Array.isArray(value.jobs))return value;const ids:string[]=value.characterIds??[];return{jobs:ids.map((charId,index)=>({nodeId:DEFAULT_MINING_CONFIG.nodes[index]?.id??String(index),charId,startedAt:value.startedAt,endsAt:value.endsAt}))}}catch{return null}}
export const saveMiningRun=(value:MiningRun|null)=>value?localStorage.setItem(RUN_KEY,JSON.stringify(value)):localStorage.removeItem(RUN_KEY)
const miningDay=()=>new Date(Date.now()-4*3600000).toLocaleDateString('sv-SE')
export function getMiningDailyUses(nodeId:string){try{const value=JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');return value.date===miningDay()?Math.max(0,Number(value.uses?.[nodeId])||0):0}catch{return 0}}
export function consumeMiningDailyUse(nodeId:string){const count=getMiningDailyUses(nodeId);if(count>=3)return false;let value:{date:string;uses:Record<string,number>}={date:miningDay(),uses:{}};try{const saved=JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');if(saved.date===miningDay())value=saved}catch{}value.uses[nodeId]=count+1;localStorage.setItem(DAILY_KEY,JSON.stringify(value));return true}
export function miningStats(atk:number,spd:number,boosted:boolean,config:MiningConfig){const power=atk*(config.atkPowerPercent/100)*(1+(boosted?config.weeklyPowerPercent:0)/100),speed=Math.min(config.maxSpeedBonus,spd*config.spdSpeedPercent+(boosted?config.weeklySpeedPercent:0));return{power,speed,damagePerSecond:power/(1.5*(1-speed/100))}}
