export type MiningRewardKey='coins'|'gems'|'silver'|'copper'|'iron'
export interface MiningNodeConfig{id:string;name:string;maxHp:number;respawnSeconds:number;reward:MiningRewardKey;rewardMin:number;rewardMax:number;x:number;y:number}
export interface MiningConfig{durationHours:number;atkPowerPercent:number;spdSpeedPercent:number;maxSpeedBonus:number;weeklyCharacterIds:string[];weeklyPowerPercent:number;weeklySpeedPercent:number;nodes:MiningNodeConfig[]}
export interface MiningRun{startedAt:number;endsAt:number;characterIds:string[];claimed?:boolean}
const CONFIG_KEY='cb_mining_config',RUN_KEY='cb_mining_run'
const DAILY_KEY='cb_mining_daily_uses'
export const DEFAULT_MINING_CONFIG:MiningConfig={durationHours:2,atkPowerPercent:100,spdSpeedPercent:3,maxSpeedBonus:60,weeklyCharacterIds:[],weeklyPowerPercent:30,weeklySpeedPercent:20,nodes:[
 {id:'copper',name:'赤銅礦脈',maxHp:3200,respawnSeconds:20,reward:'copper',rewardMin:2,rewardMax:5,x:20,y:63},
 {id:'silver',name:'白銀晶脈',maxHp:4600,respawnSeconds:30,reward:'silver',rewardMin:1,rewardMax:3,x:50,y:23},
 {id:'crystal',name:'蒼金晶脈',maxHp:6200,respawnSeconds:45,reward:'gems',rewardMin:1,rewardMax:2,x:82,y:62},
]}
export const getMiningConfig=():MiningConfig=>{try{return{...DEFAULT_MINING_CONFIG,...JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}'),nodes:(JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}').nodes??DEFAULT_MINING_CONFIG.nodes)}}catch{return DEFAULT_MINING_CONFIG}}
export const saveMiningConfig=(value:MiningConfig)=>localStorage.setItem(CONFIG_KEY,JSON.stringify(value))
export const getMiningRun=():MiningRun|null=>{try{return JSON.parse(localStorage.getItem(RUN_KEY)||'null')}catch{return null}}
export const saveMiningRun=(value:MiningRun|null)=>value?localStorage.setItem(RUN_KEY,JSON.stringify(value)):localStorage.removeItem(RUN_KEY)
const today=()=>new Date().toLocaleDateString('sv-SE')
export function getMiningDailyUses(){try{const value=JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');return value.date===today()?Math.max(0,Number(value.count)||0):0}catch{return 0}}
export function consumeMiningDailyUse(){const count=getMiningDailyUses();if(count>=3)return false;localStorage.setItem(DAILY_KEY,JSON.stringify({date:today(),count:count+1}));return true}
export function miningStats(atk:number,spd:number,boosted:boolean,config:MiningConfig){const power=atk*(config.atkPowerPercent/100)*(1+(boosted?config.weeklyPowerPercent:0)/100),speed=Math.min(config.maxSpeedBonus,spd*config.spdSpeedPercent+(boosted?config.weeklySpeedPercent:0));return{power,speed,damagePerSecond:power/(1.5*(1-speed/100))}}
