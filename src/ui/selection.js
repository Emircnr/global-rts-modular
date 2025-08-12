import { state } from '../core/state.js';
import { id } from './dom.js';
import { setSelected, clearSelection } from './production.js';

export function wireSelection(){
  const overlay = id('selectOverlay');
  let draggingSel=false, selStart=null, selBox=null;

  state.map.getContainer().addEventListener('mousedown', (e)=>{
    if(e.button!==0) return; // only left
    if(e.target.closest('.glass,.btn,.leaflet-control')) return; // ignore UI
    draggingSel=true;
    selStart = {x:e.clientX, y:e.clientY};
    selBox = document.createElement('div'); selBox.className='selbox'; overlay.appendChild(selBox);
    updateSelBox(e.clientX,e.clientY);
    state.map.dragging.disable();
  });
  window.addEventListener('mousemove',(e)=>{ if(!draggingSel) return; updateSelBox(e.clientX,e.clientY); });
  window.addEventListener('mouseup',(e)=>{
    if(!draggingSel) return; draggingSel=false; state.map.dragging.enable();
    const rect = normRect(selStart.x, selStart.y, e.clientX, e.clientY);
    selectUnitsInRect(rect);
    selBox.remove(); selBox=null;
  });

  function updateSelBox(x,y){
    const r=normRect(selStart.x,selStart.y,x,y);
    Object.assign(selBox.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
  }
  function normRect(x1,y1,x2,y2){ const x=Math.min(x1,x2), y=Math.min(y1,y2); return {x,y,w:Math.abs(x2-x1),h:Math.abs(y2-y1)}; }
  function selectUnitsInRect(rect){
    clearSelection();
    const cont = state.map.getContainer().getBoundingClientRect();
    const x0=rect.x-cont.left, y0=rect.y-cont.top, x1=x0+rect.w, y1=y0+rect.h;
    const pts = state.player.units.map(u=> [u, state.map.latLngToContainerPoint(u.pos)]);
    pts.forEach(([u,p])=>{ if(p.x>=x0 && p.x<=x1 && p.y>=y0 && p.y<=y1){ setSelected(u,true) } });
    state.hint(state.selection.size? state.selection.size+' birim seçildi.' : 'Seçim yok.');
  }
}
