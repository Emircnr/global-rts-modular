/* === PATCHPOINT: UNIT_BALANCE === */
export const STATS = {
  // units
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
  // buildings
  base:{hp:900}, mill:{hp:220}, refinery:{hp:240}, mine:{hp:240}, port:{hp:260},
  factory:{hp:340}, barracks:{hp:280}, rocketlab:{hp:340}, airbase:{hp:360}, sam:{hp:300},
};

/* === PATCHPOINT: COSTS === */
export const COST = {
  mill:{money:80, build:25}, refinery:{money:80, build:25}, mine:{money:80, build:25}, port:{money:180, build:30},
  barracks:{money:120, build:30}, factory:{money:180, oil:40, build:45}, rocketlab:{money:220, iron:40, build:60},
  airbase:{money:250, iron:30, build:60}, sam:{money:200, iron:25, build:40},
  excavator:{money:70, oil:20}, soldier:{money:30, food:20}, apc:{money:90, oil:30, iron:15},
  tank:{money:140, oil:60, iron:40}, t90:{money:150, oil:60, iron:45},
  himars:{money:200, oil:40, iron:50}, ship:{money:120, oil:60},
  f16:{money:260, oil:120, iron:60}, tb2:{money:160, oil:60, iron:30}, apache:{money:220, oil:80, iron:50},
};

/* === PATCHPOINT: ECONOMY_RATES === */
export const RATES = { tickSec:3, foodPerMill:4, oilPerRef:3, ironPerMine:3, portMoneyBonus:0.20 };
