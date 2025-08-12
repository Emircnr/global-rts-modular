import { state } from '../core/state.js';
import { updateHPBar } from '../ui/production.js';

export function tickSideCombat(dt, sideObj, enemySide){
  const units=sideObj.units;
  const enemies=enemySide.units.concat(enemySide.buildings);
  for(const u of units){
    // attack-move: yakın düşman
    if(u.attackMove && (!u.target || u.target.dead)){
      const e = acquireTargetInRange(u, enemies, u.range*0.9);
      if(e){ u.target=e }
    }
    // hareket
    window.moveUnit?.(dt,u);

    // stance
    if(sideObj===state.player && state.playerStance==='hold' && (!u.target || !inRange(u,u.target))){
      continue;
    }
    // hedef koruma
    if(!u.target || u.target.dead){ u.target = acquireTarget(u,enemies); }
    else if(state.distance(u.pos,u.target.pos) > (u.range*1.1)){ u.dest = u.target.pos; }
    if(u.target && inRange(u,u.target)){ dealDamage(u,u.target,dt) }
  }
  // SAM hava savunma
  sideObj.buildings.filter(b=>b.buildingType==='sam').forEach(s=>{
    const R=12000; const tgt = enemySide.units.find(e=> isAir(e) && state.distance(s.pos,e.pos)<=R );
    if(tgt){ drawBeam(s.pos, tgt.pos); tgt.hp -= 45*dt; updateHPBar(tgt); if(tgt.hp<=0) destroyEntity(tgt, s); }
  });
}
function inRange(u,v){ return state.distance(u.pos,v.pos) <= (u.range||0) }
function dealDamage(attacker,target,dt){
  if(attacker.dps<=0) return;
  if(attacker.targetType==='ground' && isAir(target)) return;
  if(attacker.targetType==='air' && !isAir(target)) return;
  target.hp -= attacker.dps * dt;
  updateHPBar(target);
  if(target.hp<=0) destroyEntity(target, attacker);
  if(Math.random()<.3) drawBeam(attacker.pos, target.pos);
}
function isAir(ent){ if(ent.unitType){ return state.STATS[ent.unitType].medium==='air' } return false }
function destroyEntity(ent,killer){
  ent.dead=true; ent.marker?.remove?.();
  if(ent.unitType){
    const arr = ent.side==='player'? state.player.units : state.ai.units; const i=arr.indexOf(ent); if(i>=0) arr.splice(i,1);
  } else {
    const arr = ent.side==='player'? state.player.buildings : state.ai.buildings; const i=arr.indexOf(ent); if(i>=0) arr.splice(i,1);
    if(ent.isBase){ endGame(ent.side!=='player'); }
  }
  if(state.selection.has(ent)) state.selection.delete(ent);
  if(killer) state.log(`${killer.side==='player'?'Bizim':'AI'} ${killer.unitType||killer.buildingType} birimi ${ent.unitType||ent.buildingType} yok etti.`);
}
function drawBeam(a,b){
  const p1=state.map.latLngToLayerPoint(a), p2=state.map.latLngToLayerPoint(b);
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  line.setAttribute('x1',p1.x); line.setAttribute('y1',p1.y); line.setAttribute('x2',p2.x); line.setAttribute('y2',p2.y);
  line.setAttribute('class','beam'); state.svg.appendChild(line); setTimeout(()=> line.remove(), 160);
}
function endGame(win){
  const modal=document.getElementById('helpModal'); const box=modal.querySelector('.glass'); modal.classList.add('show');
  box.querySelector('.text-lg').textContent = win? 'Zafer!' : 'Yenilgi!';
  box.querySelector('ul').innerHTML = `<li>${win? 'AI üssünü yok ettiniz.' : 'Üssünüz yok edildi.'}</li>`;
}
function acquireTarget(u,enemies){
  let best=null,bestD=Infinity;
  for(const e of enemies){
    if(e.dead) continue;
    if(state.STATS[u.unitType].target==='ground' && isAir(e)) continue;
    if(state.STATS[u.unitType].target==='air' && !isAir(e)) continue;
    const d=state.distance(u.pos,e.pos); if(d<bestD){ best=e; bestD=d; }
  }
  return best;
}
function acquireTargetInRange(u,enemies,R){
  let best=null,bestD=Infinity;
  for(const e of enemies){
    if(e.dead) continue;
    if(state.STATS[u.unitType].target==='ground' && isAir(e)) continue;
    if(state.STATS[u.unitType].target==='air' && !isAir(e)) continue;
    const d=state.distance(u.pos,e.pos); if(d<=R && d<bestD){ best=e; bestD=d; }
  }
  return best;
}

/* expose moveUnit from movement without circular import at top */
import { moveUnit as _move } from './movement.js';
window.moveUnit = _move;
