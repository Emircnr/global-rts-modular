import { state } from '../core/state.js';
import { id } from '../ui/dom.js';

export function wireCommands(){
  const cmdAttackBtn = id('cmdAttackMove');
  cmdAttackBtn.onclick = ()=>{
    state.attackMoveMode = !state.attackMoveMode;
    cmdAttackBtn.textContent = state.attackMoveMode ? '⚔️ Saldırı Yürüyüşü: Açık' : '⚔️ Saldırı Yürüyüşü: Kapalı';
    state.hint(state.attackMoveMode? 'Saldırı yürüyüşü aktif.' : 'Saldırı yürüyüşü kapalı.');
  };

  id('cmdStop').onclick = ()=> stopSelected();

  // Sağ tık: hareket / saldır
  state.map.on('contextmenu',(e)=>{
    if(state.selection.size===0){ if(state.wallDrawing){ /* duvar modunda sağ tık bitir */ } return; }
    const enemy = findEnemyNear(e.latlng, 40); // px
    state.selection.forEach(ent=>{
      if(!ent.unitType) return;
      ent.attackMove = state.attackMoveMode;
      if(enemy){ ent.target=enemy; ent.dest = enemy.pos; }
      else { if(state.canUnitGoTo(ent, e.latlng)){ ent.dest=e.latlng; ent.target=null; } }
    });
  });
}

function stopSelected(){
  state.selection.forEach(ent=>{
    if(ent.unitType){ ent.dest=null; ent.target=null; ent.attackMove=false; }
  });
  state.hint('Seçili birimler durdu.');
}
function findEnemyNear(latlng, radiusPx){
  const center = state.map.latLngToContainerPoint(latlng);
  const all = state.ai.units.concat(state.ai.buildings);
  let best=null, bestD=Infinity;
  for(const e of all){
    const p = state.map.latLngToContainerPoint(e.pos);
    const d = Math.hypot(p.x-center.x, p.y-center.y);
    if(d<radiusPx && d<bestD){ best=e; bestD=d; }
  }
  return best;
}
