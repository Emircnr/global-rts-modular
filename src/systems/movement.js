import { state } from '../core/state.js';
import { Building } from '../entities/Building.js';
import { updateHPBar } from '../ui/production.js';

export function moveUnit(dt,u){
  if(!u.dest) return;
  if(!state.canUnitGoTo(u,u.dest)){ u.dest=null; return; }
  const step = u.speed*dt;
  const next = state.latlngTowards(u.pos,u.dest,step);
  // Duvar çarpışması (hava dışı)
  if(state.STATS[u.unitType].medium!=='air'){
    if(intersectsAnyWall(u.pos,next)){ u.dest=null; state.hint('🧱 Duvar engel oldu.'); return; }
  }
  u.pos=next; u.marker.setLatLng(u.pos);
  if(state.distance(u.pos,u.dest)<4){ u.dest=null }
}

export function tickKepce(dt, u, owner){
  moveUnit(dt,u);
  if(u.job && u.dest==null){
    if(!u.buildTask){
      const type=u.job.type; const c=state.COST[type];
      const b = new Building({side:u.side,pos:u.job.pos,buildingType:type});
      b.buildProgress=0; b.buildNeeded=(c.build||30); b.underConstruction=true;
      state.addMarker(b);
      b.marker.getElement().querySelector('.hpbar').insertAdjacentHTML('beforebegin','<div class="buildbar"><div class="buildfill" style="width:0%"></div></div>');
      u.buildTask=b; owner.buildings.push(b);
    } else {
      u.buildTask.buildProgress += dt;
      const pct=Math.min(100,(u.buildTask.buildProgress/u.buildTask.buildNeeded)*100);
      const el=u.buildTask.marker.getElement(); if(el){ const f=el.querySelector('.buildfill'); if(f) f.style.width=pct+'%'; }
      if(u.buildTask.buildProgress>=u.buildTask.buildNeeded){
        u.buildTask.underConstruction=false;
        const el2=u.buildTask.marker.getElement(); if(el2){ const bb=el2.querySelector('.buildbar'); if(bb) bb.remove(); }
        state.log(`${owner===state.player?'Bizim':'AI'} ${labelOf(u.job.type)} tamamlandı.`);
        u.job=null; u.buildTask=null;
        if(owner.queue.length>0){ u.job=owner.queue.shift(); u.dest=u.job.pos; }
        state.updateQueueUI(); state.updateHUD();
      }
    }
  }
}

export function updateHP(ent, delta){
  ent.hp += delta; updateHPBar(ent);
  if(ent.hp<=0) destroyEntity(ent);
}
function destroyEntity(ent,killer){
  ent.dead=true; state.removeMarker(ent);
  if(ent.unitType){
    const arr = ent.side==='player'? state.player.units : state.ai.units; const i=arr.indexOf(ent); if(i>=0) arr.splice(i,1);
  } else {
    const arr = ent.side==='player'? state.player.buildings : state.ai.buildings; const i=arr.indexOf(ent); if(i>=0) arr.splice(i,1);
    if(ent.isBase){ endGame(ent.side!=='player'); }
  }
  if(state.selection.has(ent)) state.selection.delete(ent);
  if(killer) state.log(`${killer.side==='player'?'Bizim':'AI'} ${killer.unitType||killer.buildingType} birimi ${ent.unitType||ent.buildingType} yok etti.`);
}
function endGame(win){
  const modal=document.getElementById('helpModal'); const box=modal.querySelector('.glass'); modal.classList.add('show');
  box.querySelector('.text-lg').textContent = win? 'Zafer!' : 'Yenilgi!';
  box.querySelector('ul').innerHTML = `<li>${win? 'AI üssünü yok ettiniz.' : 'Üssünüz yok edildi.'}</li>`;
}

/* walls */
function intersectsAnyWall(A,B){
  const a = state.map.latLngToLayerPoint(A), b = state.map.latLngToLayerPoint(B);
  for(const w of state.WALLS){
    const c = state.map.latLngToLayerPoint(w.latlngs[0]), d = state.map.latLngToLayerPoint(w.latlngs[1]);
    if(segmentsIntersect(a,b,c,d)) return true;
  }
  return false;
}
function segmentsIntersect(p1,p2,p3,p4){
  function ccw(a,b,c){ return (c.y-a.y)*(b.x-a.x) > (b.y-a.y)*(c.x-a.x) }
  return (ccw(p1,p3,p4) !== ccw(p2,p3,p4)) && (ccw(p1,p2,p3) !== ccw(p1,p2,p4));
}
function labelOf(type){
  const m={mill:'Değirmen',refinery:'Rafineri',mine:'Maden',port:'Liman',factory:'Tank Fabrikası',barracks:'Kışla',rocketlab:'Roket Tesisi',airbase:'Hava Üssü',sam:'Patriot (SAM)',ship:'Gemi',soldier:'Asker',apc:'APC',tank:'Leopard 2A7',t90:'T-90M',f16:'F-16C',tb2:'TB2',apache:'AH-64D',kepce:'Kepçe',himars:'HIMARS',wall:'Duvar'};
  return m[type]||type;
}
