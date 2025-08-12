import { state, COST } from '../core/state.js';
import { id } from './dom.js';
import { Unit } from '../entities/Unit.js';
import { Building } from '../entities/Building.js';

export function wireProduction(){
  // Build buttons
  const buildList = ['mill','refinery','mine','barracks','factory','rocketlab','airbase','sam','port','WALL'];
  const wrap = id('buildButtons');
  for(const key of buildList){
    const btn=document.createElement('button');
    if(key==='WALL'){ btn.id='wallTool'; btn.innerHTML='🧱 Duvar Çiz <span class="opacity-70 text-xs">(metre başı 💰0.02)</span>'; }
    else btn.innerHTML=`${emoji(key)} ${labelOf(key)} <span class="opacity-70 text-xs">${costText(key)}</span>`;
    btn.className='btn bg-white/5 hover:bg-white/10';
    wrap.appendChild(btn);
  }
  id('wallTool').addEventListener('click',()=> {
    state.buildMode = 'wall'; state.wallDrawing=false; state.wallChain=null; state.hint('Duvar Çiz modu: başlangıç noktasını tıklayın. Sağ tıkla bitir.');
  });

  // Map click to place build jobs
  state.map.on('click', (e)=>{
    if(state.buildMode){
      if(state.buildMode==='wall'){ window.handleWallClick?.(e.latlng); return; }
      const c=COST[state.buildMode]; if(!canPay(state.player,c)){ state.hint('Yetersiz kaynak.'); state.buildMode=null; return; }
      pay(state.player,c); state.updateHUD();
      enqueueBuildJob(state.player, {type:state.buildMode, pos:e.latlng});
      state.updateQueueUI();
      state.hint(labelOf(state.buildMode) + ' için kepçe yola çıktı.');
      state.buildMode=null; return;
    }
    // boş tıklamada seçim temizleme (Shift değilse)
    if(!e.originalEvent.shiftKey) clearSelection();
  });
}

export function renderProductionPanel(){
  const prodPanel = id('prodPanel');
  const items = [...state.selection].filter(x=> x instanceof Building && x.side==='player');
  prodPanel.innerHTML = '';
  if(items.length!==1){ prodPanel.innerHTML = '<div class="opacity-60">Bir bina seçin…</div>'; return; }
  const b = items[0]; const wrap=document.createElement('div');

  const addBtn=(title, costStr, kind)=>{
    const btn=document.createElement('button');
    btn.className='btn bg-white/5 hover:bg-white/10 w-full justify-between';
    btn.innerHTML=`<span>${title}</span><span class="opacity-70 text-xs">${costStr}</span>`;
    btn.onclick=()=> produceFromBuilding(b,kind);
    wrap.appendChild(btn);
  };

  if(b.isBase){ addBtn('⛏️ Kepçe', costText('excavator'), 'kepce'); }
  if(b.buildingType==='barracks'){ addBtn('🪖 Asker', costText('soldier'), 'soldier'); }
  if(b.buildingType==='factory'){
    addBtn('🚙 APC (M113)', costText('apc'),'apc');
    addBtn('🛡️ Tank (Leopard 2A7)', costText('tank'),'tank');
    addBtn('🛡️ Tank (T-90M)', costText('t90'),'t90');
  }
  if(b.buildingType==='rocketlab'){ addBtn('🚀 HIMARS', costText('himars'),'himars'); }
  if(b.buildingType==='port'){ addBtn('🚢 Gemi', costText('ship'),'ship'); }
  if(b.buildingType==='airbase'){
    addBtn('✈️ F-16C', costText('f16'),'f16');
    addBtn('🛩️ TB2', costText('tb2'),'tb2');
    addBtn('🚁 AH-64D', costText('apache'),'apache');
  }
  if(!wrap.childNodes.length){ prodPanel.innerHTML='<div class="opacity-60">Bu binadan üretim yok.</div>'; }
  else prodPanel.appendChild(wrap);
}
export function setSelected(ent,val){
  const el = ent.marker?.getElement()?.firstChild; if(!el) return;
  if(val){ el.classList.add('sel'); state.selection.add(ent) } else { el.classList.remove('sel'); state.selection.delete(ent) }
  renderProductionPanel(); renderRangeRing();
}
export function clearSelection(){ [...state.selection].forEach(x=> setSelected(x,false)); renderProductionPanel(); renderRangeRing(); }
export function renderRangeRing(){
  if(state.rangeCircle){ state.rangeCircle.remove(); state.rangeCircle=null; }
  if(state.selection.size===1){
    const ent=[...state.selection][0];
    const r = ent.unitType? (state.STATS[ent.unitType].range||0) : 0;
    if(r>0){ state.rangeCircle = L.circle(ent.pos,{radius:r,color:'#60a5fa',weight:1,fillOpacity:0.05,opacity:0.7}).addTo(state.map); }
  }
}

