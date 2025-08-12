import { state } from '../core/state.js';

let incomeTimer=0;
export function incomeTick(dt){
  incomeTimer+=dt; if(incomeTimer<state.RATES.tickSec) return; incomeTimer=0;

  const mills=state.player.buildings.filter(b=>b.buildingType==='mill').length;
  const refs=state.player.buildings.filter(b=>b.buildingType==='refinery').length;
  const mines=state.player.buildings.filter(b=>b.buildingType==='mine').length;
  const ports=state.player.ports();
  state.player.food += mills*state.RATES.foodPerMill;
  state.player.oil += refs*state.RATES.oilPerRef;
  state.player.iron += mines*state.RATES.ironPerMine;
  state.player.money += (1 + ports*state.RATES.portMoneyBonus)*2;

  const amills=state.ai.buildings.filter(b=>b.buildingType==='mill').length;
  const arefs=state.ai.buildings.filter(b=>b.buildingType==='refinery').length;
  const amines=state.ai.buildings.filter(b=>b.buildingType==='mine').length;
  const aports=state.ai.buildings.filter(b=>b.buildingType==='port').length;
  state.ai.food += amills*state.RATES.foodPerMill;
  state.ai.oil += arefs*state.RATES.oilPerRef;
  state.ai.iron += amines*state.RATES.ironPerMine;
  state.ai.money += (1 + aports*state.RATES.portMoneyBonus)*2;

  state.updateHUD();
}
