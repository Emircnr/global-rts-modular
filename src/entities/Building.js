import { state } from '../core/state.js';
export class Building{
  constructor(opts){
    Object.assign(this,opts);
    this.id = state.ENT_ID++; this.dead=false;
    this.hp = state.STATS[this.buildingType].hp;
    state.ENT_INDEX.set(this.id,this);
  }
}
