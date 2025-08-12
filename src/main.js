import { state, resetState } from './core/state.js';
import { createMap } from './core/map.js';
import { buildHUD, wireHUD } from './ui/hud.js';
import { wireSelection } from './ui/selection.js';
import { wireProduction } from './ui/production.js';
import { wireWalls } from './systems/walls.js';
import { wireCommands } from './systems/commands.js';
import { aiThink } from './systems/ai.js';
import { incomeTick } from './systems/income.js';
import { tickSideCombat } from './systems/combat.js';
import { tickKepce } from './systems/movement.js';
import { id } from './ui/dom.js';
import { Building } from './entities/Building.js';
import { Unit } from './entities/Unit.js';

/* Bootstrap */
createMap();
buildHUD();
wireHUD();
wireSelection();
wireProduction();
wireWalls();
wireCommands();

function initGame(){
  resetState();
  const map = state.map;
  const center = L.latLng(41.0082, 28.9784);
  map.setView(center, 10);

  // Player & AI base positions
  const pPos = state.offsetDir(center,2000,Math.random()*Math.PI*2);
  const aPos = state.offsetDir(center,4200,Math.random()*Math.PI*2);

  const pBase = new Building({side:'player', pos:pPos, buildingType:'base', isBase:true});
  const aBase = new Building({side:'ai',     pos:aPos, buildingType:'base', isBase:true});
  state.player.base=pBase; state.ai.base=aBase;
  state.player.buildings.push(pBase); state.ai.buildings.push(aBase);
  state.addMarker(pBase); state.addMarker(aBase);

  const pKep = new Unit({side:'player', pos:state.offset(pBase.pos,120), unitType:'kepce'});
  const aKep = new Unit({side:'ai',     pos:state.offset(aBase.pos,120), unitType:'kepce'});
  state.player.units.push(pKep); state.ai.units.push(aKep);
  state.addMarker(pKep); state.addMarker(aKep);

  state.updateHUD(); state.updateQueueUI();
  aiThink(0,true);
  state.hint('Sol sürükle: kutu seçim • Sağ tık: hareket • Duvar Çiz: nokta-nokta çizin, sağ tıkla bitirin.');
}
initGame();
id('newGame').onclick = () => location.reload();

/* Game loop */
let last=performance.now(); const FIXED_STEP=0.02; const MAX_STEPS=300; let accumulator=0;
function step(dt){
  // Kepçe inşa işleri
  state.player.units.filter(u=>u.unitType==='kepce').forEach(u=> tickKepce(dt,u,state.player));
  state.ai.units.filter(u=>u.unitType==='kepce').forEach(u=> tickKepce(dt,u,state.ai));
  // Çatışma
  tickSideCombat(dt, state.player, state.ai);
  tickSideCombat(dt, state.ai, state.player);
  // Ekonomi & AI
  incomeTick(dt);
  aiThink(dt);
  // Range halkasını takipte tut
  if(state.rangeCircle && state.selection.size===1){ state.rangeCircle.setLatLng([...state.selection][0].pos); }
}
function loop(now){
  const baseDt=Math.min(0.1,(now-last)/1000); last=now; accumulator+=baseDt*state.gameSpeed;
  let steps=0;
  while(accumulator>=FIXED_STEP && steps<MAX_STEPS){ step(FIXED_STEP); accumulator-=FIXED_STEP; steps++; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
