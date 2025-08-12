import { state } from '../core/state.js';
export class Unit{
  constructor(opts){
    Object.assign(this,opts);
    this.id = state.ENT_ID++; this.dead=false;
    const S = state.STATS[this.unitType];
    this.hp=S.hp; this.speed=S.speed; this.range=S.range||0; this.dps=S.dps||0; this.medium=S.medium||'land'; this.targetType=S.target||'ground';
    this.dest=null; this.target=null; this.moveVec=null; this.attackMove=false; this.job=null; this.buildTask=null;
    state.ENT_INDEX.set(this.id,this);
  }
}
