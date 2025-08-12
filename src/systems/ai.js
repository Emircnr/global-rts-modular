import { state } from '../core/state.js';
import { Unit } from '../entities/Unit.js';

export function aiThink(dt, seed=false){
  if(!state.aiEnabled) return;
  state.ai.lastThink+=dt; if(seed || state.ai.lastThink>5){
    state.ai.lastThink=0;
    const hasM=state.ai.buildings.some(b=>b.buildingType==='mill');
    const hasR=state.ai.buildings.some(b=>b.buildingType==='refinery');
    const hasI=state.ai.buildings.some(b=>b.buildingType==='mine');
    const hasB=state.ai.buildings.some(b=>b.buildingType==='barracks');
    const hasF=state.ai.buildings.some(b=>b.buildingType==='factory');
    const hasA=state.ai.buildings.some(b=>b.buildingType==='airbase');
    const hasS=state.ai.buildings.some(b=>b.buildingType==='sam');

    /* === PATCHPOINT: AI_BUILD_ORDER === */
    if(!hasM && state.ai.money>=state.COST.mill.money){ state.ai.money-=state.COST.mill.money; enqueueAI('mill',1000) }
    else if(!hasR && state.ai.money>=state.COST.refinery.money){ state.ai.money-=state.COST.refinery.money; enqueueAI('refinery',1300) }
    else if(!hasI && state.ai.money>=state.COST.mine.money){ state.ai.money-=state.COST.mine.money; enqueueAI('mine',1500) }
    else if(!hasB && state.ai.money>=state.COST.barracks.money){ state.ai.money-=state.COST.barracks.money; enqueueAI('barracks',900) }
    else if(!hasF && state.ai.money>=state.COST.factory.money && state.ai.oil>=(state.COST.factory.oil||0)){ state.ai.money-=state.COST.factory.money; state.ai.oil-=state.COST.factory.oil||0; enqueueAI('factory',1600) }
    else if(!hasA && state.ai.money>=state.COST.airbase.money && state.ai.iron>=(state.COST.airbase.iron||0)){ state.ai.money-=state.COST.airbase.money; state.ai.iron-=state.COST.airbase.iron||0; enqueueAI('airbase',2000) }
    else if(!hasS && state.ai.money>=state.COST.sam.money && state.ai.iron>=(state.COST.sam.iron||0)){ state.ai.money-=state.COST.sam.money; state.ai.iron-=state.COST.sam.iron||0; enqueueAI('sam',1200) }

    const b=state.ai.buildings.find(x=>x.buildingType==='barracks');
    const f=state.ai.buildings.find(x=>x.buildingType==='factory');
    const a=state.ai.buildings.find(x=>x.buildingType==='airbase');
    if(b && state.ai.money>=state.COST.soldier.money && state.ai.food>=state.COST.soldier.food){ state.ai.money-=state.COST.soldier.money; state.ai.food-=state.COST.soldier.food; spawnAI('soldier',b.pos); }
    if(f && state.ai.money>=state.COST.tank.money && state.ai.oil>=state.COST.tank.oil && state.ai.iron>=state.COST.tank.iron){ state.ai.money-=state.COST.tank.money; state.ai.oil-=state.COST.tank.oil; state.ai.iron-=state.COST.tank.iron; spawnAI(Math.random()<.5?'tank':'t90',f.pos); }
    if(a && state.ai.money>=state.COST.tb2.money && state.ai.oil>=state.COST.tb2.oil && state.ai.iron>=state.COST.tb2.iron){ state.ai.money-=state.COST.tb2.money; state.ai.oil-=state.COST.tb2.oil; state.ai.iron-=state.COST.tb2.iron; spawnAI(Math.random()<.5?'tb2':'f16',a.pos); }

    const army = state.ai.units.filter(u=>u.dps>0);
    if(army.length>=6){
      const t = acquireTargetNear(state.player.units.concat(state.player.buildings), state.ai.base.pos);
      if(t){ army.forEach(u=>{ if(state.canUnitGoTo(u,t.pos)){ u.dest=t.pos; u.attackMove=true; } }); state.log('AI saldırı başlattı!'); }
    }
  }
}
function enqueueAI(type,dist){ window.enqueueBuildJob?.(state.ai,{type, pos:state.offset(state.ai.base.pos,dist)}) }
function spawnAI(kind, around){ const pos=findSpawnAround(around,kind)||around; const u=new Unit({side:'ai',pos,unitType:kind}); state.ai.units.push(u); state.addMarker(u); }
function findSpawnAround(origin, kind){
  const medium = state.STATS[kind].medium||'land';
  const wantLand = (medium==='land'); const wantWater=(medium==='water');
  for(let r=30;r<=220;r+=20){
    for(let k=0;k<14;k++){
      const ang=Math.random()*Math.PI*2; const p=state.offsetDir(origin,r,ang);
      if( (wantLand && state.isLand(p)) || (wantWater && !state.isLand(p)) || (!wantLand && !wantWater) ) return p;
    }
  }
  if((wantLand && state.isLand(origin)) || (wantWater && !state.isLand(origin)) || (!wantLand && !wantWater)) return origin;
  return null;
}
function acquireTargetNear(arr, origin){
  let best=null,bestD=Infinity; for(const e of arr){ const d=state.distance(origin,e.pos); if(d<bestD){ best=e; bestD=d; } } return best;
}
