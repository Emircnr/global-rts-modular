import { state } from '../core/state.js';

/* === PATCHPOINT: WALL_COST === */
const WALL_COST_PER_M = 0.02;

export function wireWalls(){
  state.buildMode=null; state.wallDrawing=false; state.wallChain=null;

  window.handleWallClick = handleWallClick;
  state.map.on('contextmenu', (e)=>{ // sağ tık: duvar modunda bitir
    if(state.wallDrawing){ finishWallChain(); }
  });
}
function handleWallClick(latlng){
  if(state.buildMode!=='wall') return;
  if(!state.wallDrawing){
    state.wallDrawing=true; state.wallChain={start:latlng, last:latlng};
    state.hint('Duvar: ikinci noktayı tıklayın (sağ tıkla bitir).');
  }else{
    const A=state.wallChain.last, B=latlng;
    const len = state.distance(A,B);
    const cost = (len*WALL_COST_PER_M);
    if(state.player.money<cost){ state.hint('Yetersiz para (duvar).'); return; }
    state.player.money-=cost; state.updateHUD();
    addWallSegment(A,B);
    state.wallChain.last = B;
  }
}
function finishWallChain(){
  state.wallDrawing=false; state.wallChain=null; state.hint('Duvar çizimi bitti.');
}
function addWallSegment(A,B){
  const poly = L.polyline([A,B], {color:'#9ca3af', weight:6, opacity:0.9, className:'wall-seg'}).addTo(state.layers.walls);
  const seg = {latlngs:[A,B], polyline:poly, hp:400};
  state.WALLS.push(seg);
}