function costText(kind){
  const c=COST[kind]; const z=[];
  if(c.money) z.push(`💰${c.money}`); if(c.food) z.push(`🌾${c.food}`); if(c.oil) z.push(`🛢️${c.oil}`); if(c.iron) z.push(`⛏️${c.iron}`);
  return '('+z.join(' + ')+')';
}
function emoji(type){
  const m={mill:'🌾',refinery:'🛢️',mine:'⛏️',port:'⚓',factory:'🏭',barracks:'🎖️',rocketlab:'🛰️',airbase:'🛫',sam:'🎯'}; return m[type]||'';
}
function labelOf(type){
  const m={mill:'Değirmen',refinery:'Rafineri',mine:'Maden',port:'Liman',factory:'Tank Fabrikası',barracks:'Kışla',
    rocketlab:'Roket Tesisi',airbase:'Hava Üssü',sam:'Patriot (SAM)',ship:'Gemi',soldier:'Asker',apc:'APC',tank:'Leopard 2A7',
    t90:'T-90M',f16:'F-16C',tb2:'TB2',apache:'AH-64D',kepce:'Kepçe',himars:'HIMARS',wall:'Duvar'};
  return m[type]||type;
}
function canPay(side,c){ return (side.money>=(c.money||0)) && (side.food>=(c.food||0)) && (side.oil>=(c.oil||0)) && (side.iron>=(c.iron||0)) }
function pay(side,c){ side.money-=(c.money||0); side.food-=(c.food||0); side.oil-=(c.oil||0); side.iron-=(c.iron||0) }

export function quickProduce(ent){
  if(!(ent instanceof Building) || ent.side!=='player') return;
  if(ent.isBase) return produceFromBuilding(ent,'kepce');
  if(ent.buildingType==='barracks') return produceFromBuilding(ent,'soldier');
  if(ent.buildingType==='factory') return produceFromBuilding(ent,'tank');
  if(ent.buildingType==='port') return produceFromBuilding(ent,'ship');
  if(ent.buildingType==='rocketlab') return produceFromBuilding(ent,'himars');
  if(ent.buildingType==='airbase') return produceFromBuilding(ent,'f16');
}
window.quickProduce = quickProduce; // dblclick'te kullanıyoruz

export function enqueueBuildJob(sideObj, job){
  const kepces = sideObj.units.filter(u=>u.unitType==='kepce');
  const free = kepces.find(k=>!k.job);
  if(free){ free.job = job; free.dest = job.pos; state.updateQueueUI(); }
  else { sideObj.queue.push(job); state.updateQueueUI(); }
}
window.enqueueBuildJob = enqueueBuildJob; // make available to AI

export function updateHPBar(ent){
  const el = ent.marker?.getElement(); if(!el) return; const fill=el.querySelector('.hpfill');
  const maxHP = ent.unitType? state.STATS[ent.unitType].hp : state.STATS[ent.buildingType].hp;
  const pct = Math.max(0,Math.min(100,(ent.hp/maxHP)*100));
  fill.style.width=pct+'%';
  fill.style.background = pct<33? 'linear-gradient(90deg,#ef4444,#dc2626)' : pct<66? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#22c55e,#16a34a)';
}

function produceFromBuilding(b,kind){
  const need = state.COST[kind==='kepce'?'excavator':kind];
  if(!canPay(state.player,need)){ state.hint('Yetersiz kaynak.'); return; }
  const pos = findSpawnAround(b.pos, kind);
  if(!pos){ state.hint('Çıkış noktası bulunamadı.'); return; }
  pay(state.player,need); state.updateHUD();
  const u = new Unit({side:'player', pos, unitType:kind}); state.player.units.push(u); state.addMarker(u);
  state.hint(labelOf(kind)+' üretildi.');
}
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
