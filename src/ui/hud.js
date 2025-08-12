import { state } from '../core/state.js';
import { id, qsa } from './dom.js';

export function buildHUD(){
  // inject helpers
  state.updateHUD = ()=>{
    id('money').textContent = Math.floor(state.player.money);
    id('food').textContent  = Math.floor(state.player.food);
    id('oil').textContent   = Math.floor(state.player.oil);
    id('iron').textContent  = Math.floor(state.player.iron);
  };
  state.hint = (msg)=> { id('hint').textContent = msg; };
  state.log = (msg)=>{ const t=document.createElement('div'); t.textContent=msg; id('log').prepend(t); };
  state.updateQueueUI = ()=>{
    const queueEl=id('queue'); queueEl.innerHTML='';
    const list = state.player.units.filter(u=>u.unitType==='kepce').map(k=> k.job? `⛏️ ${labelOf(k.job.type)} kuruluyor` : '⏳ Boş')
      .concat( (state.player.queue||[]).map(j=>`🧱 Sırada: ${labelOf(j.type)}`) );
    list.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; queueEl.appendChild(li); });
  };
  state.addMarker = (ent)=>{
    const isUnit = !!ent.unitType;
    const isPlayer = ent.side==='player';
    const html = `<div class="${isUnit?'unit':'building'} ${isPlayer?'player':'ai'} ${cssClass(ent)}"><div class="hpbar"><div class="hpfill" style="width:100%"></div></div></div>`;
    const icon = L.divIcon({className:'',html,iconSize:[isUnit?22:28,isUnit?22:28]});
    const layer = isUnit? state.layers.units : state.layers.buildings;
    const m = L.marker(ent.pos,{icon,zIndexOffset:isUnit?1000:500}).addTo(layer);
    ent.marker = m;
    m.on('click', (e)=> onMarkerClick(ent,e));
    m.on('contextmenu', (e)=> {}); // future
    m.on('dblclick', (e)=> window.quickProduce?.(ent));
    return m;
  };
  state.removeMarker = (ent)=> { ent.marker?.remove?.() };
}

export function wireHUD(){
  const speedRange = id('speedRange'), speedLbl=id('speedLbl');
  const setSpeed = (v)=>{ state.gameSpeed = clamp(v,1,100); speedRange.value=String(state.gameSpeed); speedLbl.textContent = state.gameSpeed+'x'; state.hint('Hız: '+state.gameSpeed+'x'); };
  qsa('[data-speed]').forEach(b=> b.addEventListener('click',()=> setSpeed(+b.dataset.speed)));
  speedRange.addEventListener('input', ()=> setSpeed(+speedRange.value));
  setSpeed(1);

  const stanceBtn = id('stanceBtn');
  stanceBtn.addEventListener('click', ()=>{
    state.playerStance = (state.playerStance==='aggressive')? 'hold' : 'aggressive';
    stanceBtn.textContent = state.playerStance==='aggressive'? 'Agresif' : 'Tut';
    stanceBtn.className = 'btn ' + (state.playerStance==='aggressive'? 'bg-emerald-500/15' : 'bg-yellow-500/20');
  });

  id('helpBtn').onclick = ()=> id('helpModal').classList.add('show');
}
function labelOf(type){
  const m={mill:'Değirmen',refinery:'Rafineri',mine:'Maden',port:'Liman',factory:'Tank Fabrikası',barracks:'Kışla',
    rocketlab:'Roket Tesisi',airbase:'Hava Üssü',sam:'Patriot (SAM)',ship:'Gemi',soldier:'Asker',apc:'APC',tank:'Leopard 2A7',
    t90:'T-90M',f16:'F-16C',tb2:'TB2',apache:'AH-64D',kepce:'Kepçe',himars:'HIMARS',wall:'Duvar'};
  return m[type]||type;
}
function clamp(x,a,b){ return Math.max(a,Math.min(b,x)) }

/* selection click handler is injected here to avoid circular deps */
import { renderProductionPanel, clearSelection, setSelected } from './production.js';
function onMarkerClick(ent,e){
  if(e.originalEvent.shiftKey){ setSelected(ent, !state.selection.has(ent)); }
  else { clearSelection(); setSelected(ent,true); }
}
function cssClass(ent){
  if(ent.unitType){
    const m={kepce:'kepce',soldier:'soldier',apc:'apc',tank:'tank',t90:'t90',himars:'himars',ship:'ship',f16:'f16',tb2:'tb2',apache:'apache'}; return m[ent.unitType]||'neutral'
  } else if(ent.buildingType){
    if(ent.isBase) return 'base';
    return ent.buildingType;
  }
  return 'neutral';
}
