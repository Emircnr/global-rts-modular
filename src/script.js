/* =========================================================
   Global RTS — Tek dosyalı (modülsüz) GitHub Pages sürümü
   ========================================================= */
(function(){
  /* ---------- Kısayollar ---------- */
  const id = (x)=> document.getElementById(x);
  const qsa = (sel,root=document)=> [...root.querySelectorAll(sel)];
  const clamp=(x,a,b)=> Math.max(a,Math.min(b,x));

  /* ---------- Oyun Değerleri ---------- */
  const COST = {
    mill:{money:80, build:25}, refinery:{money:80, build:25}, mine:{money:80, build:25}, port:{money:180, build:30},
    barracks:{money:120, build:30}, factory:{money:180, oil:40, build:45}, rocketlab:{money:220, iron:40, build:60},
    airbase:{money:250, iron:30, build:60}, sam:{money:200, iron:25, build:40},
    excavator:{money:70, oil:20}, soldier:{money:30, food:20}, apc:{money:90, oil:30, iron:15},
    tank:{money:140, oil:60, iron:40}, t90:{money:150, oil:60, iron:45},
    himars:{money:200, oil:40, iron:50}, ship:{money:120, oil:60},
    f16:{money:260, oil:120, iron:60}, tb2:{money:160, oil:60, iron:30}, apache:{money:220, oil:80, iron:50},
  };
  const STATS = {
    kepce:{hp:140, speed:6, range:0, dps:0, medium:'land', target:'none'},
    soldier:{hp:80, speed:1.6, range:200, dps:8, medium:'land', target:'ground'},
    apc:{hp:160, speed:7, range:350, dps:12, medium:'land', target:'ground'},
    tank:{hp:260, speed:6, range:800, dps:26, medium:'land', target:'ground'},
    t90:{hp:280, speed:7, range:800, dps:28, medium:'land', target:'ground'},
    himars:{hp:180, speed:7, range:30000, dps:40, medium:'land', target:'ground'},
    ship:{hp:260, speed:12, range:900, dps:18, medium:'water', target:'ground'},
    f16:{hp:200, speed:150, range:25000, dps:36, medium:'air', target:'any'},
    tb2:{hp:120, speed:55, range:15000, dps:14, medium:'air', target:'ground'},
    apache:{hp:180, speed:85, range:6000, dps:30, medium:'air', target:'any'},
    base:{hp:900}, mill:{hp:220}, refinery:{hp:240}, mine:{hp:240}, port:{hp:260},
    factory:{hp:340}, barracks:{hp:280}, rocketlab:{hp:340}, airbase:{hp:360}, sam:{hp:300},
  };
  const RATES = { tickSec:3, foodPerMill:4, oilPerRef:3, ironPerMine:3, portMoneyBonus:0.20 };
  const WALL_COST_PER_M = 0.02;

  /* ---------- State ---------- */
  const Side = { PLAYER:'player', AI:'ai' };
  const player = { money:150, food:40, oil:50, iron:30, units:[], buildings:[], base:null, queue:[], ports(){ return this.buildings.filter(b=>b.buildingType==='port').length } };
  const ai     = { money:150, food:40, oil:50, iron:30, units:[], buildings:[], base:null, queue:[], lastThink:0 };
  const selection = new Set();
  const WALLS=[];

  let map, svg, LAYERS, rangeCircle=null, attackMoveMode=false, playerStance='hold', gameSpeed=1;

  /* ---------- Land mask (coarse) ---------- */
  const LAND_BOXES = [
    [5,-168,83,-52],[-56,-82,13,-34],[35,-10,72,40],[-35,-18,37,52],[5,26,81,180],[-45,110,-10,160],[59,-74,84,-12]
  ];
  function isLand(latlng){ const {lat,lng}=latlng; for(const b of LAND_BOXES){ if(lat>=b[0]&&lat<=b[2]&&lng>=b[1]&&lng<=b[3]) return true } return false }

  /* ---------- DOM kısa yardımcılar ---------- */
  const moneyEl=id('money'), foodEl=id('food'), oilEl=id('oil'), ironEl=id('iron');
  const hintEl=id('hint'), logEl=id('log'), queueEl=id('queue'), prodPanel=id('prodPanel');
  function hint(msg){ hintEl.textContent=msg }
  function log(msg){ const t=document.createElement('div'); t.textContent=msg; logEl.prepend(t) }
  function updateHUD(){ moneyEl.textContent=Math.floor(player.money); foodEl.textContent=Math.floor(player.food); oilEl.textContent=Math.floor(player.oil); ironEl.textContent=Math.floor(player.iron); }

  /* ---------- Map init ---------- */
  function createMap(){
    map = L.map('map', { zoomControl:true, worldCopyJump:true, minZoom:2, maxZoom:18 });
    // OSM tile (her yerde çalışır)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap contributors', noWrap:false, maxZoom:19
    }).addTo(map);
    map.setView([41.0082,28.9784], 10);

    const svgLayer = L.svg({clickable:false}).addTo(map);
    svg = svgLayer._container.querySelector('svg');

    LAYERS = {
      units: L.layerGroup().addTo(map),
      buildings: L.layerGroup().addTo(map),
      walls: L.layerGroup().addTo(map)
    };
  }

  /* ---------- Entities ---------- */
  let ENT_ID=1; const ENT_INDEX=new Map();
  class Entity{ constructor(opts){ Object.assign(this,opts); this.id=ENT_ID++; this.dead=false; ENT_INDEX.set(this.id,this) } }
  class Unit extends Entity{
    constructor(opts){
      super(opts);
      const S=STATS[opts.unitType]; this.hp=S.hp; this.speed=S.speed; this.range=S.range||0; this.dps=S.dps||0; this.medium=S.medium||'land'; this.targetType=S.target||'ground';
      this.dest=null; this.target=null; this.attackMove=false; this.job=null; this.buildTask=null;
      this.marker=createMarker(this,true);
    }
  }
  class Building extends Entity{
    constructor(opts){ super(opts); this.hp=STATS[opts.buildingType].hp; this.marker=createMarker(this,false); }
  }

  function createMarker(ent,isUnit){
    const isPlayer=ent.side===Side.PLAYER;
    const html = `<div class="${isUnit?'unit':'building'} ${isPlayer?'player':'ai'} ${cssClass(ent)}"><div class="hpbar"><div class="hpfill" style="width:100%"></div></div></div>`;
    const icon = L.divIcon({className:'',html,iconSize:[isUnit?22:28,isUnit?22:28]});
    const m = L.marker(ent.pos,{icon,zIndexOffset:isUnit?1000:500}).addTo(isUnit?LAYERS.units:LAYERS.buildings);
    m.on('click', (e)=> onMarkerClick(ent,e));
    m.on('dblclick', ()=> quickProduce(ent));
    return m;
  }
  function cssClass(ent){
    if(ent.unitType){
      const m={kepce:'kepce',soldier:'soldier',apc:'apc',tank:'tank',t90:'t90',himars:'himars',ship:'ship',f16:'f16',tb2:'tb2',apache:'apache'}; return m[ent.unitType]||'neutral'
    } else if(ent.buildingType){ return ent.isBase? 'base' : ent.buildingType }
    return 'neutral';
  }
  function onMarkerClick(ent,e){
    if(e.originalEvent.shiftKey){ setSelected(ent, !selection.has(ent)); }
    else { clearSelection(); setSelected(ent,true); }
  }
  function setSelected(ent,val){
    const el = ent.marker.getElement()?.firstChild; if(!el) return;
    if(val){ el.classList.add('sel'); selection.add(ent) } else { el.classList.remove('sel'); selection.delete(ent) }
    renderProductionPanel(); renderRangeRing();
  }
  function clearSelection(){ [...selection].forEach(x=> setSelected(x,false)); }
  function renderRangeRing(){
    if(rangeCircle){ rangeCircle.remove(); rangeCircle=null; }
    if(selection.size===1){
      const ent=[...selection][0]; const r=ent.unitType? (STATS[ent.unitType].range||0) : 0;
      if(r>0){ rangeCircle=L.circle(ent.pos,{radius:r,color:'#60a5fa',weight:1,fillOpacity:0.05,opacity:0.7}).addTo(map); }
    }
  }
  function updateHPBar(ent){
    const el = ent.marker.getElement(); if(!el) return; const fill=el.querySelector('.hpfill');
    const maxHP = ent.unitType? STATS[ent.unitType].hp : STATS[ent.buildingType].hp;
    const pct = clamp((ent.hp/maxHP)*100,0,100);
    fill.style.width=pct+'%';
    fill.style.background = pct<33? 'linear-gradient(90deg,#ef4444,#dc2626)' : pct<66? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#22c55e,#16a34a)';
  }

  /* ---------- Build UI ---------- */
  function labelOf(type){
    const m={mill:'Değirmen',refinery:'Rafineri',mine:'Maden',port:'Liman',factory:'Tank Fabrikası',barracks:'Kışla',
      rocketlab:'Roket Tesisi',airbase:'Hava Üssü',sam:'Patriot (SAM)',ship:'Gemi',soldier:'Asker',apc:'APC',tank:'Leopard 2A7',
      t90:'T-90M',f16:'F-16C',tb2:'TB2',apache:'AH-64D',kepce:'Kepçe',himars:'HIMARS',wall:'Duvar'};
    return m[type]||type;
  }
  function costText(kind){
    const c=COST[kind]; const z=[]; if(!c) return '';
    if(c.money) z.push(`💰${c.money}`); if(c.food) z.push(`🌾${c.food}`); if(c.oil) z.push(`🛢️${c.oil}`); if(c.iron) z.push(`⛏️${c.iron}`);
    return '('+z.join(' + ')+')';
  }
  function canPay(side,c){ return (side.money>=(c?.money||0)) && (side.food>=(c?.food||0)) && (side.oil>=(c?.oil||0)) && (side.iron>=(c?.iron||0)) }
  function pay(side,c){ side.money-=(c.money||0); side.food-=(c.food||0); side.oil-=(c.oil||0); side.iron-=(c.iron||0) }

  function renderBuildButtons(){
    const wrap=id('buildButtons'); wrap.innerHTML='';
    const keys=['mill','refinery','mine','barracks','factory','rocketlab','airbase','sam','port','WALL'];
    for(const key of keys){
      const btn=document.createElement('button');
      btn.className='btn bg-white/5 hover:bg-white/10';
      if(key==='WALL'){ btn.id='wallTool'; btn.innerHTML='🧱 Duvar Çiz <span class="opacity-70 text-xs">(metre başı 💰0.02)</span>'; }
      else btn.innerHTML=`${labelEmoji(key)} ${labelOf(key)} <span class="opacity-70 text-xs">${costText(key)}</span>`;
      wrap.appendChild(btn);
    }
    id('wallTool').addEventListener('click',()=> { buildMode='wall'; wallDrawing=false; wallChain=null; hint('Duvar Çiz: başlangıç noktasını tıklayın. Sağ tıkla bitirin.'); });
  }
  function labelEmoji(type){ const m={mill:'🌾',refinery:'🛢️',mine:'⛏️',port:'⚓',factory:'🏭',barracks:'🎖️',rocketlab:'🛰️',airbase:'🛫',sam:'🎯'}; return m[type]||'' }

  function renderProductionPanel(){
    const items=[...selection].filter(x=> x instanceof Building && x.side===Side.PLAYER);
    prodPanel.innerHTML='';
    if(items.length!==1){ prodPanel.innerHTML='<div class="opacity-60">Bir bina seçin…</div>'; return; }
    const b=items[0], wrap=document.createElement('div');
    const addBtn=(title,costStr,kind)=>{ const btn=document.createElement('button'); btn.className='btn bg-white/5 hover:bg-white/10 w-full justify-between'; btn.innerHTML=`<span>${title}</span><span class="opacity-70 text-xs">${costStr}</span>`; btn.onclick=()=> produceFromBuilding(b,kind); wrap.appendChild(btn); };
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
  function quickProduce(ent){
    if(!(ent instanceof Building) || ent.side!==Side.PLAYER) return;
    if(ent.isBase) return produceFromBuilding(ent,'kepce');
    if(ent.buildingType==='barracks') return produceFromBuilding(ent,'soldier');
    if(ent.buildingType==='factory') return produceFromBuilding(ent,'tank');
    if(ent.buildingType==='port') return produceFromBuilding(ent,'ship');
    if(ent.buildingType==='rocketlab') return produceFromBuilding(ent,'himars');
    if(ent.buildingType==='airbase') return produceFromBuilding(ent,'f16');
  }

  /* ---------- Build & Walls ---------- */
  let buildMode=null, wallDrawing=false, wallChain=null;
  mapClickInit();
  function mapClickInit(){
    // Sol tık: inşa yer seç / boş tıklama: seçim temizle
    map?.on?.('click', onMapClick);
    // Sağ tık: hareket / duvar bitir
    map?.on?.('contextmenu', (e)=>{ if(selection.size===0){ if(wallDrawing) finishWallChain(); return; } rightClickCommand(e); });
    // Kutu seçimi
    wireSelectionBox();
  }
  function onMapClick(e){
    if(buildMode){
      if(buildMode==='wall'){ handleWallClick(e.latlng); return; }
      const c=COST[buildMode];
      if(!canPay(player,c)){ hint('Yetersiz kaynak.'); buildMode=null; return; }
      pay(player,c); updateHUD();
      enqueueBuildJob(player, {type:buildMode, pos:e.latlng});
      updateQueueUI();
      hint(labelOf(buildMode)+' için kepçe yola çıktı.');
      buildMode=null; return;
    }
    clearSelection();
  }
  function handleWallClick(latlng){
    if(!wallDrawing){
      wallDrawing=true; wallChain={start:latlng, last:latlng};
      hint('Duvar: ikinci noktayı tıklayın (sağ tıkla bitir).');
    }else{
      const A=wallChain.last, B=latlng;
      const len=map.distance(A,B); const cost=len*WALL_COST_PER_M;
      if(player.money<cost){ hint('Yetersiz para (duvar).'); return; }
      player.money-=cost; updateHUD();
      addWallSegment(A,B);
      wallChain.last=B;
    }
  }
  function finishWallChain(){ wallDrawing=false; wallChain=null; hint('Duvar çizimi bitti.'); }
  function addWallSegment(A,B){
    const poly=L.polyline([A,B],{color:'#9ca3af',weight:6,opacity:0.9,className:'wall-seg'}).addTo(LAYERS.walls);
    WALLS.push({latlngs:[A,B],polyline:poly,hp:400});
  }
  function intersectsAnyWall(A,B){
    const a=map.latLngToLayerPoint(A), b=map.latLngToLayerPoint(B);
    for(const w of WALLS){
      const c=map.latLngToLayerPoint(w.latlngs[0]), d=map.latLngToLayerPoint(w.latlngs[1]);
      if(segmentsIntersect(a,b,c,d)) return true;
    }
    return false;
  }
  function segmentsIntersect(p1,p2,p3,p4){
    function ccw(a,b,c){ return (c.y-a.y)*(b.x-a.x) > (b.y-a.y)*(c.x-a.x) }
    return (ccw(p1,p3,p4)!==ccw(p2,p3,p4)) && (ccw(p1,p2,p3)!==ccw(p1,p2,p4));
  }

  /* ---------- Selection Box ---------- */
  function wireSelectionBox(){
    const overlay=id('selectOverlay');
    let draggingSel=false, selStart=null, selBox=null;
    map.getContainer().addEventListener('mousedown',(e)=>{
      if(e.button!==0) return;
      if(e.target.closest('.glass,.btn,.leaflet-control')) return;
      draggingSel=true; selStart={x:e.clientX,y:e.clientY};
      selBox=document.createElement('div'); selBox.className='selbox'; overlay.appendChild(selBox);
      updateSelBox(e.clientX,e.clientY); map.dragging.disable();
    });
    window.addEventListener('mousemove',(e)=>{ if(!draggingSel) return; updateSelBox(e.clientX,e.clientY); });
    window.addEventListener('mouseup',(e)=>{
      if(!draggingSel) return; draggingSel=false; map.dragging.enable();
      const rect=normRect(selStart.x,selStart.y,e.clientX,e.clientY);
      selectUnitsInRect(rect); selBox.remove(); selBox=null;
    });
    function updateSelBox(x,y){ const r=normRect(selStart.x,selStart.y,x,y); Object.assign(selBox.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'}); }
    function normRect(x1,y1,x2,y2){ const x=Math.min(x1,x2), y=Math.min(y1,y2); return {x,y,w:Math.abs(x2-x1),h:Math.abs(y2-y1)}; }
    function selectUnitsInRect(rect){
      clearSelection();
      const cont = map.getContainer().getBoundingClientRect();
      const x0=rect.x-cont.left, y0=rect.y-cont.top, x1=x0+rect.w, y1=y0+rect.h;
      const pts = player.units.map(u=> [u, map.latLngToContainerPoint(u.pos)]);
      pts.forEach(([u,p])=>{ if(p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1){ setSelected(u,true) } });
      hint(selection.size? selection.size+' birim seçildi.' : 'Seçim yok.');
    }
  }

  /* ---------- Queue & Kepçe build ---------- */
  function enqueueBuildJob(owner, job){
    const kepces = owner.units.filter(u=>u.unitType==='kepce');
    const free = kepces.find(k=>!k.job);
    if(free){ free.job=job; free.dest=job.pos; updateQueueUI(); }
    else { owner.queue.push(job); updateQueueUI(); }
  }
  function updateQueueUI(){
    queueEl.innerHTML='';
    const list = (player.units.filter(u=>u.unitType==='kepce').map(k=> k.job? `⛏️ ${labelOf(k.job.type)} kuruluyor` : '⏳ Boş'))
      .concat( (player.queue||[]).map(j=>`🧱 Sırada: ${labelOf(j.type)}`) );
    list.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; queueEl.appendChild(li) });
  }
  function tickKepce(dt,u,owner){
    moveUnit(dt,u);
    if(u.job && u.dest==null){
      if(!u.buildTask){
        const type=u.job.type; const c=COST[type];
        const b=new Building({side:u.side,pos:u.job.pos,buildingType:type}); b.buildProgress=0; b.buildNeeded=(c.build||30); b.underConstruction=true;
        b.marker.getElement().querySelector('.hpbar').insertAdjacentHTML('beforebegin','<div class="buildbar"><div class="buildfill" style="width:0%"></div></div>');
        u.buildTask=b; owner.buildings.push(b);
      } else {
        u.buildTask.buildProgress += dt;
        const pct=Math.min(100,(u.buildTask.buildProgress/u.buildTask.buildNeeded)*100);
        const el=u.buildTask.marker.getElement(); if(el){ const f=el.querySelector('.buildfill'); if(f) f.style.width=pct+'%'; }
        if(u.buildTask.buildProgress>=u.buildTask.buildNeeded){
          u.buildTask.underConstruction=false;
          const el2=u.buildTask.marker.getElement(); if(el2){ const bb=el2.querySelector('.buildbar'); if(bb) bb.remove(); }
          log(`${owner===player?'Bizim':'AI'} ${labelOf(u.job.type)} tamamlandı.`);
          u.job=null; u.buildTask=null;
          if(owner.queue.length>0){ u.job=owner.queue.shift(); u.dest=u.job.pos; }
          updateQueueUI(); updateHUD();
        }
      }
    }
  }

  /* ---------- Income ---------- */
  let incomeTimer=0;
  function incomeTick(dt){
    incomeTimer+=dt; if(incomeTimer<RATES.tickSec) return; incomeTimer=0;
    const mills=player.buildings.filter(b=>b.buildingType==='mill').length;
    const refs=player.buildings.filter(b=>b.buildingType==='refinery').length;
    const mines=player.buildings.filter(b=>b.buildingType==='mine').length;
    const ports=player.ports();
    player.food += mills*RATES.foodPerMill;
    player.oil  += refs*RATES.oilPerRef;
    player.iron += mines*RATES.ironPerMine;
    player.money+= (1 + ports*RATES.portMoneyBonus)*2;

    const amills=ai.buildings.filter(b=>b.buildingType==='mill').length;
    const arefs=ai.buildings.filter(b=>b.buildingType==='refinery').length;
    const amines=ai.buildings.filter(b=>b.buildingType==='mine').length;
    const aports=ai.buildings.filter(b=>b.buildingType==='port').length;
    ai.food += amills*RATES.foodPerMill;
    ai.oil  += arefs*RATES.oilPerRef;
    ai.iron += amines*RATES.ironPerMine;
    ai.money+= (1 + aports*RATES.portMoneyBonus)*2;
    updateHUD();
  }

  /* ---------- Combat & Movement ---------- */
  function distance(a,b){ return map.distance(a,b) }
  function latlngTowards(from,to,dist){ const total=distance(from,to); if(total===0||dist>=total) return to; const r=dist/total; return L.latLng(from.lat+(to.lat-from.lat)*r, from.lng+(to.lng-from.lng)*r); }
  function offset(latlng, meters){ return offsetDir(latlng, meters, Math.random()*Math.PI*2) }
  function offsetDir(latlng, meters, angleRad){
    const d=meters, ang=angleRad;
    const lat = latlng.lat + (d*Math.cos(ang))/111320;
    const lng = latlng.lng + (d*Math.sin(ang))/(40075000*Math.cos(latlng.lat*Math.PI/180)/360);
    return L.latLng(lat,lng);
  }
  function canUnitGoTo(u,dest){
    const med=STATS[u.unitType].medium||'land'; const land=isLand(dest);
    if(med==='land') return land; if(med==='water') return !land; return true;
  }
  function moveUnit(dt,u){
    if(!u.dest) return;
    if(!canUnitGoTo(u,u.dest)){ u.dest=null; return; }
    const step=u.speed*dt; const next=latlngTowards(u.pos,u.dest,step);
    if(STATS[u.unitType].medium!=='air'){ if(intersectsAnyWall(u.pos,next)){ u.dest=null; hint('🧱 Duvar engel oldu.'); return; } }
    u.pos=next; u.marker.setLatLng(u.pos);
    if(distance(u.pos,u.dest)<4){ u.dest=null }
  }
  function inRange(u,v){ return distance(u.pos,v.pos) <= (u.range||0) }
  function drawBeam(a,b){
    const p1=map.latLngToLayerPoint(a), p2=map.latLngToLayerPoint(b);
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',p1.x); line.setAttribute('y1',p1.y); line.setAttribute('x2',p2.x); line.setAttribute('y2',p2.y);
    line.setAttribute('class','beam'); svg.appendChild(line); setTimeout(()=> line.remove(), 160);
  }
  function dealDamage(attacker,target,dt){
    if(attacker.dps<=0) return;
    if(attacker.targetType==='ground' && isAir(target)) return;
    if(attacker.targetType==='air' && !isAir(target)) return;
    target.hp -= attacker.dps * dt; updateHPBar(target); if(target.hp<=0) destroyEntity(target, attacker);
    if(Math.random()<.3) drawBeam(attacker.pos, target.pos);
  }
  function isAir(ent){ if(ent.unitType){ return STATS[ent.unitType].medium==='air' } return false }
  function destroyEntity(ent,killer){
    ent.dead=true; ent.marker.remove();
    if(ent.unitType){
      const arr = ent.side===Side.PLAYER? player.units : ai.units; const i=arr.indexOf(ent); if(i>=0) arr.splice(i,1);
    } else {
      const arr = ent.side===Side.PLAYER? player.buildings : ai.buildings; const i=arr.indexOf(ent); if(i>=0) arr.splice(i,1);
      if(ent.isBase){ endGame(ent.side!==Side.PLAYER); }
    }
    if(selection.has(ent)) selection.delete(ent);
    if(killer) log(`${killer.side==='player'?'Bizim':'AI'} ${killer.unitType||killer.buildingType} birimi ${ent.unitType||ent.buildingType} yok etti.`);
    renderProductionPanel(); renderRangeRing();
  }
  function endGame(win){
    const modal=id('helpModal'); const box=modal.querySelector('.glass'); modal.classList.add('show');
    box.querySelector('.text-lg').textContent = win? 'Zafer!' : 'Yenilgi!';
    box.querySelector('ul').innerHTML = `<li>${win? 'AI üssünü yok ettiniz.' : 'Üssünüz yok edildi.'}</li>`;
  }
  function acquireTarget(u,enemies){
    let best=null,bestD=Infinity;
    for(const e of enemies){
      if(e.dead) continue;
      if(STATS[u.unitType].target==='ground' && isAir(e)) continue;
      if(STATS[u.unitType].target==='air' && !isAir(e)) continue;
      const d=distance(u.pos,e.pos); if(d<bestD){ best=e; bestD=d; }
    }
    return best;
  }
  function acquireTargetInRange(u,enemies,R){
    let best=null,bestD=Infinity;
    for(const e of enemies){
      if(e.dead) continue;
      if(STATS[u.unitType].target==='ground' && isAir(e)) continue;
      if(STATS[u.unitType].target==='air' && !isAir(e)) continue;
      const d=distance(u.pos,e.pos); if(d<=R && d<bestD){ best=e; bestD=d; }
    }
    return best;
  }

  /* ---------- Commands ---------- */
  function rightClickCommand(e){
    const enemy = findEnemyNear(e.latlng, 40);
    selection.forEach(ent=>{
      if(!(ent instanceof Unit)) return;
      ent.attackMove = attackMoveMode;
      if(enemy){ ent.target=enemy; ent.dest = enemy.pos; }
      else { if(canUnitGoTo(ent, e.latlng)){ ent.dest=e.latlng; ent.target=null; } }
    });
  }
  function findEnemyNear(latlng, radiusPx){
    const center = map.latLngToContainerPoint(latlng);
    const all = ai.units.concat(ai.buildings);
    let best=null, bestD=Infinity;
    for(const e of all){
      const p = map.latLngToContainerPoint(e.pos);
      const d = Math.hypot(p.x-center.x, p.y-center.y);
      if(d<radiusPx && d<bestD){ best=e; bestD=d; }
    }
    return best;
  }

  /* ---------- AI ---------- */
  function aiThink(dt, seed=false){
    ai.lastThink+=dt; if(seed || ai.lastThink>5){
      ai.lastThink=0;
      const hasM=ai.buildings.some(b=>b.buildingType==='mill');
      const hasR=ai.buildings.some(b=>b.buildingType==='refinery');
      const hasI=ai.buildings.some(b=>b.buildingType==='mine');
      const hasB=ai.buildings.some(b=>b.buildingType==='barracks');
      const hasF=ai.buildings.some(b=>b.buildingType==='factory');
      const hasA=ai.buildings.some(b=>b.buildingType==='airbase');
      const hasS=ai.buildings.some(b=>b.buildingType==='sam');

      if(!hasM && ai.money>=COST.mill.money){ ai.money-=COST.mill.money; enqueueBuildJob(ai,{type:'mill',pos:offset(ai.base.pos,1000)}) }
      else if(!hasR && ai.money>=COST.refinery.money){ ai.money-=COST.refinery.money; enqueueBuildJob(ai,{type:'refinery',pos:offset(ai.base.pos,1300)}) }
      else if(!hasI && ai.money>=COST.mine.money){ ai.money-=COST.mine.money; enqueueBuildJob(ai,{type:'mine',pos:offset(ai.base.pos,1500)}) }
      else if(!hasB && ai.money>=COST.barracks.money){ ai.money-=COST.barracks.money; enqueueBuildJob(ai,{type:'barracks',pos:offset(ai.base.pos,900)}) }
      else if(!hasF && ai.money>=COST.factory.money && ai.oil>=(COST.factory.oil||0)){ ai.money-=COST.factory.money; ai.oil-=COST.factory.oil||0; enqueueBuildJob(ai,{type:'factory',pos:offset(ai.base.pos,1600)}) }
      else if(!hasA && ai.money>=COST.airbase.money && ai.iron>=(COST.airbase.iron||0)){ ai.money-=COST.airbase.money; ai.iron-=COST.airbase.iron||0; enqueueBuildJob(ai,{type:'airbase',pos:offset(ai.base.pos,2000)}) }
      else if(!hasS && ai.money>=COST.sam.money && ai.iron>=(COST.sam.iron||0)){ ai.money-=COST.sam.money; ai.iron-=COST.sam.iron||0; enqueueBuildJob(ai,{type:'sam',pos:offset(ai.base.pos,1200)}) }

      const b=ai.buildings.find(x=>x.buildingType==='barracks');
      const f=ai.buildings.find(x=>x.buildingType==='factory');
      const a=ai.buildings.find(x=>x.buildingType==='airbase');
      if(b && ai.money>=COST.soldier.money && ai.food>=COST.soldier.food){ ai.money-=COST.soldier.money; ai.food-=COST.soldier.food; ai.units.push(spawnAI('soldier',b.pos)) }
      if(f && ai.money>=COST.tank.money && ai.oil>=COST.tank.oil && ai.iron>=COST.tank.iron){ ai.money-=COST.tank.money; ai.oil-=COST.tank.oil; ai.iron-=COST.tank.iron; ai.units.push(spawnAI(Math.random()<.5?'tank':'t90',f.pos)) }
      if(a && ai.money>=COST.tb2.money && ai.oil>=COST.tb2.oil && ai.iron>=COST.tb2.iron){ ai.money-=COST.tb2.money; ai.oil-=COST.tb2.oil; ai.iron-=COST.tb2.iron; ai.units.push(spawnAI(Math.random()<.5?'tb2':'f16',a.pos)) }

      const army = ai.units.filter(u=>u.dps>0);
      if(army.length>=6){ const t=acquireTargetNear(player.units.concat(player.buildings), ai.base.pos); if(t){ army.forEach(u=>{ if(canUnitGoTo(u,t.pos)) { u.dest=t.pos; u.attackMove=true; } }); log('AI saldırı başlattı!'); } }
    }
  }
  function spawnAI(kind, around){ const pos=findSpawnAround(around,kind)||around; const u=new Unit({side:Side.AI,pos,unitType:kind}); u.marker=createMarker(u,true); return u; }
  function findSpawnAround(origin, kind){
    const medium = STATS[kind].medium||'land';
    const wantLand = (medium==='land'); const wantWater=(medium==='water');
    for(let r=30;r<=220;r+=20){
      for(let k=0;k<14;k++){
        const ang=Math.random()*Math.PI*2; const p=offsetDir(origin,r,ang);
        if( (wantLand && isLand(p)) || (wantWater && !isLand(p)) || (!wantLand && !wantWater) ) return p;
      }
    }
    if((wantLand && isLand(origin)) || (wantWater && !isLand(origin)) || (!wantLand && !wantWater)) return origin;
    return null;
  }
  function acquireTargetNear(arr, origin){ let best=null,bestD=Infinity; for(const e of arr){ const d=distance(origin,e.pos); if(d<bestD){ best=e; bestD=d; } } return best; }

  /* ---------- Commands UI ---------- */
  function wireHUD(){
    const speedRange=id('speedRange'), speedLbl=id('speedLbl');
    function setSpeed(v){ gameSpeed=clamp(v,1,100); speedRange.value=String(gameSpeed); speedLbl.textContent=gameSpeed+'x'; hint('Hız: '+gameSpeed+'x'); }
    qsa('[data-speed]').forEach(b=> b.addEventListener('click',()=> setSpeed(+b.dataset.speed)));
    speedRange.addEventListener('input', ()=> setSpeed(+speedRange.value));
    setSpeed(1);

    const stanceBtn=id('stanceBtn');
    stanceBtn.addEventListener('click', ()=>{
      playerStance = (playerStance==='aggressive')? 'hold' : 'aggressive';
      stanceBtn.textContent = playerStance==='aggressive'? 'Agresif' : 'Tut';
      stanceBtn.className = 'btn ' + (playerStance==='aggressive'? 'bg-emerald-500/15' : 'bg-yellow-500/20');
    });

    id('helpBtn').onclick = ()=> id('helpModal').classList.add('show');
    id('newGame').onclick = ()=> location.reload();

    id('cmdStop').onclick = ()=>{ selection.forEach(ent=>{ if(ent instanceof Unit){ ent.dest=null; ent.target=null; ent.attackMove=false; } }); hint('Seçili birimler durdu.'); };
    const cmdAttackBtn=id('cmdAttackMove');
    cmdAttackBtn.onclick=()=>{ attackMoveMode=!attackMoveMode; cmdAttackBtn.textContent = attackMoveMode ? '⚔️ Saldırı Yürüyüşü: Açık' : '⚔️ Saldırı Yürüyüşü: Kapalı'; hint(attackMoveMode? 'Saldırı yürüyüşü aktif.' : 'Saldırı yürüyüşü kapalı.'); };
  }

  /* ---------- Game bootstrap ---------- */
  function initGame(){
    createMap(); wireHUD(); renderBuildButtons();
    // Player & AI base
    const center=L.latLng(41.0082,28.9784);
    const pPos=offsetDir(center,2000,Math.random()*Math.PI*2);
    const aPos=offsetDir(center,4200,Math.random()*Math.PI*2);
    const pBase=new Building({side:Side.PLAYER,pos:pPos,buildingType:'base',isBase:true});
    const aBase=new Building({side:Side.AI,pos:aPos,buildingType:'base',isBase:true});
    player.base=pBase; ai.base=aBase; player.buildings.push(pBase); ai.buildings.push(aBase);

    const pKep=new Unit({side:Side.PLAYER,pos:offset(pBase.pos,120),unitType:'kepce'}); player.units.push(pKep);
    const aKep=new Unit({side:Side.AI,pos:offset(aBase.pos,120),unitType:'kepce'}); ai.units.push(aKep);

    updateHUD(); updateQueueUI(); aiThink(0,true);
    hint('Sol sürükle: kutu seçim • Sağ tık: hareket • Duvar Çiz: nokta-nokta çizin, sağ tıkla bitirin.');

    // Sol tık inşa yer seçimi ve üretim
    map.on('click', onMapClick);
    // Sağ tık hareket/saldırı
    map.on('contextmenu', (e)=>{ if(selection.size===0){ if(wallDrawing) finishWallChain(); return; } rightClickCommand(e); });
  }
  initGame();

  /* ---------- Production helpers ---------- */
  function produceFromBuilding(b,kind){
    const need = COST[kind==='kepce'?'excavator':kind];
    if(!canPay(player,need)){ hint('Yetersiz kaynak.'); return; }
    const pos = findSpawnAround(b.pos, kind);
    if(!pos){ hint('Çıkış noktası bulunamadı.'); return; }
    pay(player,need); updateHUD();
    const u = new Unit({side:Side.PLAYER, pos, unitType:kind}); player.units.push(u);
    hint(`${labelOf(kind)} üretildi.`);
  }
  function findSpawnAround(origin, kind){
    const medium = STATS[kind].medium||'land';
    const wantLand = (medium==='land'); const wantWater=(medium==='water');
    for(let r=30;r<=220;r+=20){
      for(let k=0;k<14;k++){
        const ang=Math.random()*Math.PI*2; const p=offsetDir(origin,r,ang);
        if( (wantLand && isLand(p)) || (wantWater && !isLand(p)) || (!wantLand && !wantWater) ) return p;
      }
    }
    if((wantLand && isLand(origin)) || (wantWater && !isLand(origin)) || (!wantLand && !wantWater)) return origin;
    return null;
  }

  /* ---------- Game loop ---------- */
  let last=performance.now(); const FIXED_STEP=0.02; const MAX_STEPS=300; let accumulator=0;
  function step(dt){
    // kepçe build
    player.units.filter(u=>u.unitType==='kepce').forEach(u=> tickKepce(dt,u,player));
    ai.units.filter(u=>u.unitType==='kepce').forEach(u=> tickKepce(dt,u,ai));
    // combat & movement
    tickCombat(dt,player,ai);
    tickCombat(dt,ai,player);
    // econ & ai
    incomeTick(dt);
    aiThink(dt);
    if(rangeCircle && selection.size===1){ rangeCircle.setLatLng([...selection][0].pos) }
  }
  function loop(now){
    const baseDt=Math.min(0.1,(now-last)/1000); last=now; accumulator+=baseDt*gameSpeed;
    let steps=0; while(accumulator>=FIXED_STEP && steps<MAX_STEPS){ step(FIXED_STEP); accumulator-=FIXED_STEP; steps++; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function tickCombat(dt, sideObj, enemySide){
    const units=sideObj.units;
    const enemies=enemySide.units.concat(enemySide.buildings);
    for(const u of units){
      if(u.attackMove && (!u.target || u.target.dead)){
        const e = acquireTargetInRange(u, enemies, u.range*0.9);
        if(e){ u.target=e }
      }
      moveUnit(dt,u);
      if(sideObj===player && playerStance==='hold' && (!u.target || !inRange(u,u.target))) continue;
      if(!u.target || u.target.dead){ u.target = acquireTarget(u,enemies); }
      else if(distance(u.pos,u.target.pos) > (u.range*1.1)){ u.dest = u.target.pos; }
      if(u.target && inRange(u,u.target)){ dealDamage(u,u.target,dt) }
    }
    // SAM
    sideObj.buildings.filter(b=>b.buildingType==='sam').forEach(s=>{
      const R=12000; const tgt = enemySide.units.find(e=> isAir(e) && distance(s.pos,e.pos)<=R );
      if(tgt){ drawBeam(s.pos, tgt.pos); tgt.hp -= 45*dt; updateHPBar(tgt); if(tgt.hp<=0) destroyEntity(tgt, s); }
    });
  }

})();
