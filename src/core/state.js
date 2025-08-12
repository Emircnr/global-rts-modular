import { COST as _COST, STATS as _STATS, RATES as _RATES } from '../data/constants.js';
import { id, qs, qsa } from '../ui/dom.js';

export const state = {
  map:null, svg:null, layers:null,
  selection:new Set(), rangeCircle:null,
  ENT_ID:1, ENT_INDEX:new Map(),
  player:{ money:150, food:40, oil:50, iron:30, units:[], buildings:[], base:null, queue:[], ports(){ return this.buildings.filter(b=>b.buildingType==='port').length } },
  ai:{ money:150, food:40, oil:50, iron:30, units:[], buildings:[], base:null, queue:[], lastThink:0 },
  gameSpeed:1,
  playerStance:'hold',          // varsayılan: 'hold' (komut vermeden hareket yok)
  attackMoveMode:false,
  aiEnabled:true,               // İstersen kapatırız
  WALLS:[],
  LAND_BOXES:[
    [5,-168,83,-52],[-56,-82,13,-34],[35,-10,72,40],[-35,-18,37,52],[5,26,81,180],[-45,110,-10,160],[59,-74,84,-12]
  ],
  /* helpers injected later */
  updateHUD:()=>{}, updateQueueUI:()=>{}, hint:()=>{}, log:()=>{},
  addMarker:()=>{}, removeMarker:()=>{},
  isLand:()=>{}, distance:()=>{}, latlngTowards:()=>{}, offset:()=>{}, offsetDir:()=>{},
  canUnitGoTo:()=>{},
};

// Attach constants onto state for easy access across modules
state.COST = _COST;
state.STATS = _STATS;
state.RATES = _RATES;

export function resetState(){
  state.selection.clear();
  state.ENT_ID=1; state.ENT_INDEX.clear();
  Object.assign(state.player,{ money:150, food:40, oil:50, iron:30, units:[], buildings:[], base:null, queue:[] });
  Object.assign(state.ai,{ money:150, food:40, oil:50, iron:30, units:[], buildings:[], base:null, queue:[], lastThink:0 });
  state.WALLS.length=0;
  state.playerStance='hold'; state.attackMoveMode=false;
}

// Re-export for direct imports if needed
export const COST = _COST;
export const STATS = _STATS;
export const RATES = _RATES;
