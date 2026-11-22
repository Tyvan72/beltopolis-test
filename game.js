'use strict';
/* Beltopolis — original auto-belt factory builder (formerly AutoForge). All code & art procedural/original. */
(() => {
// desktop docked-panel state (see DESKTOP LAYOUT); declared first so any early UI call can read DESK.on
const DESK = { on:false, mq: null, home: null };
// ============================== DATA (easy to expand) ==============================
const ITEMS = {
  wood:{name:'Wood'}, plank:{name:'Planks'},
  stone:{name:'Stone'}, brick:{name:'Bricks'},
  ironOre:{name:'Iron Ore'}, ironIngot:{name:'Iron Ingots'}, gear:{name:'Gears'},
  copperOre:{name:'Copper Ore'}, copperIngot:{name:'Copper Ingots'}, wire:{name:'Wire'},
  coal:{name:'Coal'}, steel:{name:'Steel'}, circuit:{name:'Circuits'},
  silverOre:{name:'Silver Ore'}, silverIngot:{name:'Silver Bars'}, contact:{name:'Silver Contacts'},
  goldOre:{name:'Gold Ore'}, goldIngot:{name:'Gold Bars'}, jewelry:{name:'Jewelry'},
  quartz:{name:'Quartz'}, glass:{name:'Glass'}, chip:{name:'Microchips'},
  titaniumOre:{name:'Titanium Ore'}, titaniumIngot:{name:'Titanium Ingots'}, plate:{name:'Titanium Plates'},
  quantum:{name:'Quantum Crystals'}, qcore:{name:'Quantum Cores'}, qcomp:{name:'Quantum Computers'},
};
// terrain ids
const GRASS=0, WATER=1, TREE=2, STONE=3, IRON=4, COPPER=5, COAL=6, SILVER=7, GOLD=8, QUARTZ=9, TITAN=10, QUANTUM=11;
// raw resources: iv = seconds per harvest, cost = Ore Drill price on that deposit, clear = items from clearing the tile
const RES = {
  [TREE]:   {item:'wood',        name:'Trees',            key:'wood',     unlock:null,           iv:2.0, clear:5, col:'#2ecc71'},
  [STONE]:  {item:'stone',       name:'Stone',            key:'stone',    unlock:'res:stone',    iv:3.0, clear:5, col:'#c9c2b5'},
  [IRON]:   {item:'ironOre',     name:'Iron Ore',         key:'iron',     unlock:'res:iron',     iv:4.5, clear:5, col:'#d3dbe4', cost:{stone:40, plank:12}},
  [COPPER]: {item:'copperOre',   name:'Copper Ore',       key:'copper',   unlock:'res:copper',   iv:4.5, clear:5, col:'#f6a83c', cost:{stone:40, plank:12}},
  [COAL]:   {item:'coal',        name:'Coal',             key:'coal',     unlock:'res:coal',     iv:4.5, clear:5, col:'#454b54', cost:{stone:40, plank:12}},
  [SILVER]: {item:'silverOre',   name:'Silver Ore',       key:'silver',   unlock:'res:silver',   iv:5.0, clear:5, col:'#e9e6ff', cost:{stone:60, plank:15, brick:8}},
  [GOLD]:   {item:'goldOre',     name:'Gold Ore',         key:'gold',     unlock:'res:gold',     iv:5.5, clear:5, col:'#ffd23f', cost:{stone:70, brick:15}},
  [QUARTZ]: {item:'quartz',      name:'Quartz',           key:'quartz',   unlock:'res:quartz',   iv:5.0, clear:5, col:'#ff9ecf', cost:{stone:70, brick:15}},
  [TITAN]:  {item:'titaniumOre', name:'Titanium Ore',     key:'titanium', unlock:'res:titanium', iv:6.0, clear:5, col:'#8fb4cf', cost:{brick:25, ironIngot:10}},
  [QUANTUM]:{item:'quantum',     name:'Quantum Crystals', key:'quantum',  unlock:'res:quantum',  iv:7.0, clear:5, col:'#b56bff', cost:{brick:40, steel:10}},
};
const ORE_T = [IRON,COPPER,COAL,SILVER,GOLD,QUARTZ,TITAN,QUANTUM];
// Ascensions: finishing all eras restarts at era 1; each Ascension turns one resource's harvesters GOLD (free + 25% faster), in this order
const ASC_ORDER = ['wood','stone','iron','copper','coal','silver','gold','quartz','titanium','quantum'];
const ASC_SPEED = 1.15;
const ENDGAME_KIT = {wood:1200, plank:600, stone:1200, brick:350, ironIngot:150, gear:60, copperIngot:100, wire:150, steel:70, circuit:30};
const HARV_NAME = {wood:'Wood Cutters', stone:'Quarries', iron:'Iron Drills', copper:'Copper Drills', coal:'Coal Drills', silver:'Silver Drills', gold:'Gold Drills', quartz:'Quartz Drills', titanium:'Titanium Drills', quantum:'Quantum Drills'};
const ascN = () => (S && S.asc) | 0;
const isGoldKey = k => { const i = ASC_ORDER.indexOf(k); return i >= 0 && i < ascN(); };
const harvKeyOf = (type, key) => {
  if (type==='cutter' || type==='megaCutter') return 'wood';
  if (type==='quarry' || type==='megaQuarry') return 'stone';
  if (type==='drill' || type==='megaDrill'){
    const part = String(key||'').split(':')[1];
    return part || null;
  }
  return null;
};
const GOLD_HARV_LINE = {wood:'Wood harvesters', stone:'Stone harvesters', iron:'Iron harvesters', copper:'Copper harvesters', coal:'Coal harvesters', silver:'Silver harvesters', gold:'Gold harvesters', quartz:'Quartz harvesters', titanium:'Titanium harvesters', quantum:'Quantum harvesters'};
const goldBonusLine = k => 'Ascension bonus: '+(GOLD_HARV_LINE[k]||'These harvesters')+' are free and 25% faster.';
const isGoldB = b => { if (!b || !BUILDINGS[b.type] || !BUILDINGS[b.type].on) return false; const tv = harvTvOf(b); return tv != null && RES[tv] && isGoldKey(RES[tv].key); };
const RES_BY_KEY = {}; for (const t in RES) RES_BY_KEY[RES[t].key] = +t;
const BUILDINGS = {
  hub:{name:'Main Hub', size:3, top:'#7b6cf0', side:'#4b3cc4'},
  cutter:{name:'Wood Cutter', size:1, on:[TREE], interval:2.0, cost:{wood:5}, top:'#2ecc71', side:'#1e8449', desc:'Chops wood from trees'},
  quarry:{name:'Quarry', size:1, on:[STONE], interval:3.0, cost:{wood:20, plank:4}, top:'#b2bec3', side:'#7f8c8d', desc:'Digs stone'},
  drill:{name:'Ore Drill', size:1, on:ORE_T, interval:4.5, cost:{stone:40, plank:12}, top:'#f39c12', side:'#b9651a', desc:'Mines ores and crystals'},
  workshop:{name:'Workshop', size:2, recipes:['plank','brick','gear','wire','contact'], cost:{wood:15}, top:'#fdcb6e', side:'#c29d0b', desc:'Crafts parts'},
  smelter:{name:'Smelter', size:2, recipes:['ironIngot','copperIngot','steel','silverIngot','goldIngot','glass','titaniumIngot'], cost:{stone:60, brick:15}, top:'#ff7675', side:'#b03a2e', desc:'Melts ore into metal and glass'},
  assembler:{name:'Assembler', size:2, recipes:['circuit','jewelry','chip','plate'], cost:{brick:50, gear:15, wire:30}, top:'#74b9ff', side:'#21618c', desc:'Builds advanced parts'},
  lab:{name:'Quantum Lab', size:2, recipes:['qcore','qcomp'], cost:{brick:100, steel:30, circuit:10}, top:'#a66bff', side:'#5b2a9e', desc:'Bends reality into quantum tech'},
  // Mega prestige buildings (unlocked in perk shop). Super-producers; themed accents via world().accent at draw time.
  megaCutter:{name:'Mega Harvester', size:3, on:[TREE], interval:0.35, mega:1, megaMul:8, cost:{wood:200, plank:80, gear:20}, top:'#1e8f4e', side:'#145a32', desc:'Big 3×3 harvester. Chops Wood 8× faster than a Wood Cutter. Must sit on trees.', unlockPerk:'megaHarv'},
  megaQuarry:{name:'Mega Quarry', size:3, on:[STONE], interval:0.45, mega:1, megaMul:8, cost:{stone:200, brick:60, gear:25}, top:'#b2bec3', side:'#636e72', desc:'Big 3×3 quarry. Digs Stone 8× faster than a Quarry. Must sit on stone.', unlockPerk:'megaQuarry'},
  megaDrill:{name:'Mega Drill', size:3, on:ORE_T, interval:0.55, mega:1, megaMul:8, cost:{brick:120, steel:40, circuit:12}, top:'#74b9ff', side:'#0984e3', desc:'Big 3×3 drill. Mines ore 8× faster than an Ore Drill. Must sit on ore tiles.', unlockPerk:'megaDrill'},
  megaSmelter:{name:'Mega Smelter', size:3, recipes:['ironIngot','copperIngot','steel','silverIngot','goldIngot','glass','titaniumIngot'], mega:1, megaCraft:5, cost:{brick:200, steel:50, circuit:20}, top:'#e17055', side:'#b33939', desc:'Big 3×3 smelter. Melts ore into metal and glass 5× faster than a Smelter. Place on open grass.', unlockPerk:'megaSmelt'},
  megaBlock:{name:'Mega Block', size:3, recipes:['plank','brick','gear','wire','contact'], mega:1, megaCraft:5, cost:{wood:150, plank:100, gear:40}, top:'#fdcb6e', side:'#e17055', desc:'Big 3×3 workshop. Crafts Planks, Bricks, Gears, Wire, and Silver Contacts 5× faster than a Workshop. Place on open grass.', unlockPerk:'megaBlock'},
  megaHub:{name:'Hub Extension', size:4, mega:1, hubExt:1, cost:{}, top:'#a29bfe', side:'#6c5ce7', desc:'Big 4×4 extra Hub. Nearby buildings belt here automatically. Free to place, as many as you like.', unlockPerk:'megaHub'},
  // Gathering huts (prestige). Worker walks out, brings back 1 wood/stone per trip; 5 trips clear the tile for good. No belts.
  woodHut:{name:"Woodcutter's Hut", size:2, hut:1, hutRes:TREE, cost:{wood:35}, top:'#d08a3a', side:'#6b3e1a', desc:'A woodcutter walks to trees, chops them, and brings back 1 Wood per trip. A tree takes 5 trips before it\'s gone for good. No belts — demolish to stop him.', unlockPerk:'woodHut'},
  rockHut:{name:'Quarry Hut', size:2, hut:1, hutRes:STONE, cost:{stone:35}, top:'#c5bfb4', side:'#6d6560', desc:'A miner walks to rocks, breaks them, and brings back 1 Stone per trip. A rock takes 5 trips before it\'s gone for good. No belts — demolish to stop him.', unlockPerk:'rockHut'},
  // Cosmetic landmarks (Style Shop). Looks only — no production, belts may pass through.
  landWindmill:{name:'Windmill', size:4, landmark:1, cost:{}, top:'#e8d5a3', side:'#8d6e4c', desc:'A spinning country windmill. Looks only — does not produce anything.'},
  landClock:{name:'Clock Tower', size:4, landmark:1, cost:{}, top:'#c9b8a0', side:'#6d5c4b', desc:'A tall brick clock tower with ticking hands. Looks only.'},
  landWater:{name:'Giant Water Tower', size:4, landmark:1, cost:{}, top:'#74b9ff', side:'#3d566e', desc:'A riveted water tower on steel legs. Looks only.'},
  landGate:{name:'Grand Factory Gate', size:6, landmark:1, mask:[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[0,2],[1,2],[4,2],[5,2],[0,3],[1,3],[4,3],[5,3],[0,4],[1,4],[4,4],[5,4],[0,5],[1,5],[4,5],[5,5]], cost:{}, top:'#bfa078', side:'#5d4630', desc:'A ceremonial arch. Belts can pass through the gateway. Looks only.'},
  landStatue:{name:'Statue of the Founder', size:4, landmark:1, cost:{}, top:'#dfe6ee', side:'#7f8c8d', desc:'A bronze founder on a stone plinth. Looks only.'},
  landCathedral:{name:'Smokestack Cathedral', size:6, landmark:1, cost:{}, top:'#6d6d7a', side:'#3a3a44', desc:'A factory cathedral with smoking stacks. Looks only.'},
  landObservatory:{name:'Observatory Dome', size:6, landmark:1, cost:{}, top:'#b0c4de', side:'#4a5564', desc:'A rotating observatory dome. Looks only.'},
  landSpire:{name:'Quantum Spire', size:4, landmark:1, cost:{}, top:'#a66bff', side:'#3d1a6e', desc:'A glowing quantum crystal spire. Looks only.'},
  landRocket:{name:'Rocket Launch Pad', size:6, landmark:1, cost:{}, top:'#dfe6ee', side:'#4a4a55', desc:'A rocket on a lit launch pad. Looks only.'},
};
const LAND_ORDER = ['landWindmill','landClock','landWater','landGate','landStatue','landCathedral','landObservatory','landSpire','landRocket'];
const BUILD_ORDER = ['cutter','quarry','drill','workshop','smelter','assembler','lab','woodHut','rockHut','megaCutter','megaQuarry','megaDrill','megaBlock','megaSmelter','megaHub', ...LAND_ORDER];
const RECIPES = {
  plank:{in:{wood:6}, out:1, time:1.5}, brick:{in:{stone:4}, out:1, time:3.5},
  gear:{in:{ironIngot:2}, out:1, time:4}, wire:{in:{copperIngot:1}, out:2, time:3},
  ironIngot:{in:{ironOre:2}, out:1, time:4}, copperIngot:{in:{copperOre:2}, out:1, time:4}, steel:{in:{ironIngot:2, coal:2}, out:1, time:6},
  circuit:{in:{wire:3, plank:1}, out:1, time:6},
  silverIngot:{in:{silverOre:2}, out:1, time:4}, contact:{in:{silverIngot:1, wire:2}, out:2, time:5},
  goldIngot:{in:{goldOre:2}, out:1, time:5}, jewelry:{in:{goldIngot:2, silverIngot:1}, out:1, time:8},
  glass:{in:{quartz:2, coal:1}, out:1, time:4}, chip:{in:{glass:1, goldIngot:1, circuit:1}, out:1, time:8},
  titaniumIngot:{in:{titaniumOre:2, coal:1}, out:1, time:5}, plate:{in:{titaniumIngot:2, steel:1}, out:1, time:6},
  qcore:{in:{quantum:3, chip:1, plate:1}, out:1, time:12}, qcomp:{in:{qcore:2, contact:4, jewelry:1}, out:1, time:20},
};
// Player level: XP from harvested + crafted goods during live, foreground play only.
// Offline / hidden-tab / background catch-up still pays resources, but grants zero XP. Not from clearing, refunds, or rewards.
// Level 1→2 costs XP_BASE; each later level needs 20% more. Early levels take ~5–10 min with a couple of cutters.
// xpv 3 (v43): slower curve + +1 ✦ every 10 levels. Existing saves are one-time reset to Lv 1 / 0 XP (PP and everything else kept).
// v69: Move Hub is also in the Menu, so you can start a move without tapping the Hub. The camera jumps to it first.
// v70: belts merge into same-direction trunks (even from the side) and cross/turn under straight bridge decks, so crowded Hubs still connect; route-fail popup (Move Hub / Hub Extension); Hub Extension perk 5 ✦ (refund 95 ✦ once), unlimited placements; bridge items no longer vanish.
// v71: faster first Ascension (quest bases 2.1/5.2/6.0, PACE_PROD 0.50, softer late-star quest scale); faster leveling (XP_GROW 1.12, 1.5× item XP) with a keep-your-level curve migrate; Ascend grants 10×★ ✦; Store removed from Rebirth; missing IAPs show Coming soon; permanent 2× Speed Boost IAP ($2.99) with on/off.
// v72: bigger quest-card era/progress text; building panel pins Upgrade + Max + Pause at the top; Menu Rate Beltopolis row (App Store write-review link) plus requestNativeReview hook after Ascension; My Buildings finder (crafters, megas, Hub only — not harvesters); Daily Challenges (3 goals, +5/+7/+10 PP, local-midnight reset) and Weekly Event (era-scaled goal, exclusive belt color kept forever).
// v68: Hub can no longer be placed on the map rim (edge margin + zoom-in before placing). Existing edge Hubs are moved on load. Players can Move the Hub from its info sheet.
// xpv 4 (v67): Lv 1–25 unchanged. Past 25 the curve is gentle (≈linear) so all 40 Medals are reachable:
//   need(lv) = XP_FLAT * (1 + (lv-26)/XP_FLAT_K)^XP_FLAT_P. Existing xpv-3 saves keep their level; XP-into-level is scaled
//   to the same fraction of the new requirement. ✦ from levels: every 10 levels up to Lv 100, then every 25 (on Medal levels).
// xpv 5 (v71): Lv 1–25 use XP_GROW 1.12 (was 1.2); late curve unchanged so Medals through Lv 1000 stay reachable. Existing
//   saves keep their level and the same % progress into it. Item XP is 1.5×. PP / levelPp never touched.
const XP_BASE = 210, XP_GROW = 1.12, XP_GROW_V4 = 1.2, XP_PP_EVERY = 10, XP_CURVE_V = 5;
const XP_STEEP_TO = 25, XP_FLAT = 11000, XP_FLAT_K = 25, XP_FLAT_P = 0.8, XP_PP_LATE_FROM = 100, XP_PP_LATE_EVERY = 25;
const XP_ITEM_MUL = 1.5;
const XP_RAW = {wood:1, stone:1, ironOre:2, copperOre:2, coal:2, silverOre:3, goldOre:3, quartz:3, titaniumOre:4, quantum:4};
function itemXpBase(id){
  if (XP_RAW[id]) return XP_RAW[id];
  const r = RECIPES[id]; if (!r) return 1;
  // Soft cap late crafts so mega labs can't blow through the curve.
  return Math.max(2, Math.min(8, Math.round((r.time * 0.5) / Math.max(1, r.out||1))));
}
function itemXp(id){ return itemXpBase(id) * XP_ITEM_MUL; }
function xpNeedAt(lv, grow){ return Math.max(1, Math.round(XP_BASE * Math.pow(grow, Math.max(1, lv|0) - 1))); }
function xpNeedV3(lv){ return xpNeedAt(lv, XP_GROW_V4); } // historical steep curve (grow 1.2, all levels)
function xpNeedV4(lv){
  lv = Math.max(1, lv|0);
  if (lv <= XP_STEEP_TO) return xpNeedAt(lv, XP_GROW_V4);
  return Math.round(XP_FLAT * Math.pow(1 + (lv - XP_STEEP_TO - 1) / XP_FLAT_K, XP_FLAT_P));
}
function xpNeed(lv){
  lv = Math.max(1, lv|0);
  if (lv <= XP_STEEP_TO) return xpNeedAt(lv, XP_GROW);
  return Math.round(XP_FLAT * Math.pow(1 + (lv - XP_STEEP_TO - 1) / XP_FLAT_K, XP_FLAT_P));
}
function xpPpAt(lv){ lv = lv|0; return lv > 0 && (lv <= XP_PP_LATE_FROM ? lv % XP_PP_EVERY === 0 : lv % XP_PP_LATE_EVERY === 0); }
function xpNextPp(lv){ for (let l=(lv|0)+1; l<(lv|0)+200; l++) if (xpPpAt(l)) return l; return (lv|0)+XP_PP_LATE_EVERY; }
function migrateXpReset(st){
  // Keep level, PP, and levelPp. Scale only the in-level XP fraction onto the new curve.
  if (!st || (st.xpv|0) >= XP_CURVE_V) return false;
  const lv = Math.max(1, st.level|0) || 1;
  const xpv = st.xpv|0;
  const oldN = xpv === 4 ? xpNeedV4(lv) : xpv === 3 ? xpNeedV3(lv) : 0;
  const newN = xpNeed(lv);
  if (oldN){
    const f = Math.max(0, Math.min(1, (+st.xp||0) / Math.max(1, oldN)));
    st.xp = Math.min(Math.max(0, newN - 1), Math.floor(f * newN));
  } else {
    st.xp = Math.min(Math.max(0, +st.xp||0), Math.max(0, newN - 1));
  }
  st.level = lv;
  st.xpv = XP_CURVE_V;
  return true;
}
function migrateAllSlotsXp(){
  for (let n=1; n<=SLOTS; n++){
    const raw = lsGet(slotKey(n)); if (!raw) continue;
    try {
      const d = JSON.parse(raw);
      if (!d || d.v !== SAVE_V) continue;
      if (migrateXpReset(d)) lsSet(slotKey(n), JSON.stringify(d));
    } catch(e){}
  }
}
function xpLive(){
  // Only the visible, foreground game awards XP. Offline catch-up and hidden/background tabs do not.
  if (R.noXp || R.offline) return false;
  try { if (typeof document !== 'undefined' && document.hidden) return false; } catch(e){}
  return true;
}
function gainXp(id, n){
  if (!xpLive()) return 0;
  if (!S || !(n > 0)) return 0;
  const unit = itemXp(id); if (!unit) return 0;
  S.xp = (S.xp||0) + unit * n;
  if ((S.level|0) < 1) S.level = 1;
  let ups = 0, pps = 0;
  for (let i=0; i<200 && (S.xp||0) >= xpNeed(S.level); i++){
    S.xp -= xpNeed(S.level);
    S.level = (S.level|0) + 1;
    ups++;
    if (xpPpAt(S.level) && S.level > (S.levelPp|0)){
      S.pp = (S.pp|0) + 1;
      S.levelPp = S.level;
      pps++;
    }
  }
  R.dirty = true;
  if (ups){
    if (R.quiet){
      const prev = R.pendLv || {to:S.level, ups:0, pps:0};
      prev.to = S.level; prev.ups += ups; prev.pps += pps; R.pendLv = prev;
    } else {
      try { celebrateLevel(S.level, ups, pps); } catch(e){}
    }
  }
  try { if (!R.quiet) updateXpBar(); } catch(e){}
  return unit * n;
}
function flushLevelUp(){
  const prev = R.pendLv; if (!prev) return;
  R.pendLv = null;
  try { celebrateLevel(prev.to, prev.ups, prev.pps); } catch(e){}
}

// ERAS: every rebirth is a fresh world with ONE quest. Each era adds one new thing (a resource, building or product).
// Finish the quest -> Rebirth -> +1 prestige point -> next era. After the last era of the cycle you Ascend. Each Ascension adds one new era (new resource), up to 50.
const ERAS = [
  {name:'The First Tree', unlock:[],                               q:{item:'wood', n:25},          tip:'Tap a tree to build a Wood Cutter (the first one is free).'},
  {name:'Planks',         unlock:['b:workshop','r:plank'],         q:{item:'plank', n:15},         tip:'Tap open grass to build a Workshop: 6 Wood → 1 Plank.'},
  {name:'Stone Age',      unlock:['res:stone','b:quarry'],         q:{item:'stone', n:60},         tip:'Stone appeared! Build Quarries on the grey rocks.'},
  {name:'Bricks',         unlock:['r:brick'],                      q:{item:'brick', n:30},         tip:'Set a Workshop to Bricks: 4 Stone → 1 Brick.'},
  {name:'Iron Age',       unlock:['res:iron','b:drill'],           q:{item:'ironOre', n:60},       tip:'Iron ore appeared! Build Ore Drills on the dark rocks with silver nuggets.'},
  {name:'Smelting',       unlock:['b:smelter','r:ironIngot'],      q:{item:'ironIngot', n:40},     tip:'Smelters melt 2 Iron Ore into 1 Iron Ingot.'},
  {name:'Gears',          unlock:['r:gear'],                       q:{item:'gear', n:40},          tip:'Workshops press 2 Iron Ingots into a Gear.'},
  {name:'Copper Age',     unlock:['res:copper','r:copperIngot'],   q:{item:'copperIngot', n:60},   tip:'Copper ore appeared! Drill it and smelt it into Copper Ingots.'},
  {name:'Wire',           unlock:['r:wire'],                       q:{item:'wire', n:150},         tip:'Workshops pull 1 Copper Ingot into 2 Wire.'},
  {name:'Coal & Steel',   unlock:['res:coal','r:steel'],           q:{item:'steel', n:50},         tip:'Coal appeared! Smelters make Steel from 2 Iron Ingots + 2 Coal.'},
  {name:'Circuits',       unlock:['b:assembler','r:circuit'],      q:{item:'circuit', n:40},       tip:'Assemblers build Circuits from 3 Wire + 1 Plank.'},
  {name:'Silver Age',     unlock:['res:silver','r:silverIngot'],   q:{item:'silverIngot', n:80},   tip:'Silver ore appeared (lilac rocks with sparkles)! Smelt it into Silver Bars.'},
  {name:'Contacts',       unlock:['r:contact'],                    q:{item:'contact', n:120},      tip:'Workshops make 2 Silver Contacts from 1 Silver Bar + 2 Wire.'},
  {name:'Gold Rush',      unlock:['res:gold','r:goldIngot'],       q:{item:'goldIngot', n:80},     tip:'Gold ore appeared! Smelt it into Gold Bars.'},
  {name:'Jewelry',        unlock:['r:jewelry'],                    q:{item:'jewelry', n:30},       tip:'Assemblers craft Jewelry from 2 Gold Bars + 1 Silver Bar.'},
  {name:'Crystal Age',    unlock:['res:quartz','r:glass'],         q:{item:'glass', n:100},        tip:'Pink Quartz appeared! Smelt 2 Quartz + 1 Coal into Glass.'},
  {name:'Microchips',     unlock:['r:chip'],                       q:{item:'chip', n:40},          tip:'Assemblers make Microchips from Glass + Gold Bar + Circuit.'},
  {name:'Titanium Age',   unlock:['res:titanium','r:titaniumIngot'], q:{item:'titaniumIngot', n:80}, tip:'Titanium ore appeared! Smelt 2 ore + 1 Coal into Titanium Ingots.'},
  {name:'Titanium Plates',unlock:['r:plate'],                      q:{item:'plate', n:40},         tip:'Assemblers roll Titanium Plates from 2 Titanium Ingots + 1 Steel.'},
  {name:'Quantum Age',    unlock:['res:quantum','b:lab','r:qcore'], q:{item:'qcore', n:30},        tip:'Quantum Crystals appeared! Build a Quantum Lab: 3 Crystals + Chip + Plate → Quantum Core.'},
  {name:'Quantum Computer', unlock:['r:qcomp'],                    q:{item:'qcomp', n:3},          tip:'A Quantum Computer: 2 Quantum Cores + 4 Contacts + 1 Jewelry. Finish the cycle to Ascend — later Ascensions add a new era after this one.'},
];
// ===== v44: post-quantum eras (one new resource per Ascension, up to 50 eras) + cycle cap =====
const BASE_ERAS = 21, MAX_ERAS = 50, BASE_LAST = 20; // BASE_LAST = Quantum Computer (never moves)
function cycleLen(asc){ return Math.min(MAX_ERAS, BASE_ERAS + (asc|0)); }
function capOf(st){ const s = st || S; const c = (s && s.eraCap)|0; return c ? Math.max(BASE_ERAS, Math.min(MAX_ERAS, c)) : cycleLen(s && s.asc); }
function lastEraOf(st){ return capOf(st) - 1; }
function migrateEraCap(st){
  if (!st) return false;
  if (st.eraCap != null){ st.eraCap = Math.max(BASE_ERAS, Math.min(MAX_ERAS, st.eraCap|0)); return false; }
  // Pending Ascension after Quantum: keep this cycle at 21 so the Ascend button still works.
  // Otherwise they get the eras they've earned (21+N) at the end of this cycle, after Quantum.
  if ((st.rebirths|0) >= BASE_LAST && st.finalDone) st.eraCap = BASE_ERAS;
  else st.eraCap = cycleLen(st.asc|0);
  return true;
}
function migrateAllSlotsEraCap(){
  for (let n=1; n<=SLOTS; n++){
    const raw = lsGet(slotKey(n)); if (!raw) continue;
    try { const d = JSON.parse(raw); if (!d || d.v !== SAVE_V) continue; if (migrateEraCap(d)) lsSet(slotKey(n), JSON.stringify(d)); } catch(e){}
  }
}

// 29 new eras (22–50). Each adds one raw resource + a product (and a new crafter at 22/25/30/36).
const POST_BLD = {
  forge:     {name:'Fusion Forge',      size:2, cost:{brick:120, steel:40, circuit:16, qcore:4}, top:'#3ec7ff', side:'#0a4e68', desc:'Fuses plasma and light elements into power cells'},
  collider:  {name:'Particle Collider', size:2, cost:{brick:150, steel:50, chip:10, plasmaCell:6}, top:'#b56bff', side:'#3b1060', desc:'Smashes exotic particles into antimatter and dark cores'},
  starforge: {name:'Starforge',         size:2, cost:{brick:180, plate:20, fusionCore:4, circuit:20}, top:'#ffb347', side:'#8a3d0f', desc:'Compresses stellar matter into cores, glass and plates'},
  nexus:     {name:'Nexus',             size:2, cost:{brick:220, qcomp:2, starCore:2, steel:60}, top:'#e8f0ff', side:'#2a2160', desc:'Bends time, space and origin-stuff into late-game wonders'},
};
const POST_ERAS = [
  {key:'plasma',      raw:'plasma',      rawName:'Plasma Crystals',     oneRaw:'Plasma Crystal',     prod:'plasmaCell',      prodName:'Plasma Cells',      oneProd:'Plasma Cell',      era:'Plasma Age',     bld:'forge',     qn:20, shape:'crystal', pshape:'cell',   cols:['#fff6c0','#4fd2ff','#0a6a9e'], glow:'rgba(80,210,255,.7)', rock:['#16324a','#2a5a7a'],
   recipe:{in:{plasma:4, steel:2, circuit:1}, out:1, time:8},  tip:'Plasma Crystals appeared! Build a Fusion Forge: 4 Plasma + 2 Steel + 1 Circuit → Plasma Cell.'},
  {key:'deuterium',   raw:'deuterium',   rawName:'Deuterium Ice',       oneRaw:'Deuterium Ice',      prod:'fusionCore',      prodName:'Fusion Cores',      oneProd:'Fusion Core',      era:'Fusion',         qn:16, shape:'ice',     pshape:'core',   cols:['#ffffff','#9ae8ff','#2b6fbf'], glow:'rgba(160,230,255,.75)', rock:['#3a6288','#7eb6d4'],
   recipe:{in:{deuterium:4, plasmaCell:2, qcore:1}, out:1, time:10}, tip:'Deuterium Ice appeared! Fusion Forge: 4 Deuterium + 2 Plasma Cells + 1 Quantum Core → Fusion Core.'},
  {key:'helion',      raw:'helion',      rawName:'Helion Ore',          oneRaw:'Helion Ore',         prod:'helionRod',       prodName:'Helion Rods',       oneProd:'Helion Rod',       era:'Helion',         qn:16, shape:'ore',     pshape:'rod',    cols:['#fff6d0','#ffd36a','#c47a10'], glow:'rgba(255,210,100,.55)', rock:['#5a4a28','#8a7040'],
   recipe:{in:{helion:3, fusionCore:1, plate:1}, out:1, time:9}, tip:'Helion Ore appeared! Fusion Forge: 3 Helion + 1 Fusion Core + 1 Titanium Plate → Helion Rod.'},
  {key:'antimatter',  raw:'antimatter',  rawName:'Antimatter Veins',    oneRaw:'Antimatter Vein',    prod:'antimatterCell',  prodName:'Antimatter Cells',  oneProd:'Antimatter Cell',  era:'Antimatter',     bld:'collider',  qn:12, shape:'shard',   pshape:'cell',   cols:['#f4e9ff','#c077ff','#2a0838'], glow:'rgba(200,120,255,.7)', rock:['#1a0a24','#3a1850'],
   recipe:{in:{antimatter:4, helionRod:1, qcomp:1}, out:1, time:12}, tip:'Antimatter Veins appeared! Build a Particle Collider: 4 Antimatter + 1 Helion Rod + 1 Quantum Computer → Antimatter Cell.'},
  {key:'darkmatter',  raw:'darkmatter',  rawName:'Dark Matter',         oneRaw:'Dark Matter',        prod:'darkCore',        prodName:'Dark Cores',        oneProd:'Dark Core',        era:'Dark Matter',    qn:14, shape:'orb',     pshape:'core',   cols:['#c8b0ff','#5b2a9e','#12081c'], glow:'rgba(90,40,160,.7)', rock:['#141018','#2c1a40'],
   recipe:{in:{darkmatter:4, antimatterCell:1, chip:1}, out:1, time:12}, tip:'Dark Matter appeared! Collider: 4 Dark Matter + 1 Antimatter Cell + 1 Microchip → Dark Core.'},
  {key:'photon',      raw:'photon',      rawName:'Photon Sand',         oneRaw:'Photon Sand',        prod:'photonCoil',      prodName:'Photon Coils',      oneProd:'Photon Coil',      era:'Photonic',       qn:16, shape:'dust',    pshape:'coil',   cols:['#ffffff','#ffe566','#e0a100'], glow:'rgba(255,240,160,.8)', rock:['#6a5a20','#c4a84a'],
   recipe:{in:{photon:5, darkCore:1, wire:4}, out:1, time:10}, tip:'Photon Sand appeared! Collider: 5 Photon Sand + 1 Dark Core + 4 Wire → Photon Coil.'},
  {key:'gravium',     raw:'gravium',     rawName:'Gravium',             oneRaw:'Gravium',            prod:'gravWell',        prodName:'Gravity Wells',     oneProd:'Gravity Well',     era:'Gravity',        qn:14, shape:'ore',     pshape:'well',   cols:['#e8eef6','#7d8a96','#2c3a48'], glow:'rgba(80,90,110,.45)', rock:['#3a4450','#6a7684'],
   recipe:{in:{gravium:3, photonCoil:1, steel:2}, out:1, time:11}, tip:'Gravium appeared! Collider: 3 Gravium + 1 Photon Coil + 2 Steel → Gravity Well.'},
  {key:'neutrino',    raw:'neutrino',    rawName:'Neutrino Ore',        oneRaw:'Neutrino Ore',       prod:'neutrinoCache',   prodName:'Neutrino Caches',   oneProd:'Neutrino Cache',   era:'Neutrino',       qn:14, shape:'crystal', pshape:'cache',  cols:['#f2ffe8','#b6f07a','#3a7a28'], glow:'rgba(180,240,120,.55)', rock:['#2a3a22','#4a6a38'],
   recipe:{in:{neutrino:4, gravWell:1, glass:2}, out:1, time:10}, tip:'Neutrino Ore appeared! Collider: 4 Neutrino + 1 Gravity Well + 2 Glass → Neutrino Cache.'},
  {key:'stellar',     raw:'stellar',     rawName:'Stellar Dust',        oneRaw:'Stellar Dust',       prod:'starCore',        prodName:'Star Cores',        oneProd:'Star Core',        era:'Stellar',        bld:'starforge', qn:12, shape:'dust',    pshape:'core',   cols:['#fff3c0','#ff9f1a','#c0392b'], glow:'rgba(255,160,40,.75)', rock:['#5a2a10','#a85a18'],
   recipe:{in:{stellar:4, neutrinoCache:1, goldIngot:2}, out:1, time:12}, tip:'Stellar Dust appeared! Build a Starforge: 4 Stellar Dust + 1 Neutrino Cache + 2 Gold Bars → Star Core.'},
  {key:'nebula',      raw:'nebula',      rawName:'Nebula Gas',          oneRaw:'Nebula Gas',         prod:'nebulaGlass',     prodName:'Nebula Glass',      oneProd:'Nebula Glass',     era:'Nebula',         qn:14, shape:'gas',     pshape:'lens',   cols:['#ffd6f5','#ff7eb6','#6c5ce7'], glow:'rgba(255,120,200,.6)', rock:['#3a2150','#7a3a80'],
   recipe:{in:{nebula:4, starCore:1, glass:2}, out:1, time:10}, tip:'Nebula Gas appeared! Starforge: 4 Nebula Gas + 1 Star Core + 2 Glass → Nebula Glass.'},
  {key:'pulsar',      raw:'pulsar',      rawName:'Pulsar Crystals',     oneRaw:'Pulsar Crystal',     prod:'pulsarBeacon',    prodName:'Pulsar Beacons',    oneProd:'Pulsar Beacon',    era:'Pulsar',         qn:12, shape:'crystal', pshape:'beacon', cols:['#eaf4ff','#74b9ff','#1e4a9e'], glow:'rgba(80,160,255,.75)', rock:['#152448','#2a4a88'],
   recipe:{in:{pulsar:3, nebulaGlass:1, circuit:2}, out:1, time:11}, tip:'Pulsar Crystals appeared! Starforge: 3 Pulsar + 1 Nebula Glass + 2 Circuits → Pulsar Beacon.'},
  {key:'neutronium',  raw:'neutronium',  rawName:'Neutronium',          oneRaw:'Neutronium',         prod:'neutronPlate',    prodName:'Neutron Plates',    oneProd:'Neutron Plate',    era:'Neutronium',     qn:12, shape:'ore',     pshape:'plate',  cols:['#e6f0ff','#8fa6c4','#2c3a52'], glow:'rgba(140,170,210,.4)', rock:['#2a3344','#4a5870'],
   recipe:{in:{neutronium:3, pulsarBeacon:1, plate:1}, out:1, time:12}, tip:'Neutronium appeared! Starforge: 3 Neutronium + 1 Pulsar Beacon + 1 Titanium Plate → Neutron Plate.'},
  {key:'quasar',      raw:'quasar',      rawName:'Quasar Shards',       oneRaw:'Quasar Shard',       prod:'quasarLens',      prodName:'Quasar Lenses',     oneProd:'Quasar Lens',      era:'Quasar',         qn:10, shape:'shard',   pshape:'lens',   cols:['#fff5e8','#ff6b3d','#7a1020'], glow:'rgba(255,120,50,.75)', rock:['#3a1018','#7a3020'],
   recipe:{in:{quasar:3, neutronPlate:1, chip:1}, out:1, time:12}, tip:'Quasar Shards appeared! Starforge: 3 Quasar + 1 Neutron Plate + 1 Microchip → Quasar Lens.'},
  {key:'voids',       raw:'voidOre',     rawName:'Void Ore',            oneRaw:'Void Ore',           prod:'voidShard',       prodName:'Void Shards',       oneProd:'Void Shard',       era:'Void',           qn:12, shape:'orb',     pshape:'shard',  cols:['#d0d6e8','#4a5168','#07070c'], glow:'rgba(80,90,140,.5)', rock:['#0c0c14','#242436'],
   recipe:{in:{voidOre:4, quasarLens:1, quantum:2}, out:1, time:11}, tip:'Void Ore appeared! Starforge: 4 Void Ore + 1 Quasar Lens + 2 Quantum Crystals → Void Shard.'},
  {key:'chronite',    raw:'chronite',    rawName:'Chronite',            oneRaw:'Chronite',           prod:'timeGear',        prodName:'Time Gears',        oneProd:'Time Gear',        era:'Chrono',         bld:'nexus',     qn:10, shape:'ore',     pshape:'gear',   cols:['#ffe9c0','#e0a15a','#1aa7c4'], glow:'rgba(80,200,220,.5)', rock:['#4a3020','#8a6040'],
   recipe:{in:{chronite:3, voidShard:1, gear:2}, out:1, time:12}, tip:'Chronite appeared! Build a Nexus: 3 Chronite + 1 Void Shard + 2 Gears → Time Gear.'},
  {key:'aether',      raw:'aether',      rawName:'Aether Blooms',       oneRaw:'Aether Bloom',       prod:'aetherSilk',      prodName:'Aether Silk',       oneProd:'Aether Silk',      era:'Aether',         qn:12, shape:'bloom',   pshape:'silk',   cols:['#ffffff','#d6f0ff','#a78bfa'], glow:'rgba(200,230,255,.7)', rock:['#3a3a60','#7a7ab0'],
   recipe:{in:{aether:4, timeGear:1, jewelry:1}, out:1, time:10}, tip:'Aether Blooms appeared! Nexus: 4 Aether + 1 Time Gear + 1 Jewelry → Aether Silk.'},
  {key:'astral',      raw:'astral',      rawName:'Astral Ore',          oneRaw:'Astral Ore',         prod:'astralGem',       prodName:'Astral Gems',       oneProd:'Astral Gem',       era:'Astral',         qn:10, shape:'crystal', pshape:'gem',    cols:['#e8f0ff','#6ea8ff','#1a1a4a'], glow:'rgba(110,170,255,.7)', rock:['#12123a','#2a2a6a'],
   recipe:{in:{astral:3, aetherSilk:1, quartz:2}, out:1, time:11}, tip:'Astral Ore appeared! Nexus: 3 Astral Ore + 1 Aether Silk + 2 Quartz → Astral Gem.'},
  {key:'celestial',   raw:'celestial',   rawName:'Celestial Stone',     oneRaw:'Celestial Stone',    prod:'celestialBar',    prodName:'Celestial Bars',    oneProd:'Celestial Bar',    era:'Celestial',      qn:10, shape:'ore',     pshape:'bar',    cols:['#fffdf0','#ffe08a','#c9a227'], glow:'rgba(255,230,150,.65)', rock:['#5a4a28','#c4b06a'],
   recipe:{in:{celestial:3, astralGem:1, goldIngot:2}, out:1, time:12}, tip:'Celestial Stone appeared! Nexus: 3 Celestial Stone + 1 Astral Gem + 2 Gold Bars → Celestial Bar.'},
  {key:'warp',        raw:'warp',        rawName:'Warp Crystals',       oneRaw:'Warp Crystal',       prod:'warpDrive',       prodName:'Warp Drives',       oneProd:'Warp Drive',       era:'Warp',           qn:8,  shape:'crystal', pshape:'drive',  cols:['#e8fff8','#2ee0c0','#0a5a58'], glow:'rgba(50,224,192,.7)', rock:['#0e3a3a','#1a6a68'],
   recipe:{in:{warp:3, celestialBar:1, contact:2}, out:1, time:12}, tip:'Warp Crystals appeared! Nexus: 3 Warp + 1 Celestial Bar + 2 Silver Contacts → Warp Drive.'},
  {key:'singularity', raw:'singSeed',    rawName:'Singularity Seeds',   oneRaw:'Singularity Seed',   prod:'singularity',     prodName:'Singularities',     oneProd:'Singularity',      era:'Singularity',    qn:8,  shape:'orb',     pshape:'sing',   cols:['#ffffff','#8a7cff','#0a0a12'], glow:'rgba(140,120,255,.7)', rock:['#0a0a14','#2a2050'],
   recipe:{in:{singSeed:3, warpDrive:1, qcore:1}, out:1, time:14}, tip:'Singularity Seeds appeared! Nexus: 3 Seeds + 1 Warp Drive + 1 Quantum Core → Singularity.'},
  {key:'dimension',   raw:'dimensionOre',rawName:'Dimension Ore',       oneRaw:'Dimension Ore',      prod:'riftCore',        prodName:'Rift Cores',        oneProd:'Rift Core',        era:'Dimensional',    qn:8,  shape:'shard',   pshape:'core',   cols:['#fff','#ff9ff3','#54a0ff'], glow:'rgba(200,140,255,.65)', rock:['#2a1650','#5a2a90'],
   recipe:{in:{dimensionOre:3, singularity:1, chip:1}, out:1, time:12}, tip:'Dimension Ore appeared! Nexus: 3 Dimension Ore + 1 Singularity + 1 Microchip → Rift Core.'},
  {key:'eclipse',     raw:'eclipse',     rawName:'Eclipse Rock',        oneRaw:'Eclipse Rock',       prod:'eclipseMirror',   prodName:'Eclipse Mirrors',   oneProd:'Eclipse Mirror',   era:'Eclipse',        qn:8,  shape:'ore',     pshape:'mirror', cols:['#fff4d0','#ffd23f','#1a1208'], glow:'rgba(255,200,60,.5)', rock:['#1a140c','#3a3020'],
   recipe:{in:{eclipse:3, riftCore:1, glass:2}, out:1, time:12}, tip:'Eclipse Rock appeared! Nexus: 3 Eclipse Rock + 1 Rift Core + 2 Glass → Eclipse Mirror.'},
  {key:'primordial',  raw:'primordial',  rawName:'Primordial Clay',     oneRaw:'Primordial Clay',    prod:'genesisSeed',     prodName:'Genesis Seeds',     oneProd:'Genesis Seed',     era:'Primordial',     qn:8,  shape:'clay',    pshape:'seed',   cols:['#ffe0a0','#e17055','#2d8f4e'], glow:'rgba(225,110,80,.45)', rock:['#4a2a18','#8a4a28'],
   recipe:{in:{primordial:4, eclipseMirror:1, wood:8}, out:1, time:11}, tip:'Primordial Clay appeared! Nexus: 4 Primordial Clay + 1 Eclipse Mirror + 8 Wood → Genesis Seed.'},
  {key:'mythril',     raw:'mythril',     rawName:'Mythril Veins',       oneRaw:'Mythril Vein',       prod:'mythrilWeave',    prodName:'Mythril Weave',     oneProd:'Mythril Weave',    era:'Mythril',        qn:8,  shape:'ore',     pshape:'weave',  cols:['#e8fff8','#7fd8c4','#2a6a6a'], glow:'rgba(130,220,200,.6)', rock:['#1a3a3a','#3a6a68'],
   recipe:{in:{mythril:3, genesisSeed:1, titaniumIngot:2}, out:1, time:12}, tip:'Mythril Veins appeared! Nexus: 3 Mythril + 1 Genesis Seed + 2 Titanium Ingots → Mythril Weave.'},
  {key:'cosmic',      raw:'cosmic',      rawName:'Cosmic Dust',         oneRaw:'Cosmic Dust',        prod:'cosmicLattice',   prodName:'Cosmic Lattices',   oneProd:'Cosmic Lattice',   era:'Cosmic',         qn:6,  shape:'dust',    pshape:'lattice',cols:['#f0e8ff','#a29bfe','#6c5ce7'], glow:'rgba(180,160,255,.7)', rock:['#1a1250','#3a2a80'],
   recipe:{in:{cosmic:3, mythrilWeave:1, qcomp:1}, out:1, time:14}, tip:'Cosmic Dust appeared! Nexus: 3 Cosmic Dust + 1 Mythril Weave + 1 Quantum Computer → Cosmic Lattice.'},
  {key:'infinity',    raw:'infinity',    rawName:'Infinity Crystals',   oneRaw:'Infinity Crystal',   prod:'infinityLoop',    prodName:'Infinity Loops',    oneProd:'Infinity Loop',    era:'Infinity',       qn:5,  shape:'crystal', pshape:'loop',   cols:['#fff8d0','#ffd23f','#8a6100'], glow:'rgba(255,210,60,.7)', rock:['#3a2a08','#8a6a20'],
   recipe:{in:{infinity:3, cosmicLattice:1, jewelry:1}, out:1, time:14}, tip:'Infinity Crystals appeared! Nexus: 3 Infinity + 1 Cosmic Lattice + 1 Jewelry → Infinity Loop.'},
  {key:'omega',       raw:'omega',       rawName:'Omega Ore',           oneRaw:'Omega Ore',          prod:'omegaCore',       prodName:'Omega Cores',       oneProd:'Omega Core',       era:'Omega',          qn:4,  shape:'ore',     pshape:'core',   cols:['#ffd0d0','#e74c3c','#1a0508'], glow:'rgba(220,50,40,.65)', rock:['#2a080c','#6a1518'],
   recipe:{in:{omega:3, infinityLoop:1, darkCore:1}, out:1, time:16}, tip:'Omega Ore appeared! Nexus: 3 Omega Ore + 1 Infinity Loop + 1 Dark Core → Omega Core.'},
  {key:'origin',      raw:'origin',      rawName:'Origin Sparks',       oneRaw:'Origin Spark',       prod:'originCell',      prodName:'Origin Cells',      oneProd:'Origin Cell',      era:'Origin',         qn:3,  shape:'spark',   pshape:'cell',   cols:['#ffffff','#ffeaa7','#fdcb6e'], glow:'rgba(255,250,200,.85)', rock:['#5a4a20','#c4b06a'],
   recipe:{in:{origin:3, omegaCore:1, starCore:1}, out:1, time:16}, tip:'Origin Sparks appeared! Nexus: 3 Origin Sparks + 1 Omega Core + 1 Star Core → Origin Cell.'},
  {key:'universe',    raw:'universe',    rawName:'Universe Fragments',  oneRaw:'Universe Fragment',  prod:'universeHeart',   prodName:'Universe Hearts',   oneProd:'Universe Heart',   era:'Universe',       qn:2,  shape:'fragment',pshape:'heart',  cols:['#ffffff','#a29bfe','#ff7eb6'], glow:'rgba(200,180,255,.85)', rock:['#1a1033','#4a2a70'],
   recipe:{in:{universe:5, originCell:2, singularity:1, qcomp:1}, out:1, time:20}, tip:'Universe Fragments appeared! The capstone: 5 Fragments + 2 Origin Cells + 1 Singularity + 1 Quantum Computer → Universe Heart.'},
];
const POST_ART = {};
const POST_TV = {};
function applyPostQuantum(){
  let tv = 12;
  for (let i=0;i<POST_ERAS.length;i++){
    const E = POST_ERAS[i];
    E.tv = tv++;
    POST_TV[E.raw] = E.tv;
    ITEMS[E.raw] = {name:E.rawName, one:E.oneRaw};
    ITEMS[E.prod] = {name:E.prodName, one:E.oneProd};
    const iv = Math.min(9, 7 + i*0.06);
    const cost = i<5 ? {brick:40, steel:12, circuit:4}
               : i<10 ? {brick:50, steel:16, circuit:6, qcore:1}
               : i<18 ? {brick:60, plate:8, qcore:2}
               : {brick:80, steel:20, qcomp:1};
    RES[E.tv] = {item:E.raw, name:E.rawName, key:E.key, unlock:'res:'+E.key, iv, clear:5, col:E.cols[1], cost, rock:E.rock, art:E};
    ORE_T.push(E.tv);
    ASC_ORDER.push(E.key);
    HARV_NAME[E.key] = (E.oneRaw || E.rawName) + ' Drills';
    XP_RAW[E.raw] = 4 + Math.floor(i/8);
    RECIPES[E.prod] = E.recipe;
    POST_ART[E.raw] = E; POST_ART[E.prod] = E;
    if (E.bld && POST_BLD[E.bld] && !BUILDINGS[E.bld]){
      const B = POST_BLD[E.bld];
      BUILDINGS[E.bld] = {name:B.name, size:B.size, recipes:[], cost:B.cost, top:B.top, side:B.side, desc:B.desc};
    }
    const bld = E.bld || (i<3?'forge': i<8?'collider': i<14?'starforge':'nexus');
    if (BUILDINGS[bld] && BUILDINGS[bld].recipes && !BUILDINGS[bld].recipes.includes(E.prod)) BUILDINGS[bld].recipes.push(E.prod);
    const unlock = ['res:'+E.key, 'r:'+E.prod];
    if (E.bld) unlock.splice(1, 0, 'b:'+E.bld);
    ERAS.push({name:E.era, unlock, q:{item:E.prod, n:E.qn}, tip:E.tip});
  }
  const extras = ['forge','collider','starforge','nexus'].filter(id => BUILDINGS[id] && !BUILD_ORDER.includes(id));
  const ix = BUILD_ORDER.indexOf('lab');
  BUILD_ORDER.splice(ix<0?BUILD_ORDER.length:ix+1, 0, ...extras);
  for (const t in RES) RES_BY_KEY[RES[t].key] = +t;
}
applyPostQuantum();

function postMetal(cols){ return {hi:cols[0], mid:cols[1], lo:cols[2], edge:cols[2]}; }
function drawPostRaw(c, x, y, s, E){
  const cols = E.cols, glow = E.glow, rock = E.rock || [cols[2], cols[1]];
  if (glow){ const g = c.createRadialGradient(x,y,s*.05,x,y,s*.52); g.addColorStop(0, glow); g.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=g; c.beginPath(); c.arc(x,y,s*.52,0,7); c.fill(); }
  const sh = E.shape;
  if (sh==='crystal' || sh==='shard'){
    c.fillStyle=rock[0]; blobPath(c,x,y+s*.16,s*.3,4); c.fill();
    crystals(c,x,y+s*.1,s,cols,sh==='shard'?glow:null);
    if (sh==='shard'){ c.fillStyle=cols[0]; c.beginPath(); c.moveTo(x,y-s*.42); c.lineTo(x+s*.16,y-s*.05); c.lineTo(x-s*.18,y); c.closePath(); c.fill(); }
    sparkle(c,x+s*.22,y-s*.24,s*.09,cols[0]);
  } else if (sh==='ore'){
    c.fillStyle=rock[0]; blobPath(c,x,y,s*.4,3); c.fill();
    c.fillStyle=rock[1]; blobPath(c,x-s*.05,y-s*.05,s*.28,4); c.fill();
    nuggets(c,x,y,s,postMetal(cols),2);
  } else if (sh==='ice'){
    c.fillStyle='rgba(180,220,255,.35)'; rr(c,x-s*.32,y-s*.3,s*.64,s*.62,s*.12); c.fill();
    c.fillStyle=cols[1]; blobPath(c,x,y,s*.34,5); c.fill();
    c.fillStyle=cols[0]; blobPath(c,x-s*.08,y-s*.1,s*.2,6); c.fill();
    c.strokeStyle='rgba(255,255,255,.85)'; c.lineWidth=s*.04; c.beginPath(); c.moveTo(x-s*.12,y+s*.1); c.lineTo(x+s*.16,y-s*.16); c.stroke();
  } else if (sh==='dust' || sh==='gas'){
    for (let i=0;i<5;i++){ const a=i*1.26, d=s*(0.08+i*0.05); c.fillStyle=i%2?cols[1]:cols[0]; c.globalAlpha=.55+i*.08; c.beginPath(); c.ellipse(x+Math.cos(a)*d,y+Math.sin(a)*d*0.7,s*(.16-i*.015),s*(.12-i*.01),a,0,7); c.fill(); }
    c.globalAlpha=1; sparkle(c,x+s*.16,y-s*.2,s*.08,cols[0]);
  } else if (sh==='orb'){
    const g = c.createRadialGradient(x-s*.12,y-s*.12,s*.04,x,y,s*.36); g.addColorStop(0,cols[0]); g.addColorStop(.45,cols[1]); g.addColorStop(1,cols[2]);
    c.fillStyle=g; c.beginPath(); c.arc(x,y,s*.34,0,7); c.fill();
    c.strokeStyle=cols[0]; c.lineWidth=s*.04; c.beginPath(); c.arc(x,y,s*.34,0,7); c.stroke();
  } else if (sh==='bloom'){
    for (let i=0;i<6;i++){ const a=i/6*Math.PI*2; c.fillStyle=i%2?cols[1]:cols[0]; c.beginPath(); c.ellipse(x+Math.cos(a)*s*.18,y+Math.sin(a)*s*.18,s*.14,s*.08,a,0,7); c.fill(); }
    c.fillStyle=cols[2]; c.beginPath(); c.arc(x,y,s*.1,0,7); c.fill();
  } else if (sh==='clay'){
    c.fillStyle=cols[2]; blobPath(c,x,y+s*.08,s*.38,2); c.fill();
    c.fillStyle=cols[1]; blobPath(c,x-s*.04,y-s*.04,s*.26,3); c.fill();
    c.fillStyle=cols[0]; c.beginPath(); c.arc(x-s*.1,y-s*.1,s*.06,0,7); c.fill();
  } else if (sh==='spark'){
    sparkle(c,x,y,s*.42,cols[0]); sparkle(c,x,y,s*.22,cols[1]);
    c.strokeStyle=cols[1]; c.lineWidth=s*.04; for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; c.beginPath(); c.moveTo(x+Math.cos(a)*s*.12,y+Math.sin(a)*s*.12); c.lineTo(x+Math.cos(a)*s*.4,y+Math.sin(a)*s*.4); c.stroke(); }
  } else if (sh==='fragment'){
    for (const [dx,dy,sc,a] of [[-.12,.04,.7,-.4],[.14,.02,.55,.5],[0,-.14,.45,0]]){ c.save(); c.translate(x+dx*s,y+dy*s); c.rotate(a); c.fillStyle=cols[1]; c.beginPath(); c.moveTo(0,-s*.28*sc); c.lineTo(s*.2*sc,s*.12*sc); c.lineTo(-s*.18*sc,s*.14*sc); c.closePath(); c.fill(); c.fillStyle=cols[0]; c.beginPath(); c.moveTo(0,-s*.28*sc); c.lineTo(s*.08*sc,-s*.04*sc); c.lineTo(-s*.1*sc,0); c.closePath(); c.fill(); c.restore(); }
    sparkle(c,x+s*.2,y-s*.22,s*.09,cols[0]);
  } else {
    c.fillStyle=rock[0]; blobPath(c,x,y,s*.38,3); c.fill(); c.fillStyle=cols[1]; blobPath(c,x-s*.04,y-s*.06,s*.24,4); c.fill();
  }
}
function drawPostProd(c, x, y, s, E){
  const cols = E.cols, sh = E.pshape, m = postMetal(cols);
  if (E.glow){ const g = c.createRadialGradient(x,y,s*.04,x,y,s*.48); g.addColorStop(0,E.glow); g.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=g; c.beginPath(); c.arc(x,y,s*.48,0,7); c.fill(); }
  if (sh==='cell'){
    c.fillStyle=cols[2]; rr(c,x-s*.2,y-s*.38,s*.4,s*.76,s*.18); c.fill();
    const g = c.createLinearGradient(x-s*.16,y-s*.34,x+s*.16,y+s*.34); g.addColorStop(0,cols[0]); g.addColorStop(.5,cols[1]); g.addColorStop(1,cols[2]);
    c.fillStyle=g; rr(c,x-s*.16,y-s*.34,s*.32,s*.68,s*.14); c.fill();
    c.fillStyle='rgba(255,255,255,.7)'; rr(c,x-s*.08,y-s*.28,s*.1,s*.2,s*.05); c.fill();
  } else if (sh==='core'){
    c.strokeStyle=cols[2]; c.lineWidth=s*.07; c.beginPath(); c.ellipse(x,y,s*.34,s*.13,0.5,0,7); c.stroke(); c.beginPath(); c.ellipse(x,y,s*.34,s*.13,-0.5,0,7); c.stroke();
    const g2 = c.createRadialGradient(x-s*.05,y-s*.05,s*.02,x,y,s*.2); g2.addColorStop(0,'#fff'); g2.addColorStop(.4,cols[0]); g2.addColorStop(1,cols[1]); c.fillStyle=g2; c.beginPath(); c.arc(x,y,s*.19,0,7); c.fill();
  } else if (sh==='rod'){
    c.fillStyle=cols[2]; rr(c,x-s*.12,y-s*.4,s*.24,s*.8,s*.08); c.fill();
    c.fillStyle=metalGrad(c,x-s*.1,y-s*.38,x+s*.1,y+s*.38,m); rr(c,x-s*.1,y-s*.38,s*.2,s*.76,s*.07); c.fill();
    c.fillStyle=cols[0]; for(let i=0;i<3;i++) c.fillRect(x-s*.08,y-s*.28+i*s*.2,s*.16,s*.05);
  } else if (sh==='coil'){
    c.strokeStyle=cols[2]; c.lineWidth=s*.1; for(let i=0;i<3;i++){ c.beginPath(); c.ellipse(x-s*.16+i*s*.16,y,s*.14,s*.26,0,0,7); c.stroke(); }
    c.strokeStyle=cols[0]; c.lineWidth=s*.05; for(let i=0;i<3;i++){ c.beginPath(); c.ellipse(x-s*.16+i*s*.16,y-s*.02,s*.14,s*.24,0,3.5,5.5); c.stroke(); }
  } else if (sh==='well'){
    c.fillStyle=cols[2]; c.beginPath(); c.arc(x,y,s*.34,0,7); c.fill();
    c.fillStyle='#0c1016'; c.beginPath(); c.arc(x,y,s*.2,0,7); c.fill();
    c.strokeStyle=cols[0]; c.lineWidth=s*.05; c.beginPath(); c.ellipse(x,y,s*.28,s*.1,0.3,0,7); c.stroke();
  } else if (sh==='cache'){
    c.fillStyle=cols[2]; rr(c,x-s*.3,y-s*.28,s*.6,s*.58,s*.1); c.fill();
    c.fillStyle=cols[1]; rr(c,x-s*.3,y-s*.34,s*.6,s*.22,s*.1); c.fill();
    c.fillStyle=cols[0]; c.fillRect(x-s*.08,y-s*.08,s*.16,s*.2);
  } else if (sh==='beacon'){
    c.fillStyle=cols[2]; rr(c,x-s*.1,y-s*.1,s*.2,s*.42,s*.04); c.fill();
    c.fillStyle=cols[1]; c.beginPath(); c.moveTo(x-s*.22,y-s*.08); c.lineTo(x,y-s*.46); c.lineTo(x+s*.22,y-s*.08); c.closePath(); c.fill();
    c.fillStyle=cols[0]; c.beginPath(); c.arc(x,y-s*.28,s*.07,0,7); c.fill();
  } else if (sh==='plate'){
    c.fillStyle=cols[2]; rr(c,x-s*.42,y-s*.24,s*.84,s*.52,s*.06); c.fill();
    c.fillStyle=metalGrad(c,x-s*.4,y-s*.3,x+s*.4,y+s*.2,m); rr(c,x-s*.42,y-s*.3,s*.84,s*.5,s*.06); c.fill();
    c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=s*.04; c.beginPath(); c.moveTo(x-s*.2,y-s*.18); c.lineTo(x+s*.15,y-s*.18); c.stroke();
  } else if (sh==='lens'){
    c.fillStyle='rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(x,y,s*.32,s*.38,0,0,7); c.fill();
    c.strokeStyle=cols[1]; c.lineWidth=s*.05; c.beginPath(); c.ellipse(x,y,s*.32,s*.38,0,0,7); c.stroke();
    c.fillStyle=cols[0]; c.beginPath(); c.ellipse(x-s*.08,y-s*.1,s*.08,s*.12,0,0,7); c.fill();
  } else if (sh==='gear'){
    c.fillStyle=cols[2]; gearPath(c,x,y+s*.03,s*.4,8); c.fill();
    c.fillStyle=cols[1]; gearPath(c,x,y,s*.4,8); c.fill();
    c.fillStyle=cols[2]; c.beginPath(); c.arc(x,y,s*.12,0,7); c.fill();
    sparkle(c,x+s*.22,y-s*.22,s*.08,cols[0]);
  } else if (sh==='silk'){
    c.strokeStyle=cols[2]; c.lineWidth=s*.1; c.beginPath(); c.moveTo(x-s*.34,y+s*.2); c.quadraticCurveTo(x-s*.1,y-s*.4,x+s*.1,y); c.quadraticCurveTo(x+s*.25,y+s*.3,x+s*.38,y-s*.1); c.stroke();
    c.strokeStyle=cols[0]; c.lineWidth=s*.05; c.beginPath(); c.moveTo(x-s*.32,y+s*.16); c.quadraticCurveTo(x-s*.08,y-s*.36,x+s*.1,y-s*.02); c.stroke();
  } else if (sh==='gem'){
    c.fillStyle=cols[2]; c.beginPath(); c.moveTo(x,y-s*.4); c.lineTo(x+s*.28,y-s*.08); c.lineTo(x+s*.16,y+s*.3); c.lineTo(x-s*.16,y+s*.3); c.lineTo(x-s*.28,y-s*.08); c.closePath(); c.fill();
    c.fillStyle=cols[1]; c.beginPath(); c.moveTo(x,y-s*.4); c.lineTo(x+s*.28,y-s*.08); c.lineTo(x,y); c.closePath(); c.fill();
    c.fillStyle=cols[0]; c.beginPath(); c.moveTo(x,y-s*.4); c.lineTo(x-s*.08,y-s*.08); c.lineTo(x,y-s*.04); c.closePath(); c.fill();
  } else if (sh==='bar'){ metalIngot(c,x,y,s,m); sparkle(c,x+s*.2,y-s*.28,s*.09,cols[0]); }
  else if (sh==='drive'){
    c.fillStyle=cols[2]; rr(c,x-s*.38,y-s*.2,s*.76,s*.4,s*.12); c.fill();
    c.fillStyle=cols[1]; rr(c,x-s*.38,y-s*.26,s*.76,s*.28,s*.12); c.fill();
    c.fillStyle=cols[0]; for(let i=0;i<3;i++) c.fillRect(x-s*.28+i*s*.2,y-s*.1,s*.08,s*.16);
  } else if (sh==='sing'){
    c.fillStyle=cols[2]; c.beginPath(); c.arc(x,y,s*.3,0,7); c.fill();
    c.fillStyle='#05050a'; c.beginPath(); c.arc(x,y,s*.16,0,7); c.fill();
    c.strokeStyle=cols[0]; c.lineWidth=s*.05; c.beginPath(); c.ellipse(x,y,s*.34,s*.1,0.4,0,7); c.stroke();
  } else if (sh==='mirror'){
    c.fillStyle=cols[2]; c.beginPath(); c.arc(x,y,s*.32,0.4,Math.PI-0.2); c.arc(x+s*.08,y,s*.22,Math.PI-0.3,0.5,true); c.fill();
    c.fillStyle=cols[0]; c.globalAlpha=.5; c.beginPath(); c.arc(x-s*.04,y-s*.06,s*.14,0,7); c.fill(); c.globalAlpha=1;
  } else if (sh==='seed'){
    c.fillStyle=cols[2]; c.beginPath(); c.arc(x,y+s*.08,s*.18,0,7); c.fill();
    c.fillStyle=cols[1]; c.beginPath(); c.ellipse(x+s*.04,y-s*.16,s*.12,s*.22,-0.3,0,7); c.fill();
    c.fillStyle=cols[0]; c.beginPath(); c.ellipse(x-s*.1,y-s*.12,s*.1,s*.18,0.4,0,7); c.fill();
  } else if (sh==='weave'){
    c.strokeStyle=cols[1]; c.lineWidth=s*.07;
    for(let i=0;i<3;i++){ c.beginPath(); c.moveTo(x-s*.32,y-s*.16+i*s*.16); c.bezierCurveTo(x-s*.1,y-s*.3+i*s*.16,x+s*.1,y+s*.02+i*s*.16,x+s*.32,y-s*.12+i*s*.16); c.stroke(); }
  } else if (sh==='lattice'){
    c.strokeStyle=cols[1]; c.lineWidth=s*.05; for(let i=-1;i<=1;i++){ c.beginPath(); c.moveTo(x+i*s*.18,y-s*.28); c.lineTo(x+i*s*.18,y+s*.28); c.stroke(); c.beginPath(); c.moveTo(x-s*.28,y+i*s*.18); c.lineTo(x+s*.28,y+i*s*.18); c.stroke(); }
    c.fillStyle=cols[0]; c.beginPath(); c.arc(x,y,s*.08,0,7); c.fill();
  } else if (sh==='loop'){
    c.strokeStyle=cols[2]; c.lineWidth=s*.14; c.beginPath(); c.ellipse(x,y,s*.26,s*.16,0.6,0,7); c.stroke();
    c.strokeStyle=cols[0]; c.lineWidth=s*.08; c.beginPath(); c.ellipse(x,y,s*.26,s*.16,0.6,0,7); c.stroke();
  } else if (sh==='heart'){
    const g = c.createRadialGradient(x,y,s*.04,x,y,s*.4); g.addColorStop(0,cols[0]); g.addColorStop(.5,cols[1]); g.addColorStop(1,cols[2]);
    c.fillStyle=g; c.beginPath(); c.arc(x,y,s*.28,0,7); c.fill();
    c.strokeStyle='#fff'; c.lineWidth=s*.04; c.beginPath(); c.ellipse(x,y,s*.34,s*.12,0.4,0,7); c.stroke();
    sparkle(c,x+s*.2,y-s*.22,s*.1,cols[0]);
  } else { metalIngot(c,x,y,s,m); }
}
function drawPostItem(c, id, x, y, s){
  const E = POST_ART[id]; if (!E) return false;
  if (id===E.raw) drawPostRaw(c,x,y,s,E); else drawPostProd(c,x,y,s,E);
  return true;
}
function drawPostTile(rc, X, Y, P, v, k){
  const r = RES[v]; if (!r) return false;
  const rock = r.rock || [r.col, r.col];
  rc.fillStyle='rgba(0,0,0,.16)'; rc.beginPath(); rc.ellipse(X+2,Y+P*.28,P*.4,P*.13,0,0,7); rc.fill();
  rc.fillStyle=rock[0]; blobPath(rc,X,Y+P*.05,P*.4,k); rc.fill();
  rc.fillStyle=rock[1]; blobPath(rc,X-P*.06,Y-P*.02,P*.28,k+1); rc.fill();
  if (r.art) drawPostRaw(rc, X, Y, P*.95, r.art);
  return true;
}

const eraOf = e => ERAS[Math.min(Math.max(0, e|0), ERAS.length-1)];
// Pacing (v71): first Ascension ~6-8h of efficient play; later stars stay in a 1-2 week casual range.
// Prefer quest/cost/pack levers over slowing production ticks (keeps factories feeling snappy).
const PACE_PACK = 0.28;         // daily / achievement / quest completion packs
const PACE_KIT = 0.65;          // endgame supply kit (keep quantum eras finishable)
const PACE_UPG = 1;             // legacy; upgrade costs no longer use this steepener
const PACE_PROD = 0.50;         // harvest/craft rate (belts stay snappy; first run ~6-8h)
function paceQuest(e){          // multiplies the era's base quest target
  e = e|0;
  const asc = (S && S.asc) | 0;
  const rb = (S && S.rebirths) | 0;
  let base, ascMul, rbMul;
  if (e <= 2) base = 2.1;
  else if (e <= 9) base = 5.2;
  else if (e <= 18) base = 6.0;
  else if (e <= 20) base = 3.4; // shortened Quantum Age / Quantum Computer
  else base = 3.0;              // post-quantum: a session, not hours
  if (e >= 19){
    ascMul = 1 + 0.5 * Math.min(asc, 8); // ★1=1.5×, ★5=3.5×, caps at ★8=5×
    rbMul = 1 + 0.008 * Math.min(rb, 40);
  } else {
    ascMul = 1 + 0.7 * Math.min(asc, 6); // ★0=1×, ★1=1.7×, ★5=4.5×, caps at ★6=5.2×
    rbMul = 1 + 0.012 * Math.min(rb, 20);
  }
  return base * ascMul * rbMul;
}
const eraName = e => (e|0) >= capOf() ? `Ascension ★${ascN()+1}` : (ERAS[e] && ERAS[e].name) || ('Era '+(e+1));
function eraUnlocks(e){ const u = []; const top = Math.min(e|0, ERAS.length-1); for (let i=0;i<=top;i++) for (const x of ERAS[i].unlock) if (!u.includes(x)) u.push(x); return u; }
function eraQuest(e){ const E = eraOf(e); return {item:E.q.item, n:Math.ceil(E.q.n*paceQuest(e)), tip:E.tip, era:e}; }
// what an era reveals (for the quest card and the rebirth celebration)
function eraReveal(e){
  if ((e|0) >= capOf() || (e|0) >= ERAS.length){ const k = ASC_ORDER[ascN()]; return k && RES_BY_KEY[k] != null ? {kind:'Ascension', item:RES[RES_BY_KEY[k]].item, text:`Back to Era 1 — ${HARV_NAME[k]} turn GOLD & FREE`} : {kind:'Ascension', item:'qcomp', text:'Back to Era 1 — all harvesters are already gold'}; }
  const u = ERAS[e].unlock, res = u.find(x=>x.startsWith('res:')), bld = u.filter(x=>x.startsWith('b:')).map(x=>BUILDINGS[x.slice(2)] && BUILDINGS[x.slice(2)].name).filter(Boolean), rec = u.filter(x=>x.startsWith('r:')).map(x=>x.slice(2));
  if (res){ const tv = RES_BY_KEY[res.slice(4)]; return {kind:'New resource', item:RES[tv].item, text:RES[tv].name + (bld.length?' + '+bld.join(', '):'') + (rec.length?' → '+rec.map(r=>ITEMS[r].name).join(', '):'')}; }
  if (rec.length) return {kind:'New product', item:rec[0], text:rec.map(r=>ITEMS[r].name).join(', ') + (bld.length?' + '+bld.join(', '):'')};
  return {kind:'Start', item:'wood', text:'Wood'};
}
// One upgrade track (Lv1–Lv5): each level = faster + higher double chance. Clear panel in openInfo.
const MAX_LV = 5;
const LV_COL = [null,'#b2bec3','#55efc4','#74b9ff','#a29bfe','#fdcb6e'];
const lvSpeed = lv => 1 + 0.25*Math.max(0, (lv||1)-1);           // 1.00 / 1.25 / 1.50 / 1.75 / 2.00
const lvDouble = lv => 0.10*Math.max(0, (lv||1)-1);               // 0% / 10% / 20% / 30% / 40%
const dblChance = b => lvDouble(b.lv||1) + 0.05*perk('lucky') + 0.10*perk('fortune');
// Cost to buy `lv` (from lv-1). Scaled to the building's own base build cost — affordable, not free.
const LV_MUL = [0, 0, 1.5, 3, 5.5, 8]; // Lv2 ~1.5× build, Lv5 ~8× build
function lvBaseCost(type){
  const B = BUILDINGS[type]; if (!B || !B.cost) return {wood:20};
  return {...B.cost};
}
function lvCost(type, lv){
  if (lv < 2 || lv > MAX_LV) return null;
  const base = lvBaseCost(type), mul = LV_MUL[lv] * qScale(), o = {};
  for (const k in base) o[k] = Math.max(1, Math.ceil(base[k] * mul));
  // fold in era-appropriate materials so mid/late upgrades stay reachable with current resources
  if (lv >= 3 && has('r:brick')) o.brick = (o.brick||0) + Math.ceil(6 * LV_MUL[lv]);
  if (lv >= 4 && has('r:ironIngot')) o.ironIngot = (o.ironIngot||0) + Math.ceil(4 * LV_MUL[lv]);
  if (lv >= 5 && has('r:gear')) o.gear = (o.gear||0) + Math.ceil(3 * LV_MUL[lv]);
  if (lv >= 5 && has('r:steel')) o.steel = (o.steel||0) + Math.ceil(2 * LV_MUL[lv]);
  return o;
}
// Migrate old tier + double-output into a single level (no refund)
function migrateBuildingLv(b){
  if (!b || b.type==='hub') return;
  if (b.lv != null && b.lv >= 1){ b.lv = Math.min(MAX_LV, Math.max(1, b.lv|0)); return; }
  const t = Math.min(5, Math.max(1, (b.tier|0) || 1));
  const d = Math.min(3, Math.max(0, b.dbl|0));
  b.lv = Math.min(MAX_LV, Math.max(t, d + 1));
}
function x2Pop(b){ if (R.time - (b.x2t||-9) < 0.6) return; b.x2t = R.time; const sz = BUILDINGS[b.type].size; R.x2.push({x:b.x+sz/2, y:b.y+0.1, life:0.9, max:0.9}); }
// Back-compat aliases so any leftover call sites keep working during the swap
const MAX_TIER = MAX_LV, TIER_COL = LV_COL;
const tierMul = t => lvSpeed(t);
function tierCost(type, t){ return lvCost(type, t); }
function dblCost(type, l){ return null; } // double-output track removed
const DBL_CHANCE = [0, 0.10, 0.20, 0.30, 0.40]; // display helper only
const MAX_DBL = 0;
// Prestige perks: exactly 1 point per rebirth; level L costs L+1 points
const PERKS = [
  {id:'swift',   ic:'⛏️', name:'Swift Harvest',   desc:'+25% harvester speed per level', max:5},
  {id:'craft',   ic:'🔨', name:'Master Crafter',  desc:'+25% crafting speed per level', max:5},
  {id:'belts',   ic:'⚡', name:'Turbo Belts',     desc:'+25% belt speed per level', max:5},
  {id:'thrift',  ic:'💰', name:'Thrifty Builder', desc:'-10% building costs per level', max:5},
  {id:'start',   ic:'🎒', name:'Head Start',      desc:'Start each era with extra Wood, Planks, Stone, Bricks & Iron (what that era has)', max:5},
  {id:'lucky',   ic:'🍀', name:'Lucky Factory',   desc:'+5% double-output chance on every building per level', max:4},
  {id:'offline', ic:'🌙', name:'Night Shift',     desc:'+12h offline time per level (base 24h)', max:4},
  // mid-tier prestige sinks (~10–30 ✦)
  {id:'stockpile', ic:'📦', name:'Deep Stockpile', desc:'+18 wood/stone and +8 planks/bricks at the start of every era', max:3, cost:15},
  {id:'express',   ic:'🚄', name:'Express Belts',  desc:'+40% belt speed per level (stacks with Turbo Belts)', max:3, cost:20},
  {id:'fortune',   ic:'✨', name:'Fortune Lines',  desc:'+10% double-output chance per level', max:2, cost:25},
  {id:'woodHut', ic:'🪓', name:"Woodcutter's Hut", desc:'Place up to 3 huts on grass, all free. A woodcutter walks to nearby trees and brings back 1 Wood per trip. A tree takes 5 trips, then it\'s gone for good — demolish a hut to free a slot.', max:1, cost:5, hut:1},
  {id:'rockHut', ic:'⛏️', name:'Quarry Hut', desc:'Place up to 3 huts on grass, all free. A miner walks to nearby rocks and brings back 1 Stone per trip. A rock takes 5 trips, then it\'s gone for good — demolish a hut to free a slot.', max:1, cost:5, hut:1},
  // mega unlocks (~50 / ~100 ✦) — permanent; then build with resources
  {id:'megaHarv',   ic:'🌲', name:'Mega Harvester', desc:'Unlock the 3×3 Mega Harvester: chops Wood 8× faster than a Wood Cutter. Must sit on trees.', max:1, cost:50, mega:1},
  {id:'megaQuarry', ic:'🪨', name:'Mega Quarry',    desc:'Unlock the 3×3 Mega Quarry: digs Stone 8× faster than a Quarry. Must sit on stone.', max:1, cost:50, mega:1},
  {id:'megaDrill',  ic:'🛠️', name:'Mega Drill',     desc:'Unlock the 3×3 Mega Drill: mines ore 8× faster than an Ore Drill. Must sit on ore tiles.', max:1, cost:75, mega:1},
  {id:'megaBlock',  ic:'🧱', name:'Mega Block',     desc:'Unlock the 3×3 Mega Block: a giant workshop that crafts Planks, Bricks, Gears, Wire, and Contacts 5× faster.', max:1, cost:80, mega:1},
  {id:'megaSmelt',  ic:'🔥', name:'Mega Smelter',   desc:'Unlock the 3×3 Mega Smelter: melts ore into metal and glass 5× faster than a Smelter.', max:1, cost:80, mega:1},
  {id:'megaHub',    ic:'🏛️', name:'Hub Extension',  desc:'Unlock the 4×4 Hub Extension: extra delivery Hubs, place as many as you like. Nearby buildings belt to the closest one.', max:1, cost:5, mega:1},
];
const perkDef = id => PERKS.find(p=>p.id===id);
const perkCost = id => { const p = perkDef(id); if (p && p.cost != null) return p.cost; return perk(id) + 1; };
const megaUnlocked = type => { const B = BUILDINGS[type]; return !B.unlockPerk || perk(B.unlockPerk) > 0; };

const MAP_W = 200, MAP_H = 200, CHUNK = 16, SPACING = 0.5, OFFLINE_BASE = 24*3600, OFFLINE_RATE = 0.55, RESERVE = 12; // Builderment-scale map; crafters leave RESERVE of each item in the Hub for building
const HUB_EDGE = 8; // Main Hub must sit at least this many tiles in from every map edge, so belts have room and the camera can show it above the HUD
const COST_GROWTH = 1.28; // first ~10 of a type: each one costs +28% more...
const COST_SOFT = 0.12;    // ...after 10 the growth turns linear (+12% of the 10th's price each) so big factories don't hit a wall
const growthMul = n => n <= 10 ? Math.pow(COST_GROWTH, n) : Math.pow(COST_GROWTH, 10) * (1 + COST_SOFT*(n-10));
const TILE_PX = 48; // terrain prerender resolution
// ---- Ascension worlds: look-only themes (gameplay / names / recipes unchanged) ----
const WORLDS = [
  {id:'meadow',  name:'Meadow',         ic:'🌿', sky:'#3f8fc9', sea:'#2f6f9e', grass:['#7ccf6a','#74c862'], blade:['#8fdb7c','#64b355'], flower:['#fff','#ffeaa7','#fd79a8'],
   waterRim:'#e6d39a', water:'#4fb4e8', trunk:'#7a4a24', canopy:['#1e8f4e','#239b56','#1a7f45'], hi:'#2ecc71', tree:'round',
   beltIn:'#3d8bfd', beltOut:'#f5a623', bridge:'#8d6e4c', accent:'#2ecc71', particle:'none'},
  {id:'autumn',  name:'Autumn Forest',  ic:'🍂', sky:'#c98a4a', sea:'#8a5a2b', grass:['#c9a14a','#b8903a'], blade:['#e07a2f','#d4a017'], flower:['#e17055','#fdcb6e','#d63031'],
   waterRim:'#d4b483', water:'#5a8fb0', trunk:'#5c3317', canopy:['#d35400','#e67e22','#c0392b'], hi:'#f39c12', tree:'round',
   beltIn:'#e67e22', beltOut:'#f1c40f', bridge:'#8d5a2b', accent:'#e67e22', particle:'leaf'},
  {id:'tundra',  name:'Snowy Tundra',   ic:'❄️', sky:'#a8c4d8', sea:'#6a8aa0', grass:['#dfe8ef','#cfd9e2'], blade:['#b8c8d4','#9eb0be'], flower:['#fff','#dfe6ee','#c5d3e0'],
   waterRim:'#c5d3e0', water:'#7eb6d4', trunk:'#5a4636', canopy:['#1a5c3a','#245c40','#0e3d28'], hi:'#dfe8ef', tree:'pine',
   beltIn:'#74b9ff', beltOut:'#a29bfe', bridge:'#7f8c8d', accent:'#74b9ff', particle:'snow'},
  {id:'desert',  name:'Desert Canyon',  ic:'🌵', sky:'#e8b86d', sea:'#c48a3a', grass:['#e8c878','#d4b45c'], blade:['#c9a14a','#b8860b'], flower:['#e17055','#fd79a8','#ffeaa7'],
   waterRim:'#d4b483', water:'#3d9bb8', trunk:'#6b4f2a', canopy:['#2d8f4e','#3aa35a','#1e7a3c'], hi:'#55efc4', tree:'cactus',
   beltIn:'#e17055', beltOut:'#fdcb6e', bridge:'#a67c52', accent:'#e17055', particle:'sand'},
  {id:'jungle',  name:'Tropical Jungle',ic:'🌴', sky:'#2d9cdb', sea:'#1a6a8a', grass:['#2d8f4e','#248044'], blade:['#55efc4','#00b894'], flower:['#fd79a8','#ffeaa7','#a29bfe'],
   waterRim:'#c8b070', water:'#1abc9c', trunk:'#6b3a1f', canopy:['#0e7a3c','#16a085','#27ae60'], hi:'#55efc4', tree:'palm',
   beltIn:'#00b894', beltOut:'#fdcb6e', bridge:'#6b3a1f', accent:'#00b894', particle:'none'},
  {id:'volcanic',name:'Volcanic',       ic:'🌋', sky:'#4a2c2a', sea:'#2a1514', grass:['#4a3a38','#3a2c2a'], blade:['#6b4540','#5a3530'], flower:['#e17055','#fdcb6e','#d63031'],
   waterRim:'#6b4540', water:'#c0392b', trunk:'#2c1810', canopy:['#2c2c2c','#1a1a1a','#3d3d3d'], hi:'#e17055', tree:'dead',
   beltIn:'#e17055', beltOut:'#fdcb6e', bridge:'#5a3530', accent:'#e17055', particle:'ember'},
  {id:'sakura',  name:'Cherry Blossom', ic:'🌸', sky:'#f5c6d0', sea:'#c98aa0', grass:['#a8d5a2','#92c78c'], blade:['#b8e0b0','#7cbc74'], flower:['#ffc0cb','#ff9ff3','#fff'],
   waterRim:'#e8c4c8', water:'#7eb6d4', trunk:'#6b4a3a', canopy:['#ffb7c5','#ff8fab','#ffc0cb'], hi:'#ffe4ec', tree:'blossom',
   beltIn:'#fd79a8', beltOut:'#ffeaa7', bridge:'#a67c72', accent:'#fd79a8', particle:'petal'},
  {id:'crystal', name:'Crystal Caves',  ic:'💎', sky:'#2c3e6b', sea:'#1a2540', grass:['#3d4f7a','#344568'], blade:['#5a6fa0','#4a5f90'], flower:['#a29bfe','#74b9ff','#81ecec'],
   waterRim:'#5a6fa0', water:'#6c5ce7', trunk:'#4a3a6b', canopy:['#a29bfe','#74b9ff','#81ecec'], hi:'#dfe6ff', tree:'crystal',
   beltIn:'#a29bfe', beltOut:'#81ecec', bridge:'#5a4a7a', accent:'#a29bfe', particle:'spark'},
  {id:'alien',   name:'Alien Planet',   ic:'🛸', sky:'#1a0a2e', sea:'#0d0518', grass:['#2d1b4e','#241640'], blade:['#6c5ce7','#a29bfe'], flower:['#00cec9','#fd79a8','#ffeaa7'],
   waterRim:'#4a2c6b', water:'#6c5ce7', trunk:'#3d2a55', canopy:['#00cec9','#55efc4','#a29bfe'], hi:'#81ecec', tree:'fungi',
   beltIn:'#00cec9', beltOut:'#fd79a8', bridge:'#4a2c6b', accent:'#00cec9', particle:'spore'},
  {id:'neon',    name:'Neon Night',     ic:'🌌', sky:'#0a0a18', sea:'#05050e', grass:['#12122a','#0e0e22'], blade:['#6c5ce7','#00cec9'], flower:['#00cec9','#fd79a8','#ffeaa7'],
   waterRim:'#1a1a3a', water:'#2d3436', trunk:'#1a1a2e', canopy:['#00cec9','#6c5ce7','#fd79a8'], hi:'#81ecec', tree:'neon',
   beltIn:'#00cec9', beltOut:'#fd79a8', bridge:'#2d2d4a', accent:'#6c5ce7', particle:'spark'},
];
// Prestige cosmetics (visual only). One equipped item per slot; owned items persist through rebirth / Ascension.
// Map themes are full palettes (ground, water, trees, sky, particles) — not a faint wash.
const MAP_PALETTES = {
  goldenMap: {id:'golden', name:'Golden Hour', ic:'🌅', sky:'#f0a04a', sea:'#c86a2a', grass:['#e8c04a','#d4a017'], blade:['#f5d76e','#c98a14'], flower:['#fff6c9','#ffd23f','#ff9f43'],
    waterRim:'#f0d090', water:'#5aa0c8', trunk:'#6b3e14', canopy:['#e09a1a','#f0b429','#c47a10'], hi:'#fff3b0', tree:'round',
    beltIn:'#e67e22', beltOut:'#ffd23f', bridge:'#8d5a2b', accent:'#f5b82e', particle:'leaf'},
  moonlitMap: {id:'moonlit', name:'Moonlit', ic:'🌕', sky:'#152238', sea:'#0d1828', grass:['#3d5368','#33485c'], blade:['#8ab0c8','#6a8aaa'], flower:['#dfe8ef','#74b9ff','#a8c4d8'],
    waterRim:'#4a6a80', water:'#3d6a88', trunk:'#2a3038', canopy:['#1a3d4a','#245060','#0e2a32'], hi:'#c5e0f0', tree:'pine',
    beltIn:'#74b9ff', beltOut:'#a29bfe', bridge:'#4a5a68', accent:'#74b9ff', particle:'spark'},
  cherryMap: {id:'cherry', name:'Cherry Dusk', ic:'🌸', sky:'#e89ab0', sea:'#b07090', grass:['#c8e0b0','#b4d49c'], blade:['#f5c0d0','#7cbc74'], flower:['#ffc0cb','#ff9ff3','#fff'],
    waterRim:'#e8c4c8', water:'#7eb6d4', trunk:'#6b4a3a', canopy:['#ffb7c5','#ff8fab','#ffc0cb'], hi:'#ffe4ec', tree:'blossom',
    beltIn:'#fd79a8', beltOut:'#ffeaa7', bridge:'#a67c72', accent:'#fd79a8', particle:'petal'},
  autumnMap: {id:'autumn', name:'Autumn Forest', ic:'🍂', sky:'#c98a4a', sea:'#8a5a2b', grass:['#c9a14a','#b8903a'], blade:['#e07a2f','#d4a017'], flower:['#e17055','#fdcb6e','#d63031'],
    waterRim:'#d4b483', water:'#5a8fb0', trunk:'#5c3317', canopy:['#d35400','#e67e22','#c0392b'], hi:'#f39c12', tree:'round',
    beltIn:'#e67e22', beltOut:'#f1c40f', bridge:'#8d5a2b', accent:'#e67e22', particle:'leaf'},
  tundraMap: {id:'tundra', name:'Snowy Tundra', ic:'❄️', sky:'#a8c4d8', sea:'#6a8aa0', grass:['#eef4f8','#d5e0ea'], blade:['#b8c8d4','#9eb0be'], flower:['#fff','#dfe6ee','#c5d3e0'],
    waterRim:'#c5d3e0', water:'#7eb6d4', trunk:'#5a4636', canopy:['#1a5c3a','#245c40','#0e3d28'], hi:'#ffffff', tree:'pine',
    beltIn:'#74b9ff', beltOut:'#a29bfe', bridge:'#7f8c8d', accent:'#74b9ff', particle:'snow'},
  desertMap: {id:'desert', name:'Desert Canyon', ic:'🌵', sky:'#e8b86d', sea:'#c48a3a', grass:['#edc878','#d4b45c'], blade:['#c9a14a','#b8860b'], flower:['#e17055','#fd79a8','#ffeaa7'],
    waterRim:'#d4b483', water:'#3d9bb8', trunk:'#6b4f2a', canopy:['#2d8f4e','#3aa35a','#1e7a3c'], hi:'#55efc4', tree:'cactus',
    beltIn:'#e17055', beltOut:'#fdcb6e', bridge:'#a67c52', accent:'#e17055', particle:'sand'},
  reefMap: {id:'reef', name:'Ocean Reef', ic:'🏖️', sky:'#4fc3f7', sea:'#1e88b8', grass:['#f6e3b0','#ead089'], blade:['#2ec4b6','#48dbdb'], flower:['#ff6b9d','#54a0ff','#ffeaa7'],
    waterRim:'#f0e0b8', water:'#2ec4b6', trunk:'#8a5a2b', canopy:['#0e8a4a','#16a085','#27ae60'], hi:'#81ecec', tree:'palm',
    beltIn:'#00cec9', beltOut:'#54a0ff', bridge:'#c9a06a', accent:'#00cec9', particle:'spark'},
  volcanoMap: {id:'volcanic', name:'Volcanic', ic:'🌋', sky:'#4a2c2a', sea:'#2a1514', grass:['#4a3a38','#3a2c2a'], blade:['#e17055','#c0392b'], flower:['#e17055','#fdcb6e','#d63031'],
    waterRim:'#6b4540', water:'#c0392b', trunk:'#2c1810', canopy:['#2c2c2c','#1a1a1a','#3d3d3d'], hi:'#ff7a3d', tree:'dead',
    beltIn:'#e17055', beltOut:'#fdcb6e', bridge:'#5a3530', accent:'#e17055', particle:'ember'},
  candyMap: {id:'candy', name:'Candy Land', ic:'🍭', sky:'#c9b6ff', sea:'#a88cff', grass:['#ffb3d9','#a8f0e8'], blade:['#ff7eb6','#7cf3ff'], flower:['#ff6b9d','#54a0ff','#ffeaa7'],
    waterRim:'#ffe0f0', water:'#7ad7ff', trunk:'#d48aa0', canopy:['#ff6b9d','#54a0ff','#ffd93d'], hi:'#fff0f8', tree:'blossom',
    beltIn:'#ff7eb6', beltOut:'#7cf3ff', bridge:'#e8a0c0', accent:'#ff7eb6', particle:'petal'},
  neonMap: {id:'neon', name:'Neon Night', ic:'🌌', sky:'#0a0a18', sea:'#05050e', grass:['#12122a','#0e0e22'], blade:['#6c5ce7','#00cec9'], flower:['#00cec9','#fd79a8','#ffeaa7'],
    waterRim:'#1a1a3a', water:'#141428', trunk:'#1a1a2e', canopy:['#00cec9','#6c5ce7','#fd79a8'], hi:'#81ecec', tree:'neon',
    beltIn:'#00cec9', beltOut:'#fd79a8', bridge:'#2d2d4a', accent:'#6c5ce7', particle:'spark'},
  spaceMap: {id:'space', name:'Lunar Sea', ic:'🌙', sky:'#070714', sea:'#04040c', grass:['#2c2c36','#3a3a46'], blade:['#9aa0b8','#c5c0e0'], flower:['#a29bfe','#74b9ff','#ffffff'],
    waterRim:'#3a3a55', water:'#1a1033', trunk:'#5a5a68', canopy:['#c8c8d8','#a29bfe','#88a0c0'], hi:'#f0f0ff', tree:'crystal',
    beltIn:'#a29bfe', beltOut:'#dfe6ff', bridge:'#4a4a60', accent:'#a29bfe', particle:'spark'},
};
const COSMETICS = [
  // Belts — rails AND inner track. Keep original ids/prices.
  {id:'emberBelt', slot:'belt', cost:8, ic:'🔥', name:'Ember Belts', desc:'Copper rails, black track, molten-gold tread', inn:'#ff7a3d', out:'#ffd23f', railIn:'#ff7a3d', railOut:'#ffd23f', core:'#1a1210', tread:'#ffb347', glow:'#ff7a3d'},
  {id:'oceanBelt', slot:'belt', cost:10, ic:'🌊', name:'Ocean Belts', desc:'Tide-blue rails, deep navy track, cyan dashes', inn:'#19d3c5', out:'#1a86ff', railIn:'#19d3c5', railOut:'#1a86ff', core:'#0a1a2a', tread:'#7ad7ff', glow:'#19d3c5'},
  {id:'royalBelt', slot:'belt', cost:12, ic:'👑', name:'Royal Belts', desc:'Violet rails, black track, gold dashes', inn:'#7a3dff', out:'#f5b82e', railIn:'#7a3dff', railOut:'#f5b82e', core:'#1a1028', tread:'#ffe08a', glow:'#7a3dff'},
  {id:'woodBelt', slot:'belt', cost:14, ic:'🪵', name:'Wood & Rope', desc:'Timber rails with a rope-wound track', inn:'#c9a06a', out:'#8d5a2b', railIn:'#c9a06a', railOut:'#8d5a2b', core:'#5c4030', tread:'#e8d5a8'},
  {id:'chromeBelt', slot:'belt', cost:18, ic:'🪞', name:'Chrome Belts', desc:'Mirror-silver rails, black rubber, white shine', inn:'#d8dee6', out:'#9aa4b2', railIn:'#e8eef4', railOut:'#9aa4b2', core:'#1c1e24', tread:'#ffffff', glow:'#c8d0dc'},
  {id:'goldBelt', slot:'belt', cost:24, ic:'🥇', name:'Gold & Black', desc:'Solid gold rails on a black rubber track', inn:'#ffd23f', out:'#f5b82e', railIn:'#ffe08a', railOut:'#f0a500', core:'#141414', tread:'#fff3b0', glow:'#ffd23f'},
  {id:'lavaBelt', slot:'belt', cost:32, ic:'🌋', name:'Lava Belts', desc:'Magma rails, charcoal track, flowing fire dashes', inn:'#ff5a1f', out:'#ffb347', railIn:'#ff5a1f', railOut:'#ffb347', core:'#1a0a08', tread:'#ff7a3d', glow:'#ff3d00', anim:'lava'},
  {id:'neonBelt', slot:'belt', cost:42, ic:'💡', name:'Neon Belts', desc:'Glowing cyan & magenta rails on a black track', inn:'#00fff0', out:'#ff2bd6', railIn:'#00fff0', railOut:'#ff2bd6', core:'#05050c', tread:'#7cf3ff', glow:'#00fff0'},
  {id:'rainbowBelt', slot:'belt', cost:55, ic:'🌈', name:'Rainbow Belts', desc:'Animated rainbow rails over a dark holographic track', inn:'#ff7eb6', out:'#7cf3ff', railIn:'#ff7eb6', railOut:'#7cf3ff', core:'#161022', tread:'#ffeaa7', glow:'#ffd23f', anim:'rainbow'},
  {id:'weekClay', slot:'belt', cost:0, event:1, ic:'🧱', name:'Clay Rails', desc:'Terracotta rails on a dark clay track. Weekly Event reward.', inn:'#c4693a', out:'#8a3d1c', railIn:'#f0c090', railOut:'#c4693a', core:'#2a1a12', tread:'#e8c39a', glow:'#e08a4a'},
  {id:'weekAurora', slot:'belt', cost:0, event:1, ic:'🌌', name:'Aurora Rails', desc:'Teal and rose lights on a night track. Weekly Event reward.', inn:'#5ef0d0', out:'#ff8ec4', railIn:'#5ef0d0', railOut:'#ff8ec4', core:'#0c1220', tread:'#c5fff0', glow:'#5ef0d0'},
  {id:'weekFrost', slot:'belt', cost:0, event:1, ic:'❄️', name:'Frost Rails', desc:'Icy white rails on a deep-blue track. Weekly Event reward.', inn:'#e8f4ff', out:'#7eb6ff', railIn:'#ffffff', railOut:'#7eb6ff', core:'#102038', tread:'#d6ecff', glow:'#9ad0ff'},
  {id:'weekForge', slot:'belt', cost:0, event:1, ic:'🛠️', name:'Forge Rails', desc:'Hot iron rails over a soot-black track. Weekly Event reward.', inn:'#ff8a3d', out:'#c0392b', railIn:'#ffb347', railOut:'#c0392b', core:'#1a0c0a', tread:'#ffd23f', glow:'#ff6b3d'},
  {id:'weekIvy', slot:'belt', cost:0, event:1, ic:'🌿', name:'Ivy Rails', desc:'Leaf-green rails on a mossy track. Weekly Event reward.', inn:'#6bcf6b', out:'#1e7a3c', railIn:'#a8e6a0', railOut:'#2d8f4e', core:'#102018', tread:'#d4f5c8', glow:'#55efc4'},
  {id:'weekSun', slot:'belt', cost:0, event:1, ic:'☀️', name:'Sunstone Rails', desc:'Warm amber rails on a sun-baked track. Weekly Event reward.', inn:'#ffd23f', out:'#e67e22', railIn:'#ffe08a', railOut:'#e67e22', core:'#2a1808', tread:'#fff3b0', glow:'#ffd23f'},
  {id:'weekCobalt', slot:'belt', cost:0, event:1, ic:'🔷', name:'Cobalt Rails', desc:'Deep blue rails on a midnight track. Weekly Event reward.', inn:'#4a7dff', out:'#1a3d8a', railIn:'#8cb4ff', railOut:'#2d5ad6', core:'#0a1020', tread:'#c5d8ff', glow:'#74b9ff'},
  {id:'weekRose', slot:'belt', cost:0, event:1, ic:'🌹', name:'Rose Gold Rails', desc:'Blush-gold rails on a cocoa track. Weekly Event reward.', inn:'#f4b6a8', out:'#c9a06a', railIn:'#ffd1c7', railOut:'#c98a6a', core:'#2a1614', tread:'#ffe4dc', glow:'#ffb7c5'},

  // Buildings — bold, obvious colors + glow/sheen. Keep original ids/prices.
  {id:'copperSkin', slot:'build', cost:15, ic:'🔶', name:'Copper Patina', desc:'Bright copper roofs, dark earthy walls, warm glow', top:'#ffb05a', side:'#6a3214', t:0.92, skin:'copper', glow:'#ffb05a'},
  {id:'midnightSkin', slot:'build', cost:22, ic:'🌙', name:'Midnight Steel', desc:'Polished steel-blue with a cyan edge glow', top:'#8ec4ff', side:'#121820', t:0.94, skin:'steel', glow:'#7ec8ff'},
  {id:'roseSkin', slot:'build', cost:30, ic:'🌹', name:'Rose Gold', desc:'Bold rose-gold metal with a pink sheen', top:'#ffc0d0', side:'#8a3048', t:0.94, skin:'rose', glow:'#ff9ebd'},
  {id:'prismSkin', slot:'build', cost:40, ic:'🌈', name:'Prismatic Wash', desc:'A shifting rainbow sheen and outline on every building', top:'#7cf3ff', top2:'#ff7eb6', t:0.88, anim:1, skin:'prism', glow:'#ffd23f'},
  {id:'neonSkin', slot:'build', cost:48, ic:'💜', name:'Neon Grid', desc:'Black buildings with pulsing cyan-magenta neon edges', top:'#1a1a28', side:'#08080e', t:0.96, skin:'neon', glow:'#00fff0', anim:1, top2:'#ff2bd6'},
  {id:'emberSkin', slot:'build', cost:52, ic:'🌋', name:'Emberforge', desc:'Charcoal walls with glowing lava cracks and fire outline', top:'#ff7a3d', side:'#1a0c0a', t:0.94, skin:'lava', glow:'#ff5a1f'},
  {id:'holoSkin', slot:'build', cost:58, ic:'💠', name:'Holochrome', desc:'Iridescent metal that shifts blue to pink with a shine sweep', top:'#c0f0ff', top2:'#ff9aff', side:'#2a1a40', t:0.9, anim:1, skin:'holo', glow:'#e0c0ff'},
  // Maps — full world palettes. Keep original three ids/prices.
  {id:'goldenMap', slot:'map', cost:20, ic:'🌅', name:'Golden Hour', desc:'Warm sunset grass, amber trees, golden leaves in the air'},
  {id:'autumnMap', slot:'map', cost:22, ic:'🍂', name:'Autumn Forest', desc:'Burnt-orange woods and falling leaves'},
  {id:'tundraMap', slot:'map', cost:24, ic:'❄️', name:'Snowy Tundra', desc:'Snow-covered ground, pines with white tips, falling snow'},
  {id:'moonlitMap', slot:'map', cost:25, ic:'🌕', name:'Moonlit', desc:'Cool night fields, dark pines, sparkles in the moonlight'},
  {id:'desertMap', slot:'map', cost:26, ic:'🌵', name:'Desert Canyon', desc:'Sand dunes, cacti, and drifting dust'},
  {id:'cherryMap', slot:'map', cost:30, ic:'🌸', name:'Cherry Dusk', desc:'Pink dusk, blossom trees, and falling petals'},
  {id:'reefMap', slot:'map', cost:34, ic:'🏖️', name:'Ocean Reef', desc:'Sandy beaches, palms, and bright turquoise water'},
  {id:'volcanoMap', slot:'map', cost:38, ic:'🌋', name:'Volcanic', desc:'Ash ground, burnt trees, lava pools, drifting embers'},
  {id:'candyMap', slot:'map', cost:44, ic:'🍭', name:'Candy Land', desc:'Pastel checker fields, candy-colored trees, sugary petals'},
  {id:'neonMap', slot:'map', cost:50, ic:'🌌', name:'Neon Night', desc:'Cyber-night ground, neon trees, electric sparks'},
  {id:'spaceMap', slot:'map', cost:58, ic:'🌙', name:'Lunar Sea', desc:'Cratered moon rock, crystal spires, starry sparkles'},
  // Trails — bright, large, high-contrast. Keep original ids/prices.
  {id:'sparkleTrail', slot:'trail', cost:12, ic:'✨', name:'Sparkle Trail', desc:'Big bright sparkles dance behind belt items', trail:'sparkle'},
  {id:'streakTrail', slot:'trail', cost:16, ic:'☄️', name:'Motion Streaks', desc:'A bold motion smear behind every item', trail:'streak'},
  {id:'emberTrail', slot:'trail', cost:20, ic:'🔥', name:'Ember Trail', desc:'Small orange sparks drift behind belt items', trail:'ember'},
  {id:'fireTrail', slot:'trail', cost:28, ic:'🔥', name:'Fire Wake', desc:'A wide roaring flame wake with a white-hot core and licking flames', trail:'fire'},
  {id:'rainbowTrail', slot:'trail', cost:36, ic:'🌈', name:'Rainbow Wake', desc:'A vivid rainbow of orbs trails each item', trail:'rainbow'},
  {id:'novaTrail', slot:'trail', cost:48, ic:'💫', name:'Nova Trail', desc:'A big white-cyan glow and bursting sparkles', trail:'nova'},
  // Item skins — how cargo looks on the belts
  {id:'gildItem', slot:'item', cost:15, ic:'🥇', name:'Gilded Cargo', desc:'Every item on the belt gets a thick gold halo', item:'gild'},
  {id:'neonItem', slot:'item', cost:24, ic:'💗', name:'Neon Pop', desc:'Hot pink and cyan outlines make cargo pop', item:'neon'},
  {id:'crystalItem', slot:'item', cost:32, ic:'💎', name:'Crystal Cargo', desc:'Icy-blue faceted shine around every item', item:'crystal'},
  {id:'starItem', slot:'item', cost:40, ic:'⭐', name:'Starburst Cargo', desc:'Gold starburst halo plus twinkling sparks', item:'star'},
  // Celebration moments
  {id:'partyFx', slot:'fx', cost:18, ic:'🎉', name:'Party Pop', desc:'Bigger, brighter confetti on celebrations', fx:'party'},
  {id:'goldFx', slot:'fx', cost:30, ic:'🎊', name:'Golden Fanfare', desc:'A shower of gold coins and stars', fx:'gold'},
  {id:'auroraFx', slot:'fx', cost:50, ic:'🎆', name:'Aurora Burst', desc:'A huge rainbow firework burst on celebrations', fx:'aurora'},
  // Landmarks — decorative buildings, place many copies once owned
  {id:'landWindmill', slot:'land', cost:25, ic:'🌬️', name:'Windmill', desc:'A spinning country windmill. Place on grass; looks only.'},
  {id:'landClock', slot:'land', cost:32, ic:'🕰️', name:'Clock Tower', desc:'A tall brick clock tower with ticking hands.'},
  {id:'landWater', slot:'land', cost:38, ic:'💧', name:'Giant Water Tower', desc:'A riveted tower on steel legs, dripping in the sun.'},
  {id:'landGate', slot:'land', cost:45, ic:'🏯', name:'Grand Factory Gate', desc:'A 3-wide ceremonial arch. Belts can pass through the gateway.'},
  {id:'landStatue', slot:'land', cost:48, ic:'🗽', name:'Statue of the Founder', desc:'A bronze founder on a stone plinth.'},
  {id:'landCathedral', slot:'land', cost:55, ic:'🏭', name:'Smokestack Cathedral', desc:'A 3×3 factory cathedral with smoking stacks.'},
  {id:'landObservatory', slot:'land', cost:62, ic:'🔭', name:'Observatory Dome', desc:'A 3×3 rotating observatory with a glowing slit.'},
  {id:'landSpire', slot:'land', cost:70, ic:'🔮', name:'Quantum Spire', desc:'A tall glowing quantum crystal. 2×2 footprint.'},
  {id:'landRocket', slot:'land', cost:80, ic:'🚀', name:'Rocket Launch Pad', desc:'A 3×3 rocket on a lit pad, with steam vents.'},
  {id:'formRustic', slot:'form', form:'rustic', cost:35, ic:'🏘️', name:'Rustic Village', desc:'Timber lodges, log-cabin mills with turning waterwheels, and stone bloomeries.'},
  {id:'formCastle', slot:'form', form:'castle', cost:50, ic:'🏰', name:'Medieval Castle', desc:'Castle-keep hubs, gothic clocktower workshops, and tall brick furnaces with fire glow.'},
  {id:'formSteam', slot:'form', form:'steam', cost:65, ic:'⚙️', name:'Steampunk', desc:'Brass grand stations, oil-derrick drills, and riveted boilers puffing steam.'},
  {id:'formScifi', slot:'form', form:'scifi', cost:80, ic:'🛸', name:'Sci-Fi Colony', desc:'Dome labs, laser mining rigs, and a glowing spaceport hub.'},
];
const COS_BY_ID = {}; for (const c of COSMETICS) COS_BY_ID[c.id] = c;
const cosOwned = id => !!(S && S.cosOwn && S.cosOwn[id]);
const cosEq = slot => (S && S.cosEq && S.cosEq[slot]) || null;
function rainbowHex(t){
  const a = ((t%1)+1)%1 * 6, i=a|0, f=a-i, q=1-f;
  const r=[1,q,0,0,f,1][i], g=[f,1,1,q,0,0][i], b=[0,0,f,1,1,q][i];
  const h=x=>Math.round(x*255).toString(16).padStart(2,'0');
  return '#'+h(r)+h(g)+h(b);
}
function beltSkin(){
  const id = cosEq('belt'), c = id && COS_BY_ID[id];
  const w = worldBase();
  const base = {railIn:w.beltIn, railOut:w.beltOut, core:'#434956', tread:'#5d6576', glow:null, anim:null};
  if (!c){
    if (typeof cosOn === 'function' && cosOn('aurora')) return Object.assign({}, base, {railIn:'#b06cff', railOut:'#ffd23f', core:'#2a2038', tread:'#e8d46a', glow:'#b06cff'});
    return base;
  }
  return {
    railIn: c.railIn || c.inn || base.railIn,
    railOut: c.railOut || c.out || base.railOut,
    core: c.core || '#2a2e38',
    tread: c.tread || '#d0d4dc',
    glow: c.glow || null,
    anim: c.anim || null,
  };
}
const beltPalette = kind => {
  const s = beltSkin();
  if (s.anim==='rainbow'){ const t=(R.time||0)*0.55; return rainbowHex(kind==='in' ? t : t+0.33); }
  if (s.anim==='lava'){ const t=0.5+0.5*Math.sin((R.time||0)*3.2); return mixHex(kind==='in'?s.railIn:s.railOut, '#fff3b0', t*0.4); }
  return kind==='in' ? s.railIn : s.railOut;
};
function skinHex(hex, kind){
  const id = cosEq('build'), c = id && COS_BY_ID[id]; if (!c) return hex;
  const to = kind==='side' ? (c.side || c.top) : c.top;
  if (!to) return hex;
  const amt = c.t==null ? 0.92 : c.t;
  if (c.anim){
    const tm = 0.5 + 0.5*Math.sin((R.time||0)*2.2);
    return mixHex(hex, mixHex(c.top, c.top2 || c.top, tm), amt);
  }
  return mixHex(hex, to, amt);
}
function paintBuildCosmetic(ctx, b, sx, sy, w, z, pad, depth, rad){
  const id = cosEq('build'), c = id && COS_BY_ID[id]; if (!c) return;
  const B = b && BUILDINGS[b.type];
  const x = sx+pad, y = sy+pad-depth*0.4, bw=w-pad*2, bh=w-pad*2;
  const style = c.skin || c.id;
  const tm = R.time||0;
  const glowCol = c.anim ? mixHex(c.top, c.top2||c.top, 0.5+0.5*Math.sin(tm*2.2)) : (c.glow || c.top);
  const strokeHut = () => {
    const hp = z*0.08, rx=sx+hp-z*0.08, ry=sy+w*0.34, rw=w-hp*2+z*0.16;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(sx+w/2, sy-z*0.08);
    ctx.lineTo(rx+rw, ry);
    ctx.lineTo(sx+w-hp, sy+w*0.28+z*0.1);
    ctx.lineTo(sx+w-hp, sy+w*0.93);
    ctx.lineTo(sx+hp, sy+w*0.93);
    ctx.lineTo(sx+hp, sy+w*0.28+z*0.1);
    ctx.closePath();
  };
  ctx.save();
  if (B && B.hut){
    ctx.strokeStyle = style==='neon' ? mixHex(c.glow||'#00fff0', c.top2||'#ff2bd6', 0.5+0.5*Math.sin(tm*3)) : glowCol;
    ctx.lineWidth = Math.max(2.4, z*0.1); ctx.globalAlpha = 0.95;
    strokeHut(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, z*0.035); ctx.globalAlpha = 0.45;
    strokeHut(); ctx.stroke();
    ctx.globalAlpha = 1; ctx.restore(); return;
  }
  // Diagonal metallic sheen
  if (style!=='neon'){
    const g = ctx.createLinearGradient(x, y, x+bw, y+bh);
    const sweep = 0.14 + (0.5+0.5*Math.sin(tm*1.6 + (b.x||0))) * 0.72;
    g.addColorStop(sweep-0.12, 'rgba(255,255,255,0)');
    g.addColorStop(sweep, 'rgba(255,255,255,.45)');
    g.addColorStop(sweep+0.12, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; rr(ctx, x, y, bw, bh, rad); ctx.fill();
  }
  if (style==='lava'){
    ctx.strokeStyle = '#ff5a1f'; ctx.globalAlpha = 0.7+0.3*Math.sin(tm*5+(b.y||0));
    ctx.lineWidth = Math.max(1.4, z*0.045);
    ctx.beginPath();
    ctx.moveTo(x+bw*0.2, y+bh*0.15); ctx.lineTo(x+bw*0.35, y+bh*0.55); ctx.lineTo(x+bw*0.22, y+bh*0.85);
    ctx.moveTo(x+bw*0.7, y+bh*0.2); ctx.lineTo(x+bw*0.6, y+bh*0.6);
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (style==='neon'){
    const col = mixHex(c.glow||'#00fff0', c.top2||'#ff2bd6', 0.5+0.5*Math.sin(tm*3));
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.4, z*0.1);
    ctx.globalAlpha = 0.95; rr(ctx, x, y, bw, bh, rad); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, z*0.03); ctx.globalAlpha = 0.55;
    rr(ctx, x+z*0.05, y+z*0.05, bw-z*0.1, bh-z*0.1, rad); ctx.stroke();
    ctx.globalAlpha = 1; ctx.restore(); return;
  }
  const glow = c.glow || c.top;
  if (c.anim){
    const col = mixHex(c.top, c.top2||c.top, 0.5+0.5*Math.sin(tm*2.2));
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.4, z*0.09); ctx.globalAlpha = 0.95;
    rr(ctx, x, y, bw, bh, rad); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.2, z*0.04); ctx.globalAlpha = 0.4+0.3*Math.sin(tm*1.8);
    rr(ctx, x+z*0.04, y+z*0.04, bw-z*0.08, bh-z*0.08, rad); ctx.stroke();
  } else if (glow){
    ctx.strokeStyle = glow; ctx.lineWidth = Math.max(2.2, z*0.085); ctx.globalAlpha = 0.92;
    rr(ctx, x, y, bw, bh, rad); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, z*0.03); ctx.globalAlpha = 0.4;
    rr(ctx, x+z*0.035, y+z*0.035, bw-z*0.07, bh-z*0.07, rad); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();
}
function applyMapTheme(w, id){
  if (!w || !id) return w;
  const pal = MAP_PALETTES[id];
  if (pal) return Object.assign({}, pal, {id: w.id+':'+id});
  const c = COS_BY_ID[id]; if (!c || !c.map) return w;
  const m = c.map, amt = m.amt==null ? 0.85 : m.amt;
  const mix = (src, tgt) => tgt ? mixHex(src, tgt, amt) : src;
  const arr = (a, tgt) => (a||[]).map(x => mix(x, tgt));
  return Object.assign({}, w, {
    id: w.id+':'+id,
    sky: mix(w.sky, m.sky), sea: mix(w.sea, m.sea), water: mix(w.water, m.sea || m.water),
    waterRim: mix(w.waterRim, m.sky), accent: mix(w.accent, m.accent),
    grass: arr(w.grass, m.grass), blade: arr(w.blade, m.grass), canopy: arr(w.canopy, m.grass),
    hi: mix(w.hi, m.accent || m.sky),
  });
}
const worldIdx = () => ((R.forceWorld != null ? R.forceWorld : (S && S.asc)|0) % WORLDS.length + WORLDS.length) % WORLDS.length;
const worldOf = n => WORLDS[((n|0) % WORLDS.length + WORLDS.length) % WORLDS.length];
const worldBase = () => worldOf(R.forceWorld != null ? R.forceWorld : (S && S.asc)|0);
function world(){
  const w = worldBase();
  try {
    const id = cosEq('map');
    if (!id) return islandLook(w);
    const key = w.id+'|'+id;
    if (R.themeWorld && R.themeWorldKey===key) return islandLook(R.themeWorld);
    const tw = applyMapTheme(w, id);
    R.themeWorld = tw; R.themeWorldKey = key;
    return islandLook(tw || w);
  } catch(e){}
  return islandLook(w);
}
const worldName = n => { const w = worldOf(n); return `${w.ic} ${w.name}`; };
const TERR_GEN_LAND = 1, TERR_GEN_ISLANDS = 2;
// Island archipelagos on every 3rd Ascension from ★3 onward (★3, ★6, ★9, ★12…). World palettes stay look-only.
const isIslandAsc = asc => { const n = asc|0; return n >= 3 && n % 3 === 0; };
const terrGenForAsc = asc => isIslandAsc(asc) ? TERR_GEN_ISLANDS : TERR_GEN_LAND;
function islandGen(asc){ return Math.max(0, (asc|0) / 3 | 0); } // 1 at ★3, 2 at ★6, …
function islandLayoutId(asc){
  const layouts = ['rings','spiral','crescent','clusters','chains','atolls','shards'];
  const g = islandGen(asc);
  return g < 1 ? 'rings' : layouts[(g-1) % layouts.length];
}
function islandThemeId(asc){
  const themes = ['isles','volcanic','crystal','storm','plasma','stellar','void','origin','mythic'];
  const g = islandGen(asc);
  return g < 1 ? 'isles' : themes[Math.min(themes.length-1, g-1)];
}
const ISLAND_THEME = {
  isles: null,
  volcanic: {water:'#3a1a12', sea:'#2a100c', waterRim:'#8a3a22', spark:'#ff6b2b'},
  crystal:  {water:'#1a5a7a', sea:'#0e3a58', waterRim:'#7ee0ff', spark:'#c8f6ff'},
  storm:    {water:'#243044', sea:'#152033', waterRim:'#6a7c94', spark:'#c5d4e8'},
  plasma:   {water:'#121a3a', sea:'#0a1028', waterRim:'#3ec7ff', spark:'#ff4dff'},
  stellar:  {water:'#070b1c', sea:'#050712', waterRim:'#f5c14a', spark:'#ffe9a0'},
  void:     {water:'#09060f', sea:'#050308', waterRim:'#5b2a9e', spark:'#c077ff'},
  origin:   {water:'#14301c', sea:'#0c1e12', waterRim:'#e8c36a', spark:'#fff0c0'},
  mythic:   {water:'#20142e', sea:'#140a1c', waterRim:'#ff9aff', spark:'#7cf3ff'},
};
function islandLook(w){
  if (!w || !S || S.terrGen !== TERR_GEN_ISLANDS || (S.islandGenV|0) < 2) return w;
  const ov = ISLAND_THEME[islandThemeId(S.asc|0)];
  if (!ov) return w;
  return Object.assign({}, w, {water:ov.water, sea:ov.sea||ov.water, waterRim:ov.waterRim, islandSpark:ov.spark, islandTheme:islandThemeId(S.asc|0)});
}
// Test sandbox: ?testpp=af1000 or ?testpp=af5000 uses a completely separate localStorage namespace
// so the real 3 slots are never read or written. Both tokens share the same sandbox keys, so
// cosmetics and progress carry over; af5000 tops PP up to 5,000 once (or again with &topup=1).
function testPPAmount(){
  try {
    const m = /^af(\d+)$/.exec(new URLSearchParams(location.search).get('testpp') || '');
    const n = m ? +m[1] : 0;
    return (n===1000 || n===5000) ? n : 0;
  } catch(e){ return 0; }
}
const TEST_PP = testPPAmount();
const TEST_MODE = TEST_PP > 0;
const SAVE_KEY = TEST_MODE ? 'autoforge_test_save_v1' : 'autoforge_save_v1'; // legacy single save (kept untouched as a backup after migrating to Slot 1)
const SLOTS = 3, META_KEY = TEST_MODE ? 'autoforge_test_slots_v1' : 'autoforge_slots_v1';
const slotKey = n => (TEST_MODE ? 'autoforge_test_slot_' : 'autoforge_slot_') + n;
const oldSlotKey = n => (TEST_MODE ? 'autoforge_test_old_slot_' : 'autoforge_old_slot_') + n;
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); return true; } catch(e){ return false; } }
let META = null;
function writeMeta(){ lsSet(META_KEY, JSON.stringify(META)); }
function initSlots(){
  try { META = JSON.parse(lsGet(META_KEY)); } catch(e){ META = null; }
  if (!META || typeof META !== 'object'){
    META = {active:1, names:{}};
  }
  // migrate the old single save into Slot 1 once (never overwrite a slot that has data; the legacy key is left in place as a backup).
  // Only marked done after the copy really succeeded, so a failed write is retried next launch instead of losing the factory.
  if (!META.migrated){
    const old = lsGet(SAVE_KEY);
    if (!old || lsGet(slotKey(1)) || lsSet(slotKey(1), old)) META.migrated = 1;
    writeMeta();
  }
  try { migrateAllSlotsXp(); } catch(e){}
  try { migrateAllSlotsEraCap(); } catch(e){}
  // Eras update: every older save is archived (not shown) and the slots start fresh
  if (META.sv !== 2){
    for (let n=1;n<=SLOTS;n++){ const raw = lsGet(slotKey(n)); if (raw){ let v = 0; try { v = JSON.parse(raw).v; } catch(e){} if (v !== 2){ lsSet(oldSlotKey(n), raw); try { localStorage.removeItem(slotKey(n)); } catch(e){} } } }
    META.names = {}; META.active = 1; META.sv = 2; writeMeta();
  }
  META.active = Math.min(SLOTS, Math.max(1, META.active|0 || 1));
  if (!META.names || typeof META.names !== 'object') META.names = {};
}
const slotName = n => (META.names[n] || ('Slot ' + n));
function slotData(n){ try { const d = JSON.parse(lsGet(slotKey(n))); return d && d.v===SAVE_V ? d : null; } catch(e){ return null; } }
const qs = new URLSearchParams(location.search);
const FF = Math.max(1, +qs.get('ff') || 1); // dev fast-forward
let forceBoostFlag = qs.get('boost') === '1'; // test hook: ?boost=1 force-owns Speed Boost
function forceBoost(on){ if (on == null) return !!forceBoostFlag; forceBoostFlag = !!on; return forceBoostFlag; }
function grantBoost(){ const l = IAP.led(); if (!l.owned.boost) l.owned.boost = Date.now(); if (l.boostOn == null) l.boostOn = true; IAP.put(l); return true; }
function boostOwned(){ return !!forceBoostFlag || IAP.owned('boost'); }
function boostOn(){ if (!boostOwned()) return false; const l = IAP.led(); return l.boostOn !== false; }
function setBoostOn(on){ const l = IAP.led(); l.boostOn = !!on; IAP.put(l); try { R.dirty = true; } catch(e){} return boostOn(); }
const boostMul = () => boostOn() ? 2 : 1;

// ============================== STATE ==============================
let S; // saved state
const R = { paths:[], occ:null, terr:null, beltOut:null, beltIn:null, terrCanvas:null, resCanvas:null, parts:[], floats:[], amb:[], hubPulse:0, time:0, sel:null, dirty:true, forceWorld:null };
const SAVE_V = 2; // v2 = eras. Older saves are wiped (archived) on first launch.
function freshState(prev){
  const p = prev || {rebirths:0, pp:0, perks:{}, sound:true};
  const st = { v:SAVE_V, seed:(Math.random()*1e9)|0, rebirths:p.rebirths, asc:p.asc|0, pp:p.pp, perks:p.perks, sound:p.sound!==false,
    hub:null, b:[], uid:1, stock:{}, quest:0, qprog:0, unlocks:eraUnlocks(p.rebirths), built:{}, last:Date.now(), finalDone:false, totalDelivered:{}, cleared:[], hutWear:{}, hutsGone:1,
    terrGen: terrGenForAsc(p.asc|0), islandGenV: isIslandAsc(p.asc|0) ? 2 : 0, landScaleV: 2, hubExt5: 1, eraCap: p.eraCap != null ? p.eraCap : cycleLen(p.asc|0) };
  const hs = (p.perks && p.perks.start) || 0, un = st.unlocks;
  const sp = (p.perks && p.perks.stockpile)||0;
  st.stock.wood = 12 + 10*hs + 18*sp; if (sp) st.stock.stone = (st.stock.stone||0) + 18*sp;
  // endgame supply drop: Quantum eras start with a stockpile of basics so the long build-out doesn't drag (~15-20 min eras)
  if (p.rebirths >= 19){ const kit = ENDGAME_KIT, m = (p.rebirths >= 20 ? 1.6 : 1) * PACE_KIT; for (const k in kit) st.stock[k] = (st.stock[k]||0) + Math.round(kit[k]*m); }
  // Post-quantum eras: seed a handful of the previous product + quantum parts so the new era is about the new resource, not a full regrind.
  if (p.rebirths >= 21){
    const prev = ERAS[p.rebirths-1], it = prev && prev.q && prev.q.item;
    const m = PACE_KIT;
    if (it) st.stock[it] = (st.stock[it]||0) + Math.round(36*m);
    st.stock.qcore = (st.stock.qcore||0) + Math.round(12*m);
    st.stock.qcomp = (st.stock.qcomp||0) + Math.round(6*m);
  }
  if (hs){ if (un.includes('r:plank')) st.stock.plank = 4*hs; if (un.includes('res:stone')) st.stock.stone = 10*hs; if (un.includes('r:brick')) st.stock.brick = 3*hs; if (un.includes('r:ironIngot')) st.stock.ironIngot = 2*hs; if (sp){ if (un.includes('r:plank')) st.stock.plank=(st.stock.plank||0)+8*sp; if (un.includes('r:brick')) st.stock.brick=(st.stock.brick||0)+8*sp; } }
  return retainInit(Object.assign(st, p.daily ? retainKeep(p) : {}));
}
const perk = id => (S.perks[id]||0);
const has = u => S.unlocks.includes(u);
const qScale = () => 1 + 0.25*Math.max(0, S.rebirths - lastEraOf()); // costs only grow if a cycle somehow overruns its cap
const questN = q => q.n;
const curQuest = () => S.quest === 0 ? eraQuest(S.rebirths) : null;
const offCap = () => OFFLINE_BASE + 12*3600*perk('offline');
const perkSpeed = (lv, step) => 1 + step*(lv<=2 ? lv : 2 + 0.25*(lv-2)); // diminishing after 2 (caps ~1.5× at lv5 w/ 0.18)
const harvestMul = () => perkSpeed(perk('swift'), 0.18) * prodMul() * PACE_PROD;
const craftMul = () => perkSpeed(perk('craft'), 0.18) * prodMul() * PACE_PROD;
const beltSpeed = () => 1.6 * perkSpeed(perk('belts'), 0.18) * (1 + 0.25*perk('express'));
// Resource under a harvester: megas use footprint majority (ties → first tile in footprint order).
// Never trust only the top-left anchor — grass corners used to make megas absurdly fast.
function harvTvOf(b){
  const B = BUILDINGS[b.type]; if (!b || !B || !B.on || !R.terr) return null;
  const counts = new Map();
  let first = null;
  for (const [x,y] of footprint(b.type, b.x, b.y)){
    if (!inMap(x,y)) continue;
    const tv = R.terr[idx(x,y)];
    if (!B.on.includes(tv) || !RES[tv]) continue;
    if (first == null) first = tv;
    counts.set(tv, (counts.get(tv)||0) + 1);
  }
  if (counts.size){
    let best = first, bestN = -1;
    // second pass in footprint order: higher count wins; equal count keeps earlier (stable)
    for (const [x,y] of footprint(b.type, b.x, b.y)){
      if (!inMap(x,y)) continue;
      const tv = R.terr[idx(x,y)]; if (!counts.has(tv)) continue;
      const n = counts.get(tv);
      if (n > bestN){ bestN = n; best = tv; }
    }
    return best;
  }
  if (b.tv != null && B.on.includes(b.tv) && RES[b.tv]) return b.tv;
  if (typeof defaultHarvTv === 'function') return defaultHarvTv(b);
  if (b.type==='cutter'||b.type==='megaCutter') return TREE;
  if (b.type==='quarry'||b.type==='megaQuarry') return STONE;
  return B.on[0];
}
function ivOf(b){
  const B = BUILDINGS[b.type]; if (!B) return 1;
  let iv;
  if (B.on){
    const tv = harvTvOf(b);
    // Always use the resource's iv — never B.interval for megas (that double-dipped with megaMul)
    if (tv != null && RES[tv]) iv = RES[tv].iv;
    else if (RES[B.on[0]]) iv = RES[B.on[0]].iv;
    else iv = B.interval || 1;
  } else {
    iv = B.interval || 1;
  }
  if (B.megaMul) iv = iv / B.megaMul;
  return iv / (isGoldB(b) ? ASC_SPEED : 1);
}
const harvestItem = b => {
  const B=BUILDINGS[b.type]; if (!B||!B.on) return null;
  const tv = harvTvOf(b);
  if (tv != null && RES[tv]) return RES[tv].item;
  if (b.type==='cutter'||b.type==='megaCutter') return 'wood';
  if (b.type==='quarry'||b.type==='megaQuarry') return 'stone';
  for (const t of ORE_T){ if (B.on.includes(t) && RES[t] && (!RES[t].unlock || has(RES[t].unlock))) return RES[t].item; }
  return RES[B.on[0]] ? RES[B.on[0]].item : null;
};

// ============================== RNG / MAP ==============================
function rng(seed){ let a = seed>>>0; return () => { a = (a + 0x6D2B79F5)>>>0; let t = a; t = Math.imul(t ^ t>>>15, t|1); t ^= t + Math.imul(t ^ t>>>7, t|61); return ((t ^ t>>>14)>>>0)/4294967296; }; }
function genMap(seed, era, style){
  if ((style|0) === TERR_GEN_ISLANDS){
    const v = (typeof S!=='undefined' && S && S.islandGenV)|0;
    const asc = (typeof S!=='undefined' && S && S.asc)|0;
    if (v >= 2) return genIslandMap(seed, era, asc);
    return genIslandMapLegacy(seed, era);
  }
  const r = rng(seed), t = new Uint8Array(MAP_W*MAP_H);
  const cx = MAP_W/2, cy = MAP_H/2;
  const blob = (type, x0, y0, size, clearHub) => {
    let x = x0, y = y0;
    for (let i=0;i<size;i++){
      const rad = 1 + (r()*1.4|0);
      for (let dy=-rad;dy<=rad;dy++) for (let dx=-rad;dx<=rad;dx++){
        if (dx*dx+dy*dy > rad*rad + 0.5) continue;
        const X = Math.round(x)+dx, Y = Math.round(y)+dy;
        if (X<1||Y<1||X>=MAP_W-1||Y>=MAP_H-1) continue;
        if (clearHub !== false && Math.hypot(X-cx,Y-cy) < 4.2 && type!==GRASS) continue; // keep hub plaza open
        if (type===WATER || t[Y*MAP_W+X]===GRASS) { if (r() < (type===WATER?1:0.82)) t[Y*MAP_W+X] = type; }
      }
      x += (r()-0.5)*2.8; y += (r()-0.5)*2.8;
    }
  };
  const ring = (type, count, dmin, dmax, size) => {
    for (let i=0;i<count;i++){ const a = r()*Math.PI*2, d = dmin + r()*(dmax-dmin); blob(type, cx+Math.cos(a)*d, cy+Math.sin(a)*d, size + (r()*Math.max(1,size*0.5)|0)); }
  };
  // sparse lakes farther out
  ring(WATER, 10, 28, 90, 5); ring(WATER, 8, 70, 95, 7);
  // wood & stone ALWAYS close so the first minutes stay smooth
  ring(TREE, 6, 5, 12, 4); ring(TREE, 14, 12, 28, 4); ring(TREE, 22, 30, 70, 3); ring(TREE, 18, 60, 95, 3);
    // unlocked resources: small patches, rarer ones farther from hub
  const un = eraUnlocks(era), newest = (eraOf(era).unlock.find(x=>x.startsWith('res:'))||'').slice(4);
  // [nearCount, nearMin, nearMax, nearSize, farCount, farMin, farMax, farSize]
  const SPEC = {
    stone:   [6, 6, 16, 3,  12, 22, 80, 3],
    iron:    [3, 14, 28, 3,  8, 30, 85, 3],
    copper:  [3, 16, 32, 3,  8, 35, 88, 3],
    coal:    [2, 18, 34, 2,  7, 40, 90, 3],
    silver:  [2, 22, 40, 2,  6, 45, 92, 2],
    gold:    [2, 24, 42, 2,  6, 48, 94, 2],
    quartz:  [2, 26, 44, 2,  6, 50, 94, 2],
    titanium:[2, 30, 48, 2,  5, 55, 95, 2],
    quantum: [2, 34, 52, 2,  5, 60, 96, 2],
  };
  // only place unlocked ores/stone; wood always present. New post-quantum ores use a far-ring default.
  const oreSpec = k => SPEC[k] || [2, 36, 54, 2,  5, 62, 96, 2];
  const placeKeys = Object.keys(RES_BY_KEY).filter(k => k!=='wood' && un.includes('res:'+k)).sort((a,b) => (b===newest)-(a===newest));
  for (const k of placeKeys){
    const tv = RES_BY_KEY[k], sp = oreSpec(k);
    // newest resource gets an extra close cluster so it's findable
    if (k===newest) ring(tv, 2, 8, 16, 3);
    ring(tv, sp[0], sp[1], sp[2], sp[3]);
    ring(tv, sp[4], sp[5], sp[6], sp[7]);
  }
  // ensure minimum counts
  for (const k of placeKeys){ const tv = RES_BY_KEY[k]; for (let tries=0; tries<8; tries++){ let n=0; for (let i=0;i<t.length;i++) if (t[i]===tv) n++; if (n >= 14) break; ring(tv, 1, 12, 50, 3); } }
  // starter wood: force a few trees just outside the plaza if sparse
  { let n=0; for (let y=cy-10;y<=cy+10;y++) for (let x=cx-10;x<=cx+10;x++) if (inMap(x,y) && t[y*MAP_W+x]===TREE) n++;
    if (n < 8) ring(TREE, 3, 5, 9, 3); }
  return t;
}

function genIslandMapLegacy(seed, era){
  // Legacy ring-archipelago (pre-v55). Kept so in-progress ★3/★6/★9/… island saves regenerate the same layout.
  const r = rng(seed ^ 0x151a11d), t = new Uint8Array(MAP_W*MAP_H);
  const cx = MAP_W/2, cy = MAP_H/2;
  t.fill(WATER);
  const raise = (x0, y0, rx, ry, jagged) => {
    const j = jagged || 0.22;
    for (let y = Math.floor(y0-ry-3); y <= y0+ry+3; y++) for (let x = Math.floor(x0-rx-3); x <= x0+rx+3; x++){
      if (x<2||y<2||x>=MAP_W-2||y>=MAP_H-2) continue;
      const nx = (x-x0)/rx, ny = (y-y0)/ry;
      const wob = 1 + j*((Math.sin((x*0.37+seed)*0.9)+Math.cos((y*0.31+seed)*1.1))*0.5);
      if (nx*nx + ny*ny <= wob*wob) t[y*MAP_W+x] = GRASS;
    }
  };
  const landStamp = (type, x0, y0, size) => {
    let x = x0, y = y0;
    for (let i=0;i<size;i++){
      const rad = 1 + (r()*1.3|0);
      for (let dy=-rad;dy<=rad;dy++) for (let dx=-rad;dx<=rad;dx++){
        if (dx*dx+dy*dy > rad*rad+0.5) continue;
        const X = Math.round(x)+dx, Y = Math.round(y)+dy;
        if (X<2||Y<2||X>=MAP_W-2||Y>=MAP_H-2) continue;
        if (t[Y*MAP_W+X] === WATER) continue; // resources only on land
        if (Math.hypot(X-cx,Y-cy) < 4.2 && type!==GRASS) continue; // hub plaza stays open grass
        if (type===GRASS || t[Y*MAP_W+X]===GRASS || r()<0.85) t[Y*MAP_W+X] = type;
      }
      x += (r()-0.5)*2.4; y += (r()-0.5)*2.4;
    }
  };
  // Main hub island — large enough for Hub + processors
  raise(cx, cy, 22 + r()*4, 20 + r()*4, 0.18);
  // Shore scallops on main island
  for (let i=0;i<7;i++){
    const a = r()*Math.PI*2, d = 12 + r()*8;
    raise(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 3+r()*2.2, 2.8+r()*2, 0.3);
  }
  // Satellite islands in rings (stepping stones + resource outposts)
  const sats = [];
  const placeSat = (dmin, dmax, n, rx0, ry0) => {
    for (let i=0;i<n;i++){
      const a = (i/n)*Math.PI*2 + r()*0.35, d = dmin + r()*(dmax-dmin);
      const x = cx + Math.cos(a)*d, y = cy + Math.sin(a)*d;
      const rx = rx0 + r()*3, ry = ry0 + r()*2.5;
      raise(x, y, rx, ry, 0.28);
      sats.push([x, y, rx]);
      // tiny mid-channel islet (keeps a water gap for visible causeways; belts still cross)
      const mid = 0.5 + r()*0.2;
      const mx = cx+(x-cx)*mid, my = cy+(y-cy)*mid;
      // only if still ocean around it — avoid welding islands into one continent
      if (t[(my|0)*MAP_W+(mx|0)] === WATER) raise(mx, my, 1.6+r()*0.6, 1.5+r()*0.5, 0.4);
    }
  };
  placeSat(34, 46, 6, 5.5, 4.8);
  placeSat(48, 62, 7, 5, 4.5);
  placeSat(68, 82, 5, 4.5, 4);
  // Carve water channels so satellite islands stay separated from the hub (visible causeways)
  const carveChannel = (x0, y0, x1, y1) => {
    const steps = Math.max(8, Math.hypot(x1-x0, y1-y0)|0);
    for (let i=1;i<steps;i++){
      const u = i/steps, x = x0+(x1-x0)*u, y = y0+(y1-y0)*u;
      // skip near either shoreline so islands keep a beach
      if (i < 3 || i > steps-3) continue;
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
        const X = Math.round(x)+dx, Y = Math.round(y)+dy;
        if (X<2||Y<2||X>=MAP_W-2||Y>=MAP_H-2) continue;
        if (Math.hypot(X-cx,Y-cy) < 10) continue; // never carve hub core
        t[Y*MAP_W+X] = WATER;
      }
    }
  };
  for (const [sx,sy] of sats) carveChannel(cx, cy, sx, sy);

  // Starter wood & stone on main island
  for (let i=0;i<8;i++){ const a=r()*Math.PI*2, d=6+r()*10; landStamp(TREE, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 4+(r()*3|0)); }
  for (let i=0;i<4;i++){ const a=r()*Math.PI*2, d=8+r()*11; landStamp(STONE, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 3+(r()*2|0)); }
  // A few trees on outer islands too (flavor + belt demos)
  for (let i=0;i<Math.min(6, sats.length);i++){ const sat=sats[i]; landStamp(TREE, sat[0], sat[1], 3+(r()*2|0)); }

  // Unlocked resources on satellite islands (spread out)
  const un = eraUnlocks(era), newest = (eraOf(era).unlock.find(x=>x.startsWith('res:'))||'').slice(4);
  const placeKeys = Object.keys(RES_BY_KEY).filter(k => k!=='wood' && un.includes('res:'+k));
  let si = 0;
  for (const k of placeKeys){
    const tv = RES_BY_KEY[k];
    const copies = (k===newest ? 3 : 2) + (k==='stone'?1:0);
    for (let c=0;c<copies;c++){
      const sat = sats[(si++) % Math.max(1, sats.length)] || [cx+40, cy, 5];
      landStamp(tv, sat[0]+(r()-0.5)*sat[2]*0.8, sat[1]+(r()-0.5)*sat[2]*0.8, 3+(r()*2|0));
    }
  }
  // Ensure starter wood near plaza
  { let n=0; for (let y=cy-12;y<=cy+12;y++) for (let x=cx-12;x<=cx+12;x++) if (x>=0&&y>=0&&x<MAP_W&&y<MAP_H && t[y*MAP_W+x]===TREE) n++;
    if (n < 10){ for (let i=0;i<4;i++){ const a=r()*Math.PI*2, d=5+r()*6; landStamp(TREE, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 4); } } }
  // Minimum counts for unlocked ores
  for (const k of placeKeys){
    const tv = RES_BY_KEY[k];
    for (let tries=0; tries<10; tries++){
      let n=0; for (let i=0;i<t.length;i++) if (t[i]===tv) n++;
      if (n >= 12) break;
      const sat = sats[r()*sats.length|0] || [cx+35,cy+10,5];
      landStamp(tv, sat[0], sat[1], 4);
    }
  }
  // Open grass plaza at hub
  for (let y=cy-3;y<=cy+3;y++) for (let x=cx-3;x<=cx+3;x++) if (x>=0&&y>=0&&x<MAP_W&&y<MAP_H) t[y*MAP_W+x] = GRASS;
  return t;
}


function genIslandMap(seed, era, asc){
  // Archipelago: ocean base, roomy hub island, satellite resource islands. Belts cross water via causeways.
  // Layout + scale depend on Ascension so ★3, ★6, ★9, ★12… each feel different and grow later on.
  if (asc==null) asc = (typeof S!=='undefined' && S && S.asc)|0;
  const g = Math.max(1, islandGen(asc) || 1);
  const layout = islandLayoutId(asc);
  const r = rng(seed ^ 0x151a11d ^ (asc*0x9e3779b9)), t = new Uint8Array(MAP_W*MAP_H);
  const cx = MAP_W/2, cy = MAP_H/2;
  t.fill(WATER);
  const raise = (x0, y0, rx, ry, jagged) => {
    const j = jagged==null ? 0.22 : jagged;
    for (let y = Math.floor(y0-ry-3); y <= y0+ry+3; y++) for (let x = Math.floor(x0-rx-3); x <= x0+rx+3; x++){
      if (x<2||y<2||x>=MAP_W-2||y>=MAP_H-2) continue;
      const nx = (x-x0)/rx, ny = (y-y0)/ry;
      const wob = 1 + j*((Math.sin((x*0.37+seed)*0.9)+Math.cos((y*0.31+seed)*1.1))*0.5);
      if (nx*nx + ny*ny <= wob*wob) t[y*MAP_W+x] = GRASS;
    }
  };
  const landStamp = (type, x0, y0, size) => {
    let x = x0, y = y0;
    for (let i=0;i<size;i++){
      const rad = 1 + (r()*1.3|0);
      for (let dy=-rad;dy<=rad;dy++) for (let dx=-rad;dx<=rad;dx++){
        if (dx*dx+dy*dy > rad*rad+0.5) continue;
        const X = Math.round(x)+dx, Y = Math.round(y)+dy;
        if (X<2||Y<2||X>=MAP_W-2||Y>=MAP_H-2) continue;
        if (t[Y*MAP_W+X] === WATER) continue;
        if (Math.hypot(X-cx,Y-cy) < 4.2 && type!==GRASS) continue;
        if (type===GRASS || t[Y*MAP_W+X]===GRASS || r()<0.85) t[Y*MAP_W+X] = type;
      }
      x += (r()-0.5)*2.4; y += (r()-0.5)*2.4;
    }
  };
  const sats = [];
  const addSat = (x, y, rx, ry) => {
    rx = Math.max(2.2, rx); ry = Math.max(2.0, ry);
    if (x<8||y<8||x>MAP_W-8||y>MAP_H-8) return;
    raise(x, y, rx, ry, 0.28);
    sats.push([x, y, rx]);
  };

  // Main hub island grows slowly with later island generations
  const mainRx = 20 + Math.min(12, g*1.8) + r()*3;
  const mainRy = 18 + Math.min(10, g*1.5) + r()*3;
  raise(cx, cy, mainRx, mainRy, 0.18);
  for (let i=0;i<6+Math.min(4,g);i++){
    const a = r()*Math.PI*2, d = 11 + r()*(8+g);
    raise(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 3+r()*2.2, 2.8+r()*2, 0.3);
  }

  const far = Math.min(96, 76 + g*5);
  if (layout==='spiral'){
    const n = 16 + g*6;
    for (let i=0;i<n;i++){
      const a = i*0.72 + r()*0.2, d = 30 + (i/n)*(far-30);
      addSat(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 4.2+r()*2.2, 3.8+r()*2);
    }
  } else if (layout==='crescent'){
    const n = 14 + g*5, a0 = r()*Math.PI*2, span = Math.PI*1.25;
    for (let i=0;i<n;i++){
      const a = a0 + (i/(n-1))*span, d = 36 + r()*8 + (i%3)*6;
      addSat(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 4.8+r()*2.4+(g>3?1:0), 4.2+r()*2);
    }
    // far outliers opposite the crescent
    for (let i=0;i<3+g;i++){
      const a = a0 + span + Math.PI*0.4 + r()*0.8, d = 70 + r()*(far-70);
      addSat(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 4+r()*2, 3.6+r()*1.8);
    }
  } else if (layout==='clusters'){
    const clusters = 4 + Math.min(4, g);
    for (let c=0;c<clusters;c++){
      const a = (c/clusters)*Math.PI*2 + r()*0.3, d = 42 + r()*(far-46);
      const bx = cx+Math.cos(a)*d, by = cy+Math.sin(a)*d;
      const n = 3 + (r()*3|0) + (g>4?1:0);
      for (let i=0;i<n;i++){
        const aa = r()*Math.PI*2, dd = r()*10;
        addSat(bx+Math.cos(aa)*dd, by+Math.sin(aa)*dd, 3.8+r()*2.2, 3.4+r()*2);
      }
    }
  } else if (layout==='chains'){
    const arms = 5 + Math.min(3, g);
    for (let a=0;a<arms;a++){
      const ang = (a/arms)*Math.PI*2 + r()*0.15;
      const steps = 3 + g;
      for (let s=1;s<=steps;s++){
        const d = 28 + s*((far-28)/steps) + (r()-0.5)*5;
        addSat(cx+Math.cos(ang)*d, cy+Math.sin(ang)*d, 4.0+r()*1.8, 3.6+r()*1.6);
      }
    }
  } else if (layout==='atolls'){
    const rings = 2 + Math.min(2, (g/2)|0);
    for (let ring=0;ring<rings;ring++){
      const d = 38 + ring*((far-40)/Math.max(1,rings-1));
      const n = 8 + ring*3 + g;
      for (let i=0;i<n;i++){
        const a = (i/n)*Math.PI*2 + r()*0.12;
        addSat(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 3.6+r()*1.6, 3.2+r()*1.4);
      }
    }
    // a couple of far lone isles
    for (let i=0;i<4;i++){ const a=r()*Math.PI*2, d=far-6+r()*4; addSat(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 5+r()*2, 4.4+r()*2); }
  } else if (layout==='shards'){
    const n = 8 + g*2;
    for (let i=0;i<n;i++){
      const a = (i/n)*Math.PI*2 + r()*0.2, d = 36 + r()*(far-40);
      addSat(cx+Math.cos(a)*d, cy+Math.sin(a)*d, 7+r()*4+g*0.4, 5.5+r()*3);
    }
  } else {
    // rings (classic, denser and farther in later generations)
    const placeSat = (dmin, dmax, n, rx0, ry0) => {
      for (let i=0;i<n;i++){
        const a = (i/n)*Math.PI*2 + r()*0.35, d = dmin + r()*(dmax-dmin);
        addSat(cx+Math.cos(a)*d, cy+Math.sin(a)*d, rx0+r()*3, ry0+r()*2.5);
      }
    };
    placeSat(32, 44, 5+g, 5.2, 4.6);
    placeSat(46, 62, 6+g, 5, 4.4);
    placeSat(66, Math.min(far, 84), 5+g, 4.6, 4.1);
    if (g>=3) placeSat(84, far, 4+g, 4.4, 4);
  }

  // Tiny mid-channel islets (visible causeways, belts still cross)
  for (const sat of sats){
    const mid = 0.48 + r()*0.18;
    const mx = cx+(sat[0]-cx)*mid, my = cy+(sat[1]-cy)*mid;
    if (t[(my|0)*MAP_W+(mx|0)] === WATER) raise(mx, my, 1.5+r()*0.7, 1.4+r()*0.5, 0.4);
  }

  // Carve water channels so satellites stay separated from the hub
  const carveW = layout==='shards' ? 2 : 1;
  const carveChannel = (x0, y0, x1, y1) => {
    const steps = Math.max(8, Math.hypot(x1-x0, y1-y0)|0);
    for (let i=1;i<steps;i++){
      const u = i/steps, x = x0+(x1-x0)*u, y = y0+(y1-y0)*u;
      if (i < 3 || i > steps-3) continue;
      for (let dy=-carveW;dy<=carveW;dy++) for (let dx=-carveW;dx<=carveW;dx++){
        const X = Math.round(x)+dx, Y = Math.round(y)+dy;
        if (X<2||Y<2||X>=MAP_W-2||Y>=MAP_H-2) continue;
        if (Math.hypot(X-cx,Y-cy) < 10) continue;
        t[Y*MAP_W+X] = WATER;
      }
    }
  };
  for (const [sx,sy] of sats) carveChannel(cx, cy, sx, sy);

  // Starter wood & stone on main island
  for (let i=0;i<8+Math.min(4,g);i++){ const a=r()*Math.PI*2, d=6+r()*10; landStamp(TREE, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 4+(r()*3|0)); }
  for (let i=0;i<4;i++){ const a=r()*Math.PI*2, d=8+r()*11; landStamp(STONE, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 3+(r()*2|0)); }
  for (let i=0;i<Math.min(8, sats.length);i++){ const sat=sats[i]; landStamp(TREE, sat[0], sat[1], 3+(r()*2|0)); }

  const un = eraUnlocks(era), newest = ((eraOf(era).unlock||[]).find(x=>x.startsWith('res:'))||'').slice(4);
  const placeKeys = Object.keys(RES_BY_KEY).filter(k => k!=='wood' && un.includes('res:'+k));
  let si = 0;
  for (const k of placeKeys){
    const tv = RES_BY_KEY[k];
    const copies = (k===newest ? 3 : 2) + (k==='stone'?1:0);
    for (let c=0;c<copies;c++){
      const sat = sats[(si++) % Math.max(1, sats.length)] || [cx+40, cy, 5];
      landStamp(tv, sat[0]+(r()-0.5)*sat[2]*0.8, sat[1]+(r()-0.5)*sat[2]*0.8, 3+(r()*2|0));
    }
  }
  { let n=0; for (let y=cy-12;y<=cy+12;y++) for (let x=cx-12;x<=cx+12;x++) if (x>=0&&y>=0&&x<MAP_W&&y<MAP_H && t[y*MAP_W+x]===TREE) n++;
    if (n < 10){ for (let i=0;i<4;i++){ const a=r()*Math.PI*2, d=5+r()*6; landStamp(TREE, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 4); } } }
  const minN = Math.max(12, Math.min(20, 8 + (placeKeys.length>12?4:0)));
  const stampAnywhereLand = (tv, size) => {
    // Prefer a satellite; fall back to any grass that's not the plaza
    const sat = sats.length ? sats[r()*sats.length|0] : null;
    if (sat) landStamp(tv, sat[0], sat[1], size);
    let n=0; for (let i=0;i<t.length;i++) if (t[i]===tv) n++;
    if (n >= minN) return;
    for (let tries=0; tries<40 && n<minN; tries++){
      const a=r()*Math.PI*2, d=12+r()*80;
      const x = Math.round(cx+Math.cos(a)*d), y = Math.round(cy+Math.sin(a)*d);
      if (!inMap(x,y) || t[y*MAP_W+x]===WATER) continue;
      if (Math.hypot(x-cx,y-cy)<6) continue;
      landStamp(tv, x, y, size);
      n=0; for (let i=0;i<t.length;i++) if (t[i]===tv) n++;
    }
  };
  for (const k of placeKeys){
    const tv = RES_BY_KEY[k];
    for (let tries=0; tries<12; tries++){
      let n=0; for (let i=0;i<t.length;i++) if (t[i]===tv) n++;
      if (n >= minN) break;
      stampAnywhereLand(tv, 4);
    }
  }
  // Open grass plaza at hub
  for (let y=cy-3;y<=cy+3;y++) for (let x=cx-3;x<=cx+3;x++) if (x>=0&&y>=0&&x<MAP_W&&y<MAP_H) t[y*MAP_W+x] = GRASS;
  return t;
}
function repairIslandResources(){
  // Existing island saves keep their layout. If a required resource is missing or very scarce, stamp more on current land (never under buildings / plaza / cleared tiles).
  if (!S || !R.terr || S.terrGen !== TERR_GEN_ISLANDS) return false;
  const t = R.terr, era = S.rebirths|0, un = eraUnlocks(era);
  const cx = MAP_W/2, cy = MAP_H/2;
  const cleared = new Set(Array.isArray(S.cleared) ? S.cleared : []);
  const can = (x,y) => {
    if (!inMap(x,y)) return false;
    const i = idx(x,y);
    if (t[i]===WATER) return false;
    if (R.occ && R.occ[i]) return false;
    if (cleared.has(i)) return false;
    if (Math.hypot(x-cx,y-cy) < 5) return false;
    return t[i]===GRASS;
  };
  const r = rng(((S.seed|0) ^ 0x12E1A1D ^ (era*13)) >>> 0);
  const stamp = (type, x0, y0, size) => {
    let x=x0, y=y0, n=0;
    for (let i=0;i<size;i++){
      const rad = 1+(r()*1.2|0);
      for (let dy=-rad;dy<=rad;dy++) for (let dx=-rad;dx<=rad;dx++){
        if (dx*dx+dy*dy > rad*rad+0.5) continue;
        const X=Math.round(x)+dx, Y=Math.round(y)+dy;
        if (!can(X,Y)) continue;
        t[Y*MAP_W+X] = type; n++;
      }
      x += (r()-0.5)*2.2; y += (r()-0.5)*2.2;
    }
    return n;
  };
  const keys = ['wood'].concat(Object.keys(RES_BY_KEY).filter(k => k!=='wood' && un.includes('res:'+k)));
  let added = 0;
  for (const k of keys){
    const tv = k==='wood' ? TREE : RES_BY_KEY[k];
    let n=0; for (let i=0;i<t.length;i++) if (t[i]===tv) n++;
    const need = k==='wood' ? 10 : 12;
    let guard=0;
    while (n < need && guard++ < 30){
      let x=0,y=0, found=false;
      for (let tries=0; tries<80 && !found; tries++){
        const a=r()*Math.PI*2, d=8+r()*90;
        x = Math.round(cx+Math.cos(a)*d); y = Math.round(cy+Math.sin(a)*d);
        if (can(x,y)) found=true;
      }
      if (!found) break;
      added += stamp(tv, x, y, 4);
      n=0; for (let i=0;i<t.length;i++) if (t[i]===tv) n++;
    }
  }
  if (added){ if (R.chunkCache) R.chunkCache.clear(); R.ov = null; R.dirty = true; }
  return added > 0;
}


// ============================== ITEM ART (procedural) ==============================
function blobPath(c, x, y, r, k){ c.beginPath(); const n=7; for(let i=0;i<=n;i++){ const a=i/n*Math.PI*2, j=0.78+0.22*Math.abs(Math.sin(k*13.7+i*2.3)); const px=x+Math.cos(a)*r*j, py=y+Math.sin(a)*r*j*0.9; i?c.lineTo(px,py):c.moveTo(px,py);} c.closePath(); }
function rr(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function specks(c,x,y,s,col,k){ c.fillStyle=col; for(let i=0;i<4;i++){ const a=k+i*1.9, d=s*0.18*(0.4+((i*7)%3)/3); c.beginPath(); c.arc(x+Math.cos(a)*d*1.6, y+Math.sin(a)*d, s*0.075, 0, 7); c.fill(); } }
function ingot(c,x,y,s,top,side){ c.fillStyle=side; c.beginPath(); c.moveTo(x-s*.42,y+s*.2); c.lineTo(x+s*.42,y+s*.2); c.lineTo(x+s*.3,y-s*.16); c.lineTo(x-s*.3,y-s*.16); c.closePath(); c.fill(); c.fillStyle=top; c.beginPath(); c.moveTo(x-s*.3,y-s*.16); c.lineTo(x+s*.3,y-s*.16); c.lineTo(x+s*.22,y-s*.3); c.lineTo(x-s*.22,y-s*.3); c.closePath(); c.fill(); }
function gearPath(c,x,y,r,teeth){ c.beginPath(); for(let i=0;i<teeth*2;i++){ const a=i/(teeth*2)*Math.PI*2, rad = i%2? r*0.72 : r; const a2 = a + Math.PI/(teeth*2); c.lineTo(x+Math.cos(a)*rad, y+Math.sin(a)*rad); c.lineTo(x+Math.cos(a2)*rad, y+Math.sin(a2)*rad);} c.closePath(); }
// metal palette: iron = bright cool silver, copper = warm copper-gold
const METAL = { iron:{hi:'#ffffff', mid:'#d3dbe4', lo:'#8d99a8', edge:'#5f6b7a'}, copper:{hi:'#ffe6a8', mid:'#f6a83c', lo:'#c8661f', edge:'#8a3f12'},
  silver:{hi:'#ffffff', mid:'#f1efff', lo:'#c4c0ea', edge:'#7c76b8'}, gold:{hi:'#fff9c4', mid:'#ffd23f', lo:'#e0a100', edge:'#8a6100'},
  titanium:{hi:'#e6f4ff', mid:'#8fb4cf', lo:'#4f7592', edge:'#2c4a60'} };
function sparkle(c, x, y, r, col){ c.fillStyle = col||'#fff'; c.beginPath(); c.moveTo(x, y-r); c.lineTo(x+r*.25, y-r*.25); c.lineTo(x+r, y); c.lineTo(x+r*.25, y+r*.25); c.lineTo(x, y+r); c.lineTo(x-r*.25, y+r*.25); c.lineTo(x-r, y); c.lineTo(x-r*.25, y-r*.25); c.closePath(); c.fill(); }
// a cluster of hexagonal crystals (quartz / quantum)
function crystals(c, x, y, s, cols, glow){
  if (glow){ const g = c.createRadialGradient(x, y, s*.05, x, y, s*.5); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, s*.5, 0, 7); c.fill(); }
  const pr = [[-.17,.12,.13,.42,-.35],[.16,.14,.12,.36,.3],[0,.16,.15,.55,0]];
  for (const [dx,dy,w,h,a] of pr){ c.save(); c.translate(x+dx*s, y+dy*s); c.rotate(a); const W = w*s, Hh = h*s;
    c.fillStyle = cols[2]; c.beginPath(); c.moveTo(-W,0); c.lineTo(-W,-Hh*.7); c.lineTo(0,-Hh); c.lineTo(W,-Hh*.7); c.lineTo(W,0); c.closePath(); c.fill();
    c.fillStyle = cols[1]; c.beginPath(); c.moveTo(-W,0); c.lineTo(-W,-Hh*.7); c.lineTo(0,-Hh); c.lineTo(0,0); c.closePath(); c.fill();
    c.fillStyle = cols[0]; c.beginPath(); c.moveTo(-W*.6,-Hh*.15); c.lineTo(-W*.6,-Hh*.65); c.lineTo(-W*.2,-Hh*.85); c.lineTo(-W*.2,-Hh*.2); c.closePath(); c.fill();
    c.restore(); }
}
function metalGrad(c, x0, y0, x1, y1, m){ const g = c.createLinearGradient(x0,y0,x1,y1); g.addColorStop(0, m.hi); g.addColorStop(0.45, m.mid); g.addColorStop(1, m.lo); return g; }
// shiny metal nuggets embedded in a rock
function nuggets(c, x, y, s, m, k){ const pts = [[-.16,-.1,.15],[.15,.02,.13],[-.02,.16,.11],[.12,-.17,.08]];
  for (let i=0;i<pts.length;i++){ const [dx,dy,r] = pts[(i+k)%pts.length], px = x+dx*s, py = y+dy*s, R = r*s;
    c.fillStyle = m.edge; c.beginPath(); c.moveTo(px-R,py); c.lineTo(px-R*.3,py-R*.9); c.lineTo(px+R*.8,py-R*.5); c.lineTo(px+R,py+R*.4); c.lineTo(px+R*.1,py+R*.95); c.lineTo(px-R*.8,py+R*.6); c.closePath(); c.fill();
    c.fillStyle = metalGrad(c, px-R, py-R, px+R, py+R, m); c.beginPath(); c.moveTo(px-R*.8,py-R*.05); c.lineTo(px-R*.25,py-R*.75); c.lineTo(px+R*.65,py-R*.4); c.lineTo(px+R*.8,py+R*.3); c.lineTo(px+R*.05,py+R*.75); c.lineTo(px-R*.6,py+R*.45); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(px-R*.25,py-R*.3,Math.max(.6,R*.22),0,7); c.fill(); } }
function metalIngot(c,x,y,s,m){
  c.fillStyle='rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x,y+s*.24,s*.44,s*.07,0,0,7); c.fill();
  c.fillStyle=m.lo; c.beginPath(); c.moveTo(x-s*.42,y+s*.2); c.lineTo(x+s*.42,y+s*.2); c.lineTo(x+s*.3,y-s*.16); c.lineTo(x-s*.3,y-s*.16); c.closePath(); c.fill();
  c.fillStyle=metalGrad(c, x-s*.42, y-s*.16, x+s*.3, y+s*.2, {hi:m.mid, mid:m.lo, lo:m.edge}); c.beginPath(); c.moveTo(x-s*.42,y+s*.2); c.lineTo(x+s*.42,y+s*.2); c.lineTo(x+s*.3,y-s*.16); c.lineTo(x-s*.3,y-s*.16); c.closePath(); c.fill();
  c.fillStyle=metalGrad(c, x-s*.3, y-s*.3, x+s*.3, y-s*.16, m); c.beginPath(); c.moveTo(x-s*.3,y-s*.16); c.lineTo(x+s*.3,y-s*.16); c.lineTo(x+s*.22,y-s*.3); c.lineTo(x-s*.22,y-s*.3); c.closePath(); c.fill();
  c.strokeStyle=m.edge; c.lineWidth=Math.max(1,s*.03); c.beginPath(); c.moveTo(x-s*.42,y+s*.2); c.lineTo(x+s*.42,y+s*.2); c.lineTo(x+s*.3,y-s*.16); c.lineTo(x+s*.22,y-s*.3); c.lineTo(x-s*.22,y-s*.3); c.lineTo(x-s*.3,y-s*.16); c.closePath(); c.stroke();
  c.strokeStyle='rgba(255,255,255,.85)'; c.lineWidth=Math.max(1,s*.05); c.beginPath(); c.moveTo(x-s*.26,y+s*.12); c.lineTo(x-s*.16,y-s*.1); c.stroke(); }
function drawItem(c, id, x, y, s){
  c.save(); c.lineJoin='round';
  switch(id){
    case 'wood': c.fillStyle='#8a5a2b'; rr(c,x-s*.42,y-s*.2,s*.8,s*.4,s*.18); c.fill(); c.fillStyle='#e0ac6f'; c.beginPath(); c.ellipse(x+s*.36,y,s*.13,s*.2,0,0,7); c.fill(); c.strokeStyle='#a8743f'; c.lineWidth=s*.04; c.beginPath(); c.ellipse(x+s*.36,y,s*.06,s*.1,0,0,7); c.stroke(); c.strokeStyle='#6b4420'; c.beginPath(); c.moveTo(x-s*.3,y-s*.05); c.lineTo(x+s*.1,y-s*.05); c.stroke(); break;
    case 'plank': c.translate(x,y); c.rotate(-0.25); c.fillStyle='#b9824a'; rr(c,-s*.45,-s*.1,s*.9,s*.26,s*.05); c.fill(); c.fillStyle='#e8bb7a'; rr(c,-s*.45,-s*.18,s*.9,s*.24,s*.05); c.fill(); c.strokeStyle='#c99556'; c.lineWidth=s*.035; c.beginPath(); c.moveTo(-s*.35,-s*.07); c.lineTo(s*.1,-s*.07); c.moveTo(-s*.05,-s*.11); c.lineTo(s*.35,-s*.11); c.stroke(); break;
    case 'box': c.fillStyle='#7a4f22'; rr(c,x-s*.38,y-s*.36,s*.76,s*.76,s*.08); c.fill(); c.fillStyle='#d39a55'; rr(c,x-s*.32,y-s*.3,s*.64,s*.64,s*.05); c.fill(); c.strokeStyle='#8f5f2c'; c.lineWidth=s*.09; c.beginPath(); c.moveTo(x-s*.3,y-s*.28); c.lineTo(x+s*.3,y+s*.32); c.stroke(); c.fillStyle='#7a4f22'; c.fillRect(x-s*.38,y-s*.06,s*.76,s*.08); break;
    case 'stone': c.fillStyle='#8a8276'; blobPath(c,x,y+s*.04,s*.38,1); c.fill(); c.fillStyle='#c4bba9'; blobPath(c,x-s*.06,y-s*.04,s*.27,2); c.fill(); c.fillStyle='#ebe5d8'; c.beginPath(); c.arc(x-s*.12,y-s*.12,s*.07,0,7); c.fill(); break;
    case 'brick': c.fillStyle='#9e3d28'; rr(c,x-s*.42,y-s*.16,s*.84,s*.42,s*.06); c.fill(); c.fillStyle='#d9643f'; rr(c,x-s*.42,y-s*.26,s*.84,s*.38,s*.06); c.fill(); c.fillStyle='#f0b496'; c.fillRect(x-s*.34,y-s*.2,s*.2,s*.05); c.fillRect(x+s*.02,y-s*.2,s*.2,s*.05); break;
    case 'ironOre': c.fillStyle='#4d5868'; blobPath(c,x,y,s*.4,3); c.fill(); c.fillStyle='#717d8e'; blobPath(c,x-s*.05,y-s*.05,s*.28,4); c.fill(); nuggets(c,x,y,s,METAL.iron,0); break;
    case 'copperOre': c.fillStyle='#4a3326'; blobPath(c,x,y,s*.4,5); c.fill(); c.fillStyle='#6c4a35'; blobPath(c,x-s*.05,y-s*.05,s*.28,6); c.fill(); nuggets(c,x,y,s,METAL.copper,1); break;
    case 'coal': c.fillStyle='#1e2126'; blobPath(c,x,y,s*.38,7); c.fill(); c.fillStyle='#3a3f47'; blobPath(c,x-s*.06,y-s*.06,s*.22,8); c.fill(); c.fillStyle='#6b7380'; c.beginPath(); c.arc(x-s*.12,y-s*.12,s*.05,0,7); c.fill(); break;
    case 'ironIngot': metalIngot(c,x,y,s,METAL.iron); break;
    case 'copperIngot': metalIngot(c,x,y,s,METAL.copper); break;
    case 'gear': c.fillStyle='#7d8a96'; gearPath(c,x,y+s*.03,s*.4,8); c.fill(); c.fillStyle='#c5ced6'; gearPath(c,x,y,s*.4,8); c.fill(); c.fillStyle='#7d8a96'; c.beginPath(); c.arc(x,y,s*.12,0,7); c.fill(); break;
    case 'wire': c.strokeStyle='#c8661f'; c.lineWidth=s*.1; for(let i=0;i<3;i++){ c.beginPath(); c.ellipse(x-s*.18+i*s*.18,y,s*.13,s*.27,0,0,7); c.stroke(); } c.strokeStyle='#ffd27a'; c.lineWidth=s*.05; for(let i=0;i<3;i++){ c.beginPath(); c.ellipse(x-s*.18+i*s*.18,y-s*.02,s*.13,s*.25,0,3.5,5.5); c.stroke(); } break;
    case 'steel': c.fillStyle='#2f3f52'; c.fillRect(x-s*.44,y-s*.27,s*.88,s*.15); c.fillRect(x-s*.44,y+s*.12,s*.88,s*.15); c.fillRect(x-s*.1,y-s*.14,s*.2,s*.28); c.fillStyle='#4a6380'; c.fillRect(x-s*.42,y-s*.25,s*.84,s*.1); c.fillRect(x-s*.42,y+s*.14,s*.84,s*.1); c.fillRect(x-s*.07,y-s*.14,s*.14,s*.28); c.fillStyle='#8fb0cf'; c.fillRect(x-s*.42,y-s*.25,s*.84,s*.04); break;
    case 'circuit': c.fillStyle='#1e7a46'; rr(c,x-s*.38,y-s*.38,s*.76,s*.76,s*.08); c.fill(); c.strokeStyle='#f6c945'; c.lineWidth=s*.05; c.beginPath(); c.moveTo(x-s*.3,y-s*.2); c.lineTo(x-s*.12,y-s*.2); c.moveTo(x+s*.12,y+s*.2); c.lineTo(x+s*.3,y+s*.2); c.moveTo(x-s*.3,y+s*.14); c.lineTo(x-s*.12,y+s*.14); c.moveTo(x+s*.12,y-s*.14); c.lineTo(x+s*.3,y-s*.14); c.stroke(); c.fillStyle='#22262e'; rr(c,x-s*.14,y-s*.14,s*.28,s*.28,s*.04); c.fill(); break;
    case 'motor': c.fillStyle='#454d58'; rr(c,x-s*.36,y-s*.24,s*.62,s*.48,s*.1); c.fill(); c.fillStyle='#6b7684'; rr(c,x-s*.36,y-s*.24,s*.62,s*.2,s*.08); c.fill(); c.fillStyle='#f0883e'; c.fillRect(x-s*.12,y-s*.24,s*.12,s*.48); c.fillStyle='#c5ced6'; c.fillRect(x+s*.26,y-s*.05,s*.16,s*.1); break;
    case 'robot': c.strokeStyle='#5a6b7c'; c.lineWidth=s*.05; c.beginPath(); c.moveTo(x,y-s*.3); c.lineTo(x,y-s*.42); c.stroke(); c.fillStyle='#ff6b6b'; c.beginPath(); c.arc(x,y-s*.43,s*.06,0,7); c.fill(); c.fillStyle='#7a8ea3'; rr(c,x-s*.34,y-s*.28,s*.68,s*.6,s*.14); c.fill(); c.fillStyle='#b6c8da'; rr(c,x-s*.34,y-s*.3,s*.68,s*.52,s*.14); c.fill(); c.fillStyle='#1f2933'; rr(c,x-s*.24,y-s*.18,s*.48,s*.24,s*.08); c.fill(); c.fillStyle='#48f0ff'; c.beginPath(); c.arc(x-s*.1,y-s*.06,s*.05,0,7); c.arc(x+s*.1,y-s*.06,s*.05,0,7); c.fill(); break;
    case 'silverOre': c.fillStyle='#7d79a3'; blobPath(c,x,y,s*.4,3); c.fill(); c.fillStyle='#a9a5cc'; blobPath(c,x-s*.05,y-s*.05,s*.28,4); c.fill(); nuggets(c,x,y,s,METAL.silver,2); sparkle(c,x+s*.2,y-s*.22,s*.1); break;
    case 'goldOre': c.fillStyle='#3b3a33'; blobPath(c,x,y,s*.4,5); c.fill(); c.fillStyle='#5a584c'; blobPath(c,x-s*.05,y-s*.05,s*.28,6); c.fill(); nuggets(c,x,y,s,METAL.gold,3); break;
    case 'quartz': c.fillStyle='#cdb8c6'; blobPath(c,x,y+s*.18,s*.3,2); c.fill(); crystals(c,x,y+s*.12,s,['#fff1f8','#ffc4e3','#ff8cc6']); break;
    case 'titaniumOre': c.fillStyle='#34495a'; blobPath(c,x,y,s*.4,7); c.fill(); c.fillStyle='#55707f'; blobPath(c,x-s*.05,y-s*.05,s*.28,8); c.fill(); nuggets(c,x,y,s,METAL.titanium,0); break;
    case 'quantum': c.fillStyle='#1b1033'; blobPath(c,x,y+s*.18,s*.3,4); c.fill(); crystals(c,x,y+s*.12,s,['#eaffff','#7cf3ff','#9b4dff'],'rgba(160,90,255,.75)'); sparkle(c,x+s*.24,y-s*.26,s*.09,'#bff9ff'); break;
    case 'silverIngot': metalIngot(c,x,y,s,METAL.silver); sparkle(c,x+s*.22,y-s*.3,s*.1,'#fff'); sparkle(c,x-s*.3,y+s*.05,s*.06,'#fff'); break;
    case 'goldIngot': metalIngot(c,x,y,s,METAL.gold); sparkle(c,x+s*.22,y-s*.3,s*.1,'#fffbe0'); break;
    case 'titaniumIngot': metalIngot(c,x,y,s,METAL.titanium); break;
    case 'contact': for (let i=0;i<3;i++){ const px = x-s*.24+i*s*.24; c.fillStyle='#7c76b8'; rr(c,px-s*.08,y-s*.32,s*.16,s*.5,s*.05); c.fill(); c.fillStyle='#f1efff'; rr(c,px-s*.06,y-s*.32,s*.1,s*.46,s*.04); c.fill(); c.fillStyle='#c8661f'; c.fillRect(px-s*.03,y+s*.16,s*.06,s*.2); } break;
    case 'jewelry': c.strokeStyle='#8a6100'; c.lineWidth=s*.14; c.beginPath(); c.arc(x,y+s*.1,s*.26,0,7); c.stroke(); c.strokeStyle='#ffd23f'; c.lineWidth=s*.09; c.beginPath(); c.arc(x,y+s*.1,s*.26,0,7); c.stroke(); c.strokeStyle='#fff6c0'; c.lineWidth=s*.03; c.beginPath(); c.arc(x,y+s*.1,s*.27,3.6,4.6); c.stroke();
      c.fillStyle='#c4c0ea'; c.beginPath(); c.moveTo(x-s*.14,y-s*.16); c.lineTo(x+s*.14,y-s*.16); c.lineTo(x,y-s*.06); c.closePath(); c.fill(); c.fillStyle='#ff5fa8'; c.beginPath(); c.moveTo(x,y-s*.44); c.lineTo(x+s*.15,y-s*.28); c.lineTo(x,y-s*.14); c.lineTo(x-s*.15,y-s*.28); c.closePath(); c.fill(); c.fillStyle='#ffd0e6'; c.beginPath(); c.moveTo(x,y-s*.44); c.lineTo(x+s*.06,y-s*.3); c.lineTo(x-s*.08,y-s*.28); c.closePath(); c.fill(); break;
    case 'glass': c.fillStyle='rgba(120,200,235,.55)'; c.strokeStyle='#4aa3c7'; c.lineWidth=s*.04; rr(c,x-s*.34,y-s*.38,s*.6,s*.7,s*.05); c.fill(); c.stroke(); c.fillStyle='rgba(170,230,250,.75)'; rr(c,x-s*.24,y-s*.3,s*.6,s*.7,s*.05); c.fill(); c.stroke(); c.strokeStyle='rgba(255,255,255,.95)'; c.lineWidth=s*.05; c.beginPath(); c.moveTo(x-s*.14,y+s*.2); c.lineTo(x+s*.16,y-s*.16); c.moveTo(x-s*.04,y+s*.3); c.lineTo(x+s*.22,y); c.stroke(); break;
    case 'chip': c.fillStyle='#e0a100'; for (let i=0;i<4;i++){ const o = -s*.21+i*s*.14; c.fillRect(x+o-s*.03,y-s*.42,s*.06,s*.84); c.fillRect(x-s*.42,y+o-s*.03,s*.84,s*.06); } c.fillStyle='#1d1f26'; rr(c,x-s*.3,y-s*.3,s*.6,s*.6,s*.06); c.fill(); c.fillStyle='#3a3e4b'; rr(c,x-s*.22,y-s*.22,s*.44,s*.44,s*.04); c.fill(); c.fillStyle='#7cf3ff'; c.beginPath(); c.arc(x-s*.12,y-s*.12,s*.05,0,7); c.fill(); break;
    case 'plate': c.fillStyle='#2c4a60'; rr(c,x-s*.42,y-s*.24,s*.84,s*.52,s*.06); c.fill(); c.fillStyle=metalGrad(c,x-s*.4,y-s*.3,x+s*.4,y+s*.2,METAL.titanium); rr(c,x-s*.42,y-s*.3,s*.84,s*.5,s*.06); c.fill(); c.fillStyle='#2c4a60'; for (const [dx,dy] of [[-.32,-.2],[.32,-.2],[-.32,.1],[.32,.1]]){ c.beginPath(); c.arc(x+dx*s,y+dy*s,s*.04,0,7); c.fill(); } c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=s*.04; c.beginPath(); c.moveTo(x-s*.2,y-s*.18); c.lineTo(x+s*.15,y-s*.18); c.stroke(); break;
    case 'qcore': { const g = c.createRadialGradient(x,y,s*.04,x,y,s*.46); g.addColorStop(0,'rgba(124,243,255,.9)'); g.addColorStop(1,'rgba(155,77,255,0)'); c.fillStyle=g; c.beginPath(); c.arc(x,y,s*.46,0,7); c.fill();
      c.strokeStyle='#5f7a8c'; c.lineWidth=s*.07; c.beginPath(); c.ellipse(x,y,s*.36,s*.14,0.5,0,7); c.stroke(); c.beginPath(); c.ellipse(x,y,s*.36,s*.14,-0.5,0,7); c.stroke();
      const g2 = c.createRadialGradient(x-s*.05,y-s*.05,s*.02,x,y,s*.2); g2.addColorStop(0,'#ffffff'); g2.addColorStop(.4,'#7cf3ff'); g2.addColorStop(1,'#9b4dff'); c.fillStyle=g2; c.beginPath(); c.arc(x,y,s*.19,0,7); c.fill(); break; }
    case 'qcomp': c.fillStyle='#2a1d4a'; rr(c,x-s*.4,y-s*.36,s*.8,s*.62,s*.08); c.fill(); { const g = c.createLinearGradient(x-s*.3,y-s*.28,x+s*.3,y+s*.1); g.addColorStop(0,'#7cf3ff'); g.addColorStop(1,'#b56bff'); c.fillStyle=g; } rr(c,x-s*.32,y-s*.28,s*.64,s*.42,s*.05); c.fill();
      c.fillStyle='rgba(255,255,255,.85)'; c.beginPath(); c.arc(x,y-s*.07,s*.08,0,7); c.fill(); c.strokeStyle='rgba(255,255,255,.8)'; c.lineWidth=s*.03; c.beginPath(); c.ellipse(x,y-s*.07,s*.17,s*.06,0.4,0,7); c.stroke();
      c.fillStyle='#5f7a8c'; c.fillRect(x-s*.08,y+s*.26,s*.16,s*.08); c.fillRect(x-s*.24,y+s*.32,s*.48,s*.07); break;
    default: if (drawPostItem(c, id, x, y, s)) break; if (!id){ c.restore(); return; } /* was magenta #f0f placeholder */ c.fillStyle='#8a5a2b'; rr(c,x-s*.3,y-s*.25,s*.6,s*.5,s*.1); c.fill();
  }
  c.restore();
}
const iconCache = {};
function icon(id){
  const B0 = BUILDINGS[id];
  const form = (B0 && !B0.landmark && !B0.hut && typeof formSetId==='function' && formSetId()) || '';
  const key = form ? id+'~'+form : id;
  if (iconCache[key]) return iconCache[key];
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  if (B0 && form){ try { drawFormIcon(c, id, form, 32, 32, 60); } catch(e){ drawBuildingIcon(c, id, 32, 32, 60); } }
  else if (B0) drawBuildingIcon(c, id, 32, 32, 60); else drawItem(c, id, 32, 32, 58);
  return iconCache[key] = cv.toDataURL();
}
const img = (id, cls) => `<img src="${icon(id)}" ${cls?`class="${cls}"`:''} alt="">`;
const ONE = {box:'Box'};
const iname = (id, n) => n===1 ? (ONE[id] || (ITEMS[id]&&ITEMS[id].one) || ITEMS[id].name.replace(/s$/,'')) : ITEMS[id].name;
// icon + amount + item name, kept together as one unbreakable chip (wraps between chips)
const itag = (id, n, cls) => `<span class="it${cls?' '+cls:''}">${img(id)}<span class="iq">${n}</span> <span class="nm">${iname(id, typeof n==='number'?n:2)}</span></span>`;
function drawBuildingIcon(c, type, x, y, s){
  const B = BUILDINGS[type]; if (!B) return;
  if (B.landmark){ try { drawLandmarkIcon(c, type, x, y, s); } catch(e){} return; }
  // Mini-Hub / Main Hub: factory block with doors, chimney, label — not a blank square
  if (type==='hub' || type==='megaHub'){
    const ext = type==='megaHub';
    c.fillStyle = B.side; rr(c, x-s*.42, y-s*.28, s*.84, s*.72, s*.14); c.fill();
    c.fillStyle = B.top; rr(c, x-s*.42, y-s*.42, s*.84, s*.66, s*.14); c.fill();
    c.fillStyle = '#5a4bd6'; for (let i=0;i<3;i++){ rr(c, x-s*.28+i*s*.22, y-s*.28, s*.16, s*.28, s*.04); c.fill(); }
    c.fillStyle = '#ffeaa7'; for (let i=0;i<2;i++){ rr(c, x-s*.22+i*s*.28, y-s*.02, s*.14, s*.14, s*.03); c.fill(); }
    // side intake doors
    c.fillStyle = '#2d3436'; rr(c, x-s*.42, y-s*.05, s*.12, s*.28, s*.03); c.fill();
    rr(c, x+s*.30, y-s*.05, s*.12, s*.28, s*.03); c.fill();
    c.fillStyle = '#ffeaa7'; rr(c, x-s*.40, y+s*.02, s*.08, s*.16, s*.02); c.fill();
    rr(c, x+s*.32, y+s*.02, s*.08, s*.16, s*.02); c.fill();
    // chimney
    c.fillStyle = '#3d3290'; rr(c, x+s*.18, y-s*.48, s*.12, s*.22, s*.03); c.fill();
    c.fillStyle = ext ? '#00b894' : '#ff7675'; c.fillRect(x+s*.18, y-s*.46, s*.12, s*.04);
    drawItem(c, 'box', x-s*.02, y-s*.08, s*.36);
    c.fillStyle = '#2d3436'; rr(c, x-s*.32, y+s*.22, s*.64, s*.2, s*.06); c.fill();
    c.fillStyle = '#fff'; c.font = `900 ${Math.max(7,s*.18)}px -apple-system,Segoe UI,sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(ext ? 'HUB 2' : 'HUB', x, y+s*.32);
    return;
  }
  if (type==='woodHut' || type==='rockHut'){ drawHutIcon(c, type, x, y, s); return; }
  c.fillStyle = B.side; rr(c, x-s*.42, y-s*.34, s*.84, s*.78, s*.16); c.fill();
  c.fillStyle = B.top; rr(c, x-s*.42, y-s*.42, s*.84, s*.72, s*.16); c.fill();
  const out = {cutter:'wood', megaCutter:'wood', quarry:'stone', megaQuarry:'stone', drill:'ironOre', megaDrill:'ironOre', workshop:'plank', megaBlock:'plank', smelter:'ironIngot', megaSmelter:'ironIngot', assembler:'circuit', lab:'qcore', forge:'plasmaCell', collider:'antimatterCell', starforge:'starCore', nexus:'timeGear'}[type];
  if (out) drawItem(c, out, x, y-s*.08, BUILDINGS[type].mega ? s*.62 : s*.55);
  if (BUILDINGS[type].mega){
    c.fillStyle='#6c5ce7'; rr(c, x-s*.34, y+s*.20, s*.68, s*.22, s*.06); c.fill();
    c.fillStyle='#fff'; c.font=`900 ${Math.max(7,s*.16)}px -apple-system,Segoe UI,sans-serif`;
    c.textAlign='center'; c.textBaseline='middle'; c.fillText('MEGA', x, y+s*.31);
  }
  if (BUILDINGS[type].landmark) try { drawLandmarkIcon(c, type, x, y, s); } catch(e){}
}

// ============================== TERRAIN PRERENDER ==============================
function drawWorldTree(c, X, Y, P, k, w){
  const sh = w.tree;
  c.fillStyle='rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(X+3,Y+P*.3,P*.36,P*.14,0,0,7); c.fill();
  if (sh==='cactus'){
    c.fillStyle=w.canopy[k%3]; c.fillRect(X-P*.08,Y-P*.28,P*.16,P*.55);
    c.fillRect(X-P*.28,Y-P*.05,P*.2,P*.1); c.fillRect(X-P*.28,Y-P*.22,P*.1,P*.22);
    c.fillRect(X+P*.08,Y+P*.02,P*.2,P*.1); c.fillRect(X+P*.18,Y-P*.12,P*.1,P*.18);
    c.fillStyle=w.hi; c.fillRect(X-P*.04,Y-P*.24,P*.04,P*.4); return;
  }
  if (sh==='pine'){
    c.fillStyle=w.trunk; c.fillRect(X-3,Y+P*.05,6,P*.28);
    for (const [yy,rr] of [[-P*.28,P*.34],[-P*.12,P*.28],[P*.02,P*.22]]){
      c.fillStyle=w.canopy[k%3]; c.beginPath(); c.moveTo(X,Y+yy-rr*.6); c.lineTo(X+rr,Y+yy+rr*.5); c.lineTo(X-rr,Y+yy+rr*.5); c.closePath(); c.fill();
    }
    c.fillStyle='rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(X,Y-P*.48); c.lineTo(X+P*.18,Y-P*.22); c.lineTo(X-P*.18,Y-P*.22); c.closePath(); c.fill(); return;
  }
  if (sh==='palm'){
    c.fillStyle=w.trunk; c.beginPath(); c.moveTo(X-4,Y+P*.32); c.quadraticCurveTo(X+6,Y+P*.05,X-2,Y-P*.1); c.lineTo(X+4,Y-P*.1); c.quadraticCurveTo(X+10,Y+P*.05,X+2,Y+P*.32); c.closePath(); c.fill();
    for (let i=0;i<5;i++){ const a=-1.2+i*.55; c.fillStyle=w.canopy[i%3]; c.beginPath(); c.moveTo(X,Y-P*.1); c.quadraticCurveTo(X+Math.cos(a)*P*.5,Y-P*.1+Math.sin(a)*P*.25-P*.15,X+Math.cos(a)*P*.55,Y-P*.05+Math.sin(a)*P*.4); c.quadraticCurveTo(X+Math.cos(a)*P*.25,Y-P*.2,X,Y-P*.1); c.fill(); }
    return;
  }
  if (sh==='blossom' || sh==='round' || sh==='dead'){
    c.fillStyle=w.trunk; c.fillRect(X-4,Y+P*.05,8,P*.28);
    if (sh==='dead'){ c.strokeStyle=w.canopy[0]; c.lineWidth=3; c.beginPath(); c.moveTo(X,Y+P*.05); c.lineTo(X-P*.2,Y-P*.25); c.moveTo(X,Y); c.lineTo(X+P*.22,Y-P*.2); c.moveTo(X,Y-P*.05); c.lineTo(X+P*.05,Y-P*.35); c.stroke(); c.fillStyle=w.hi; c.beginPath(); c.arc(X+P*.05,Y-P*.35,3,0,7); c.fill(); return; }
    const g = w.canopy[k%3];
    c.fillStyle=g; c.beginPath(); c.arc(X,Y-P*.05,P*.36,0,7); c.fill();
    c.fillStyle=w.hi; c.beginPath(); c.arc(X-P*.1,Y-P*.15,P*.2,0,7); c.fill();
    if (sh==='blossom'){ for (let i=0;i<6;i++){ const a=i*1.1, rr=P*.28; c.fillStyle=w.flower[i%3]; c.beginPath(); c.arc(X+Math.cos(a)*rr,Y-P*.08+Math.sin(a)*rr*.7,P*.07,0,7); c.fill(); } }
    else { c.fillStyle='rgba(255,255,255,.25)'; c.beginPath(); c.arc(X-P*.14,Y-P*.2,P*.08,0,7); c.fill(); }
    return;
  }
  if (sh==='crystal'){
    c.fillStyle=w.trunk; blobPath(c,X,Y+P*.18,P*.22,k); c.fill();
    crystals(c,X,Y+P*.02,P*1.05,w.canopy,'rgba(162,155,254,.55)'); sparkle(c,X+P*.18,Y-P*.28,P*.08,'#fff'); return;
  }
  if (sh==='fungi'){
    c.fillStyle=w.trunk; c.fillRect(X-3,Y-P*.05,6,P*.35);
    c.fillStyle=w.canopy[k%3]; c.beginPath(); c.ellipse(X,Y-P*.12,P*.32,P*.18,0,0,7); c.fill();
    c.fillStyle=w.hi; c.beginPath(); c.ellipse(X-P*.06,Y-P*.18,P*.14,P*.08,0,0,7); c.fill();
    for (let i=0;i<4;i++){ c.fillStyle=w.flower[i%3]; c.beginPath(); c.arc(X-P*.18+i*P*.12,Y-P*.08,P*.04,0,7); c.fill(); }
    return;
  }
  if (sh==='neon'){
    c.strokeStyle=w.canopy[k%3]; c.lineWidth=3; c.shadowColor=w.canopy[k%3]; c.shadowBlur=8;
    c.beginPath(); c.moveTo(X,Y+P*.3); c.lineTo(X,Y-P*.1); c.lineTo(X-P*.22,Y-P*.28); c.moveTo(X,Y-P*.1); c.lineTo(X+P*.24,Y-P*.3); c.stroke();
    c.fillStyle=w.hi; c.beginPath(); c.arc(X,Y-P*.12,P*.08,0,7); c.fill(); c.shadowBlur=0; return;
  }
}

function mixHex(a, b, t){
  const p = h => { h=String(h||'').replace('#',''); if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; const n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; };
  const A=p(a), B=p(b); t=Math.max(0,Math.min(1,+t||0));
  const c = i => Math.round(A[i]*(1-t)+B[i]*t);
  return '#'+[c(0),c(1),c(2)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function applyWorldFrame(){
  const w = world(); if (!w) return;
  const root = document.documentElement;
  root.style.setProperty('--frame-accent', w.accent);
  // strong world-colored rim (light steel blend only) + soft glow for iPhone contrast
  root.style.setProperty('--frame-rim', mixHex(w.accent, '#d8dee6', 0.18));
  const [r,g,b] = (h => { h=String(h).replace('#',''); if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; const n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; })(w.accent);
  root.style.setProperty('--frame-glow', `rgba(${r},${g},${b},.38)`);
  root.dataset.world = w.id;
  const el = $('frame'); if (el) el.dataset.world = w.id;
}
function renderTerrain(){
  // huge map: drop full-map canvases; rebuild chunk cache for the current world/seed
  R.chunkCache = new Map(); R.terrCanvas = null; R.resCanvas = null; R.amb = []; R.worldId = world().id; R.ov = null;
  applyWorldFrame();
}
function invalidateChunks(x,y,r){
  R.ov = null;
  if (!R.chunkCache) return;
  r = r||2; const x0=Math.floor((x-r)/CHUNK), x1=Math.floor((x+r)/CHUNK), y0=Math.floor((y-r)/CHUNK), y1=Math.floor((y+r)/CHUNK);
  for (let cy=y0;cy<=y1;cy++) for (let cx=x0;cx<=x1;cx++) R.chunkCache.delete(cx+','+cy);
}
function renderChunk(cx, cy){
  const key = cx+','+cy; if (R.chunkCache && R.chunkCache.has(key)) return R.chunkCache.get(key);
  const w = world(), P = TILE_PX, t = R.terr;
  const cv = document.createElement('canvas'); cv.width = CHUNK*P; cv.height = CHUNK*P;
  const rcv = document.createElement('canvas'); rcv.width = CHUNK*P; rcv.height = CHUNK*P;
  const c = cv.getContext('2d'), rc = rcv.getContext('2d');
  const x0 = cx*CHUNK, y0 = cy*CHUNK;
  const islandSea = S && S.terrGen===TERR_GEN_ISLANDS;
  for (let ly=0; ly<CHUNK; ly++) for (let lx=0; lx<CHUNK; lx++){
    const x = x0+lx, y = y0+ly; if (!inMap(x,y)) continue;
    const v = t[y*MAP_W+x], r = rng(((S.seed ^ 0xabc) + Math.imul(y*MAP_W+x+1, 2654435761))>>>0);
    if (islandSea && v===WATER){ c.fillStyle=w.sea||w.water; c.fillRect(lx*P, ly*P, P, P); continue; }
    c.fillStyle = ((x+y)&1) ? w.grass[0] : w.grass[1]; c.fillRect(lx*P, ly*P, P, P);
    if (v===GRASS && r()<0.22){ c.fillStyle = r()<0.5?w.blade[0]:w.blade[1]; for(let i=0;i<2;i++) c.fillRect(lx*P+r()*P*0.8, ly*P+r()*P*0.8, 2, 5); }
    if (v===GRASS && r()<0.03){ c.fillStyle = w.flower[r()*3|0]; c.beginPath(); c.arc(lx*P+P*(0.2+r()*0.6), ly*P+P*(0.2+r()*0.6), 2, 0, 7); c.fill(); }
    const theme = (w.id && w.id.indexOf(':')>=0) ? w.id.slice(w.id.indexOf(':')+1) : '';
    if (v===GRASS && theme==='spaceMap' && r()<0.07){
      const cr = 4+r()*6; c.fillStyle='rgba(16,16,24,.4)'; c.beginPath(); c.arc(lx*P+P*0.5, ly*P+P*0.55, cr, 0, 7); c.fill();
      c.strokeStyle='rgba(210,210,230,.4)'; c.lineWidth=1.2; c.stroke();
    }
    if (v===GRASS && theme==='candyMap' && r()<0.09){
      c.fillStyle = ['#ff6b9d','#54a0ff','#ffd93d','#7cf3ff'][r()*4|0];
      c.beginPath(); c.arc(lx*P+P*(0.2+r()*0.6), ly*P+P*(0.2+r()*0.6), 3+r()*2, 0, 7); c.fill();
    }
    if (v===GRASS && theme==='reefMap' && r()<0.05){
      c.fillStyle = ['#ff6b9d','#54a0ff','#ffffff'][r()*3|0];
      c.beginPath(); c.arc(lx*P+P*(0.3+r()*0.4), ly*P+P*(0.3+r()*0.4), 2.4, 0, 7); c.fill();
    }
    if (v===GRASS && theme==='volcanoMap' && r()<0.07){
      c.fillStyle = r()<0.5?'#c0392b':'#1a1a1a';
      c.beginPath(); c.arc(lx*P+P*(0.3+r()*0.4), ly*P+P*(0.3+r()*0.4), 2+r()*3, 0, 7); c.fill();
    }
    if (v===GRASS && theme==='neonMap' && r()<0.07){
      c.fillStyle = r()<0.5?'#00cec9':'#fd79a8';
      c.fillRect(lx*P+r()*P*0.8, ly*P+r()*P*0.8, 3, 3);
    }
    if (v===GRASS && theme==='tundraMap' && r()<0.1){
      c.fillStyle='rgba(255,255,255,.85)'; c.beginPath(); c.arc(lx*P+P*(0.2+r()*0.6), ly*P+P*(0.2+r()*0.6), 2+r()*3, 0, 7); c.fill();
    }
  }
  // water
  for (let ly=0; ly<CHUNK; ly++) for (let lx=0; lx<CHUNK; lx++){
    const x=x0+lx, y=y0+ly; if (!inMap(x,y) || t[y*MAP_W+x]!==WATER) continue;
    c.fillStyle=w.waterRim; rr(c,lx*P-3,ly*P-3,P+6,P+6,10); c.fill();
  }
  for (let ly=0; ly<CHUNK; ly++) for (let lx=0; lx<CHUNK; lx++){
    const x=x0+lx, y=y0+ly; if (!inMap(x,y) || t[y*MAP_W+x]!==WATER) continue;
    c.fillStyle=w.water; rr(c,lx*P-1,ly*P-1,P+2,P+2,8); c.fill();
  }
  // resources
  for (let ly=0; ly<CHUNK; ly++) for (let lx=0; lx<CHUNK; lx++){
    const x=x0+lx, y=y0+ly; if (!inMap(x,y)) continue;
    const v = t[y*MAP_W+x], X = lx*P+P/2, Y = ly*P+P/2, k = x*31+y*17;
    if (v===TREE || v>=STONE){
      const left = (v===TREE || v===STONE) ? hutWearLeft(y*MAP_W+x, v) : HUT_HITS;
      const scW = left < HUT_HITS ? (0.55 + 0.45*left/HUT_HITS) : 1;
      if (scW !== 1){ rc.save(); rc.translate(X, Y+P*0.2); rc.scale(scW, scW); rc.translate(-X, -(Y+P*0.2)); }
      if (v===TREE) drawWorldTree(rc, X, Y, P, k, w);
      else {
        if (v>QUANTUM){ drawPostTile(rc,X,Y,P,v,k); }
        else {
        const base = {[STONE]:['#968f84','#c9c2b5'], [IRON]:['#4d5868','#717d8e'], [COPPER]:['#503527','#74503a'], [COAL]:['#23262b','#454b54'],
          [SILVER]:['#7d79a3','#aeaad2'], [GOLD]:['#3b3a33','#5d5a4c'], [QUARTZ]:['#b9a4b3','#ddccd7'], [TITAN]:['#34495a','#58748a'], [QUANTUM]:['#1b1033','#2e1d55']}[v] || ['#555','#888'];
        rc.fillStyle='rgba(0,0,0,.16)'; rc.beginPath(); rc.ellipse(X+2,Y+P*.28,P*.4,P*.13,0,0,7); rc.fill();
        rc.fillStyle=base[0]; blobPath(rc,X,Y+P*.05,P*.4,k); rc.fill();
        rc.fillStyle=base[1]; blobPath(rc,X-P*.06,Y-P*.02,P*.28,k+1); rc.fill();
        if (v===IRON) nuggets(rc,X,Y,P*.95,METAL.iron,k%4);
        if (v===COPPER) nuggets(rc,X,Y,P*.95,METAL.copper,k%4);
        if (v===COAL) specks(rc,X,Y,P*.9,'#6b7380',k);
        if (v===SILVER){ nuggets(rc,X,Y,P*.95,METAL.silver,k%4); sparkle(rc,X+P*.2,Y-P*.2,P*.1); }
        if (v===GOLD){ nuggets(rc,X,Y,P*.95,METAL.gold,k%4); sparkle(rc,X+P*.18,Y-P*.22,P*.08,'#fffbe0'); }
        if (v===TITAN) nuggets(rc,X,Y,P*.95,METAL.titanium,k%4);
        if (v===QUARTZ) crystals(rc,X,Y-P*.02,P*.95,['#fff1f8','#ffc4e3','#ff8cc6']);
        if (v===QUANTUM){ crystals(rc,X,Y-P*.02,P*.95,['#eaffff','#7cf3ff','#9b4dff'],'rgba(160,90,255,.7)'); sparkle(rc,X+P*.24,Y-P*.26,P*.08,'#bff9ff'); }
        if (v===STONE){ rc.fillStyle='rgba(255,255,255,.4)'; rc.beginPath(); rc.arc(X-P*.14,Y-P*.12,P*.06,0,7); rc.fill(); }
        }
      }
      if (scW !== 1) rc.restore();
      if (left < HUT_HITS) hutDrawWearMark(rc, X, Y, P, left);
    }
  }
  const entry = {terr:cv, res:rcv, cx, cy};
  if (!R.chunkCache) R.chunkCache = new Map();
  R.chunkCache.set(key, entry);
  // soft cap so iPhone memory stays happy
  if (R.chunkCache.size > 90){ const first = R.chunkCache.keys().next().value; R.chunkCache.delete(first); }
  return entry;
}
function drawChunks(layer){
  const z = cam.z, P = TILE_PX;
  const [wx0,wy0] = toWorld(-P, -P), [wx1,wy1] = toWorld(W+P, H+P);
  const x0 = Math.max(0, Math.floor(wx0)), y0 = Math.max(0, Math.floor(wy0));
  const x1 = Math.min(MAP_W-1, Math.ceil(wx1)), y1 = Math.min(MAP_H-1, Math.ceil(wy1));
  const cx0 = Math.floor(x0/CHUNK), cy0 = Math.floor(y0/CHUNK), cx1 = Math.floor(x1/CHUNK), cy1 = Math.floor(y1/CHUNK);
  const [ox,oy] = toScreen(0,0);
  for (let cy=cy0; cy<=cy1; cy++) for (let cx=cx0; cx<=cx1; cx++){
    const ch = renderChunk(cx, cy);
    const sx = ox + cx*CHUNK*z, sy = oy + cy*CHUNK*z, sw = CHUNK*z, sh = CHUNK*z;
    ctx.drawImage(layer==='res'?ch.res:ch.terr, sx, sy, sw, sh);
  }
}
function worldPreview(n, size){
  const w = worldOf(n), s = size||120, cv = document.createElement('canvas'); cv.width = s; cv.height = s; const c = cv.getContext('2d'), P = s/3;
  for (let y=0;y<3;y++) for (let x=0;x<3;x++){ c.fillStyle=((x+y)&1)?w.grass[0]:w.grass[1]; c.fillRect(x*P,y*P,P,P); }
  drawWorldTree(c, s*.3, s*.55, P*1.1, 1, w); drawWorldTree(c, s*.7, s*.6, P*1.1, 4, w);
  c.fillStyle=w.water; rr(c,s*.05,s*.78,s*.35,s*.16,8); c.fill();
  c.strokeStyle=w.beltOut; c.lineWidth=4; c.beginPath(); c.moveTo(s*.2,s*.35); c.lineTo(s*.8,s*.4); c.stroke();
  return cv.toDataURL('image/png');
}


const idx = (x,y) => y*MAP_W+x;
const inMap = (x,y) => x>=0 && y>=0 && x<MAP_W && y<MAP_H;
function footprint(type, x, y){
  const B = BUILDINGS[type]; if (!B) return [];
  if (B.mask && B.mask.length) return B.mask.map(([dx,dy]) => [x+dx, y+dy]);
  const s = B.size, out=[]; for(let dy=0;dy<s;dy++) for(let dx=0;dx<s;dx++) out.push([x+dx,y+dy]); return out;
}
const isLandType = type => !!(BUILDINGS[type] && BUILDINGS[type].landmark);
const isLandB = b => !!(b && isLandType(b.type));
function rebuildOcc(){
  R.occ = new Int32Array(MAP_W*MAP_H).fill(0);
  R.passOcc = new Set();
  for (const b of allB()){
    if (isLandB(b)) R.passOcc.add(b.uid);
    for (const [x,y] of footprint(b.type,b.x,b.y)){ if (inMap(x,y)) R.occ[idx(x,y)] = b.uid; }
  }
}
function allB(){ const b = (S && Array.isArray(S.b)) ? S.b.filter(x => x && typeof x === 'object') : []; return (S && S.hub) ? [S.hub, ...b] : b; }
function recountBelts(){ const N = MAP_W*MAP_H; R.beltOut = new Uint16Array(N); R.beltIn = new Uint16Array(N); R.axH = new Uint16Array(N); R.axV = new Uint16Array(N); R.axT = new Uint16Array(N);
  R.dirH = new Int8Array(N); R.dirV = new Int8Array(N);
  const top = new Map();
  const markDir = (arr, i, d) => { if (!d) return; if (!arr[i]) arr[i]=d; else if (arr[i]!==d) arr[i]=2; };
  // v70: per-kind piece counts (straight H / straight V / turn) so a tile's legality can be judged exactly (tileOk)
  R.kH = {in:new Uint16Array(N), out:new Uint16Array(N)}; R.kV = {in:new Uint16Array(N), out:new Uint16Array(N)}; R.kT = {in:new Uint16Array(N), out:new Uint16Array(N)};
  for (const p of R.paths) p.tiles.forEach((i, j) => { const kk = p.kind==='in'?'in':'out'; (kk==='in'?R.beltIn:R.beltOut)[i]++; const a = p.ax ? p.ax[j] : 3; (a===1?R.axH:a===2?R.axV:R.axT)[i]++; (a===1?R.kH:a===2?R.kV:R.kT)[kk][i]++; if (a===1) markDir(R.dirH,i,p.dir&&p.dir[j]); else if (a===2) markDir(R.dirV,i,p.dir&&p.dir[j]); if (a!==3) top.set(i, {i, axis:a, dir:p.dir[j], kind:p.kind, over:p}); });
  // a bridge: belts crossing straight through each other at right angles; the newest one rides over the top
  R.bridges = []; R.brMap = new Map();
  // v70: a tile carrying both kinds is a bridge whose deck is the kind running straight on one axis with no turns;
  // the other kind passes under it (straight across or turning). Same-kind straight crossings stay bridges too.
  const deckOf = i => {
    const hI=R.kH.in[i], vI=R.kV.in[i], tI=R.kT.in[i], hO=R.kH.out[i], vO=R.kV.out[i], tO=R.kT.out[i];
    if ((hI+vI+tI) && (hO+vO+tO)){
      const d = (h,v,t,oh,ov) => t ? 0 : (h && !v && !oh) ? 1 : (v && !h && !ov) ? 2 : 0;
      let ax = d(hI,vI,tI,hO,vO); if (ax) return {kind:'in', axis:ax};
      ax = d(hO,vO,tO,hI,vI); if (ax) return {kind:'out', axis:ax};
      return null;
    }
    if (R.axH[i] && R.axV[i] && !R.axT[i]){ const t = top.get(i); return t ? {kind:t.kind, axis:t.axis} : null; }
    return null;
  };
  const cand = new Set(); for (const p of R.paths) for (const i of p.tiles) if ((R.beltIn[i] && R.beltOut[i]) || (R.axH[i] && R.axV[i] && !R.axT[i])) cand.add(i);
  for (const i of cand){ const dk = deckOf(i); if (!dk) continue;
    let over = null; for (let n=R.paths.length-1; n>=0 && !over; n--){ const p = R.paths[n]; if (p.kind!==dk.kind || !p.ax) continue; const j = p.tiles.indexOf(i); if (j>=0 && p.ax[j]===dk.axis) over = p; }
    if (!over) continue;
    const t = {i, axis:dk.axis, dir:(dk.axis===1?R.dirH:R.dirV)[i], kind:dk.kind, over}; R.bridges.push(t); R.brMap.set(i, t); }
  if (S && S.stats && R.bridges.length){ if (!Array.isArray(S.brSeen)) S.brSeen = []; const seen = new Set(S.brSeen); for (const b of R.bridges) if (!seen.has(b.i)){ seen.add(b.i); S.brSeen.push(b.i); S.stats.bridgesBuilt = (S.stats.bridgesBuilt||0)+1; } } // lifetime: each new bridge spot counts once per world
  if (S && S.stats && !(S.stats.maxBridges > 0) && R.bridges.length && !R.quiet && !R.loading){ S.stats.maxBridges = R.bridges.length; setTimeout(() => { toast('🌉 Belt bridge! Belts hop over each other automatically — items pass straight through both ways', 3400); checkAch(); }, 600); }
}
const DX=[1,0,-1,0], DY=[0,1,0,-1];
// A tile may only hold one travel direction per axis. Same-kind belts going the same way may share a corridor (they merge).
// Opposite-kind or opposite-direction belts may share a tile only as a right-angle bridge. This stops the "double belt"
// (orange + blue on the same tiles, items running both ways).
// v70 tile rules (with an optional hypothetical piece added): at most one item direction per axis, and if both kinds
// share the tile one of them must be a clean straight deck (one axis, no turns) that the other kind doesn't run along.
function tileOk(i, kind, a, dir){
  let hI=R.kH.in[i], vI=R.kV.in[i], tI=R.kT.in[i], hO=R.kH.out[i], vO=R.kV.out[i], tO=R.kT.out[i], dH=R.dirH[i], dV=R.dirV[i];
  if (kind){
    const isIn = kind==='in';
    if (a===1){ if (isIn) hI++; else hO++; dH = !dH ? dir : (dH===dir ? dH : 2); }
    else if (a===2){ if (isIn) vI++; else vO++; dV = !dV ? dir : (dV===dir ? dV : 2); }
    else { if (isIn) tI++; else tO++; }
  }
  if (dH===2 || dV===2) return false;
  if (!(hI+vI+tI) || !(hO+vO+tO)) return true;
  const deck = (h,v,t,oh,ov) => !t && ((h && !v && !oh) || (v && !h && !ov));
  return deck(hI,vI,tI,hO,vO) || deck(hO,vO,tO,hI,vI);
}
function beltBlocked(ni, k, kind){
  if (R.kH) return !tileOk(ni, kind, k%2===0?1:2, (kind==='in' ? -1 : 1) * ((k===0||k===1) ? 1 : -1));
  const hor = k%2===0, perp = (hor?R.axV:R.axH)[ni], par = (hor?R.axH:R.axV)[ni];
  const isBridge = !!(perp && !par && !(R.axT && R.axT[ni]));
  const other = kind==='in' ? R.beltOut : R.beltIn;
  if (other && other[ni] && !isBridge) return true;
  if (!par) return false;
  const itemSgn = (kind==='in' ? -1 : 1) * ((k===0||k===1) ? 1 : -1);
  const parDir = (hor?R.dirH:R.dirV)[ni];
  if (parDir===2 || (parDir && parDir!==itemSgn)) return true;
  return false;
}
function findRoute(b, kind, allowOverlap, allowSeam){
  if (allowSeam == null) allowSeam = !!allowOverlap;
  if (!S || !S.hub) return null;
  const hubUids = new Set([S.hub.uid, ...S.b.filter(x=>x && BUILDINGS[x.type]&&BUILDINGS[x.type].hubExt).map(x=>x.uid)]); const hubUid = S.hub.uid, N = MAP_W*MAP_H*5;
  const same = kind==='in'?R.beltIn:R.beltOut, other = kind==='in'?R.beltOut:R.beltIn;
  const blocked = new Set();
  const pushHeap = (heap,c,s) => { heap.push([c,s]); let i=heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p; } };
  const popHeap = heap => { const top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; let i=0; for(;;){ const l=2*i+1, r=l+1; let m=i; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m; } } return top; };
  for (let attempt=0; attempt<8; attempt++){
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const heap = [];
    for (const [x,y] of footprint(b.type,b.x,b.y)){ const s = idx(x,y)*5+4; dist[s]=0; pushHeap(heap,0,s); }
    let goal = -1;
    while (heap.length){
      const [c, s] = popHeap(heap); if (c > dist[s]) continue;
      const ti = (s/5)|0, d = s%5, x = ti%MAP_W, y = (ti/MAP_W)|0;
      if (hubUids.has(R.occ[ti])){ goal = s; break; }
      for (let k=0;k<4;k++){
        const nx=x+DX[k], ny=y+DY[k]; if (!inMap(nx,ny)) continue;
        const ni = idx(nx,ny), o = R.occ[ni];
        // v70: judge the piece this path lays on tile ti (straight or turn) once we know where it leaves to.
        // Same-kind belts heading the same way merge (join the trunk, from the side too); a different-kind belt
        // may cross or turn under a straight deck (a bridge). Never two directions / both kinds on one axis.
        let cost = 0;
        if (d!==4){
          const a = d===k ? (k%2===0?1:2) : 3, sg = (kind==='in'?-1:1)*((k===0||k===1)?1:-1);
          const ok = tileOk(ti, kind, a, sg);
          if (!allowOverlap && (!ok || blocked.has(ti))) continue;
          if (!ok) cost += 3;
          const oth = other[ti];
          if (a===3){ cost += 0.35; if (oth) cost += 0.9; }
          else {
            const sameAx = (a===1?R.kH:R.kV)[kind==='in'?'in':'out'][ti];
            if (sameAx && (a===1?R.dirH:R.dirV)[ti]===sg) cost -= 0.45; // ride an existing trunk
            else if (oth) cost += 0.3;                                    // hop over on a bridge
          }
        }
        if (hubUids.has(o)){
          // A one-step hop from the building straight into the Hub leaves no mid-tile, so the
          // belt is drawn under the two sprites and looks like a missing exit. Walk around
          // (a mid tile) unless we are on the last-resort seam/overlap pass.
          if (!allowSeam && d===4) continue;
          cost += 0.01;
        }
        else if (o && !(R.passOcc && R.passOcc.has(o))) continue;
        else { const tv = R.terr[ni];
          // Island worlds: belts may cross water on visible causeways (costly so land is preferred)
          cost += tv===WATER ? 3.6 : tv>=TREE ? 2.2 : 1;
          // Prefer leaving a building on a side that isn't tucked against the Hub, so the exit is visible.
          if (d===4){
            for (let k2=0;k2<4;k2++){
              const ax2=nx+DX[k2], ay2=ny+DY[k2];
              if (inMap(ax2,ay2) && hubUids.has(R.occ[idx(ax2,ay2)])){ cost += 2.2; break; }
            }
          }
        }
        if (cost < 0.01) cost = 0.01;
        const ns = ni*5+k, nc = c+cost;
        if (nc < dist[ns]){ dist[ns]=nc; prev[ns]=s; pushHeap(heap,nc,ns); }
      }
    }
    if (goal<0) return null;
    const tiles = []; for (let s=goal; s>=0; s=prev[s]) tiles.push((s/5)|0); tiles.reverse();
    // tiles: [foot, ...mid, hubTile]
    const ctr = i => [i%MAP_W+0.5, ((i/MAP_W)|0)+0.5];
    const midpt = (p,q) => [(p[0]+q[0])/2, (p[1]+q[1])/2];
    const pts = [];
    // Start at the building's edge, not under its sprite, so the belt is clearly leaving it.
    if (tiles.length > 2) pts.push(midpt(ctr(tiles[0]), ctr(tiles[1])));
    else pts.push(ctr(tiles[0]));
    for (let i=1;i<tiles.length-1;i++) pts.push(ctr(tiles[i]));
    pts.push(midpt(ctr(tiles[tiles.length-2]), ctr(tiles[tiles.length-1])));
    const mid = tiles.slice(1,-1);
    // axis of every belt tile: 1 = straight left/right, 2 = straight up/down, 3 = turn; dir = travel direction of a straight tile
    const ax = new Uint8Array(mid.length), dir = new Int8Array(mid.length);
    for (let j=0;j<mid.length;j++){ const a = tiles[j], c = tiles[j+2], dx = (c%MAP_W)-(a%MAP_W), dy = ((c/MAP_W)|0)-((a/MAP_W)|0);
      ax[j] = dy===0 ? 1 : dx===0 ? 2 : 3; const sgn = (dx||dy) > 0 ? 1 : -1; dir[j] = kind==='in' ? -sgn : sgn; }
    if (kind==='in') pts.reverse();
    const pth = makePath(pts, mid, kind, b); pth.ax = ax; pth.dir = dir;
    pth.hubUid = R.occ[(goal/5)|0] || (S.hub && S.hub.uid); // which Hub / Extension this belt ends at
    if (allowOverlap || !mid.length) return pth;
    // If this path still shares a tile the wrong way, block those tiles and search for a detour.
    R.paths.push(pth); recountBelts();
    const bad = beltConflicts().filter(i => mid.includes(i));
    R.paths.pop(); recountBelts();
    if (!bad.length) return pth;
    let added = 0;
    for (const i of bad) if (!blocked.has(i)){ blocked.add(i); added++; }
    if (!added) return null;
  }
  return null;
}

function makePath(pts, tiles, kind, owner){
  const cum=[0]; for (let i=1;i<pts.length;i++) cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]));
  return {pts, cum, len:cum[cum.length-1], tiles, kind, owner, items:[]};
}
function posOn(p, d){ const c=p.cum; let i=1; while(i<c.length-1 && c[i]<d) i++; const t = c[i]>c[i-1] ? (d-c[i-1])/(c[i]-c[i-1]) : 1; const a=p.pts[i-1], b=p.pts[i]||a; return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }
function needsBelt(b){ const B = b && BUILDINGS[b.type]; return !!(B && b.type!=='hub' && !B.hubExt && !B.hut && !B.landmark); }
function pickRoute(b, kind, allowOverlap){
  // Prefer a visible walk-around (no overlap, no hidden building/Hub seam). Then a direct
  // seam hook so a building touching the Hub still gets a belt. Last, allow overlap.
  let p = findRoute(b, kind, false, false);
  if (p) return p;
  p = findRoute(b, kind, false, true);
  if (p) return p;
  if (allowOverlap) p = findRoute(b, kind, true, true);
  return p;
}
function routeBuilding(b, opts){
  if (!needsBelt(b)) return true; // hubs / huts / landmarks don't belt
  unroute(b);
  const allow = !!(opts && opts.allowOverlap);
  const out = pickRoute(b,'out', allow); if (!out) return false;
  b.outPath = out; R.paths.push(out); recountBelts();
  if (BUILDINGS[b.type].recipes){ const inp = pickRoute(b,'in', allow); if (!inp){ unroute(b); return false; } b.inPath = inp; R.paths.push(inp); recountBelts(); }
  return true;
}
// Used when an existing building must keep working (rollback, load, hub-extension re-route).
// Prefer a clean route; if none exists, allow a shared tile rather than leaving it unbelted.
function routeBuildingSafe(b){ return routeBuilding(b) || routeBuilding(b, {allowOverlap:1}); }
function unroute(b){ for (const p of [b.outPath, b.inPath]) if (p){ refundItems(p); const i=R.paths.indexOf(p); if(i>=0) R.paths.splice(i,1); } b.outPath=b.inPath=null; recountBelts(); }
// Count tiles where in-belts and out-belts (or opposite directions) share the same axis. Clean right-angle bridges don't count.
function beltConflicts(){
  if (!R.beltIn || !R.beltOut) return [];
  const hits = [];
  const N = MAP_W*MAP_H;
  if (!R.kH) return hits;
  for (let i=0;i<N;i++){
    if (!R.beltIn[i] && !R.beltOut[i]) continue;
    if (!tileOk(i)) hits.push(i);
  }
  return hits;
}
// Rebuild every production belt. Used on world setup / load so older saves that already had
// overlapping "double belts" get clean routes without losing buildings or progress. If a
// building truly has no conflict-free path, it still gets a belt (overlap allowed) so it keeps working.
function routeAllBuildings(){
  const list = allB().filter(needsBelt);
  const clear = () => { for (const b of list) unroute(b); };
  const attempt = (arr, allow) => {
    const failed = [];
    for (const b of arr){ try { if (!routeBuilding(b, allow ? {allowOverlap:1} : null)) failed.push(b); } catch(e){ failed.push(b); } }
    return failed;
  };
  clear();
  let failed = attempt(list, false);
  if (failed.length && S && S.hub){
    const hx = S.hub.x+1.5, hy = S.hub.y+1.5;
    const dist = b => Math.hypot((b.x+((BUILDINGS[b.type]&&BUILDINGS[b.type].size)||1)/2)-hx, (b.y+((BUILDINGS[b.type]&&BUILDINGS[b.type].size)||1)/2)-hy);
    clear();
    failed = attempt(list.slice().sort((a,c)=>dist(a)-dist(c)), false);
  }
  if (failed.length) attempt(failed, true); // last resort: keep the building producing
  const ownersOf = tiles => {
    const set = new Set();
    for (const p of R.paths){ if (p && p.tiles && p.owner && p.tiles.some(t=>tiles.has(t))) set.add(p.owner); }
    return [...set].filter(needsBelt);
  };
  for (let n=0;n<3;n++){
    const hits = beltConflicts();
    if (!hits.length) break;
    const own = ownersOf(new Set(hits));
    if (!own.length) break;
    for (const b of own) unroute(b);
    const again = attempt(own, false);
    if (again.length){ attempt(again, true); break; }
  }
}
function refundItems(p){ for (const it of p.items){ if (p.kind==='out') deliver(it.id, it.n||1, true); else addStock(it.id, it.n||1); } p.items=[]; }

// ============================== ECONOMY ==============================
function addStock(id, n){ S.stock[id] = (S.stock[id]||0) + n; R.dirty = true; if (n > 0) try { softIncome(id, n); } catch(e){} }
// Price counter key: Ore Drills are priced per ore (drill:iron / drill:copper / drill:coal); everything else per type.
// S.built counts buildings currently placed (removing one lowers the next price).
function oreKey(tv){ return (RES[tv] && ORE_T.includes(tv)) ? RES[tv].key : 'iron'; }
function drillOreTv(type, x, y){
  if (type==='drill'){ const tv = inMap(x,y) ? R.terr[idx(x,y)] : 0; return ORE_T.includes(tv) ? tv : IRON; }
  if (type!=='megaDrill') return null;
  const counts = {}; let best=null, n=0;
  for (const [fx,fy] of footprint(type,x,y)){
    if (!inMap(fx,fy)) continue;
    const tv = R.terr[idx(fx,fy)];
    if (!ORE_T.includes(tv)) continue;
    counts[tv]=(counts[tv]||0)+1;
    if (counts[tv]>n){ n=counts[tv]; best=tv; }
  }
  return best != null ? best : null;
}
function bKey(type, x, y){
  if (type==='drill' || type==='megaDrill'){
    const tv = drillOreTv(type, x, y);
    return type+':'+oreKey(tv);
  }
  return type;
}
function bKeyOf(b){ return bKey(b.type, b.x, b.y); }
function nBuilt(type){ let n = 0; for (const k in S.built) if (k===type || k.startsWith(type+':')) n += S.built[k]||0; return n; }
function recountBuilt(){ S.built = {}; for (const b of S.b){ const k = bKeyOf(b); S.built[k] = (S.built[k]||0)+1; } }
const HUT_PLACE_MAX = 3;
function isHutType(type){ return !!(BUILDINGS[type] && BUILDINGS[type].hut); }
function hutPlaced(type){ if (!S || !Array.isArray(S.b)) return 0; let n=0; for (const b of S.b) if (b && b.type===type) n++; return n; }
function hutSlotsLeft(type){ return isHutType(type) ? Math.max(0, HUT_PLACE_MAX - hutPlaced(type)) : 0; }
function hutAtCap(type){ return isHutType(type) && hutPlaced(type) >= HUT_PLACE_MAX; }
function costOf(type, key){
  const B = BUILDINGS[type];
  if (isHutType(type)) return {};
  if (type==='drill' && !key){ // no ore given: the cheapest unlocked ore drill
    let best = null, bs = Infinity; for (const tv of ORE_T){ const o = RES[tv].key; if (!has('res:'+o)) continue; const c = costOf(type,'drill:'+o), sum = Object.values(c).reduce((a,b)=>a+b,0); if (sum < bs){ best = c; bs = sum; } }
    return best || costOf(type,'drill:iron'); }
  if (isGoldKey(harvKeyOf(type, key || (type==='drill' ? 'drill:iron' : type)))) return {}; // gold harvester: free, unlimited
  const n = S.built[key||type]||0;
  if (type==='cutter' && n===0) return {};
  // Hub Extension: perk is the cost — placement is free (unlimited pads once unlocked)
  if (type==='megaHub') return {};
  const m = growthMul(Math.max(0, n - (type==='cutter'?1:0))) * Math.pow(0.9, perk('thrift')), c = {};
  const base = type==='drill' ? ((RES[RES_BY_KEY[(key||'drill:iron').split(':')[1]]]||{}).cost || B.cost) : B.cost;
  for (const k in base) c[k] = Math.ceil(base[k]*m);
  return c;
}
const canPay = c => Object.keys(c).every(k => (S.stock[k]||0) >= c[k]);
function pay(c){ for (const k in c) S.stock[k] -= c[k]; R.dirty = true; }
function deliver(id, n, quiet, atB){
  quiet = quiet || R.quiet;
  addStock(id, n); S.totalDelivered[id] = (S.totalDelivered[id]||0)+n; if (S.stats) S.stats.del[id] = (S.stats.del[id]||0)+n;
  try { gainXp(id, n); } catch(e){}
  try { noteChProgress('deliver', id, n); } catch(e){}
  const q = curQuest();
  if (q && q.item===id){ S.qprog += n; if (S.qprog >= questN(q)) completeQuest(quiet); }
  if (!quiet){ R.hubPulse = 1; if (atB) atB.pop = 1; floatGain(id, n, atB); sfx('tick'); }
}
function completeQuest(quiet){
  if (S.quest !== 0) return;
  S.quest = 1; S.qprog = questN(eraQuest(S.rebirths)); S.finalDone = true; grant({res:1});
  if (!quiet){
    const ascendNow = S.rebirths >= lastEraOf(), pts = rebirthPoints();
    showBanner('Era Complete!', ascendNow ? `Tap Ascend for +${pts} ✦ and a new cycle<br>${packTxt(1)}` : `Tap Rebirth for +1 ✦ and the next era<br>${packTxt(1)}`);
    confetti(); sfx('quest'); vibrate(30);
    document.getElementById('quest').classList.add('pulse'); setTimeout(()=>document.getElementById('quest').classList.remove('pulse'),700);
    setTimeout(() => { if (!sheetWrap.classList.contains('open')) openPerks(); }, 1600);
  }
  R.dirty = true; save();
}
function itemKnown(id){ if (['wood'].includes(id)) return true; if (Object.values(RES).some(r=>r.item===id)) { const r = Object.values(RES).find(r=>r.item===id); return !r.unlock || has(r.unlock); } return has('r:'+id); }

// ============================== BUILD / DEMOLISH ==============================
function placeCheck(type, x, y, ignoreUid){
  const B = BUILDINGS[type];
  if (!B) return 'Unknown building';
  if (B.unlockPerk && !megaUnlocked(type)) return 'Unlock this in the Perk shop first';
  if (B.hut && hutAtCap(type)) return 'Max 3 placed';
  if (B.landmark && !cosOwned(type)) return 'Buy this landmark in the Style Shop first';
  let onHits = 0;
  for (const [fx,fy] of footprint(type,x,y)){
    if (!inMap(fx,fy)) return 'Off the map';
    const i = idx(fx,fy), tv = R.terr[i];
    if (R.occ[i] && R.occ[i] !== ignoreUid) return 'Something is already here';
    if (tv===WATER) return 'Can\'t build on water';
    if (B.on){
      if (B.mega){ if (B.on.includes(tv)) onHits++; else if (tv!==GRASS) return 'Needs resource patch + open grass'; }
      else if (!B.on.includes(tv)) return 'Must be built on '+B.on.map(v=>RES[v].name).join('/');
    } else if (tv!==GRASS) return 'Needs open grass';
  }
  if (B.on && B.mega && onHits < 1) return 'Cover at least one '+B.on.map(v=>RES[v].name).join('/');
  const edgeErr = hubEdgeErr(type, x, y); if (edgeErr) return edgeErr;
  return null;
}
function build(type, x, y){
  const err = placeCheck(type,x,y); if (err){ toast(err); return false; }
  const key = bKey(type,x,y), cost = type==='hub' ? {} : costOf(type, key);
  if (!canPay(cost)){ toast('Not enough resources'); sfx('err'); return false; }
  const b = {uid:S.uid++, type, x, y, lv:1, tier:1, dbl:0, recipe:null, t:0, buf:{}, outQ:0, craftT:0, crafting:false, born:R.time};
  if (BUILDINGS[type].recipes) b.recipe = BUILDINGS[type].recipes.find(r=>has('r:'+r)) || BUILDINGS[type].recipes[0];
  if (BUILDINGS[type].on){ // remember resource under this harvester (megas: footprint majority)
    b.tv = harvTvOf(b);
    if (b.tv == null){ for (const [px,py] of footprint(type,x,y)){ const tv=R.terr[idx(px,py)]; if (BUILDINGS[type].on.includes(tv)){ b.tv = tv; break; } } }
  }
  if (type==='hub'){ S.hub = b; rebuildOcc(); if (S.terrGen===TERR_GEN_ISLANDS && !S.islandTip){ S.islandTip=1; toast('🏝️ Archipelago — belts auto-build causeways over water to island resources', 4200); } if (R.pendingDaily || dailyState()) offerDailySoon(true); }
  else {
    S.b.push(b); rebuildOcc();
    if (BUILDINGS[type].landmark){
      pay(cost); S.built[key] = (S.built[key]||0)+1;
      puff(x + BUILDINGS[type].size/2, y + BUILDINGS[type].size/2, BUILDINGS[type].top, 16);
      sfx('build'); vibrate(15); if (S.stats) statAdd('built'); R.dirty = true; save();
      return b;
    }
    // reroute any belts that crossed the new footprint
    const fp = new Set(footprint(type,x,y).map(([a,c])=>idx(a,c)));
    const hit = S.b.filter(o => o!==b && [o.outPath,o.inPath].some(p => p && p.tiles.some(t=>fp.has(t))));
    for (const o of hit) unroute(o);
    let ok = routeBuilding(b); const ownOk = ok, cut = [];
    for (const o of hit) if (!routeBuilding(o)){ ok = false; cut.push(o); }
    if (!ok){
      unroute(b); for (const o of hit) unroute(o); S.b.pop(); rebuildOcc(); for (const o of hit) routeBuildingSafe(o);
      R.lastBuildErr = 'route';
      if (ownOk && cut.length){ // the spot is fine, but a building here would wall in another building's only belt
        for (const o of cut){ const s2 = BUILDINGS[o.type].size; puff(o.x+s2/2, o.y+s2/2, '#e17055', 14); o.pop = 1; }
        toast(`Building here would cut off ${cut.length>1?cut.length+' buildings\'':'another building\'s'} only belt to the Hub`, 2800);
      } else if (!routeFailHelp(type, x, y)) toast('No room for a belt to reach the Hub', 2600);
      sfx('err'); return false;
    }
    pay(cost); S.built[key] = (S.built[key]||0)+1;
  }
  if (BUILDINGS[type].hubExt){
    // Re-route everyone safely (refund in-transit first) so nearer buildings switch to this Extension
    for (const o of S.b){ if (o===b || (BUILDINGS[o.type]&&BUILDINGS[o.type].hubExt)) continue; unroute(o); routeBuildingSafe(o); }
    if (!R.quiet && !R.loading) toast('📡 Nearby buildings now deliver to the closest Hub', 2800);
  }
  puff(x + BUILDINGS[type].size/2, y + BUILDINGS[type].size/2, BUILDINGS[type].top, 16);
  sfx('build'); vibrate(15); if (S.stats) statAdd('built'); R.dirty = true; save();
  if (BUILDINGS[type].hut && !R.quiet && !R.loading){
    toast(type==='rockHut'
      ? '⚠ Rocks he breaks are gone for good — demolish the hut to stop him'
      : '⚠ Trees he cuts are gone for good — demolish the hut to stop him', 3800);
  }
  return b;
}
// v70: when a new building truly can't get a belt to any Hub, don't just say no - offer the two real fixes.
const HUBEXT_PP = 5;
function hubExtSpotNear(x, y, avoid){
  const av = new Set((avoid||[]).map(([a,c])=>idx(a,c)));
  const had = S.perks.megaHub; if (!(had > 0)) S.perks.megaHub = 1; // judge the ground only, not the perk
  try {
  for (let r=0; r<=10; r++) for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++){
    if (Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
    const sx = x+dx-1, sy = y+dy-1;
    if (placeCheck('megaHub', sx, sy)) continue;
    if (footprint('megaHub', sx, sy).some(([a,c]) => av.has(idx(a,c)))) continue;
    return [sx, sy];
  }
  } finally { if (!(had > 0)){ if (had === undefined) delete S.perks.megaHub; else S.perks.megaHub = had; } }
  return null;
}
function routeFailHelp(type, x, y){
  if (R.quiet || R.loading || typeof sheet==='undefined' || !sheet) return false;
  const owned = megaUnlocked('megaHub'), canBuy = !owned && (S.pp|0) >= HUBEXT_PP && perk('megaHub') < 1;
  const fp = footprint(type, x, y), extSpot = hubExtSpotNear(x, y, fp);
  const nm = (BUILDINGS[type] && BUILDINGS[type].name) || 'building';
  const extBtn = extSpot && (owned || canBuy)
    ? `<button class="btn green" data-a="ext" style="white-space:nowrap">${owned ? 'Add Hub Extension' : 'Hub Extension · '+HUBEXT_PP+' ✦'}</button>` : '';
  const extNote = !owned && !canBuy ? `<div class="sub" style="margin-top:6px">Or unlock a Hub Extension (${HUBEXT_PP} ✦) in Perks and put it out here.</div>` : '';
  openSheet(`<h2>No belt path to the Hub</h2>
    <div class="sub">The belts around your Hub are full, so this ${nm} can't plug in. Nothing was spent.</div>
    <div class="sub" style="margin-top:6px">Move your Hub to open ground${extBtn ? ', or drop a Hub Extension next to this spot' : ''} and it will connect.</div>${extNote}
    <div class="row" style="margin-top:12px"><button class="btn" data-a="mv" style="white-space:nowrap">🏠 Move Hub</button>${extBtn}</div>
    <div class="row"><button class="btn gray" data-a="x">Not now</button></div>`);
  sheet.querySelector('[data-a=x]').onclick = () => closeSheet();
  sheet.querySelector('[data-a=mv]').onclick = () => { sfx('click'); closeSheet(); startHubMove(); };
  const eb = sheet.querySelector('[data-a=ext]');
  if (eb) eb.onclick = () => {
    sfx('click');
    if (!megaUnlocked('megaHub')){ if ((S.pp|0) < HUBEXT_PP) return; S.pp -= HUBEXT_PP; S.perks.megaHub = (S.perks.megaHub|0) + 1; }
    closeSheet();
    const sp = hubExtSpotNear(x, y, fp);
    const ext = sp && build('megaHub', sp[0], sp[1]);
    if (!ext){ toast('No open 4×4 spot here for a Hub Extension', 2600); return; }
    const nb = build(type, x, y);
    toast(nb ? `📡 Hub Extension placed · ${nm} connected` : '📡 Hub Extension placed · tap the spot again to build', 3000);
  };
  R.lastBuildErr = 'route';
  return true;
}
function migrateHubExtPrice(st){
  // v70: Hub Extension perk dropped from 100 ✦ to 5 ✦. Refund the difference once per save.
  if (!st || st.hubExt5) return 0;
  const L = (st.perks && st.perks.megaHub)|0, refund = L > 0 ? (100 - HUBEXT_PP) * L : 0;
  if (refund){ st.pp = (st.pp|0) + refund; st.hubExtRefund = refund; }
  st.hubExt5 = 1; return refund;
}
function demolish(b){
  const wasExt = !!(BUILDINGS[b.type] && BUILDINGS[b.type].hubExt);
  if (BUILDINGS[b.type] && BUILDINGS[b.type].hut) hutDismiss(b);
  unroute(b);
  for (const k in b.buf) addStock(k, b.buf[k]);
  if (b.hq && BUILDINGS[b.type].on) addStock(harvestItem(b), b.hq);
  if (b.outQ && b.recipe) addStock(b.recipe, b.outQ);
  const key = bKeyOf(b); S.b.splice(S.b.indexOf(b),1); S.built[key] = Math.max(0,(S.built[key]||1)-1);
  if (!(BUILDINGS[b.type] && BUILDINGS[b.type].hut)){
    const c = costOf(b.type, key); for (const k in c) addStock(k, Math.floor(c[k]/2));
  }
  for (let t=2;t<=(b.lv||1);t++){ const tc = lvCost(b.type,t)||{}; for (const k in tc) addStock(k, Math.floor(tc[k]/2)); }
  rebuildOcc();
  if (wasExt){ for (const o of S.b){ if (BUILDINGS[o.type]&&BUILDINGS[o.type].hubExt) continue; unroute(o); routeBuildingSafe(o); } }
  puff(b.x+BUILDINGS[b.type].size/2, b.y+BUILDINGS[b.type].size/2, '#999', 14); if (!R.quietDemo) sfx('demo'); save();
}
function setRecipe(b, r){ if (b.recipe===r) return; for (const k in b.buf) addStock(k, b.buf[k]); b.buf={}; if (b.inPath) refundItems(b.inPath); if (b.outQ) addStock(b.recipe, b.outQ); b.outQ=0; b.crafting=false; b.craftT=0; b.recipe=r; save(); }

// ============================== SIMULATION ==============================
// The Hub always keeps enough of each item to place any unlocked building (min RESERVE), so crafters never starve your building budget.
function reserveOfRaw(k){ let m = RESERVE; for (const t of BUILD_ORDER){ if (t!=='cutter' && !has('b:'+t)) continue; const c = costOf(t)[k]; if (c > m) m = c; } return m; }
// memoised per sim tick (costs only change when something is built, which happens between ticks)
function reserveOf(k){ const mm = R.rvMemo || (R.rvMemo = {}); return mm[k] ?? (mm[k] = reserveOfRaw(k)); }
// v66 soft reserve: below the building reserve, crafters still get SOFT_SHARE of what arrives at the Hub (the rest is saved
// toward the next building). Never below the RESERVE floor, so cheap things stay buildable. Above the reserve: unchanged.
const SOFT_SHARE = 0.5;
const softCap = rv => Math.max(RESERVE, rv*0.25);
function softIncome(id, n){ if (!(n > 0) || !S || !S.stock) return; const rv = reserveOf(id); if ((S.stock[id]||0) - n < rv){ const s = R.soft || (R.soft = {}); s[id] = Math.min((s[id]||0) + n*SOFT_SHARE, softCap(rv)); } }
function crAvail(k){ const s = S.stock[k]||0, rv = reserveOf(k); const tok = (R.soft && R.soft[k]) || 0; return Math.max(0, s - rv, Math.min(s - RESERVE, Math.floor(tok))); }
function crTake(k, n){ const s = S.stock[k]||0, over = Math.max(0, s - reserveOf(k)), use = Math.max(0, n - over); if (use > 0 && R.soft) R.soft[k] = Math.max(0, (R.soft[k]||0) - use); S.stock[k] = s - n; }
function startFree(p){ const it = p.items[p.items.length-1]; return !it || it.d >= SPACING; }
// Steady-stream belts: each belt slot may carry a small bundle (it.n) so a belt can always keep up with the building it serves.
// A belt moves beltSpeed()/SPACING slots per second; bundle size is just big enough for the building's top speed (+30% headroom).
const beltSlotsPerSec = () => beltSpeed()/SPACING;
const bundleFor = rate => Math.max(1, Math.ceil(rate*1.3 / beltSlotsPerSec()));
// new item enters at the belt start; if the previous one just cleared the gap, keep exact back-to-back spacing (no frame-rate jitter)
function pushItem(p, id, n){ const last = p.items[p.items.length-1], gap = last ? last.d - SPACING : 0; p.items.push({id, d: gap > 0 && gap < beltSpeed()*0.1 ? gap : 0, n}); }
function inTransit(p, id){ let n=0; for (const it of p.items) if (it.id===id) n += (it.n||1); return n; }
const craftRate = b => { const B=BUILDINGS[b.type]; return craftMul()*lvSpeed(b.lv||1)*(B.megaCraft||1)/RECIPES[b.recipe].time; };
// how many of ingredient k this crafter wants on hand (buffer + on its belt): enough to cover the belt trip plus 3 batches
function inTarget(b, k){ const r = RECIPES[b.recipe], travel = (b.inPath ? b.inPath.len : 2)/beltSpeed(); return Math.ceil(r.in[k]*(craftRate(b)*(travel+0.5) + 3)); }
function crafterAccepts(b, id){ const r = RECIPES[b.recipe]; return r && r.in[id] && (b.buf[id]||0) < inTarget(b, id) + 2*bundleFor(r.in[id]*craftRate(b)); }
const peakMul = b => ((b.lv||1) >= 2 || perk('lucky') || perk('fortune')) ? 2 : 1; // belts sized for doubles
const outCap = b => { const r = RECIPES[b.recipe]; return Math.max(4, r.out*2*3, 3*bundleFor(r.out*peakMul(b)*craftRate(b))); };
function stepPath(p, dt){
  const v = beltSpeed()*dt;
  for (let i=0;i<p.items.length;i++){
    const it = p.items[i]; let max = i===0 ? p.len : p.items[i-1].d - SPACING;
    it.d = Math.min(it.d + v, Math.max(it.d, max));
  }
  while (p.items.length && p.items[0].d >= p.len - 1e-6){
    const it = p.items[0], n = it.n||1;
    if (p.kind==='out'){ const at = (p.hubUid && allB().find(b=>b.uid===p.hubUid)) || S.hub; deliver(it.id, n, false, at); p.items.shift(); }
    else { const b = p.owner; if (crafterAccepts(b, it.id)){ b.buf[it.id]=(b.buf[it.id]||0)+n; p.items.shift(); } else if (!RECIPES[b.recipe] || !RECIPES[b.recipe].in[it.id]) { addStock(it.id, n); p.items.shift(); } else break; }
  }
}
function simulate(dt){
  R.rvMemo = null;
  if (!S.hub) return;
  const hm = harvestMul(), cm = craftMul();
  // rotate the starting building each tick so crafters share scarce Hub stock fairly (older buildings don't hog it)
  const nb = S.b.length, off = nb ? (R.simTick = ((R.simTick||0)+1) % nb) : 0;
  R.crPrev = R.crNow || {}; R.crNow = {}; // highest "owed" share per ingredient among crafters still waiting (last tick)
  for (let j=0;j<nb;j++){
    const b = S.b[(j+off)%nb], B = b && BUILDINGS[b.type];
    if (!B) continue;
    if (B.hut){ stepHut(b, dt); }
    else if (B.on){ // harvester: produced items queue up (b.hq) and stream onto the belt slot after slot
      const tm = lvSpeed(b.lv||1), iv = ivOf(b) / (hm*tm), id = harvestItem(b); if (!id) continue; const bs = bundleFor(peakMul(b)/iv), ch = dblChance(b);
      if ((b.hq||0) < bs*3){ b.t += dt; while (b.t >= iv){ b.t -= iv; const two = ch > 0 && Math.random() < ch; b.hq = (b.hq||0)+(two?2:1); b.pop=1; if (two) x2Pop(b); } } else b.t = Math.min(b.t, iv);
      let g = 0; while (b.hq > 0 && b.outPath && startFree(b.outPath) && g++ < 4){ const n = Math.min(b.hq, bs); pushItem(b.outPath, id, n); b.hq -= n; }
      b.blocked = (b.hq||0) >= bs*3;
    } else if (B.recipes){
      const r = RECIPES[b.recipe]; if (!r) continue;
      const keys = Object.keys(r.in), rate = craftRate(b);
      // Hub feeds inputs back to back: each free slot goes to the ingredient that is furthest below its target
      // Fair share: each crafter earns credit for every ingredient at the rate it actually uses it. When an item is scarce
      // (many crafters fighting over a near-empty Hub stock) a crafter can only take what it has earned, so scarce items
      // are split in proportion to each crafter's need instead of going to whoever grabs biggest/first.
      if (!b.cr) b.cr = {};
      for (const k of keys){ const use = r.in[k]*rate, want = (b.buf[k]||0) + inTransit(b.inPath||{items:[]},k) < inTarget(b,k);
        b.cr[k] = (b.cr[k]||0)*(1 - dt/300) + (b.paused ? 0 : use*dt); // credit owed (slowly forgotten, so long shortages stay fair)
        if (want && !b.paused && b.inPath){ const q = b.cr[k]/use; if (q > (R.crNow[k]||0)) R.crNow[k] = q; } }
      let g = 0;
      while (!b.paused && b.inPath && startFree(b.inPath) && g++ < 4){
        let best = null, bf = 1;
        for (const k of keys){ const have = (b.buf[k]||0) + inTransit(b.inPath,k), f = have / inTarget(b,k); if (f < bf && crAvail(k) > 0){ bf = f; best = k; } }
        if (!best) break;
        let n = Math.min(bundleFor(r.in[best]*rate), inTarget(b,best) - (b.buf[best]||0) - inTransit(b.inPath,best), crAvail(best));
        if (crAvail(best) < 4*bundleFor(r.in[best]*rate)){ // scarce: fair share only, and the crafter that is owed the most goes first
          const ratio = b.cr[best]/(r.in[best]*rate);
          if (ratio < 0.8*(R.crPrev[best]||0) - 1) break;
          n = Math.min(n, Math.floor(b.cr[best])); }
        if (n <= 0) break;
        b.cr[best] = Math.max(0, b.cr[best] - n);
        crTake(best, n); R.dirty = true; pushItem(b.inPath, best, n);
        if (!b.inFlow) b.inFlow = {}; b.inFlow[best] = (b.inFlow[best]||0) + n;
      }
      const ready = () => b.outQ < outCap(b) && keys.every(k => (b.buf[k]||0) >= r.in[k]);
      const start = () => { for (const k in r.in) b.buf[k] -= r.in[k]; b.crafting = true; };
      if (!b.crafting && ready()){ start(); b.craftT = 0; }
      if (b.crafting){ b.craftT += dt*cm*lvSpeed(b.lv||1)*(B.megaCraft||1); let c = 0;
        while (b.crafting && b.craftT >= r.time && c++ < 80){ b.craftT -= r.time; const two = dblChance(b) > 0 && Math.random() < dblChance(b); b.outQ += two ? r.out*2 : r.out; b.pop = 1; if (two) x2Pop(b); b.crafting = false; if (ready()) start(); else b.craftT = 0; } }
      g = 0; const os = bundleFor(r.out*peakMul(b)*rate);
      while (b.outQ > 0 && b.outPath && startFree(b.outPath) && g++ < 4){ const n = Math.min(b.outQ, os); pushItem(b.outPath, b.recipe, n); b.outQ -= n; }
      // decay input-flow meters (used by info sheet "getting X/min")
      if (b.inFlow){ const decay = Math.exp(-dt/2); for (const k in b.inFlow) b.inFlow[k] *= decay; }
    }
    if (b.pop) b.pop = Math.max(0, b.pop - dt*4);
  }
  for (const p of R.paths) stepPath(p, dt);
}
// Offline catch-up at full speed.
// Short absences (< SIM_BUDGET s) run the real simulation step by step (belts, buffers and all).
// Longer ones use a flow model of the same factory: every harvester and crafter runs at its true rate (tier, perks,
// perks, x2), crafters pull inputs from the Hub above its reserve, and when an input is short it is split between the
// crafters in proportion to their need (same fair-share rule as the live feeder). Outputs feed the next step, so whole
// chains (ore -> ingots -> gears/steel ...) and quest completions play out over time. 24h takes a few ms.
const SIM_DT = 0.05, SIM_BUDGET = 300, FLOW_DT = 5;
function flowSim(sec){
  const hm = harvestMul(), cm = craftMul();
  const harv = [], craft = [];
  for (const b of S.b){ const B = BUILDINGS[b.type];
    if (B.on){ const id = harvestItem(b); if (id && ITEMS[id]) harv.push([id, hm*lvSpeed(b.lv||1)*(1+dblChance(b))/ivOf(b)]); }
    else if (B.recipes && RECIPES[b.recipe] && !b.paused){ const r = RECIPES[b.recipe]; craft.push({r, out:b.recipe, rate: cm*lvSpeed(b.lv||1)*(B.megaCraft||1)/r.time, mul: r.out*(1+dblChance(b))}); } }
  let t = 0, rq = -1, rs = {}; const resv = k => { if (rq !== S.quest){ rq = S.quest; rs = {}; } return rs[k] ?? (rs[k] = reserveOfRaw(k)); };
  const st = S.stock, frac = {}; // fractional parts carried between steps
  const tok = {}; // soft-reserve allowance (same rule as the live feeder): crafters get SOFT_SHARE of income while below reserve
  const give = (k, n) => { if (n <= 0) return; const v = (frac[k]||0) + n, w = Math.floor(v); frac[k] = v - w; if (w){ const rv = resv(k); if ((st[k]||0) < rv) tok[k] = Math.min(softCap(rv), (tok[k]||0) + w*SOFT_SHARE); deliver(k, w, true); } };
  // Gathering huts: run the full window first so new wood/stone is in stock for crafters. addStock only (not deliver) — same as tapping Clear.
  const hutGive = (k, n) => { if (n <= 0) return; const v = (frac[k]||0) + n, w = Math.floor(v); frac[k] = v - w; if (w){ addStock(k, w); try { gainXp(k, w); } catch(e){} } };
  for (const b of S.b){ if (BUILDINGS[b.type] && BUILDINGS[b.type].hut) flowHut(b, sec, hutGive); }
  while (t < sec - 1e-9){
    const dt = Math.min(FLOW_DT, sec - t); t += dt;
    for (const [id, r] of harv) give(id, r*dt);
    // demand of every input
    const need = {}; for (const c of craft) for (const k in c.r.in) need[k] = (need[k]||0) + c.r.in[k]*c.rate*dt;
    const availF = k => { const have = (st[k]||0) + (frac[k]||0); return Math.max(0, have - resv(k), Math.min(have - RESERVE, tok[k]||0)); };
    const sb = {}; for (const k in need) sb[k] = (st[k]||0) + (frac[k]||0);
    const ratio = {}; for (const k in need){ const avail = availF(k); ratio[k] = need[k] > 0 ? Math.min(1, avail/need[k]) : 1; }
    // a crafter short on one input leaves its share of the others for the rest: re-split once
    for (let pass=0; pass<2; pass++){
      const used = {}; for (const c of craft){ c.f = 1; for (const k in c.r.in) c.f = Math.min(c.f, ratio[k]); for (const k in c.r.in) used[k] = (used[k]||0) + c.r.in[k]*c.rate*dt*c.f; }
      if (pass) break;
      for (const k in need){ if (ratio[k] >= 1) continue; const avail = availF(k), u = used[k]||0;
        if (u < avail - 1e-9){ const want = {}; let wsum = 0; for (const c of craft) if (c.r.in[k] && c.f >= ratio[k] - 1e-12){ wsum += c.r.in[k]*c.rate*dt; }
          if (wsum > 0) ratio[k] = Math.min(1, ratio[k] + (avail - u)/wsum); } }
    }
    const made = {};
    for (const c of craft){ if (c.f <= 0) continue; const batches = c.rate*dt*c.f;
      for (const k in c.r.in){ const v = (st[k]||0) + (frac[k]||0) - c.r.in[k]*batches; st[k] = Math.floor(v); frac[k] = v - st[k]; }
      made[c.out] = (made[c.out]||0) + c.mul*batches; }
    for (const k in sb){ if (!tok[k]) continue; const usedK = sb[k] - ((st[k]||0) + (frac[k]||0)), over = Math.max(0, sb[k] - resv(k)); if (usedK > over) tok[k] = Math.max(0, tok[k] - (usedK - over)); }
    for (const k in made) give(k, made[k]);
  }
}
function offlineProgress(sec){
  const wall = sec; sec *= OFFLINE_RATE * boostMul(); if (!S.hub || sec <= 0) return [];
  const before = {...S.stock}, q0 = S.quest;
  const snap = {level:S.level|0, xp:S.xp|0, levelPp:S.levelPp|0, pp:S.pp|0};
  R.quiet = true; R.noXp = true; R.offline = true;
  try {
    const run = (t) => { if (t <= 0) return; if (t <= SIM_BUDGET){ const n = Math.max(1, Math.round(t/SIM_DT)); for (let i=0;i<n;i++) simulate(t/n); } else flowSim(t); };
    run(sec); if (S.stats) S.stats.playSec = (S.stats.playSec||0) + wall; // wall-clock hours for Never Sleeps; gains stay rate-nerfed
  } finally { R.quiet = false; R.noXp = false; R.offline = false; }
  // Belt-and-suspenders: never let a leaked gainXp call keep offline levels or milestone ✦.
  if ((S.level|0) !== snap.level || (S.xp|0) !== snap.xp || (S.levelPp|0) !== snap.levelPp){
    if ((S.levelPp|0) > snap.levelPp) S.pp = Math.max(snap.pp, (S.pp|0) - Math.max(0, ((S.level|0) - snap.level)));
    S.level = snap.level; S.xp = snap.xp; S.levelPp = snap.levelPp;
  }
  R.pendLv = null; // do not celebrate or surface offline levels
  for (const k in pendingGains) delete pendingGains[k]; R.x2.length = 0; R.parts.length = 0; R.floats.length = 0; R.hubPulse = 0;
  const gains = []; for (const k in S.stock){ if (!ITEMS[k]) continue; const d = Math.floor(S.stock[k] - (before[k]||0)); if (d>0) gains.push([k,d]); }
  gains.sort((a,b)=>b[1]-a[1]); gains.quests = S.quest - q0; R.dirty = true;
  return gains;
}
function catchUp(sec, popup){ // run offline progress for `sec` seconds away, then show the summary
  sec = Math.min(offCap(), sec); if (!S.hub || !S.b.length || sec < 2) return;
  const g = offlineProgress(sec); R.simClock = Date.now(); save();
  if (popup && sec >= 60 && g.length) welcomeBack(sec, g);
}

// ============================== SAVE / LOAD ==============================
const B_on = b => !!(b && BUILDINGS[b.type] && BUILDINGS[b.type].on);
function save(){
  if (!S) return;
  if (!Array.isArray(S.b)) S.b = [];
  if (!S.stock || typeof S.stock !== 'object') S.stock = {};
  try { S.landmarks = snapshotLandmarks(S); } catch(e){}
  S.last = R.simClock || Date.now(); // the last moment the factory was actually simulated
  const data = {...S, hub: S.hub && {uid:S.hub.uid,type:'hub',x:S.hub.x,y:S.hub.y}, b: S.b.filter(b=>b).map(b=>{
    const row = {uid:b.uid,type:b.type,x:b.x,y:b.y,recipe:b.recipe,buf:b.buf,outQ:b.outQ,paused:!!b.paused,lv:b.lv||1,tv:b.tv,tier:b.lv||1,dbl:0};
    if (BUILDINGS[b.type] && BUILDINGS[b.type].hut){
      if (b.axe) row.axe = b.axe|0; if (b.crew) row.crew = b.crew|0; if (b.reach) row.reach = b.reach|0;
      if (Array.isArray(b.workers) && b.workers.length) row.workers = b.workers.filter(Boolean).map(w => ({x:w.x,y:w.y,state:w.state,t:w.t||0,tx:w.tx,ty:w.ty,carry:w.carry||0,facing:w.facing,item:w.item}));
    }
    return row;
  })};
  // in-transit items are returned to the hub in the save so nothing is lost
  for (const b of S.b) if (b && b.hq && B_on(b)){ data.stock = data.stock===S.stock ? {...S.stock} : data.stock; const id = harvestItem(b); if (id) data.stock[id] = (data.stock[id]||0)+b.hq; }
  if (R.paths) for (const p of R.paths) if (p && p.items) for (const it of p.items){ data.stock = data.stock===S.stock ? {...S.stock} : data.stock; data.stock[it.id] = (data.stock[it.id]||0)+(it.n||1); }
  lsSet(slotKey(META.active), JSON.stringify(data));
}
// Fishing/Kitchen were removed (Nov 2026). Old saves: refund what was paid to build/upgrade them,
// move kitchen buffers to the Hub, keep leftover fish/meals hidden (not in ITEMS), and carry an
// active era-3/4 fish/meal quest over proportionally to the restored Stone/Brick quest.
const FISH_OLD = {fisherman:{wood:12, plank:3}, kitchen:{wood:25, plank:8, stone:10}};
const FISH_OLD_Q = {2:{item:'fish', n:50}, 3:{item:'meal', n:25}};
function migrateFishRemoval(st){
  if (!st || st.fishGone) return null;
  const rep = {removed:0, refund:{}, quest:null};
  const add = (k,n) => { n = Math.floor(n); if (n>0){ st.stock[k] = (st.stock[k]||0)+n; rep.refund[k] = (rep.refund[k]||0)+n; } };
  const thrift = Math.pow(0.9, (st.perks&&st.perks.thrift)||0), qs = 1 + 0.25*Math.max(0, (st.rebirths|0) - lastEraOf(st));
  const cnt = {};
  st.stock = st.stock || {};
  st.b = (st.b||[]).filter(b => {
    const base = b && FISH_OLD[b.type]; if (!base) return true;
    const i = cnt[b.type] = (cnt[b.type]|0); cnt[b.type]++;
    const m = growthMul(i) * thrift; for (const k in base) add(k, Math.ceil(base[k]*m));
    for (let l=2; l<=Math.min(MAX_LV, b.lv|0); l++) for (const k in base) add(k, Math.ceil(base[k]*LV_MUL[l]*qs));
    if (b.buf) for (const k in b.buf) if (ITEMS[k]) add(k, b.buf[k]);
    rep.removed++; return false;
  });
  if (st.built) for (const k of Object.keys(st.built)) if (k==='fisherman'||k==='kitchen'||k.startsWith('fisherman:')||k.startsWith('kitchen:')) delete st.built[k];
  const oq = FISH_OLD_Q[st.rebirths];
  if (oq && st.quest===0 && !st.finalDone && Array.isArray(st.unlocks) && st.unlocks.includes('b:fisherman')){
    const pq = paceQuest(st.rebirths), oldN = Math.ceil(oq.n*pq), newN = Math.ceil(ERAS[st.rebirths].q.n*pq);
    const f = Math.max(0, Math.min(1, (st.qprog||0)/oldN));
    const np = Math.min(newN-1, Math.floor(f*newN));
    rep.quest = {from:oq.item, oldProg:st.qprog||0, oldN, to:ERAS[st.rebirths].q.item, newProg:np, newN};
    st.qprog = np;
  }
  st.fishGone = 1; st.fishMigr = rep; return rep;
}

// Gathering huts (Woodcutter's Hut / Quarry Hut, Nov 2026) were removed.
// Old saves: refund 50 ✦ per bought perk, remove placed huts, refund build cost like
// demolish (half of what was paid, with thrift / count growth), and drop any carried
// resources into stock. Tiles already cleared stay cleared.
const HUT_OLD_COST = {woodHut:{wood:35}, rockHut:{stone:35}};
const HUT_OLD_ITEM = {woodHut:'wood', rockHut:'stone'};
function migrateHutRemoval(st){
  if (!st) return null;
  const isOldHut = b => b && (b.type==='woodHut' || b.type==='rockHut');
  const strip = () => {
    if (st.b) st.b = st.b.filter(b => !isOldHut(b));
    if (st.built) for (const k of Object.keys(st.built)) if (k==='woodHut'||k==='rockHut'||k.startsWith('woodHut:')||k.startsWith('rockHut:')) delete st.built[k];
    if (st.perks){ delete st.perks.woodHut; delete st.perks.rockHut; }
  };
  // Already migrated (v27 refund). Do NOT strip again — a player may have re-bought the perk and placed new huts.
  if (st.hutsGone) return st.hutsMigr || null;
  const rep = {removed:0, refund:{}, pp:0, carry:{}};
  const add = (k, n, bag) => { n = Math.floor(n); if (n>0){ st.stock = st.stock || {}; st.stock[k] = (st.stock[k]||0)+n; bag[k] = (bag[k]||0)+n; } };
  const thrift = Math.pow(0.9, (st.perks && st.perks.thrift)||0);
  st.perks = st.perks || {};
  for (const id of ['woodHut','rockHut']){
    const n = st.perks[id]|0;
    if (n>0){ const pts = 50*n; st.pp = (st.pp|0)+pts; rep.pp += pts; }
  }
  const byType = {woodHut:[], rockHut:[]};
  for (const b of (st.b||[])) if (isOldHut(b)) byType[b.type].push(b);
  for (const type of ['woodHut','rockHut']){
    const list = byType[type], base = HUT_OLD_COST[type], item = HUT_OLD_ITEM[type];
    // demolish-like: refund the last-placed hut first so growthMul matches costOf after decrement
    for (let i=list.length-1;i>=0;i--){
      const b = list[i], m = growthMul(i) * thrift;
      for (const k in base) add(k, Math.floor(Math.ceil(base[k]*m)/2), rep.refund);
      if (b.workers) for (const w of b.workers){
        const n = (w && w.carry)|0; if (n>0) add((w.item && (w.item===item))?w.item:item, n, rep.carry);
      }
      rep.removed++;
    }
  }
  strip();
  st.hutsGone = 1; st.hutsMigr = rep; return rep;
}

// Ore Survey perk was removed. Old saves: refund 10 ✦ per owned level and drop the perk
// (and any S.surveyed flag). Idempotent.
function migrateSurveyRemoval(st){
  if (!st) return null;
  const strip = () => {
    if (st.perks) delete st.perks.survey;
    if ('surveyed' in st) delete st.surveyed;
  };
  if (st.surveyGone){ strip(); return st.surveyMigr || null; }
  const n = (st.perks && st.perks.survey)|0;
  const pts = 10 * n;
  if (pts) st.pp = (st.pp|0) + pts;
  const rep = {pp:pts, levels:n};
  strip();
  st.surveyGone = 1; st.surveyMigr = rep; return rep;
}
function load(){
  // Never let a corrupt field or a failed migration blank the screen. Repair in place; never replace a real save with a fresh one.
  const keep = S; // if we already had a live state, fall back to it rather than wiping
  try {
    if (!META) initSlots();
    const d = slotData(META.active);
    if (d){
      S = d; if ('upg' in S){ delete S.upg; } S.asc = S.asc|0; if (S.terrGen == null) S.terrGen = TERR_GEN_LAND;
      retainInit(S);
      try { migrateFishRemoval(S); } catch(e){}
      try { migrateHutRemoval(S); } catch(e){}
      try { migrateSurveyRemoval(S); } catch(e){}
      try { const rf = migrateHubExtPrice(S); if (rf){ let n = 0; const tick = () => { try {
        // wait until no popup (daily spin / sheet / welcome) is covering the screen, so the refund is actually seen
        const d = document.getElementById('daily'), busy = (d && d.classList.contains('show')) || (sheetWrap && sheetWrap.classList.contains('open'));
        if (busy && ++n < 120){ setTimeout(tick, 1000); return; }
        toast(`🏛️ Hub Extension now costs ${HUBEXT_PP} ✦ — ${rf} ✦ refunded`, 4200);
      } catch(e){} }; setTimeout(tick, 1600); } } catch(e){}
      retainInit(S);
      try { S.unlocks = eraUnlocks(S.rebirths); } catch(e){ S.unlocks = S.unlocks || []; }
    } else { const snd = S ? S.sound : true; S = freshState(); S.sound = snd; }
    retainInit(S);
    try { setupWorld(); } catch(e){
      try { if (!R.terr) R.terr = genMap(S.seed, S.rebirths, S.terrGen); rebuildOcc(); renderTerrain(); } catch(e2){}
    }
    if (!Array.isArray(S.b)) S.b = [];
    for (const b of S.b){ try { migrateBuildingLv(b); b.tier = b.lv; b.dbl = 0; b.t=0; b.buf=b.buf||{}; b.outQ=b.outQ||0; b.craftT=0; b.crafting=false; b.born=-9; } catch(e){} }
    try { hutRelink(); } catch(e){}
    try { recountBuilt(); } catch(e){}
    // setupWorld already routed everyone. Only re-route if a building is still missing a belt
    // (e.g. setupWorld threw early). Never route again blindly — that used to leave a second
    // copy of every belt in R.paths (two belts on the same tiles).
    if (S.hub){ try { if ((S.b||[]).some(needsBelt) && (S.b||[]).some(b => needsBelt(b) && !b.outPath)) routeAllBuildings(); } catch(e){} }
    // catch up BEFORE save — save() stamps S.last=now and would wipe the offline window
    const away = Math.min(offCap(), Math.max(0, (Date.now() - (S.last||Date.now()))/1000));
    R.simClock = Date.now();
    if (S.hub && S.b.length && away >= 2){
      let g = [];
      try { g = offlineProgress(away) || []; } catch(e){ g = []; }
      R.simClock = Date.now();
      if (away >= 60 && g.length) setTimeout(() => { try { welcomeBack(away, g); } catch(e){} }, 400);
    }
    // persist repaired fields (wear defaults, missing arrays) — not a wipe
    try { save(); } catch(e){}
  } catch(e){
    // Keep whatever valid factory we have. Never overwrite the slot with a blank freshState.
    if (!S || typeof S !== 'object') S = keep && keep.hub ? keep : (dSafe() || freshState());
    try { retainInit(S); } catch(e2){}
    try { if (!R.terr) setupWorld(); } catch(e2){}
    R.dirty = true;
  }
  if (S && S.hub){ cam.x = S.hub.x+1.5; cam.y = S.hub.y+1.5; } else { cam.x = MAP_W/2; cam.y = MAP_H/2; }
  cam.vx = cam.vy = 0; R.dirty = true;
  try { ensureEvents(); } catch(e){}
  if (needsEraNews()) offerEraNewsSoon();
}
function dSafe(){ try { return slotData(META && META.active || 1); } catch(e){ return null; } }
// switching slots: save the one you're playing, then load (and catch up) the other one
function switchSlot(n){
  if (n === META.active) return;
  save(); closeSheet();
  META.active = n; writeMeta();
  load();
  if (!slotData(n)) save(); // a brand-new game gets written right away
  R.dirty = true;
  // Eligible daily (or pending result) after loading another / empty slot
  R.pendingDaily = !S.hub && !!dailyState();
  offerDailySoon(!!S.hub);
}
function deleteSlot(n){ if (n === META.active) return false; try { localStorage.removeItem(slotKey(n)); } catch(e){} delete META.names[n]; writeMeta(); return true; }
function renameSlot(n, name){ name = String(name||'').trim().slice(0, 20); if (name && name !== 'Slot '+n) META.names[n] = name; else delete META.names[n]; writeMeta(); }
function ago(t){ const s = Math.max(0, (Date.now()-t)/1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s/60)+'m ago'; if (s < 86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }
function migrateMapCoords(){
  // old maps were 46×46 centred near (23,23); shift an in-progress factory onto the new 200×200 centre
  if (!S || !S.hub) return false;
  if (S.hub.x > 60 || S.mapW === MAP_W) { S.mapW = MAP_W; return false; }
  const ox = (MAP_W>>1) - 23, oy = (MAP_H>>1) - 23;
  const shiftB = b => { b.x += ox; b.y += oy; };
  shiftB(S.hub); for (const b of S.b) shiftB(b);
  if (Array.isArray(S.cleared) && S.cleared.length){
    const OLD=46; S.cleared = S.cleared.map(i => { const x=(i%OLD)+ox, y=((i/OLD)|0)+oy; return (x>=0&&y>=0&&x<MAP_W&&y<MAP_H) ? y*MAP_W+x : -1; }).filter(i=>i>=0);
  }
  if (S.hutWear && typeof S.hutWear === 'object'){
    const OLD=46, nw = {};
    for (const [k,v] of Object.entries(S.hutWear)){
      const i=+k, x=(i%OLD)+ox, y=((i/OLD)|0)+oy, left=v|0;
      if (x>=0&&y>=0&&x<MAP_W&&y<MAP_H && left>0 && left<HUT_HITS) nw[y*MAP_W+x] = left;
    }
    S.hutWear = nw;
  }
  S.mapW = MAP_W; S.migratedMap = 1; return true;
}
// After map regen/migration, harvesters may sit on grass — stamp their resource back and remember b.tv
function defaultHarvTv(b){
  const B = BUILDINGS[b.type]; if (!B || !B.on) return null;
  if (b.type==='cutter' || b.type==='megaCutter') return TREE;
  if (b.type==='quarry' || b.type==='megaQuarry') return STONE;
  // drills / mega drills: prefer saved tv, else first unlocked ore under ASC/era
  if (b.tv != null && B.on.includes(b.tv)) return b.tv;
  for (const tv of ORE_T){ if (B.on.includes(tv) && (!RES[tv].unlock || has(RES[tv].unlock))) return tv; }
  return B.on[0];
}
function repairHarvesterTerrain(){
  if (!S || !R.terr) return 0;
  let fixed = 0;
  const under = new Set(); // indices we stamp — must not stay in cleared[]
  for (const b of S.b){
    const B = BUILDINGS[b.type]; if (!B || !B.on) continue;
    let tv = (b.tv != null && B.on.includes(b.tv)) ? b.tv : null;
    if (tv == null){
      for (const [x,y] of footprint(b.type,b.x,b.y)){
        if (!inMap(x,y)) continue;
        const t = R.terr[idx(x,y)]; if (B.on.includes(t)){ tv = t; break; }
      }
    }
    if (tv == null) tv = defaultHarvTv(b);
    if (tv == null) continue;
    b.tv = tv;
    let need = false;
    for (const [x,y] of footprint(b.type,b.x,b.y)){
      if (!inMap(x,y)) continue;
      const i = idx(x,y), cur = R.terr[i];
      if (B.mega){
        // keep water; stamp resource on grass/wrong tiles so mega still covers ≥1 patch
        if (cur === WATER) continue;
        if (!B.on.includes(cur)){ R.terr[i] = tv; need = true; }
      } else {
        if (cur !== tv){ R.terr[i] = tv; need = true; }
      }
      under.add(i);
    }
    if (need) fixed++;
  }
  if (under.size && Array.isArray(S.cleared) && S.cleared.length){
    S.cleared = S.cleared.filter(i => !under.has(i));
  }
  if (fixed){ if (R.chunkCache) R.chunkCache.clear(); R.ov = null; }
  return fixed;
}
// Outer-ring resource fill (land maps). Uses seed^0x0A11CE so core genMap RNG is untouched.
// canStamp=null → new maps (any grass). Otherwise only empty grass, not occupied/cleared/hub plaza.
function paintOuterResources(t, seed, era, canStamp){
  const r = rng(((seed|0) ^ 0x0A11CE) >>> 0);
  const cx = MAP_W/2, cy = MAP_H/2;
  const ok = canStamp || ((x,y) => {
    if (x<2||y<2||x>=MAP_W-2||y>=MAP_H-2) return false;
    return t[y*MAP_W+x] === GRASS;
  });
  const stamp = (type, x0, y0, size) => {
    let x=x0, y=y0, n=0;
    for (let i=0;i<size;i++){
      const rad = 1+(r()*1.2|0);
      for (let dy=-rad;dy<=rad;dy++) for (let dx=-rad;dx<=rad;dx++){
        if (dx*dx+dy*dy > rad*rad+0.5) continue;
        const X=Math.round(x)+dx, Y=Math.round(y)+dy;
        if (!ok(X,Y)) continue;
        if (r() < 0.88){ t[Y*MAP_W+X] = type; n++; }
      }
      x += (r()-0.5)*2.2; y += (r()-0.5)*2.2;
    }
    return n;
  };
  const edgePick = () => {
    const side = (r()*4)|0;
    if (side===0) return [4+r()*18, 10+r()*(MAP_H-20)];
    if (side===1) return [MAP_W-22+r()*18, 10+r()*(MAP_H-20)];
    if (side===2) return [10+r()*(MAP_W-20), 4+r()*18];
    return [10+r()*(MAP_W-20), MAP_H-22+r()*18];
  };
  const un = eraUnlocks(era|0);
  let added = 0;
  for (let i=0;i<16;i++){ const [x,y]=edgePick(); added += stamp(TREE, x, y, 3); }
  for (let i=0;i<12;i++){ const a=r()*Math.PI*2, d=68+r()*30; added += stamp(TREE, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 3); }
  if (un.includes('res:stone')){
    for (let i=0;i<10;i++){ const [x,y]=edgePick(); added += stamp(STONE, x, y, 3); }
    for (let i=0;i<8;i++){ const a=r()*Math.PI*2, d=70+r()*28; added += stamp(STONE, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 2); }
  }
  for (const k of Object.keys(RES_BY_KEY).filter(k => k!=='wood' && k!=='stone')){
    if (!un.includes('res:'+k)) continue;
    const tv = RES_BY_KEY[k];
    for (let i=0;i<5;i++){ const [x,y]=edgePick(); added += stamp(tv, x, y, 2); }
    for (let i=0;i<4;i++){ const a=r()*Math.PI*2, d=74+r()*25; added += stamp(tv, cx+Math.cos(a)*d, cy+Math.sin(a)*d, 2); }
  }
  return added;
}
function migrateOuterResources(){
  // Re-apply every load: genMap regenerates the base map; this deterministic pass only
  // stamps empty grass (never occupied / cleared / hub plaza). Islands skip.
  if (!S || !R.terr) return false;
  if (S.terrGen === TERR_GEN_ISLANDS){ S.outerResV = 1; return false; }
  const cleared = new Set(Array.isArray(S.cleared) ? S.cleared : []);
  const canStamp = (x,y) => {
    if (!inMap(x,y)) return false;
    const i = idx(x,y);
    if (R.terr[i] !== GRASS) return false;
    if (R.occ && R.occ[i]) return false;
    if (cleared.has(i)) return false;
    if (S.hub && Math.hypot(x - (S.hub.x+1.5), y - (S.hub.y+1.5)) < 5) return false;
    return true;
  };
  const added = paintOuterResources(R.terr, S.seed, S.rebirths, canStamp);
  S.outerResV = 1;
  if (added){ if (R.chunkCache) R.chunkCache.clear(); R.ov = null; R.dirty = true; }
  return added > 0;
}

// Keep the Main Hub (and Hub Extensions) off the map rim. A 3×3 Hub slammed into
// y=MAP_H-3 sits under the iPhone bottom bar, and belts from the central resource
// ring can fail to reach it ("No room for a belt to reach the Hub").
function hubEdgePad(type){
  if (type==='hub') return HUB_EDGE;
  if (BUILDINGS[type] && BUILDINGS[type].hubExt) return Math.max(4, HUB_EDGE-2);
  return 0;
}
function hubFits(x, y, type){
  const s = ((BUILDINGS[type||'hub']||{}).size)||3, m = hubEdgePad(type||'hub');
  return x>=m && y>=m && x+s<=MAP_W-m && y+s<=MAP_H-m;
}
function hubEdgeErr(type, x, y){
  const m = hubEdgePad(type); if (!m) return null;
  if (hubFits(x, y, type)) return null;
  return type==='hub' ? 'Too close to the map edge — leave room for belts' : 'Too close to the map edge';
}
function clampHubPlace(x, y, type){
  const s = ((BUILDINGS[type||'hub']||{}).size)||3, m = hubEdgePad(type||'hub');
  x = Math.max(m, Math.min(MAP_W-s-m, x|0));
  y = Math.max(m, Math.min(MAP_H-s-m, y|0));
  return [x, y];
}
function findHubSafeSpot(ignoreUid){
  const cx = (MAP_W>>1) - 1, cy = (MAP_H>>1) - 1; // 3×3 covers 99–101, centred on the plaza
  const tryAt = (x, y) => {
    x = x|0; y = y|0;
    if (!hubFits(x, y, 'hub')) return null;
    if (!placeCheck('hub', x, y, ignoreUid)) return [x, y];
    return null;
  };
  const hit = tryAt(cx, cy); if (hit) return hit;
  for (let r=1; r<=90; r++){
    for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++){
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const s = tryAt(cx+dx, cy+dy); if (s) return s;
    }
  }
  return null;
}
function moveHubTo(x, y, opts){
  if (!S || !S.hub) return false;
  const err = placeCheck('hub', x, y, S.hub.uid);
  if (err){ if (!(opts && opts.quiet)) toast(err); return false; }
  S.hub.x = x|0; S.hub.y = y|0;
  rebuildOcc();
  if (!(opts && opts.route===false)){
    try { routeAllBuildings(); } catch(e){ for (const b of (S.b||[])) try { routeBuildingSafe(b); } catch(e2){} }
  }
  R.dirty = true;
  if (!(opts && opts.save===false)) try { save(); } catch(e){}
  return true;
}
function migrateHubFromEdge(){
  // Existing saves (including live 1.0.1) could place the Hub on the last legal row.
  // Move it to a roomy interior spot once; stock stays, belts are rebuilt by setupWorld.
  if (!S || !S.hub || !R.terr) return false;
  if (hubFits(S.hub.x, S.hub.y, 'hub')) return false;
  const spot = findHubSafeSpot(S.hub.uid);
  if (!spot) return false;
  if (!moveHubTo(spot[0], spot[1], {quiet:1, route:false, save:false})) return false;
  S.hubEdgeFix = (S.hubEdgeFix|0) + 1;
  const nB = (S.b||[]).filter(needsBelt).length;
  setTimeout(() => { try { toast('Your Hub was on the map edge, so we moved it to open ground. Resources are safe'+(nB ? '; belts reconnected.' : '.'), 4400); } catch(e){} }, 800);
  return true;
}
function startHubMove(){
  if (!S || !S.hub){ toast('Place your Main Hub first', 2200); return false; }
  R.moveHub = {x:S.hub.x, y:S.hub.y, uid:S.hub.uid};
  R.sel = {ghost:{type:'hub', x:S.hub.x, y:S.hub.y}};
  // Lift belts off the old tile so the pickup is obvious; in-transit goods go back to stock.
  for (const b of (S.b||[])) try { unroute(b); } catch(e){}
  zoomTo(S.hub.x+1.5, S.hub.y+1.5, 44);
  S.hub.pop = 1;
  toast('Tap a new open spot for your Hub · tap the old Hub to cancel', 3200);
  R.dirty = true;
  return true;
}
function endHubMove(){ R.moveHub = null; if (R.sel && R.sel.ghost && R.sel.ghost.type==='hub') R.sel = null; R.dirty = true; }
function cancelHubMove(){
  if (R.moveHub && S && S.hub){
    S.hub.x = R.moveHub.x; S.hub.y = R.moveHub.y;
    rebuildOcc();
    try { routeAllBuildings(); } catch(e){}
  }
  endHubMove();
  return true;
}
function openHubMovePlace(x, y){
  if (!S || !S.hub || !R.moveHub) return;
  [x, y] = clampHubPlace(x, y, 'hub');
  R.sel = {ghost:{type:'hub', x, y}};
  const err = placeCheck('hub', x, y, S.hub.uid);
  openSheet(`<h2>Move Hub</h2><div class="sub">Everything in storage comes with it. Belts will reconnect to the new spot.</div>
    ${err?`<div class="sub" style="color:#d63031">${err}. Tap another spot.</div>`:''}
    <div class="row"><button class="btn gray" data-a="x">Cancel</button><button class="btn green" data-a="ok" ${err?'disabled':''}>Place Hub Here</button></div>`,
    () => { if (R.moveHub) R.sel = {ghost:{type:'hub', x:R.moveHub.x, y:R.moveHub.y}}; });
  sheet.querySelector('[data-a=x]').onclick = () => { closeSheet(); cancelHubMove(); toast('Hub stayed put', 1800); };
  sheet.querySelector('[data-a=ok]').onclick = () => {
    if (!moveHubTo(x, y)) return;
    endHubMove(); closeSheet();
    zoomTo(S.hub.x+1.5, S.hub.y+1.5, 44);
    S.hub.pop = 1;
    toast('Hub moved — belts reconnected. Storage is safe.', 2800);
  };
}

function setupWorld(){
  R.multi = null; if (typeof multiBar==='function' && mbar) multiBar();
  migrateMapCoords();
  if (S.terrGen == null) S.terrGen = TERR_GEN_LAND; // freeze pre-island saves on classic land
  R.terr = genMap(S.seed, S.rebirths, S.terrGen);
  if (!Array.isArray(S.cleared)) S.cleared = [];
  for (const i of S.cleared) if (i>=0 && i<R.terr.length && R.terr[i]>=TREE) R.terr[i] = GRASS;
  R.paths = []; R.parts = []; R.floats = []; R.x2 = []; R.sel = null; R.chunkCache = new Map(); R.ov = null;
  rebuildOcc(); // before outer migrate so we never stamp under buildings
  repairHarvesterTerrain(); // re-stamp trees/ore under migrated (or any orphaned) harvesters
  migrateOuterResources(); // add outer-edge patches on empty grass only (land saves; once)
  try { repairIslandResources(); } catch(e){}
  recountBelts();
  try { restoreLandmarks(); } catch(e){}
  try { migrateLandmarkScale(); } catch(e){}
  try { migrateHubFromEdge(); } catch(e){}
  try { routeAllBuildings(); } catch(e){ for (const b of allB()) try { routeBuildingSafe(b); } catch(e2){} }
  renderTerrain();
}


// ============================== LANDMARKS (cosmetic buildings) ==============================
function snapshotLandmarks(st){
  st = st || S;
  const fromB = (st && Array.isArray(st.b) ? st.b : []).filter(isLandB).map(b => ({type:b.type, x:b.x, y:b.y}));
  if (fromB.length) return fromB;
  return (st && Array.isArray(st.landmarks)) ? st.landmarks.map(lm => ({type:lm.type, x:lm.x, y:lm.y})) : [];
}
function findLandSpot(type, x, y, ignoreUid){
  if (!placeCheck(type, x, y, ignoreUid)) return [x, y];
  for (let r=1; r<=48; r++){
    for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++){
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (!placeCheck(type, x+dx, y+dy, ignoreUid)) return [x+dx, y+dy];
    }
  }
  return null;
}
function restoreLandmarks(){
  if (!S) return;
  if ((S.b||[]).some(isLandB)) return;
  const list = S.landmarks || [];
  if (!list.length) return;
  for (const lm of list){
    if (!isLandType(lm.type)) continue;
    const spot = findLandSpot(lm.type, lm.x|0, lm.y|0);
    if (!spot) continue;
    S.b.push({uid:S.uid++, type:lm.type, x:spot[0], y:spot[1], lv:1, tier:1, dbl:0, recipe:null, t:0, buf:{}, outQ:0, craftT:0, crafting:false, born:R.time||0, land:1});
  }
  rebuildOcc();
  S.landmarks = snapshotLandmarks(S);
}
const LAND_OLD_SIZE = {landWindmill:2, landClock:2, landWater:2, landStatue:2, landSpire:2, landGate:3, landCathedral:3, landObservatory:3, landRocket:3};
function landFitErr(type, x, y, ignoreUid, relax){
  const B = BUILDINGS[type]; if (!B) return 'Unknown building';
  let water=0, blocked=0, n=0;
  for (const [fx,fy] of footprint(type,x,y)){
    n++;
    if (!inMap(fx,fy)) return 'Off the map';
    const i = idx(fx,fy), tv = R.terr ? R.terr[i] : GRASS;
    if (tv===WATER){ water++; if (!relax) return "Can't build on water"; }
    else if (tv!==GRASS && !relax) return 'Needs open grass';
    const o = R.occ && R.occ[i];
    if (o && o !== ignoreUid){ blocked++; if (!relax) return 'Something is already here'; }
  }
  if (relax && n && water === n) return "Can't build on water";
  return null;
}
function migrateLandmarkScale(){
  // v55: footprints doubled. Re-anchor existing placements; if the bigger footprint
  // still can't sit cleanly, keep the landmark placed (cosmetic overlap on grass/belts is OK). Never drop one.
  if (!S || (S.landScaleV|0) >= 2) return false;
  const list = (S.b||[]).filter(isLandB);
  if (R.occ == null) try { rebuildOcc(); } catch(e){}
  for (const b of list){
    const typ = b.type, old = LAND_OLD_SIZE[typ] || 2, neu = (BUILDINGS[typ]&&BUILDINGS[typ].size) || old;
    const shift = Math.max(0, Math.floor((neu-old)/2));
    const ox = b.x|0, oy = b.y|0, ignore = b.uid;
    const tries = [[ox-shift, oy-shift],[ox,oy],[ox-(neu-old), oy-(neu-old)]];
    let found = null;
    for (const [x,y] of tries){ if (!landFitErr(typ, x, y, ignore, false)){ found=[x,y]; break; } }
    if (!found){
      found = findLandSpot(typ, ox-shift, oy-shift, ignore) || findLandSpot(typ, ox, oy, ignore);
    }
    if (!found){
      for (let r=1; r<=48 && !found; r++){
        for (let dy=-r; dy<=r && !found; dy++) for (let dx=-r; dx<=r; dx++){
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!landFitErr(typ, ox-shift+dx, oy-shift+dy, ignore, true)){ found=[ox-shift+dx, oy-shift+dy]; break; }
        }
      }
    }
    if (found){ b.x = found[0]; b.y = found[1]; }
    else {
      const s = neu;
      b.x = Math.max(1, Math.min(MAP_W-s-1, ox-shift));
      b.y = Math.max(1, Math.min(MAP_H-s-1, oy-shift));
    }
  }
  S.landScaleV = 2;
  try { S.landmarks = snapshotLandmarks(S); } catch(e){}
  try { rebuildOcc(); } catch(e){}
  return true;
}
function startLandmarkPlace(type){
  if (!isLandType(type) || !cosOwned(type)) return;
  R.placeLand = type; R.moveLand = null;
  const mid = S && S.hub ? [Math.round(S.hub.x), Math.round(S.hub.y)] : [Math.floor(cam.x), Math.floor(cam.y)];
  const spot = findLandSpot(type, mid[0], mid[1]) || mid;
  R.sel = {ghost:{type, x:spot[0], y:spot[1]}};
  toast('Tap open grass to place the '+(BUILDINGS[type].name)+' · looks only, no production', 3200);
}
function finishLandmarkTap(tx, ty){
  const moving = R.moveLand;
  const type = moving ? moving.type : R.placeLand;
  if (!isLandType(type)){ R.placeLand = R.moveLand = null; return; }
  const cells = footprint(type, 0, 0);
  const cands = cells.map(([dx,dy]) => [tx-dx, ty-dy]);
  const ignore = moving ? moving.uid : 0;
  const spot = cands.find(([a,c]) => !placeCheck(type, a, c, ignore)) || cands[0];
  const err = placeCheck(type, spot[0], spot[1], ignore);
  if (err){ toast(err); return; }
  if (moving){
    moving.x = spot[0]; moving.y = spot[1];
    rebuildOcc(); R.dirty = true; save();
    toast('Moved the '+(BUILDINGS[type].name));
  } else {
    const b = {uid:S.uid++, type, x:spot[0], y:spot[1], lv:1, tier:1, dbl:0, recipe:null, t:0, buf:{}, outQ:0, craftT:0, crafting:false, born:R.time||0, land:1};
    S.b.push(b); rebuildOcc();
    puff(spot[0] + BUILDINGS[type].size/2, spot[1] + BUILDINGS[type].size/2, BUILDINGS[type].top, 14);
    sfx('build'); vibrate(12); if (S.stats) statAdd('built'); save();
    toast((BUILDINGS[type].name)+' placed · looks only');
  }
  R.placeLand = R.moveLand = null; R.sel = null; R.dirty = true;
}
function cancelLandmarkMode(){ R.placeLand = R.moveLand = null; R.sel = null; }
function openLandmarkInfo(b){
  const B = BUILDINGS[b.type];
  openSheet(`<h2>${B.name}</h2>
    <div class="sub">Landmark · looks only · no production · belts can pass through</div>
    <div class="sec"><div class="st">What it is</div>
      <div class="sub" style="margin:0">${B.desc}</div>
      <div class="sub" style="margin-top:8px">You can place more than one. Removing it does not refund the Style Shop purchase — you still own it.</div>
    </div>
    <div class="sec rm"><span class="st" style="margin:0">Move or remove</span>
      <button class="btn" data-a="mv">Move</button>
      <button class="btn red" data-a="demo">🗑 Remove</button>
    </div>
    <div class="row"><button class="btn" data-a="x">Done</button></div>`);
  sheet.querySelector('[data-a=x]').onclick = closeSheet;
  sheet.querySelector('[data-a=mv]').onclick = () => { closeSheet(); R.moveLand = b; R.placeLand = null; R.sel = {ghost:{type:b.type, x:b.x, y:b.y}}; toast('Tap a new grassy spot to move it', 2600); };
  const dbtn = sheet.querySelector('[data-a=demo]');
  dbtn.onclick = () => { if (dbtn.dataset.c){ demolish(b); closeSheet(); } else { dbtn.dataset.c = 1; dbtn.textContent = 'Tap again to remove'; } };
}

function landSmoke(b, ox, oy){
  if (cam.z < 12) return;
  if (Math.random() < 0.035*(60/Math.max(30, fps||60))){
    R.parts.push({x:b.x+ox, y:b.y+oy, vx:(Math.random()-.5)*.18, vy:-.55, life:2, max:2, col:'rgba(230,230,235,', size:.2, smoke:true});
  }
}
function drawLandmark(b){
  const B = BUILDINGS[b.type]; if (!B) return;
  const z = cam.z, sz = B.size;
  const u = z*2; // art fills the doubled footprint with a tall, imposing silhouette
  const [sx,sy] = toScreen(b.x, b.y); const w = sz*z;
  if (sx>W+w||sy>H+w*2.4||sx<-w*2||sy<-w*3) return;
  const cx = sx + w/2, cy = sy + w*0.62;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(cx, sy+w*0.86, w*0.36, u*0.16, 0, 0, 7); ctx.fill();
  const tm = R.time||0;
  const t = b.type;
  if (t==='landWindmill'){
    // body + cap + spinning blades
    ctx.fillStyle='#8d6e4c'; rr(ctx, cx-u*0.28, sy+u*0.7, u*0.56, u*1.05, u*0.08); ctx.fill();
    ctx.fillStyle='#f0e0b8'; rr(ctx, cx-u*0.36, sy+u*0.35, u*0.72, u*0.7, u*0.1); ctx.fill();
    ctx.fillStyle='#c0392b'; ctx.beginPath(); ctx.moveTo(cx-u*0.42, sy+u*0.42); ctx.lineTo(cx, sy+u*0.08); ctx.lineTo(cx+u*0.42, sy+u*0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#ffeaa7'; rr(ctx, cx-u*0.12, sy+u*1.15, u*0.24, u*0.36, u*0.05); ctx.fill();
    ctx.save(); ctx.translate(cx, sy+u*0.55); ctx.rotate(tm*1.3);
    for (let i=0;i<4;i++){
      ctx.rotate(Math.PI/2);
      ctx.fillStyle=i%2?'#ecf0f1':'#dfe6ee';
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(u*0.12, -u*0.08); ctx.lineTo(u*0.12, -u*0.95); ctx.lineTo(-u*0.12, -u*0.95); ctx.lineTo(-u*0.12, -u*0.08); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#7f8c8d'; ctx.lineWidth=Math.max(1,u*0.03); ctx.stroke();
    }
    ctx.fillStyle='#c0392b'; ctx.beginPath(); ctx.arc(0,0,u*0.1,0,7); ctx.fill();
    ctx.restore();
  } else if (t==='landClock'){
    ctx.fillStyle='#6d5c4b'; rr(ctx, cx-u*0.42, sy+u*0.55, u*0.84, u*1.25, u*0.08); ctx.fill();
    ctx.fillStyle='#c9b8a0'; rr(ctx, cx-u*0.5, sy+u*0.15, u*1.0, u*0.85, u*0.1); ctx.fill();
    ctx.fillStyle='#8e2c2c'; ctx.beginPath(); ctx.moveTo(cx-u*0.55, sy+u*0.22); ctx.lineTo(cx, sy-u*0.35); ctx.lineTo(cx+u*0.55, sy+u*0.22); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff8e8'; ctx.beginPath(); ctx.arc(cx, sy+u*0.52, u*0.32, 0, 7); ctx.fill();
    ctx.strokeStyle='#2d3436'; ctx.lineWidth=Math.max(1.5,u*0.04); ctx.stroke();
    const angH = tm*0.15, angM = tm*1.2;
    ctx.strokeStyle='#2d3436'; ctx.lineCap='round';
    ctx.lineWidth=Math.max(2,u*0.06); ctx.beginPath(); ctx.moveTo(cx,sy+u*0.52); ctx.lineTo(cx+Math.sin(angH)*u*0.16, sy+u*0.52-Math.cos(angH)*u*0.16); ctx.stroke();
    ctx.lineWidth=Math.max(1.4,u*0.04); ctx.beginPath(); ctx.moveTo(cx,sy+u*0.52); ctx.lineTo(cx+Math.sin(angM)*u*0.24, sy+u*0.52-Math.cos(angM)*u*0.24); ctx.stroke();
    ctx.fillStyle='#2d3436'; ctx.beginPath(); ctx.arc(cx, sy+u*0.52, u*0.05,0,7); ctx.fill();
    ctx.fillStyle='#ffeaa7'; rr(ctx, cx-u*0.14, sy+u*1.35, u*0.28, u*0.32, u*0.04); ctx.fill();
  } else if (t==='landWater'){
    ctx.fillStyle='#3d566e';
    for (const px of [-0.32, 0.22]){ ctx.fillRect(cx+px*u, sy+u*1.05, u*0.12, u*0.7); }
    ctx.fillStyle='#dfe6ee'; rr(ctx, cx-u*0.55, sy+u*0.28, u*1.1, u*0.9, u*0.18); ctx.fill();
    ctx.fillStyle='#74b9ff'; rr(ctx, cx-u*0.46, sy+u*0.4, u*0.92, u*0.62, u*0.14); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.45)'; rr(ctx, cx-u*0.32, sy+u*0.48, u*0.55, u*0.16, u*0.08); ctx.fill();
    ctx.fillStyle='#636e72'; rr(ctx, cx-u*0.1, sy+u*0.12, u*0.2, u*0.22, u*0.04); ctx.fill();
    if (z>=14 && (Math.sin(tm*6)+1)/2 > 0.65){
      ctx.fillStyle='rgba(116,185,255,.7)'; ctx.beginPath(); ctx.arc(cx+u*0.38, sy+u*1.05, u*0.05,0,7); ctx.fill();
    }
  } else if (t==='landGate'){
    const gw = w, gh = u*2;
    ctx.fillStyle='#5d4630'; rr(ctx, sx+u*0.08, sy+u*0.85, u*0.7, u*1.15, u*0.1); ctx.fill();
    rr(ctx, sx+w-u*0.78, sy+u*0.85, u*0.7, u*1.15, u*0.1); ctx.fill();
    ctx.fillStyle='#bfa078'; rr(ctx, sx+u*0.05, sy+u*0.2, w-u*0.1, u*0.85, u*0.12); ctx.fill();
    // arch opening
    ctx.fillStyle='#1a1520'; ctx.beginPath(); ctx.moveTo(cx-u*0.7, sy+u*2.0); ctx.lineTo(cx-u*0.7, sy+u*1.05); ctx.quadraticCurveTo(cx, sy+u*0.45, cx+u*0.7, sy+u*1.05); ctx.lineTo(cx+u*0.7, sy+u*2.0); ctx.closePath(); ctx.fill();
    const glow = 0.55+0.45*Math.sin(tm*3);
    ctx.fillStyle=`rgba(255,210,60,${0.4+0.4*glow})`;
    ctx.beginPath(); ctx.arc(sx+u*0.4, sy+u*0.48, u*0.1,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(sx+w-u*0.4, sy+u*0.48, u*0.1,0,7); ctx.fill();
    ctx.fillStyle='#fff3b0'; ctx.font=`900 ${Math.max(8,u*0.26)}px -apple-system,Segoe UI,sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('BELTOPOLIS', cx, sy+u*0.62);
  } else if (t==='landStatue'){
    ctx.fillStyle='#8d8d82'; rr(ctx, cx-u*0.55, sy+u*1.35, u*1.1, u*0.4, u*0.08); ctx.fill();
    ctx.fillStyle='#6f6f66'; rr(ctx, cx-u*0.4, sy+u*1.2, u*0.8, u*0.22, u*0.06); ctx.fill();
    ctx.fillStyle='#b87333';
    rr(ctx, cx-u*0.16, sy+u*0.7, u*0.32, u*0.55, u*0.08); ctx.fill(); // legs/body
    rr(ctx, cx-u*0.28, sy+u*0.45, u*0.56, u*0.38, u*0.12); ctx.fill(); // torso
    ctx.beginPath(); ctx.arc(cx, sy+u*0.32, u*0.16, 0, 7); ctx.fill(); // head
    ctx.fillStyle='#8a5a2b'; ctx.fillRect(cx+u*0.22, sy+u*0.48, u*0.34, u*0.1); // pointing arm
    const tw=(Math.sin(tm*3)+1)/2; if (z>=14){ ctx.globalAlpha=0.4+0.5*tw; ctx.fillStyle='#ffeaa7'; ctx.beginPath(); ctx.arc(cx+u*0.35, sy+u*0.18, u*0.07,0,7); ctx.fill(); ctx.globalAlpha=1; }
  } else if (t==='landCathedral'){
    ctx.fillStyle='#3a3a44'; rr(ctx, sx+u*0.2, sy+u*0.9, w-u*0.4, u*1.7, u*0.1); ctx.fill();
    ctx.fillStyle='#6d6d7a'; rr(ctx, sx+u*0.15, sy+u*0.55, w-u*0.3, u*0.7, u*0.1); ctx.fill();
    // rose window
    ctx.fillStyle='#74b9ff'; ctx.beginPath(); ctx.arc(cx, sy+u*0.95, u*0.28, 0, 7); ctx.fill();
    ctx.strokeStyle='#ffeaa7'; ctx.lineWidth=Math.max(1,u*0.04); ctx.stroke();
    // stacks
    for (const ox of [-0.85, 0, 0.85]){
      ctx.fillStyle='#2d2d36'; rr(ctx, cx+ox*u-u*0.14, sy+u*0.05, u*0.28, u*0.6, u*0.05); ctx.fill();
      ctx.fillStyle='#c0392b'; ctx.fillRect(cx+ox*u-u*0.16, sy+u*0.05, u*0.32, u*0.08);
      landSmoke(b, 3+ox*2, 0.3);
    }
    ctx.fillStyle='#ffeaa7';
    for (let i=0;i<3;i++) rr(ctx, sx+u*0.45+i*u*0.7, sy+u*1.85, u*0.28, u*0.38, u*0.05), ctx.fill();
  } else if (t==='landObservatory'){
    ctx.fillStyle='#4a5564'; rr(ctx, sx+u*0.35, sy+u*1.15, w-u*0.7, u*1.4, u*0.12); ctx.fill();
    ctx.fillStyle='#b0c4de'; ctx.beginPath(); ctx.arc(cx, sy+u*1.15, u*1.05, Math.PI, 0); ctx.fill();
    ctx.fillStyle='#8aa0b8'; ctx.beginPath(); ctx.arc(cx, sy+u*1.15, u*1.05, Math.PI, 0); ctx.arc(cx, sy+u*1.15, u*0.85, 0, Math.PI, true); ctx.fill();
    ctx.save(); ctx.translate(cx, sy+u*1.15); ctx.rotate(tm*0.35);
    ctx.fillStyle='#1a2230'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,u*1.02, -0.18, 0.18); ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(255,240,180,${0.35+0.35*Math.sin(tm*4)})`;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(u*1.6, -u*0.2); ctx.lineTo(u*1.6, u*0.2); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle='#2d3436'; rr(ctx, cx-u*0.2, sy+u*2.05, u*0.4, u*0.4, u*0.06); ctx.fill();
  } else if (t==='landSpire'){
    const pulse = 0.5+0.5*Math.sin(tm*3.2);
    const col = mixHex('#a66bff', '#74b9ff', pulse);
    ctx.fillStyle='#3d1a6e'; ctx.beginPath(); ctx.moveTo(cx, sy-u*0.15); ctx.lineTo(cx+u*0.42, sy+u*1.7); ctx.lineTo(cx-u*0.42, sy+u*1.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(cx, sy-u*0.35); ctx.lineTo(cx+u*0.22, sy+u*1.05); ctx.lineTo(cx-u*0.22, sy+u*1.05); ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(200,240,255,${0.45+0.45*pulse})`; ctx.beginPath(); ctx.arc(cx, sy+u*0.25, u*(0.14+0.05*pulse),0,7); ctx.fill();
    ctx.strokeStyle=col; ctx.globalAlpha=0.45+0.4*pulse; ctx.lineWidth=Math.max(1.2,u*0.05);
    ctx.beginPath(); ctx.arc(cx, sy+u*0.25, u*(0.35+0.08*pulse),0,7); ctx.stroke(); ctx.globalAlpha=1;
    if (z>=14) landSmoke(b, 2, 0.2);
  } else if (t==='landRocket'){
    ctx.fillStyle='#3d3d46'; rr(ctx, sx+u*0.2, sy+u*1.85, w-u*0.4, u*0.7, u*0.08); ctx.fill();
    ctx.fillStyle='#2d2d36'; rr(ctx, cx-u*0.7, sy+u*1.7, u*1.4, u*0.28, u*0.06); ctx.fill();
    // rocket body
    ctx.fillStyle='#ecf0f1'; rr(ctx, cx-u*0.28, sy+u*0.35, u*0.56, u*1.45, u*0.28); ctx.fill();
    ctx.fillStyle='#e74c3c'; ctx.beginPath(); ctx.moveTo(cx-u*0.28, sy+u*0.5); ctx.lineTo(cx, sy-u*0.15); ctx.lineTo(cx+u*0.28, sy+u*0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#74b9ff'; ctx.beginPath(); ctx.arc(cx, sy+u*0.85, u*0.14,0,7); ctx.fill();
    ctx.fillStyle='#c0392b';
    ctx.beginPath(); ctx.moveTo(cx-u*0.28, sy+u*1.35); ctx.lineTo(cx-u*0.62, sy+u*1.75); ctx.lineTo(cx-u*0.28, sy+u*1.6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+u*0.28, sy+u*1.35); ctx.lineTo(cx+u*0.62, sy+u*1.75); ctx.lineTo(cx+u*0.28, sy+u*1.6); ctx.closePath(); ctx.fill();
    const lit = 0.4+0.6*Math.sin(tm*5);
    ctx.fillStyle=`rgba(255,200,40,${0.35+0.45*lit})`;
    for (const ox of [-0.9, 0.9]){ ctx.beginPath(); ctx.arc(cx+ox*u, sy+u*1.95, u*0.1,0,7); ctx.fill(); }
    landSmoke(b, 1.2, 3.8); landSmoke(b, 4.8, 3.8);
  } else {
    ctx.fillStyle=B.side; rr(ctx, sx+u*0.15, sy+u*0.3, w-u*0.3, w-u*0.3, u*0.16); ctx.fill();
    ctx.fillStyle=B.top; rr(ctx, sx+u*0.15, sy+u*0.15, w-u*0.3, w-u*0.45, u*0.16); ctx.fill();
  }
  ctx.restore();
}
function drawLandmarkIcon(c, type, x, y, s){
  c.save();
  // Mini painted version, centered in the 64px shop/build icon
  const B = BUILDINGS[type]||{};
  if (type==='landWindmill'){
    c.fillStyle='#8d6e4c'; rr(c, x-s*.1, y-s*.02, s*.2, s*.38, s*.04); c.fill();
    c.fillStyle='#f0e0b8'; rr(c, x-s*.16, y-s*.16, s*.32, s*.22, s*.05); c.fill();
    c.fillStyle='#c0392b'; c.beginPath(); c.moveTo(x-s*.2, y-s*.14); c.lineTo(x, y-s*.32); c.lineTo(x+s*.2, y-s*.14); c.closePath(); c.fill();
    c.strokeStyle='#ecf0f1'; c.lineWidth=s*.07; c.beginPath(); c.moveTo(x-s*.28,y-s*.12); c.lineTo(x+s*.28,y-s*.12); c.moveTo(x,y-s*.38); c.lineTo(x,y+s*.12); c.stroke();
  } else if (type==='landClock'){
    c.fillStyle='#6d5c4b'; rr(c, x-s*.16, y-s*.1, s*.32, s*.45, s*.05); c.fill();
    c.fillStyle='#8e2c2c'; c.beginPath(); c.moveTo(x-s*.2, y-s*.12); c.lineTo(x, y-s*.36); c.lineTo(x+s*.2, y-s*.12); c.closePath(); c.fill();
    c.fillStyle='#fff8e8'; c.beginPath(); c.arc(x,y-s*.02,s*.12,0,7); c.fill();
    c.strokeStyle='#2d3436'; c.lineWidth=1.5; c.beginPath(); c.moveTo(x,y-s*.02); c.lineTo(x,y-s*.1); c.moveTo(x,y-s*.02); c.lineTo(x+s*.08,y-s*.02); c.stroke();
  } else if (type==='landWater'){
    c.fillStyle='#3d566e'; c.fillRect(x-s*.14,y+s*.05,s*.06,s*.28); c.fillRect(x+s*.08,y+s*.05,s*.06,s*.28);
    c.fillStyle='#74b9ff'; rr(c, x-s*.22, y-s*.22, s*.44, s*.34, s*.1); c.fill();
    c.fillStyle='#dfe6ee'; rr(c, x-s*.22, y-s*.22, s*.44, s*.1, s*.1); c.fill();
  } else if (type==='landGate'){
    c.fillStyle='#bfa078'; rr(c, x-s*.32, y-s*.16, s*.64, s*.48, s*.08); c.fill();
    c.fillStyle='#5d4630'; c.fillRect(x-s*.32,y+s*.08,s*.16,s*.26); c.fillRect(x+s*.16,y+s*.08,s*.16,s*.26);
    c.fillStyle='#1a1520'; c.beginPath(); c.moveTo(x-s*.12,y+s*.34); c.quadraticCurveTo(x,y-s*.05,x+s*.12,y+s*.34); c.fill();
    c.fillStyle='#ffd23f'; c.beginPath(); c.arc(x-s*.22,y-s*.08,s*.04,0,7); c.fill(); c.beginPath(); c.arc(x+s*.22,y-s*.08,s*.04,0,7); c.fill();
  } else if (type==='landStatue'){
    c.fillStyle='#8d8d82'; rr(c, x-s*.22, y+s*.16, s*.44, s*.16, s*.04); c.fill();
    c.fillStyle='#b87333'; rr(c, x-s*.08, y-s*.02, s*.16, s*.22, s*.05); c.fill();
    c.beginPath(); c.arc(x,y-s*.1,s*.08,0,7); c.fill();
  } else if (type==='landCathedral'){
    c.fillStyle='#3a3a44'; rr(c, x-s*.28, y-s*.02, s*.56, s*.36, s*.06); c.fill();
    c.fillStyle='#6d6d7a'; rr(c, x-s*.24, y-s*.16, s*.48, s*.2, s*.05); c.fill();
    c.fillStyle='#2d2d36'; c.fillRect(x-s*.22,y-s*.32,s*.1,s*.2); c.fillRect(x-s*.05,y-s*.36,s*.1,s*.24); c.fillRect(x+s*.12,y-s*.32,s*.1,s*.2);
    c.fillStyle='#c0392b'; c.fillRect(x-s*.22,y-s*.34,s*.1,s*.04); c.fillRect(x-s*.05,y-s*.38,s*.1,s*.04); c.fillRect(x+s*.12,y-s*.34,s*.1,s*.04);
  } else if (type==='landObservatory'){
    c.fillStyle='#4a5564'; rr(c, x-s*.2, y+s*.02, s*.4, s*.3, s*.06); c.fill();
    c.fillStyle='#b0c4de'; c.beginPath(); c.arc(x,y,s*.22,Math.PI,0); c.fill();
    c.fillStyle='#1a2230'; c.fillRect(x-s*.03,y-s*.2,s*.06,s*.2);
  } else if (type==='landSpire'){
    c.fillStyle='#3d1a6e'; c.beginPath(); c.moveTo(x,y-s*.36); c.lineTo(x+s*.2,y+s*.3); c.lineTo(x-s*.2,y+s*.3); c.closePath(); c.fill();
    c.fillStyle='#a66bff'; c.beginPath(); c.moveTo(x,y-s*.4); c.lineTo(x+s*.1,y+s*.08); c.lineTo(x-s*.1,y+s*.08); c.closePath(); c.fill();
    c.fillStyle='#c8f0ff'; c.beginPath(); c.arc(x,y-s*.12,s*.07,0,7); c.fill();
  } else if (type==='landRocket'){
    c.fillStyle='#3d3d46'; rr(c, x-s*.28, y+s*.18, s*.56, s*.16, s*.04); c.fill();
    c.fillStyle='#ecf0f1'; rr(c, x-s*.1, y-s*.2, s*.2, s*.42, s*.1); c.fill();
    c.fillStyle='#e74c3c'; c.beginPath(); c.moveTo(x-s*.1,y-s*.16); c.lineTo(x,y-s*.36); c.lineTo(x+s*.1,y-s*.16); c.closePath(); c.fill();
    c.fillStyle='#74b9ff'; c.beginPath(); c.arc(x,y-s*.02,s*.05,0,7); c.fill();
  } else {
    c.fillStyle=B.side||'#888'; rr(c, x-s*.3, y-s*.2, s*.6, s*.5, s*.1); c.fill();
    c.fillStyle=B.top||'#bbb'; rr(c, x-s*.3, y-s*.32, s*.6, s*.36, s*.1); c.fill();
  }
  c.restore();
}

// ============================== PHOTO MODE ==============================
function factoryBounds(){
  const bs = allB();
  if (!bs.length) return {x:cam.x, y:cam.y, w:18, h:18};
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for (const b of bs){
    const B = BUILDINGS[b.type]; if (!B) continue;
    x0=Math.min(x0,b.x); y0=Math.min(y0,b.y);
    x1=Math.max(x1,b.x+B.size); y1=Math.max(y1,b.y+B.size);
  }
  return {x:(x0+x1)/2, y:(y0+y1)/2, w:Math.max(6,x1-x0+4), h:Math.max(6,y1-y0+4)};
}
function frameFactory(){
  const b = factoryBounds();
  cam.x = b.x; cam.y = b.y; cam.vx = cam.vy = 0; R.zoomAnim = null;
  const zW = W / Math.max(8, b.w), zH = H / Math.max(8, b.h);
  cam.z = Math.max(8, Math.min(48, Math.min(zW, zH)*0.92));
  try { clampCam(); } catch(e){}
}
function photoCaption(){
  const lv = (S && S.level) || 1;
  let era = '';
  try { era = (typeof eraLabel==='function' ? eraLabel(S.rebirths) : ('Era '+(1+(S.rebirths|0)))); } catch(e){ era = 'Era '+(1+(S.rebirths|0)); }
  const worldBit = (world() && world().name) ? (' · '+world().name) : '';
  const star = ascN() ? (' · ★'+ascN()) : '';
  return 'Lv '+lv+' · '+era+star+worldBit;
}
function captureFactoryPhoto(){
  const src = cv;
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const o = out.getContext('2d');
  o.drawImage(src, 0, 0);
  const pad = Math.max(12, Math.round(out.width*0.02));
  const fs1 = Math.max(22, Math.round(out.width*0.042));
  const fs2 = Math.max(14, Math.round(out.width*0.026));
  o.font = '900 '+fs1+'px -apple-system,Segoe UI,sans-serif';
  const title = 'Beltopolis';
  const cap = photoCaption();
  const tw = Math.max(o.measureText(title).width, (o.font='800 '+fs2+'px -apple-system,Segoe UI,sans-serif', o.measureText(cap).width));
  const boxW = tw + pad*2, boxH = fs1+fs2+pad*1.6;
  const bx = pad, by = out.height - boxH - pad;
  o.fillStyle='rgba(12,16,28,.62)';
  o.beginPath(); const r=Math.max(10, pad*0.6);
  o.moveTo(bx+r,by); o.arcTo(bx+boxW,by,bx+boxW,by+boxH,r); o.arcTo(bx+boxW,by+boxH,bx,by+boxH,r); o.arcTo(bx,by+boxH,bx,by,r); o.arcTo(bx,by,bx+boxW,by,r); o.closePath(); o.fill();
  o.fillStyle='#fff'; o.font='900 '+fs1+'px -apple-system,Segoe UI,sans-serif'; o.textBaseline='top';
  o.fillText(title, bx+pad, by+pad*0.55);
  o.font='800 '+fs2+'px -apple-system,Segoe UI,sans-serif'; o.fillStyle='#ffeaa7';
  o.fillText(cap, bx+pad, by+pad*0.7+fs1);
  return out;
}
function photoFileName(){ return 'beltopolis.png'; }
function enterPhotoMode(){
  if (R.photo) return;
  R.photo = {cam:{x:cam.x,y:cam.y,z:cam.z}};
  cancelLandmarkMode();
  closePhotoPreview();
  document.body.classList.add('photo-mode');
  if (DESK.on) resize();
  frameFactory();
  const bar = $('photoBar'); if (bar) bar.classList.add('show');
  R.dirty = true;
  toast('Frame your factory, then tap Take Photo', 2600);
}
function closePhotoPreview(){
  const el = $('photoPrev');
  if (el){ el.classList.remove('show','hint'); el.innerHTML=''; }
  if (R.photoUrl){ try { URL.revokeObjectURL(R.photoUrl); } catch(e){} }
  R.photoUrl = null; R.photoBlob = null; R.photoFile = null; R.photoNativeUri = null;
}
function exitPhotoMode(){
  if (R.photo && R.photo.cam){ cam.x=R.photo.cam.x; cam.y=R.photo.cam.y; cam.z=R.photo.cam.z; cam.vx=cam.vy=0; }
  R.photo = null;
  closePhotoPreview();
  document.body.classList.remove('photo-mode');
  const bar = $('photoBar'); if (bar) bar.classList.remove('show');
  if (DESK.on) resize();
  R.dirty = true;
}
function blobFromCanvas(c){
  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
function photoShareFile(blob){
  return new File([blob], 'beltopolis.png', {type:'image/png', lastModified: Date.now()});
}
function photoLooksValid(can, blob){
  if (!can || !can.width || !can.height) return false;
  if (!blob || blob.size < 800) return false;
  try {
    const c = can.getContext('2d');
    const w = can.width, h = can.height;
    const stepX = Math.max(1, (w/8)|0), stepY = Math.max(1, (h/8)|0);
    let first = null, varied = false, opaque = 0;
    for (let y=0; y<h; y+=stepY){
      for (let x=0; x<w; x+=stepX){
        const d = c.getImageData(x, y, 1, 1).data;
        if (d[3] > 8) opaque++;
        const key = (d[0]<<16)|(d[1]<<8)|d[2];
        if (first==null) first = key;
        else if (key !== first) varied = true;
      }
    }
    return opaque > 2 && varied;
  } catch(e){
    return false; // tainted canvas — don't share a blank/broken image
  }
}
function capSharePlugin(){
  try {
    const C = window.Capacitor;
    if (!C || typeof C.isNativePlatform!=='function' || !C.isNativePlatform()) return null;
    const P = C.Plugins || {};
    if (P.Share && typeof P.Share.share==='function') return P.Share;
  } catch(e){}
  return null;
}
function capFilesystem(){
  try {
    const C = window.Capacitor;
    if (!C || typeof C.isNativePlatform!=='function' || !C.isNativePlatform()) return null;
    const P = C.Plugins || {};
    if (P.Filesystem && typeof P.Filesystem.writeFile==='function') return P.Filesystem;
  } catch(e){}
  return null;
}
function blobToBase64(blob){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result||'');
      const i = s.indexOf(',');
      res(i>=0 ? s.slice(i+1) : s);
    };
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
async function prepareNativeShareFile(blob){
  const FS = capFilesystem();
  if (!FS || !blob) return;
  try {
    const data = await blobToBase64(blob);
    const opts = {path:'beltopolis.png', data, directory:'CACHE', recursive:true};
    const out = await FS.writeFile(opts);
    if (out && out.uri) R.photoNativeUri = out.uri;
  } catch(e){}
}
function canSharePhotoFile(file){
  if (!navigator.share) return false;
  try {
    if (navigator.canShare && !navigator.canShare({files:[file]})) return false;
  } catch(e){ return !!navigator.share; }
  return true;
}
function openPhotoInNewTab(){
  const url = R.photoUrl;
  if (!url){ toast('Could not open the photo'); return; }
  const w = window.open(url, '_blank', 'noopener');
  if (!w) toast('Could not open the photo');
}
// Must call share() in the same turn as the tap. File is prepared when the preview opens.
function sharePreparedPhoto(){
  const file = R.photoFile;
  if (!file || !file.size){ toast('Could not capture the photo'); return false; }
  // Safari / WKWebView: files ONLY (no title/text/url) so iOS shows the image thumbnail + Save Image.
  if (canSharePhotoFile(file)){
    const p = navigator.share({files:[file]});
    Promise.resolve(p).catch(e => { if (!e || e.name!=='AbortError') toast('Could not share this photo'); });
    return true;
  }
  const cap = capSharePlugin();
  if (cap && R.photoNativeUri){
    const p = cap.share({files:[R.photoNativeUri]});
    Promise.resolve(p).catch(e => { if (!e || e.name!=='AbortError') toast('Could not share this photo'); });
    return true;
  }
  openPhotoInNewTab();
  return false;
}
async function takeFactoryPhoto(){
  try {
    const shot = captureFactoryPhoto();
    const blob = await blobFromCanvas(shot);
    if (!photoLooksValid(shot, blob)){ toast('Could not capture the photo'); return; }
    showPhotoPreview(shot, blob);
  } catch(e){ toast('Could not capture the photo'); }
}
// Kept for older hooks / tests: always capture into the in-game preview. Never download the raw file.
async function shareFactoryPhoto(){ return takeFactoryPhoto(); }
function sharePhotoFromPreview(){ return sharePreparedPhoto(); }
function showPhotoPreview(can, blob){
  let el = $('photoPrev');
  if (!el){ el=document.createElement('div'); el.id='photoPrev'; document.body.appendChild(el); }
  if (R.photoUrl){ try { URL.revokeObjectURL(R.photoUrl); } catch(e){} }
  const file = photoShareFile(blob);
  const url = URL.createObjectURL(blob);
  R.photoUrl = url; R.photoBlob = blob; R.photoFile = file; R.photoNativeUri = null;
  try { prepareNativeShareFile(blob); } catch(e){}
  el.classList.remove('hint');
  el.innerHTML = `<div class="pp-box"><img alt="Your Beltopolis factory" src="${url}" draggable="false">
    <div class="row"><button type="button" class="btn green pp-share" data-a="sh">Save / Share</button><button type="button" class="btn" data-a="x">Close</button></div></div>`;
  el.classList.add('show');
  const bar = $('photoBar'); if (bar) bar.classList.remove('show');
  const closePrev = ev => { if (ev) ev.preventDefault(); closePhotoPreview(); if (R.photo){ const b=$('photoBar'); if (b) b.classList.add('show'); } };
  const xbtn = el.querySelector('[data-a=x]'); if (xbtn) xbtn.onclick = closePrev;
  const sh = el.querySelector('[data-a=sh]');
  if (sh) sh.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); sharePreparedPhoto(); };
}

// ============================== RENDER ==============================
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
let W=0, H=0, DPR=1;
const cam = {x:MAP_W/2, y:MAP_H/2, z:44, vx:0, vy:0};
function resize(){ DPR = Math.min(2, window.devicePixelRatio||1); const rc = cv.getBoundingClientRect(); W = Math.round(rc.width)||innerWidth; H = Math.round(rc.height)||innerHeight; R.cl = rc.left; R.ct = rc.top; cv.width = W*DPR; cv.height = H*DPR; R.dirty = true; }
// pointer -> canvas CSS px (the canvas box is the source of truth, so iOS toolbar/viewport changes can't offset taps)
const evX = e => e.clientX - (R.cl||0), evY = e => e.clientY - (R.ct||0);
// finger-friendly hit test: exact tile first, else nearest building / resource node within ~22 CSS px of the touch
const TOUCH_PX = 22, NODE_R = 0.36;
function pickAt(wx, wy){
  const tx = Math.floor(wx), ty = Math.floor(wy), i = inMap(tx,ty) ? idx(tx,ty) : -1;
  const o = i>=0 && R.occ[i]; if (o){ const b = allB().find(b=>b.uid===o); if (b) return {b}; }
  if (i>=0 && R.terr[i]>=TREE) return {res:[tx,ty]};
  const rw = TOUCH_PX / cam.z, n = Math.ceil(rw + NODE_R) + 1; let best = null, bd = Infinity;
  for (let y=ty-n; y<=ty+n; y++) for (let x=tx-n; x<=tx+n; x++){ if (!inMap(x,y)) continue; const j = idx(x,y);
    if (R.occ[j]){ const b = allB().find(b=>b.uid===R.occ[j]); if (!b) continue; const s = b.type==='hub' ? 3 : BUILDINGS[b.type].size;
      const dx = Math.max(b.x-wx, 0, wx-(b.x+s)), dy = Math.max(b.y-wy, 0, wy-(b.y+s)), d = Math.hypot(dx,dy);
      if (d <= rw && d < bd){ bd = d; best = {b}; } continue; }
    if (R.terr[j]>=TREE){ const d = Math.max(0, Math.hypot(wx-(x+.5), wy-(y+.5)) - NODE_R); if (d <= rw && d < bd - 1e-9){ bd = d; best = {res:[x,y]}; } } }
  return best || (i>=0 ? {tile:[tx,ty]} : null);
}
const toScreen = (x,y) => [(x-cam.x)*cam.z + W/2, (y-cam.y)*cam.z + H/2];
const toWorld = (sx,sy) => [(sx-W/2)/cam.z + cam.x, (sy-H/2)/cam.z + cam.y];
// ---- whole-map zoom: fit the 200×200 map into the usable area between the top HUD and bottom bar ----
const OV_Z = 9;            // below this scale draw the cheap overview image instead of detailed chunks
const TAP_ZOOM_Z = 14;     // below this, a tap zooms in instead of opening build menus (no accidental builds)
function hudInsets(){
  if (!R.ins || R.insW !== W || R.insH !== H){
    let t = 0, b = 0;
    try { const q = document.getElementById('quest'), st = document.getElementById('stock'), bo = document.getElementById('bottom');
      t = Math.max(q && !DESK.on ? q.getBoundingClientRect().bottom : 0, st ? st.getBoundingClientRect().bottom : 0);
      b = bo ? H - bo.getBoundingClientRect().top : 0; } catch(e){}
    R.ins = [Math.max(0, Math.min(t, H*0.4)), Math.max(0, Math.min(b, H*0.3))]; R.insW = W; R.insH = H;
  }
  return R.ins;
}
function fitZ(){ const [t,b] = hudInsets(), pad = 6; return Math.max(0.5, Math.min((W-2*pad)/MAP_W, (H-t-b-2*pad)/MAP_H)); }
function clampCam(){
  cam.z = Math.max(fitZ(), Math.min(120, cam.z));
  const [t,b] = hudInsets(), z = cam.z;
  // x: the screen centre may not move past the map edge further than the map allows; locks to centre at full view
  const ax = Math.min(MAP_W/2, W/(2*z)); cam.x = Math.max(ax, Math.min(MAP_W-ax, cam.x));
  // y: same, measured at the centre of the usable band (between HUD and bottom bar)
  const U = Math.max(50, H-t-b), c = (t + (H-b))/2 - H/2, ay = Math.min(MAP_H/2, U/(2*z));
  // When zoomed in, allow a little over-pan past the map rim so a Hub on the last
  // row can be scrolled fully above the bottom bar. At whole-map zoom, still lock to centre.
  let yMin = ay, yMax = MAP_H-ay;
  if (ay < MAP_H/2 - 0.01){
    const over = HUB_EDGE + 1.5;
    yMin = Math.max(0.5, ay - over);
    yMax = Math.min(MAP_H-0.5, MAP_H-ay + over);
  }
  const p = cam.y + c/z; cam.y = Math.max(yMin, Math.min(yMax, p)) - c/z;
}
function zoomTo(x, y, z){ R.zoomAnim = {x, y, z, t:0}; cam.vx = cam.vy = 0; }
function wholeMap(){ zoomTo(MAP_W/2, MAP_H/2, fitZ()); }
function stepZoomAnim(dt){
  const a = R.zoomAnim; if (!a) return;
  const k = 1 - Math.pow(0.0005, dt); // ~0.35s ease
  cam.z = Math.exp(Math.log(cam.z) + (Math.log(a.z) - Math.log(cam.z))*k);
  cam.x += (a.x - cam.x)*k; cam.y += (a.y - cam.y)*k; clampCam();
  if (Math.abs(Math.log(cam.z/a.z)) < 0.01 && Math.hypot(a.x-cam.x, a.y-cam.y) < 0.05){ cam.z = a.z; cam.x = a.x; cam.y = a.y; clampCam(); R.zoomAnim = null; }
  R.dirty = true;
}
function overviewCanvas(){
  if (R.ov && R.ovW === R.worldId) return R.ov;
  const w = world(), t = R.terr, P = 2, cv = document.createElement('canvas'); cv.width = MAP_W*P; cv.height = MAP_H*P;
  const c = cv.getContext('2d');
  const col = v => v===WATER ? w.water : v===TREE ? w.canopy[0] : (RES[v] ? RES[v].col : null);
  for (let y=0;y<MAP_H;y++) for (let x=0;x<MAP_W;x++){
    const v = t[y*MAP_W+x];
    if (v===WATER){ c.fillStyle = w.sea || w.water; c.fillRect(x*P, y*P, P, P); continue; }
    c.fillStyle = ((x+y)&1) ? w.grass[0] : w.grass[1]; c.fillRect(x*P, y*P, P, P);
    const k = col(v); if (!k) continue;
    if (v===STONE || v>=IRON){ c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x*P, y*P, P, P); c.fillStyle = k; c.fillRect(x*P, y*P, P, P-1); } // dark edge keeps ores distinct from grass
    else { c.fillStyle = k; c.fillRect(x*P, y*P, P, P); }
  }
  R.ov = cv; R.ovW = R.worldId; return cv;
}
function drawMapBeyond(){
  // Fill letterbox / off-map screen with themed decorative terrain (non-interactive).
  // Keeps the whole square map visible; does not change camera, taps, or buildable tiles.
  const w = world(), z = cam.z;
  const [x0,y0] = toScreen(0,0), [x1,y1] = toScreen(MAP_W, MAP_H);
  const island = S && S.terrGen === TERR_GEN_ISLANDS;
  const fillBand = (sx, sy, sw, sh) => {
    if (sw < 1 || sh < 1) return;
    if (island){
      const g = ctx.createLinearGradient(sx, sy, sx, sy+sh);
      g.addColorStop(0, w.sea); g.addColorStop(.5, w.water || w.sea); g.addColorStop(1, w.sea);
      ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      for (let i=0;i<28;i++){ const px = sx + ((i*73 + (sy|0)) % Math.max(1,sw|0)); const py = sy + ((i*41) % Math.max(1,sh|0)); ctx.fillRect(px, py, 3, 1); }
    } else {
      // Opaque themed field (snow/grass/etc.) so letterboxing reads as terrain, not empty sky
      const cell = Math.max(6, Math.min(16, z*2.4));
      const c0 = w.grass[0], c1 = w.grass[1];
      const xStart = Math.floor(sx/cell)*cell, yStart = Math.floor(sy/cell)*cell;
      for (let yy=yStart; yy<sy+sh; yy+=cell) for (let xx=xStart; xx<sx+sw; xx+=cell){
        const cx = Math.max(sx, xx), cy = Math.max(sy, yy);
        const cw = Math.min(sx+sw, xx+cell) - cx, ch = Math.min(sy+sh, yy+cell) - cy;
        if (cw<=0||ch<=0) continue;
        ctx.fillStyle = (((xx/cell)|0)+((yy/cell)|0))&1 ? c0 : c1;
        ctx.fillRect(cx, cy, cw+0.6, ch+0.6);
      }
      // slight desaturate/dim so playable map stays the focus
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(sx, sy, sw, sh);
      // decorative flecks
      ctx.fillStyle = (w.blade && w.blade[0]) || w.accent;
      ctx.globalAlpha = 0.28;
      for (let i=0;i<36;i++){ const px = sx + ((i*89+(y0|0)*3) % Math.max(1,sw|0)); const py = sy + ((i*57+(x0|0)) % Math.max(1,sh|0)); ctx.fillRect(px, py, 2.5, 2.5); }
      ctx.globalAlpha = 1;
    }
  };
  fillBand(0, 0, W, Math.max(0, y0));                 // above map
  fillBand(0, y1, W, Math.max(0, H - y1));            // below
  fillBand(0, Math.max(0,y0), Math.max(0,x0), Math.max(0, y1-y0)); // left
  fillBand(x1, Math.max(0,y0), Math.max(0,W-x1), Math.max(0, y1-y0)); // right
  // crisp map edge so letterbox isn’t confused with playable terrain
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
  ctx.strokeRect(x0+.5, y0+.5, (x1-x0)-1, (y1-y0)-1);
  ctx.strokeStyle = w.accent; ctx.globalAlpha = 0.75; ctx.lineWidth = 2;
  ctx.strokeRect(x0+2.5, y0+2.5, (x1-x0)-5, (y1-y0)-5);
  ctx.restore();
}
function drawOverview(){
  const [ox,oy] = toScreen(0,0), z = cam.z; const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(overviewCanvas(), ox, oy, MAP_W*z, MAP_H*z); ctx.imageSmoothingEnabled = sm;
}
function drawBuildingsOverview(){
  const z = cam.z;
  for (const b of allB()){ if (R.moveHub && b && b.type==='hub') continue; const B = BUILDINGS[b.type], s = B.size*z, [sx,sy] = toScreen(b.x,b.y);
    const bw = Math.max(2,s);
    if (B.landmark){
      for (const [fx,fy] of footprint(b.type,b.x,b.y)){
        const [px,py] = toScreen(fx,fy), t = Math.max(2,z);
        ctx.fillStyle = B.top; ctx.fillRect(px, py, t, t);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(px, py, t, t);
      }
      continue;
    }
    ctx.fillStyle = (b.type==='hub' || B.hubExt) ? '#ffffff' : (isGoldB(b) ? '#ffd23f' : B.top); ctx.fillRect(sx, sy, bw, bw);
    if (b.paused){ ctx.fillStyle='rgba(40,10,12,.5)'; ctx.fillRect(sx, sy, bw, bw); }
    if (BUILDING_OUTLINE){ ctx.strokeStyle = BUILDING_OUTLINE_COLOR; ctx.lineWidth = buildingOutlineW(z); ctx.lineJoin='round'; ctx.strokeRect(sx, sy, bw, bw); }
    if (b.type==='hub' || B.hubExt){ ctx.strokeStyle = B.hubExt ? (world().accent||'#00b894') : '#5a45e0'; ctx.lineWidth = 2; ctx.strokeRect(sx-2, sy-2, s+4, s+4); } }
}
function drawBelts(){
  // Shadow + colored edges per path (direction). Opaque dark core per path (same color,
  // so overlaps stay even). Motion tread is opaque + world-space phased so shared
  // corridors and crossings never paint mismatched light/dark rectangles from
  // path-local dash offsets or alpha stacking.
  const z = cam.z;
  ctx.lineJoin='round'; ctx.lineCap='round';
  const trace = p => { ctx.beginPath(); p.pts.forEach((q,i)=> i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); };
  const edgeCol = p => beltPalette(p.kind);
  const skin = beltSkin();
  let core = skin.core || '#434956', tread = skin.tread || '#5d6576';
  if (skin.anim==='rainbow') tread = rainbowHex(((R.time||0)*0.55)+0.5);
  else if (skin.anim==='lava') tread = mixHex(skin.tread, '#fff3b0', (0.5+0.5*Math.sin((R.time||0)*3.2))*0.45);
  ctx.save(); ctx.translate(W/2 - cam.x*z, H/2 - cam.y*z); ctx.scale(z,z);
  // Water causeways: pilings + deck under any belt tile on WATER (island worlds)
  if (R.terr){
    const seen = new Set();
    for (const p of R.paths){
      if (!p.tiles) continue;
      for (let j=0;j<p.tiles.length;j++){
        const ti = p.tiles[j]; if (seen.has(ti) || R.terr[ti]!==WATER) continue; seen.add(ti);
        const x = ti%MAP_W+.5, y = ((ti/MAP_W)|0)+.5;
        const ax = p.ax && p.ax[j] ? p.ax[j] : 1;
        ctx.save(); ctx.translate(x,y); ctx.rotate(ax===2 ? Math.PI/2 : 0);
        // submerged posts
        ctx.fillStyle='rgba(30,40,50,.45)'; ctx.fillRect(-.42,.18,.18,.28); ctx.fillRect(.24,.18,.18,.28);
        ctx.fillStyle=world().bridge; ctx.fillRect(-.48,-.16,.96,.28);
        ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(-.48,-.16,.96,.06);
        ctx.fillStyle='#3a2e24'; ctx.fillRect(-.5,-.2,.12,.36); ctx.fillRect(.38,-.2,.12,.36);
        ctx.restore();
      }
    }
  }
  for (const p of R.paths){ trace(p); ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=.62; ctx.save(); ctx.translate(.04,.07); ctx.stroke(); ctx.restore(); }
  if (skin.glow && z >= 14){
    ctx.strokeStyle = skin.anim==='rainbow' ? rainbowHex((R.time||0)*0.55) : skin.glow;
    ctx.globalAlpha = 0.40; ctx.lineWidth = .78;
    for (const p of R.paths){ trace(p); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  for (const p of R.paths){ trace(p); ctx.strokeStyle = edgeCol(p); ctx.lineWidth=.56; ctx.stroke(); }
  for (const p of R.paths){ trace(p); ctx.strokeStyle=core; ctx.lineWidth=.42; ctx.stroke(); }
  // world-phased opaque tread (aligned; opaque so overlaps don't brighten)
  ctx.lineCap='round';
  ctx.strokeStyle=tread;
  ctx.lineWidth=.28;
  const period = 0.3, tOff = (R.time * beltSpeed()) % period;
  ctx.setLineDash([0.1, 0.2]);
  for (const p of R.paths){
    const pts = p.pts; if (!pts || pts.length < 2) continue;
    for (let i=1;i<pts.length;i++){
      const a=pts[i-1], b=pts[i], dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy);
      if (len < 1e-6) continue;
      const ux=dx/len, uy=dy/len;
      ctx.lineDashOffset = -((a[0]*ux + a[1]*uy) + tOff);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineCap='round';
  for (const br of R.bridges||[]){ const x = br.i%MAP_W+.5, y = ((br.i/MAP_W)|0)+.5; ctx.save(); ctx.translate(x, y);
    ctx.rotate(br.axis===1 ? (br.dir>0?0:Math.PI) : (br.dir>0?Math.PI/2:-Math.PI/2));
    ctx.fillStyle='rgba(0,0,0,.3)'; rr(ctx,-.58,-.3,1.16,.74,.1); ctx.fill();
    ctx.fillStyle=world().bridge; rr(ctx,-.6,-.4,1.2,.8,.1); ctx.fill();
    const col = beltPalette(br.kind);
    ctx.fillStyle = col; ctx.fillRect(-.6,-.29,1.2,.58);
    ctx.fillStyle=core; ctx.fillRect(-.6,-.21,1.2,.42);
    ctx.strokeStyle=tread; ctx.lineWidth=.28; ctx.lineCap='round';
    ctx.setLineDash([0.1, 0.2]); ctx.lineDashOffset = -((br.axis===1 ? x : y) + tOff);
    ctx.beginPath(); ctx.moveTo(-.6,0); ctx.lineTo(.6,0); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset=0;
    ctx.fillStyle='#f4ede1'; ctx.fillRect(-.52,-.43,1.04,.08); ctx.fillRect(-.52,.35,1.04,.08);
    ctx.fillStyle='#5c4330'; for (const px of [-.55,.47]) { ctx.fillRect(px,-.46,.08,.14); ctx.fillRect(px,.32,.08,.14); }
    ctx.restore(); }
  ctx.restore();
}
// Belt items get a crisp white halo so dark items (iron, steel, coal) pop against the dark belt.
// Each item+size is rendered once into a small cached sprite (item on top of its white silhouette).
const beltSpr = new Map();
function itemHaloCol(){
  const c = COS_BY_ID[cosEq('item')||''];
  if (!c) return 'rgba(255,255,255,.95)';
  if (c.item==='gild') return '#ffd23f';
  if (c.item==='neon') return '#ff2bd6';
  if (c.item==='crystal') return '#7cf3ff';
  if (c.item==='star') return '#ffe08a';
  return 'rgba(255,255,255,.95)';
}
function beltSprite(id, s){
  const skin = cosEq('item') || '';
  const px = Math.max(8, Math.round(s*DPR)), key = id+'|'+px+'|'+DPR+'|'+skin; let e = beltSpr.get(key); if (e) return e;
  if (beltSpr.size > 400) beltSpr.clear();
  const thick = !!skin;
  const pad = Math.ceil(px*(thick?0.32:0.18)), N = px*2 + pad*2, half = N/2;
  const item = document.createElement('canvas'); item.width = item.height = N; const ic = item.getContext('2d');
  drawItem(ic, id, half, half, px);
  const out = document.createElement('canvas'); out.width = out.height = N; const oc = out.getContext('2d');
  const o = thick ? Math.max(2.6, px*0.16) : Math.max(1.5, px*0.075);
  for (let k=0;k<16;k++){ const a = k*Math.PI/8; oc.drawImage(item, Math.cos(a)*o, Math.sin(a)*o); }
  oc.globalCompositeOperation = 'source-in'; oc.fillStyle = itemHaloCol(); oc.fillRect(0,0,N,N);
  oc.globalCompositeOperation = 'source-over';
  if (skin && COS_BY_ID[skin] && COS_BY_ID[skin].item==='neon'){
    // inner cyan ring under the magenta halo
    oc.save(); oc.globalCompositeOperation = 'destination-over';
    oc.strokeStyle = '#00fff0'; oc.lineWidth = Math.max(2, px*0.08);
    oc.beginPath(); oc.arc(half, half, px*0.62, 0, 7); oc.stroke(); oc.restore();
  }
  oc.drawImage(item, 0, 0);
  e = {cv:out, half:half/DPR, size:N/DPR}; beltSpr.set(key, e); return e;
}
function drawBeltItem(id, x, y, s){ const e = beltSprite(id, s); ctx.drawImage(e.cv, x - e.half, y - e.half, e.size, e.size); }
function pathAxAt(p, ti){ if (!p.ax) return 0; if (!p._axAt){ p._axAt = new Map(); p.tiles.forEach((t,j)=>p._axAt.set(t, p.ax[j])); } return p._axAt.get(ti)||0; }
function drawItems(){
  const z = cam.z, s = z*0.42;
  const trailId = cosEq('trail'), trail = trailId && COS_BY_ID[trailId] && COS_BY_ID[trailId].trail;
  for (const p of R.paths) for (const it of p.items){
    const [wx,wy] = posOn(p, it.d), [sx,sy] = toScreen(wx,wy);
    if (R.brMap && R.brMap.size){ const ti = idx(Math.floor(wx), Math.floor(wy)), br = R.brMap.get(ti); if (br && br.over !== p && !(p.kind===br.kind && pathAxAt(p, ti)===br.axis)) continue; } // passing under a bridge (v70: every belt riding the deck stays visible)
    if (sx<-s||sy<-s||sx>W+s||sy>H+s) continue;
    if (trail && z >= 10){
      try {
        const tm = R.time||0, steps = z < 16 ? 2 : (trail==='nova' || trail==='rainbow' ? 5 : 4);
        const gap = trail==='streak' ? 0.16 : 0.20;
        if (trail==='fire'){
          // Wide roaring flame wake: ribbon + tall licking tongues, white/blue-hot core, light smoke.
          // No shadowBlur (iPhone). Fewer steps when zoomed out.
          const fsteps = z < 16 ? 3 : 5;
          const pts = [];
          for (let k=0;k<fsteps;k++){
            const [bx,by] = posOn(p, Math.max(0, it.d - k*0.16));
            pts.push(toScreen(bx,by));
          }
          const ribbon = () => { ctx.beginPath(); pts.forEach((q,i)=> i?ctx.lineTo(q[0], q[1]-s*.05):ctx.moveTo(q[0], q[1]-s*.05)); };
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = '#c0392b'; ctx.globalAlpha = 0.42; ctx.lineWidth = s*(z<16?0.9:1.45); ribbon(); ctx.stroke();
          ctx.strokeStyle = '#ff7a3d'; ctx.globalAlpha = 0.88; ctx.lineWidth = s*(z<16?0.55:0.95); ribbon(); ctx.stroke();
          ctx.strokeStyle = '#ffd23f'; ctx.globalAlpha = 0.95; ctx.lineWidth = s*(z<16?0.28:0.46); ribbon(); ctx.stroke();
          ctx.strokeStyle = '#fff8e8'; ctx.globalAlpha = 0.95; ctx.lineWidth = s*(z<16?0.12:0.22); ribbon(); ctx.stroke();
          ctx.strokeStyle = '#8fd8ff'; ctx.globalAlpha = 0.9; ctx.lineWidth = s*(z<16?0.06:0.11); ribbon(); ctx.stroke();
          const tongues = z < 16 ? 2 : 3;
          const flame = (x, y, sw, sh, col, a) => {
            ctx.fillStyle = col; ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.moveTo(x, y - sh);
            ctx.quadraticCurveTo(x + sw, y - sh*0.32, x + sw*0.55, y + sh*0.16);
            ctx.quadraticCurveTo(x, y + sh*0.28, x - sw*0.55, y + sh*0.16);
            ctx.quadraticCurveTo(x - sw, y - sh*0.32, x, y - sh);
            ctx.fill();
          };
          for (let k=0;k<tongues;k++){
            const q = pts[k]; if (!q) continue;
            const fade = 1 - k/(tongues+0.4);
            const lick = 0.82 + 0.18*Math.sin(tm*14 + (it.d||0)*8 + k*1.7);
            const lean = Math.sin(tm*10 + k*1.7 + (it.d||0))*s*0.18;
            const x = q[0] + lean, y = q[1] - s*0.08;
            const tall = s * (1.55 - k*0.22) * lick;
            const wide = s * (0.72 - k*0.1);
            flame(x, y, wide*1.2, tall*1.12, '#c0392b', 0.4*fade);
            flame(x, y, wide, tall, '#ff7a3d', 0.9*fade);
            flame(x, y, wide*0.55, tall*0.72, '#ffd23f', 0.95*fade);
            flame(x, y, wide*0.28, tall*0.45, '#fff8e8', 0.95*fade);
            if (k < 2) flame(x, y, wide*0.14, tall*0.28, '#8fd8ff', 0.9*fade);
          }
          if (z >= 16){
            const tail = pts[pts.length-1] || pts[0];
            if (tail){
              const jx = Math.sin(tm*2.2 + (it.d||0))*s*0.22;
              ctx.fillStyle = '#5a4a48'; ctx.globalAlpha = 0.22;
              ctx.beginPath(); ctx.arc(tail[0]+jx, tail[1] - s*1.15, s*0.42, 0, 7); ctx.fill();
              ctx.globalAlpha = 0.16;
              ctx.beginPath(); ctx.arc(tail[0]-jx*0.6, tail[1] - s*1.45, s*0.32, 0, 7); ctx.fill();
            }
            const sh = (Math.sin(tm*9 + (it.d||0)*3)+1)/2;
            ctx.strokeStyle = 'rgba(255,220,160,.7)'; ctx.lineWidth = Math.max(1.2, s*0.06);
            ctx.globalAlpha = 0.35 + 0.25*sh;
            ctx.beginPath(); ctx.ellipse(sx, sy - s*(1.05+sh*0.22), s*(0.58+sh*0.1), s*0.16, 0, 0, 7); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        } else if (trail==='sparkle'){
          const tw = (Math.sin(tm*10 + (it.d||0)*7)+1)/2;
          const dots = [
            [sx + Math.sin(tm*6+it.d)*s*.5, sy - s*.42 - tw*s*.2, s*0.22, '#fff8d0'],
            [sx - s*.32, sy + s*.02, s*0.16, '#ffe08a'],
            [sx + s*.28, sy - s*.08, s*0.14, '#ffffff'],
          ];
          for (const d of dots){
            ctx.fillStyle = d[3];
            ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(d[0], d[1], d[2]*1.85, 0, 7); ctx.fill();
            ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(d[0], d[1], d[2], 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = '#fff8d0'; ctx.lineWidth = Math.max(1.8, s*0.09); ctx.lineCap='round';
          const x = sx, y = sy - s*.5 - tw*s*.15, arm = s*0.30;
          ctx.beginPath(); ctx.moveTo(x-arm,y); ctx.lineTo(x+arm,y); ctx.moveTo(x,y-arm); ctx.lineTo(x,y+arm); ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          for (let k=1;k<=steps;k++){
            const [bx,by] = posOn(p, Math.max(0, it.d - k*gap));
            const [tx,ty] = toScreen(bx,by);
            const fade = 1 - k/(steps+0.5);
            if (trail==='streak'){
              ctx.globalAlpha = 0.75 * fade;
              drawBeltItem(it.id, tx, ty - s*.05, s*(1 - k*0.1));
            } else if (trail==='ember'){
              // Small drifting orange sparks — clearly not a solid flame
              const jx = Math.sin(tm*7 + (it.d||0)*5 + k*2.1)*s*0.22;
              const jy = -s*(0.12+k*0.16) + Math.cos(tm*5 + k)*s*0.08;
              const r = Math.max(1.5, s*(0.13 - k*0.015));
              ctx.fillStyle = k%2 ? '#ffd23f' : '#e17055';
              ctx.globalAlpha = 0.9 * fade;
              ctx.beginPath(); ctx.arc(tx+jx, ty+jy, r, 0, 7); ctx.fill();
              ctx.fillStyle = '#fff3b0'; ctx.globalAlpha = 0.75*fade;
              ctx.beginPath(); ctx.arc(tx+jx, ty+jy, r*0.4, 0, 7); ctx.fill();
            } else if (trail==='rainbow'){
              ctx.fillStyle = rainbowHex(tm*0.7 + k*0.14 + (it.d||0)*0.2);
              ctx.globalAlpha = 0.42 * fade; ctx.beginPath(); ctx.arc(tx, ty - s*.05, s*(0.52 - k*0.04), 0, 7); ctx.fill();
              ctx.globalAlpha = 0.96 * fade; ctx.beginPath(); ctx.arc(tx, ty - s*.05, s*(0.28 - k*0.03), 0, 7); ctx.fill();
            } else if (trail==='nova'){
              ctx.fillStyle = k%2 ? '#ffffff' : '#7cf3ff';
              ctx.globalAlpha = 0.42 * fade; ctx.beginPath(); ctx.arc(tx, ty - s*.08, s*(0.64 - k*0.06), 0, 7); ctx.fill();
              ctx.globalAlpha = 0.96 * fade; ctx.beginPath(); ctx.arc(tx, ty - s*.08, s*(0.32 - k*0.03), 0, 7); ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
        }
      } catch(e){ ctx.globalAlpha = 1; }
    }
    ctx.fillStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy+s*.28, s*.32, s*.12, 0, 0, 7); ctx.fill();
    if ((it.n||1) > 1) drawBeltItem(it.id, sx + s*.12, sy - s*.2, s*.9);
    drawBeltItem(it.id, sx, sy - s*.05, s);
    const itemSkin = COS_BY_ID[cosEq('item')||''];
    if (itemSkin && itemSkin.item==='star' && z>=16){
      const tw = (Math.sin((R.time||0)*8 + sx)*0.5+0.5);
      ctx.globalAlpha = 0.55+0.45*tw; ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(sx+s*0.28, sy-s*0.35, Math.max(1.6,s*0.10),0,7); ctx.fill();
      ctx.globalAlpha=1;
    }
  }
}
// Thin dark silhouette around placed buildings (not belts, resources, terrain, or UI).
// Flip BUILDING_OUTLINE to false to revert. Buildings are live-drawn (not cached sprites),
// so we stroke the iso-block path — one cheap stroke per building, not a per-frame blur.
const BUILDING_OUTLINE = true;
const BUILDING_OUTLINE_COLOR = 'rgba(10,10,15,0.85)';
function buildingOutlineW(z){
  // ~1.75px at play zoom (z≈44); stays visible zoomed out, doesn't balloon zoomed in
  return Math.max(1.2, Math.min(2.5, 1.75 * Math.sqrt(Math.max(8, z||44)/44)));
}
function strokeBuildingOutline(c, b, sx, sy, z){
  if (!BUILDING_OUTLINE) return;
  const B = BUILDINGS[b.type], w = B.size*z;
  const pad = z*0.07, depth = z*0.16, rad = z*0.2;
  c.save();
  c.shadowBlur = 0; c.shadowColor = 'transparent';
  c.strokeStyle = BUILDING_OUTLINE_COLOR;
  c.lineWidth = buildingOutlineW(z);
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (B.hut){
    // Cottage silhouette: peaked roof + wall/foundation + chimney (not the iso-block).
    const hp = z*0.08, rx=sx+hp-z*0.08, ry=sy+w*0.34, rw=w-hp*2+z*0.16;
    c.beginPath();
    c.moveTo(rx, ry);
    c.lineTo(sx+w/2, sy-z*0.08);
    c.lineTo(rx+rw, ry);
    c.lineTo(sx+w-hp, sy+w*0.28+z*0.1);
    c.lineTo(sx+w-hp, sy+w*0.93);
    c.lineTo(sx+hp, sy+w*0.93);
    c.lineTo(sx+hp, sy+w*0.28+z*0.1);
    c.closePath();
    c.stroke();
    rr(c, sx+w*0.68, sy-z*0.02, z*0.22, z*0.42, z*0.04); c.stroke();
    c.restore();
    return;
  }
  // Union of the side + top iso faces — the building's body silhouette
  rr(c, sx+pad, sy+pad-depth*0.4, w-pad*2, w-pad*2 + depth*1.4, rad);
  c.stroke();
  // Hub / extension chimney pokes above the roof
  if (b.type==='hub'){ rr(c, sx+z*2.25, sy+z*0.32, z*0.38, z*0.75, z*0.08); c.stroke(); }
  else if (B.hubExt){ rr(c, sx+z*3.15, sy+z*0.32, z*0.42, z*0.9, z*0.08); c.stroke(); }
  c.restore();
}
function drawMegaCaption(cx, y, z, item){
  const label = (item && ITEMS[item] && ITEMS[item].name) || '';
  const text = label ? ('MEGA · '+label.toUpperCase()) : 'MEGA';
  const fs = Math.max(9, z*0.28);
  ctx.save();
  ctx.font = `900 ${fs}px -apple-system,Segoe UI,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const tw = ctx.measureText(text).width + z*0.28;
  const th = fs + z*0.16;
  ctx.fillStyle='rgba(45,20,90,.88)'; rr(ctx, cx-tw/2, y-th/2, tw, th, z*0.1); ctx.fill();
  ctx.fillStyle='#fff'; ctx.fillText(text, cx, y+0.5);
  ctx.restore();
}
function formSetId(){
  const id = (typeof S!=='undefined' && S && typeof cosEq==='function') ? cosEq('form') : null;
  const c = id && COS_BY_ID[id];
  return (c && c.form) || null;
}
function formKind(type){
  const map = {cutter:'cutter', megaCutter:'cutter', quarry:'quarry', megaQuarry:'quarry', drill:'drill', megaDrill:'drill', workshop:'workshop', megaBlock:'workshop', smelter:'smelter', megaSmelter:'smelter', assembler:'assembler', lab:'lab', hub:'hub', megaHub:'hub', forge:'forge', collider:'collider', starforge:'starforge', nexus:'nexus'};
  if (map[type]) return map[type];
  const B = BUILDINGS[type];
  if (B && B.hubExt) return 'hub';
  if (B && B.recipes) return 'lab';
  if (B && B.on) return 'drill';
  return null;
}
const FORM_PAL = {
  rustic:{wall:'#c48a52', wallD:'#6a3a18', roof:'#8b3a22', roofL:'#c45a32', wood:'#d4a574', woodD:'#5a3010', stone:'#9a8f7e', stoneD:'#4a443c', thatch:'#c9a227', accent:'#2d6a3e', win:'#ffeaa7', glow:'#ffb04a'},
  steam:{wall:'#8a6a3a', wallD:'#3a2a14', roof:'#c9a24a', roofL:'#e8c878', brass:'#d4a017', brassD:'#7a5a10', iron:'#3a3d44', ironD:'#14161a', copper:'#c46a32', accent:'#e8a020', win:'#ffd36b', glow:'#ffb428'},
  castle:{wall:'#8a8f9a', wallD:'#3e424a', roof:'#6a1e22', roofL:'#c43840', stone:'#c4bfb4', stoneD:'#5a564e', gold:'#d4b24a', accent:'#5a1a1e', win:'#ffe08a', banner:'#c41e2a', glow:'#ff6a3a'},
  scifi:{wall:'#6a7a8e', wallD:'#141c28', roof:'#d0dce8', roofL:'#ffffff', metal:'#8aa0b8', metalD:'#1c2834', glow:'#3ee0ff', glow2:'#b44bff', accent:'#3ee0ff', win:'#7ef0ff'}
};
function formPal(form){
  const src = FORM_PAL[form]; if (!src) return null;
  const out = {};
  for (const k in src){
    const v = src[k];
    out[k] = (typeof v==='string' && v[0]==='#') ? skinHex(v, /D$|wall|iron|stoneD|metalD/.test(k) ? 'side' : 'top') : v;
  }
  return out;
}
function formSmoke(bx, by, chance){
  if (R.iconDraw) return;
  if (Math.random() < (chance||0.04)*(60/Math.max(30,fps))) R.parts.push({x:bx, y:by, vx:(Math.random()-.5)*.2, vy:-.6, life:2, max:2, col:'rgba(240,240,250,', size:.22, smoke:true});
}
function ffill(c, col, x, y, w, h, r){ c.fillStyle=col; rr(c,x,y,w,h,r||0); c.fill(); }
function ftri(c, col, x1,y1,x2,y2,x3,y3){ c.fillStyle=col; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.lineTo(x3,y3); c.closePath(); c.fill(); }
function formRoof(c, x, y, w, h, left, mid, right){
  c.fillStyle=left; c.beginPath(); c.moveTo(x,y+h); c.lineTo(x+w/2,y); c.lineTo(x+w/2,y+h); c.closePath(); c.fill();
  c.fillStyle=right||mid||left; c.beginPath(); c.moveTo(x+w,y+h); c.lineTo(x+w/2,y); c.lineTo(x+w/2,y+h); c.closePath(); c.fill();
}
function formWheel(c, x, y, r, ang, rim, pad){
  c.save(); c.translate(x,y); c.rotate(ang);
  c.strokeStyle=rim; c.lineWidth=Math.max(2,r*0.14); c.beginPath(); c.arc(0,0,r,0,7); c.stroke();
  c.beginPath(); c.arc(0,0,r*0.55,0,7); c.stroke();
  for (let i=0;i<8;i++){ const a=i*Math.PI/4; c.beginPath(); c.moveTo(0,0); c.lineTo(Math.cos(a)*r, Math.sin(a)*r); c.stroke(); }
  if (pad){ c.fillStyle=pad; for (let i=0;i<8;i++){ const a=i*Math.PI/4; c.save(); c.rotate(a); c.fillRect(r*0.72, -r*0.16, r*0.38, r*0.32); c.restore(); } }
  c.fillStyle=rim; c.beginPath(); c.arc(0,0,r*0.16,0,7); c.fill();
  c.restore();
}
function formChimney(c, x, y, bw, bh, body, cap, bx, by){
  ffill(c, body, x, y, bw, bh, bw*0.15);
  ffill(c, cap, x-bw*0.1, y, bw*1.2, Math.max(3,bh*0.12), 1);
  if (bx!=null) formSmoke(bx, by, 0.045);
}
function formWindows(c, x, y, s, n, gap, col){
  c.fillStyle=col; for (let i=0;i<n;i++) rr(c, x+i*gap, y, s, s, s*0.22), c.fill();
}
function formBattlements(c, x, y, w, h, col){
  c.fillStyle=col;
  const n = Math.max(4, Math.round(w/(h*1.6)));
  const mw = w/n;
  for (let i=0;i<n;i++) if (i%2===0) c.fillRect(x+i*mw, y, mw*0.92, h);
}
function formBanner(c, x, y, h, col, t){
  c.strokeStyle='#2d3436'; c.lineWidth=Math.max(1.5,h*0.06); c.beginPath(); c.moveTo(x,y+h); c.lineTo(x,y); c.stroke();
  const wv = Math.sin((t||0)*5)*h*0.08;
  c.fillStyle=col; c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+h*0.55,y+wv,x+h*0.85,y+h*0.22); c.lineTo(x,y+h*0.42); c.fill();
}
function formHubSign(c, cx, y, z, text, bg, fg){
  const fs = Math.max(8, z*0.28);
  c.font = '900 '+fs+'px -apple-system,Segoe UI,sans-serif';
  c.textAlign='center'; c.textBaseline='middle';
  const tw = Math.max(c.measureText(text).width+z*0.3, z*1.2);
  ffill(c, bg, cx-tw/2, y-fs*0.7, tw, fs*1.4, z*0.1);
  c.fillStyle=fg; c.fillText(text, cx, y);
}
function paintFormCosmetic(ctx, b, sx, sy, w, z){
  const id = cosEq('build'), c = id && COS_BY_ID[id]; if (!c) return;
  const glowCol = c.anim ? mixHex(c.top, c.top2||c.top, 0.5+0.5*Math.sin((R.time||0)*2.2)) : (c.glow || c.top);
  ctx.save();
  ctx.strokeStyle = glowCol; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(2, z*0.08);
  rr(ctx, sx+z*0.04, sy+z*0.02, w-z*0.08, w-z*0.06, z*0.16); ctx.stroke();
  if (c.skin==='prism' || c.anim){
    ctx.strokeStyle = (typeof rainbowHex==='function') ? rainbowHex(R.time||0) : glowCol;
    ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(2, z*0.06);
    rr(ctx, sx+z*0.01, sy-z*0.02, w-z*0.02, w, z*0.18); ctx.stroke();
  }
  ctx.restore();
}
function formSetIcon(form){
  const key = 'formset:'+form;
  if (iconCache[key]) return iconCache[key];
  const cv = document.createElement('canvas'); cv.width=cv.height=64; const c=cv.getContext('2d');
  R.iconDraw = true;
  try { drawFormBuilding(c, {type:'hub', x:0,y:0,born:0,lv:1}, form, 4, 8, 56, 56/3, 2, 4, 5, false, 32, 36); } catch(e){}
  R.iconDraw = false;
  return iconCache[key] = cv.toDataURL();
}

function drawFormBuilding(ctx, b, form, sx, sy, w, z, pad, depth, rad, gld, cx, cy){
  const B = BUILDINGS[b.type]; if (!B) return false;
  const kind = formKind(b.type); const P = formPal(form); if (!kind || !P) return false;
  const mega = !!B.mega || !!B.hubExt;
  // drop shadow on the footprint
  ctx.fillStyle='rgba(0,0,0,.28)'; rr(ctx, sx+pad+z*.05, sy+pad+depth+z*.04, w-pad*2, w-pad*2, rad); ctx.fill();
  if (form==='rustic') drawFormRustic(ctx, b, kind, mega, sx, sy, w, z, P, gld, cx);
  else if (form==='steam') drawFormSteam(ctx, b, kind, mega, sx, sy, w, z, P, gld, cx);
  else if (form==='castle') drawFormCastle(ctx, b, kind, mega, sx, sy, w, z, P, gld, cx);
  else if (form==='scifi') drawFormScifi(ctx, b, kind, mega, sx, sy, w, z, P, gld, cx);
  else return false;
  return true;
}

function drawFormRustic(c, b, kind, mega, sx, sy, w, z, P, gld, cx){
  const t = R.time||0;
  const logWall = (x,y,bw,bh) => {
    ffill(c, P.wall, x, y, bw, bh, z*0.06);
    c.strokeStyle=P.wallD; c.lineWidth=Math.max(1,z*0.04); c.globalAlpha=0.55;
    const n=Math.max(3, Math.round(bh/(z*0.16)));
    for (let i=1;i<n;i++){ c.beginPath(); c.moveTo(x,y+bh*i/n); c.lineTo(x+bw,y+bh*i/n); c.stroke(); }
    c.globalAlpha=1;
    ffill(c, P.stone, x, y+bh-z*0.12, bw, z*0.12, 2);
  };
  if (kind==='hub'){
    ffill(c, P.stone, sx+z*0.15, sy+w*0.72, w-z*0.3, w*0.22, z*0.08);
    logWall(sx+z*0.28, sy+w*0.38, w-z*0.56, w*0.42);
    formRoof(c, sx+z*0.08, sy+z*0.18, w-z*0.16, w*0.28, P.roof, P.roofL, mixHex(P.roof,'#000',0.15));
    formChimney(c, sx+w*0.72, sy+z*0.02, z*0.32, z*0.55, P.stoneD, P.roofL, b.x+2.2, b.y+0.1);
    formWindows(c, sx+z*0.5, sy+w*0.48, z*0.32, mega?4:3, z*0.62, P.win);
    ffill(c, P.woodD, cx-z*0.28, sy+w*0.58, z*0.56, z*0.28, z*0.06); // door
    formBanner(c, sx+z*0.28, sy+z*0.05, z*0.7, P.accent, t);
    formHubSign(c, cx, sy+w-z*0.32, z, gld?'👑 HUB':(mega?'HUB 2':'HUB'), P.woodD, '#fff');
    if (gld){ for (let i=0;i<3;i++){ c.globalAlpha=(Math.sin(t*3+i)+1)/2; sparkle(c, sx+z*(0.7+i*0.7), sy+z*(0.4+0.3*(i%2)), z*0.12, '#fff'); } c.globalAlpha=1; }
    return;
  }
  if (kind==='cutter' || kind==='workshop'){
    // Log cabin mill + turning waterwheel
    const bodyW = w*0.72;
    logWall(sx+z*0.06, sy+w*0.32, bodyW, w*0.58);
    formRoof(c, sx, sy+z*0.08, bodyW+z*0.16, w*0.3, P.roof, P.roofL, mixHex(P.roof,'#000',0.18));
    formWindows(c, sx+z*0.16, sy+w*0.44, Math.max(6,z*0.18*Math.min(2,Bsize(w,z))), kind==='workshop'?3:2, z*0.28*Math.max(1,w/z/1.4), P.win);
    // water under wheel
    c.fillStyle='rgba(80,160,220,.55)'; c.beginPath(); c.ellipse(sx+w*0.86, sy+w*0.82, w*0.16, w*0.08, 0, 0, 7); c.fill();
    formWheel(c, sx+w*0.86, sy+w*0.58, w*0.28, t*2.2, P.woodD, P.wood);
    if (kind==='workshop'){ c.save(); c.translate(sx+bodyW*0.55, sy+w*0.55); c.rotate(t*4); c.fillStyle='#7f8c8d'; gearPath(c,0,0,z*0.16,7); c.fill(); c.restore(); }
    if (mega) formChimney(c, sx+bodyW*0.7, sy+z*0.0, z*0.22, z*0.4, P.stoneD, P.roof, b.x+1.5, b.y);
    return;
  }
  if (kind==='smelter' || kind==='forge' || kind==='starforge'){
    ffill(c, P.stoneD, sx+w*0.08, sy+w*0.28, w*0.84, w*0.64, z*0.08);
    ffill(c, P.stone, sx+w*0.12, sy+w*0.32, w*0.76, w*0.52, z*0.06);
    // glowing mouth
    const gl = 0.55+0.45*Math.sin(t*6);
    c.fillStyle=`rgba(255,${120+gl*80|0},40,${0.65+gl*0.3})`;
    rr(c, sx+w*0.32, sy+w*0.52, w*0.36, w*0.28, z*0.08); c.fill();
    formChimney(c, sx+w*0.18, sy+z*0.0, z*0.28, w*0.36, P.stoneD, P.roof, b.x+0.4, b.y);
    formChimney(c, sx+w*0.68, sy-z*0.06, z*0.32, w*0.42, P.stoneD, P.roofL, b.x+1.5, b.y);
    if (mega) formChimney(c, sx+w*0.44, sy-z*0.1, z*0.26, w*0.38, P.wallD, P.roof, b.x+1, b.y);
    return;
  }
  if (kind==='drill'){
    // timber derrick / well tower
    ffill(c, P.stone, sx+w*0.18, sy+w*0.72, w*0.64, w*0.22, z*0.05);
    c.strokeStyle=P.woodD; c.lineWidth=Math.max(2,z*0.07);
    c.beginPath(); c.moveTo(sx+w*0.22, sy+w*0.78); c.lineTo(sx+w*0.5, sy+w*0.02); c.lineTo(sx+w*0.78, sy+w*0.78); c.stroke();
    c.beginPath(); c.moveTo(sx+w*0.28, sy+w*0.55); c.lineTo(sx+w*0.72, sy+w*0.55); c.moveTo(sx+w*0.34, sy+w*0.32); c.lineTo(sx+w*0.66, sy+w*0.32); c.stroke();
    // walking beam
    c.save(); c.translate(sx+w*0.5, sy+w*0.12); c.rotate(Math.sin(t*3)*0.35);
    c.fillStyle=P.wood; c.fillRect(-w*0.36, -z*0.05, w*0.72, z*0.1);
    c.restore();
    ffill(c, P.woodD, sx+w*0.42, sy+w*0.58, w*0.16, w*0.22, 2);
    return;
  }
  if (kind==='quarry'){
    ffill(c, P.stone, sx+w*0.08, sy+w*0.42, w*0.62, w*0.5, z*0.08);
    formRoof(c, sx+w*0.02, sy+w*0.22, w*0.7, w*0.24, P.thatch, P.roofL, P.thatch);
    // crane
    c.strokeStyle=P.woodD; c.lineWidth=Math.max(2,z*0.07);
    c.beginPath(); c.moveTo(sx+w*0.7, sy+w*0.85); c.lineTo(sx+w*0.7, sy+w*0.12); c.lineTo(sx+w*0.95, sy+w*0.28); c.stroke();
    c.strokeStyle=P.wood; c.beginPath(); c.moveTo(sx+w*0.95, sy+w*0.28); c.lineTo(sx+w*0.95, sy+w*0.62+Math.sin(t*2)*w*0.06); c.stroke();
    ffill(c, P.stoneD, sx+w*0.88, sy+w*0.62+Math.sin(t*2)*w*0.06, w*0.12, w*0.1, 2);
    return;
  }
  if (kind==='assembler'){
    logWall(sx+z*0.1, sy+w*0.36, w-z*0.2, w*0.56);
    formRoof(c, sx, sy+z*0.1, w, w*0.32, P.roof, P.roofL, mixHex(P.roof,'#000',0.18));
    formWindows(c, sx+z*0.22, sy+w*0.48, z*0.28, 3, z*0.5, P.win);
    formBanner(c, sx+w*0.12, sy+z*0.02, z*0.55, P.accent, t);
    return;
  }
  // lab, collider, nexus, default: cottage with crystal
  logWall(sx+z*0.12, sy+w*0.4, w-z*0.24, w*0.5);
  formRoof(c, sx+z*0.02, sy+z*0.12, w-z*0.04, w*0.34, P.roof, P.roofL, mixHex(P.roof,'#000',0.18));
  formWindows(c, sx+z*0.28, sy+w*0.5, z*0.26, 2, z*0.46, P.win);
  // roof crystal
  const pulse=0.5+0.5*Math.sin(t*4);
  c.fillStyle=mixHex('#7cf3ff','#b44bff',pulse); ftri(c, c.fillStyle, cx, sy+z*0.02, cx-z*0.16, sy+z*0.22, cx+z*0.16, sy+z*0.22);
}

function Bsize(w,z){ return w/z; }

function drawFormSteam(c, b, kind, mega, sx, sy, w, z, P, gld, cx){
  const t=R.time||0;
  if (kind==='hub'){
    // Grand station: brick arches, clock, iron roof, steam
    ffill(c, P.iron, sx+z*0.1, sy+w*0.28, w-z*0.2, w*0.62, z*0.08);
    ffill(c, P.wall, sx+z*0.16, sy+w*0.32, w-z*0.32, w*0.5, z*0.06);
    ffill(c, P.roof, sx+z*0.06, sy+w*0.16, w-z*0.12, w*0.18, z*0.04);
    // arches / doors
    c.fillStyle=P.ironD;
    for (let i=0;i<(mega?4:3);i++){ const ax=sx+z*0.4+i*((w-z*0.8)/(mega?4:3));
      c.beginPath(); c.moveTo(ax, sy+w*0.82); c.lineTo(ax, sy+w*0.52); c.arc(ax+z*0.28, sy+w*0.52, z*0.28, Math.PI, 0); c.lineTo(ax+z*0.56, sy+w*0.82); c.closePath(); c.fill();
      c.fillStyle=P.win; c.beginPath(); c.arc(ax+z*0.28, sy+w*0.54, z*0.16, Math.PI, 0); c.lineTo(ax+z*0.12, sy+w*0.72); c.lineTo(ax+z*0.44, sy+w*0.72); c.fill(); c.fillStyle=P.ironD;
    }
    // clock
    const clk=sx+w*0.5, cly=sy+w*0.26, cr=z*0.28;
    c.fillStyle=P.win; c.beginPath(); c.arc(clk,cly,cr,0,7); c.fill();
    c.strokeStyle=P.brass; c.lineWidth=Math.max(2,z*0.05); c.stroke();
    c.strokeStyle=P.ironD; c.lineWidth=Math.max(1.5,z*0.04);
    c.beginPath(); c.moveTo(clk,cly); c.lineTo(clk+Math.cos(t*0.2-1.57)*cr*0.6, cly+Math.sin(t*0.2-1.57)*cr*0.6); c.stroke();
    c.beginPath(); c.moveTo(clk,cly); c.lineTo(clk+Math.cos(t*2.4-1.57)*cr*0.8, cly+Math.sin(t*2.4-1.57)*cr*0.8); c.stroke();
    formChimney(c, sx+w*0.78, sy+z*0.0, z*0.28, z*0.4, P.iron, P.copper, b.x+2.4, b.y+0.1);
    formHubSign(c, cx, sy+w-z*0.28, z, gld?'👑 HUB':(mega?'HUB 2':'HUB'), P.ironD, P.brass);
    return;
  }
  if (kind==='drill'){
    // Oil-derrick lattice rig
    ffill(c, P.iron, sx+w*0.12, sy+w*0.78, w*0.76, w*0.16, z*0.04);
    c.strokeStyle=P.brass; c.lineWidth=Math.max(2,z*0.07);
    const topY = sy+w*0.02, mid=sx+w*0.5;
    c.beginPath(); c.moveTo(sx+w*0.2, sy+w*0.8); c.lineTo(mid, topY); c.lineTo(sx+w*0.8, sy+w*0.8); c.stroke();
    c.beginPath(); c.moveTo(sx+w*0.28, sy+w*0.8); c.lineTo(mid, topY); c.lineTo(sx+w*0.72, sy+w*0.8); c.stroke();
    // cross braces
    c.lineWidth=Math.max(1.2,z*0.045);
    for (let i=1;i<=4;i++){ const yy=sy+w*(0.16*i); const k=i/5; const half=w*(0.3*(1-k)+0.04); c.beginPath(); c.moveTo(mid-half,yy); c.lineTo(mid+half,yy); c.stroke();
      c.beginPath(); c.moveTo(mid-half,yy); c.lineTo(mid+half*0.2, yy+w*0.12); c.stroke(); }
    // crown spinning
    c.save(); c.translate(mid, topY+z*0.06); c.rotate(t*4);
    c.fillStyle=P.copper; gearPath(c,0,0,z*0.14,6); c.fill(); c.restore();
    // walking beam
    c.save(); c.translate(sx+w*0.18, sy+w*0.28); c.rotate(Math.sin(t*3)*0.4);
    ffill(c, P.iron, -w*0.02, -z*0.06, w*0.42, z*0.12, 2);
    c.restore();
    formSmoke(b.x+0.5, b.y+0.2, 0.03);
    return;
  }
  if (kind==='smelter' || kind==='forge' || kind==='starforge'){
    // riveted boilers
    ffill(c, P.iron, sx+w*0.06, sy+w*0.4, w*0.88, w*0.52, z*0.1);
    for (let i=0;i<(mega?3:2);i++){
      const bx=sx+w*(0.12+i*0.3);
      ffill(c, P.copper, bx, sy+w*0.28, w*0.24, w*0.58, w*0.12);
      ffill(c, P.brass, bx+w*0.04, sy+w*0.22, w*0.16, w*0.08, 2);
      const gl=0.4+0.6*Math.sin(t*5+i);
      c.fillStyle=`rgba(255,${140+gl*80|0},40,${0.5+gl*0.4})`;
      c.beginPath(); c.arc(bx+w*0.12, sy+w*0.7, w*0.07, 0, 7); c.fill();
      formChimney(c, bx+w*0.06, sy+w*0.02, w*0.12, w*0.28, P.iron, P.brass, b.x+0.4+i*0.7, b.y);
    }
    return;
  }
  if (kind==='cutter' || kind==='workshop' || kind==='assembler'){
    ffill(c, P.iron, sx+z*0.08, sy+w*0.34, w-z*0.16, w*0.58, z*0.08);
    ffill(c, P.wall, sx+z*0.12, sy+w*0.38, w-z*0.24, w*0.46, z*0.06);
    ffill(c, P.roof, sx+z*0.04, sy+w*0.16, w-z*0.08, w*0.22, z*0.04);
    // big gear
    c.save(); c.translate(sx+w*0.78, sy+w*0.62); c.rotate(t*2); c.fillStyle=P.brass; gearPath(c,0,0,w*0.2,8); c.fill(); c.fillStyle=P.ironD; c.beginPath(); c.arc(0,0,w*0.07,0,7); c.fill(); c.restore();
    formWindows(c, sx+z*0.22, sy+w*0.48, z*0.2*Math.max(1,w/z/2), 3, z*0.32*Math.max(1,w/z/2), P.win);
    if (kind==='workshop'){
      const cr=z*0.22, clk=sx+w*0.35, cly=sy+w*0.28;
      c.fillStyle=P.win; c.beginPath(); c.arc(clk,cly,cr,0,7); c.fill();
      c.strokeStyle=P.brass; c.lineWidth=2; c.stroke();
      c.beginPath(); c.moveTo(clk,cly); c.lineTo(clk+Math.cos(t*0.5)*cr*0.7,cly+Math.sin(t*0.5)*cr*0.7); c.stroke();
    }
    formChimney(c, sx+w*0.7, sy+z*0.0, z*0.2, z*0.28, P.iron, P.copper, b.x+1.2, b.y);
    return;
  }
  if (kind==='quarry'){
    ffill(c, P.iron, sx+w*0.08, sy+w*0.5, w*0.55, w*0.4, z*0.06);
    // steam crane
    c.strokeStyle=P.brass; c.lineWidth=Math.max(2,z*0.08);
    c.beginPath(); c.moveTo(sx+w*0.62, sy+w*0.85); c.lineTo(sx+w*0.62, sy+w*0.1); c.lineTo(sx+w*0.95, sy+w*0.3); c.stroke();
    formSmoke(b.x+1.4, b.y+0.2, 0.05);
    return;
  }
  // lab / collider / nexus: brass orrery / copper observatory
  ffill(c, P.iron, sx+w*0.12, sy+w*0.5, w*0.76, w*0.4, z*0.08);
  c.fillStyle=P.brass; c.beginPath(); c.arc(cx, sy+w*0.48, w*0.32, Math.PI, 0); c.fill();
  c.fillStyle=P.win; c.globalAlpha=0.55+0.3*Math.sin(t*3); c.beginPath(); c.arc(cx, sy+w*0.48, w*0.22, Math.PI, 0); c.fill(); c.globalAlpha=1;
  c.save(); c.translate(cx, sy+w*0.42); c.rotate(t); c.strokeStyle=P.copper; c.lineWidth=2; c.beginPath(); c.ellipse(0,0,w*0.2,w*0.08,0,0,7); c.stroke(); c.restore();
}

function drawFormCastle(c, b, kind, mega, sx, sy, w, z, P, gld, cx){
  const t=R.time||0;
  if (kind==='hub'){
    // Castle keep
    ffill(c, P.wallD, sx+z*0.22, sy+w*0.28, w-z*0.44, w*0.62, z*0.04);
    ffill(c, P.wall, sx+z*0.26, sy+w*0.32, w-z*0.52, w*0.52, z*0.04);
    formBattlements(c, sx+z*0.2, sy+w*0.2, w-z*0.4, z*0.16, P.stone);
    // corner turrets
    const tur = (x) => { ffill(c, P.wall, x, sy+w*0.18, z*0.42, w*0.7, z*0.04); formBattlements(c, x-z*0.04, sy+w*0.1, z*0.5, z*0.14, P.stone); formRoof(c, x-z*0.06, sy-z*0.02, z*0.54, z*0.2, P.roof, P.roofL, P.roof); };
    tur(sx+z*0.08); tur(sx+w-z*0.5);
    // gate
    c.fillStyle=P.wallD; c.beginPath(); c.moveTo(cx-z*0.32, sy+w*0.82); c.lineTo(cx-z*0.32, sy+w*0.55); c.arc(cx, sy+w*0.55, z*0.32, Math.PI, 0); c.lineTo(cx+z*0.32, sy+w*0.82); c.fill();
    formBanner(c, sx+z*0.55, sy+z*0.02, z*0.7, P.banner, t);
    formBanner(c, sx+w-z*0.7, sy+z*0.02, z*0.7, gld?'#ffd23f':P.banner, t);
    formWindows(c, sx+z*0.7, sy+w*0.4, z*0.22, 3, z*0.5, P.win);
    formHubSign(c, cx, sy+w-z*0.28, z, gld?'👑 HUB':(mega?'HUB 2':'HUB'), P.wallD, P.gold);
    return;
  }
  if (kind==='workshop'){
    // Gothic clocktower workshop
    ffill(c, P.wall, sx+w*0.22, sy+w*0.18, w*0.56, w*0.72, z*0.04);
    formBattlements(c, sx+w*0.2, sy+w*0.12, w*0.6, z*0.12, P.stone);
    formRoof(c, sx+w*0.16, sy-z*0.06, w*0.68, w*0.28, P.roof, P.roofL, mixHex(P.roof,'#000',0.2));
    // clock
    const clk=cx, cly=sy+w*0.42, cr=w*0.16;
    c.fillStyle=P.win; c.beginPath(); c.arc(clk,cly,cr,0,7); c.fill();
    c.strokeStyle=P.gold; c.lineWidth=Math.max(2,z*0.05); c.stroke();
    c.strokeStyle=P.wallD; c.lineWidth=Math.max(1.5,z*0.04);
    c.beginPath(); c.moveTo(clk,cly); c.lineTo(clk+Math.cos(t*0.15-1.57)*cr*0.55, cly+Math.sin(t*0.15-1.57)*cr*0.55); c.stroke();
    c.beginPath(); c.moveTo(clk,cly); c.lineTo(clk+Math.cos(t*1.8-1.57)*cr*0.8, cly+Math.sin(t*1.8-1.57)*cr*0.8); c.stroke();
    // door + side hall
    ffill(c, P.wallD, sx+w*0.06, sy+w*0.62, w*0.2, w*0.3, z*0.04);
    ffill(c, P.wallD, sx+w*0.74, sy+w*0.62, w*0.2, w*0.3, z*0.04);
    ffill(c, P.wallD, cx-z*0.16, sy+w*0.7, z*0.32, z*0.22, z*0.06);
    return;
  }
  if (kind==='smelter' || kind==='forge' || kind==='starforge'){
    // Big brick furnace, tall chimneys, glow
    ffill(c, '#6a2a1a', sx+w*0.08, sy+w*0.36, w*0.84, w*0.56, z*0.06);
    ffill(c, '#8a3a22', sx+w*0.12, sy+w*0.4, w*0.76, w*0.46, z*0.05);
    // brick lines
    c.strokeStyle='rgba(40,10,8,.35)'; c.lineWidth=1;
    for (let i=1;i<6;i++){ c.beginPath(); c.moveTo(sx+w*0.12, sy+w*(0.4+0.08*i)); c.lineTo(sx+w*0.88, sy+w*(0.4+0.08*i)); c.stroke(); }
    const gl=0.5+0.5*Math.sin(t*5);
    c.fillStyle=`rgba(255,${90+gl*100|0},30,${0.7+gl*0.25})`;
    rr(c, sx+w*0.3, sy+w*0.58, w*0.4, w*0.22, z*0.08); c.fill();
    formChimney(c, sx+w*0.16, sy-z*0.08, z*0.28, w*0.5, P.wallD, P.roof, b.x+0.4, b.y);
    formChimney(c, sx+w*0.62, sy-z*0.14, z*0.34, w*0.56, P.wall, P.roofL, b.x+1.4, b.y);
    if (mega) formChimney(c, sx+w*0.4, sy-z*0.04, z*0.22, w*0.42, P.wallD, P.gold, b.x+0.9, b.y);
    return;
  }
  if (kind==='cutter'){
    ffill(c, P.wall, sx+z*0.08, sy+w*0.4, w*0.7, w*0.5, z*0.06);
    formRoof(c, sx, sy+w*0.16, w*0.78, w*0.3, P.roof, P.roofL, P.roof);
    formWheel(c, sx+w*0.86, sy+w*0.58, w*0.26, t*2, P.stoneD, P.stone);
    c.fillStyle='rgba(80,160,220,.5)'; c.beginPath(); c.ellipse(sx+w*0.86, sy+w*0.82, w*0.14, w*0.07, 0,0,7); c.fill();
    return;
  }
  if (kind==='drill'){
    // siege-tower mining scaffold
    ffill(c, P.stone, sx+w*0.2, sy+w*0.7, w*0.6, w*0.22, z*0.04);
    c.strokeStyle=P.wallD; c.lineWidth=Math.max(2,z*0.07);
    c.strokeRect(sx+w*0.28, sy+w*0.08, w*0.44, w*0.64);
    for (let i=1;i<3;i++){ c.beginPath(); c.moveTo(sx+w*0.28, sy+w*(0.08+0.22*i)); c.lineTo(sx+w*0.72, sy+w*(0.08+0.22*i)); c.stroke(); }
    formBanner(c, sx+w*0.32, sy, z*0.5, P.banner, t);
    return;
  }
  if (kind==='quarry'){
    ffill(c, P.stone, sx+w*0.08, sy+w*0.4, w*0.84, w*0.5, z*0.06);
    formBattlements(c, sx+w*0.08, sy+w*0.32, w*0.84, z*0.12, P.wall);
    formWindows(c, sx+w*0.2, sy+w*0.52, z*0.2, 3, z*0.24, P.win);
    return;
  }
  if (kind==='lab' || kind==='nexus' || kind==='collider'){
    // wizard tower
    ffill(c, P.wall, sx+w*0.28, sy+w*0.22, w*0.44, w*0.7, z*0.04);
    formRoof(c, sx+w*0.18, sy-z*0.06, w*0.64, w*0.34, '#3a1a68', '#8a4bff', '#2a1048');
    formWindows(c, sx+w*0.4, sy+w*0.4, z*0.18, 1, 0, P.win);
    const pulse=0.5+0.5*Math.sin(t*4);
    c.fillStyle=`rgba(180,80,255,${0.4+pulse*0.4})`; c.beginPath(); c.arc(cx, sy+z*0.08, z*0.1, 0, 7); c.fill();
    formBanner(c, sx+w*0.74, sy+w*0.2, z*0.55, P.banner, t);
    return;
  }
  // assembler default: great hall
  ffill(c, P.wall, sx+z*0.1, sy+w*0.36, w-z*0.2, w*0.54, z*0.06);
  formRoof(c, sx, sy+z*0.08, w, w*0.34, P.roof, P.roofL, P.roof);
  formWindows(c, sx+z*0.24, sy+w*0.48, z*0.22, 4, z*0.38, P.win);
  formBanner(c, sx+w*0.12, sy+z*0.02, z*0.5, P.banner, t);
}

function drawFormScifi(c, b, kind, mega, sx, sy, w, z, P, gld, cx){
  const t=R.time||0;
  const pulse=0.45+0.55*Math.sin(t*4);
  const glow = (x,y,r,col) => { c.fillStyle=col; c.globalAlpha=0.35+0.4*pulse; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); c.globalAlpha=1; c.fillStyle=col; c.beginPath(); c.arc(x,y,r*0.45,0,7); c.fill(); };
  if (kind==='hub'){
    // Grand spaceport station
    ffill(c, P.metalD, sx+z*0.12, sy+w*0.42, w-z*0.24, w*0.48, z*0.14);
    ffill(c, P.metal, sx+z*0.18, sy+w*0.46, w-z*0.36, w*0.36, z*0.1);
    // landing ring
    c.strokeStyle=P.glow; c.globalAlpha=0.5+0.5*pulse; c.lineWidth=Math.max(2,z*0.07);
    c.beginPath(); c.ellipse(cx, sy+w*0.7, w*0.38, w*0.1, 0, 0, 7); c.stroke(); c.globalAlpha=1;
    // dome
    c.fillStyle=P.roof; c.beginPath(); c.ellipse(cx, sy+w*0.42, w*0.32, w*0.22, 0, Math.PI, 0); c.fill();
    c.fillStyle=`rgba(62,224,255,${0.25+0.25*pulse})`; c.beginPath(); c.ellipse(cx, sy+w*0.42, w*0.22, w*0.15, 0, Math.PI, 0); c.fill();
    // antenna
    c.strokeStyle=P.metal; c.lineWidth=Math.max(2,z*0.06); c.beginPath(); c.moveTo(cx, sy+w*0.22); c.lineTo(cx, sy+z*0.02); c.stroke();
    glow(cx, sy+z*0.02, z*0.1, P.glow);
    // pad lights
    for (let i=0;i<5;i++){ c.fillStyle = (Math.floor(t*3)+i)%2 ? P.glow : P.glow2; c.beginPath(); c.arc(sx+z*0.4+i*z*0.5, sy+w*0.86, z*0.06, 0, 7); c.fill(); }
    formHubSign(c, cx, sy+w-z*0.26, z, gld?'👑 HUB':(mega?'HUB 2':'HUB'), P.metalD, P.glow);
    return;
  }
  if (kind==='drill'){
    // tripod laser mining rig
    c.strokeStyle=P.metal; c.lineWidth=Math.max(2,z*0.08);
    c.beginPath(); c.moveTo(cx, sy+w*0.18); c.lineTo(sx+w*0.16, sy+w*0.88); c.moveTo(cx, sy+w*0.18); c.lineTo(sx+w*0.84, sy+w*0.88); c.moveTo(cx, sy+w*0.18); c.lineTo(cx, sy+w*0.88); c.stroke();
    c.fillStyle=P.metalD; c.beginPath(); c.arc(cx, sy+w*0.22, w*0.16, 0, 7); c.fill();
    glow(cx, sy+w*0.22, w*0.1, P.glow);
    // beam
    c.strokeStyle=`rgba(62,224,255,${0.4+0.5*pulse})`; c.lineWidth=Math.max(2,z*0.06);
    c.beginPath(); c.moveTo(cx, sy+w*0.32); c.lineTo(cx, sy+w*0.86); c.stroke();
    glow(cx, sy+w*0.86, z*0.1, '#fff');
    return;
  }
  if (kind==='lab' || kind==='collider' || kind==='nexus' || kind==='assembler' || kind==='workshop'){
    // domed lab / sci-fi pod
    ffill(c, P.metalD, sx+w*0.12, sy+w*0.52, w*0.76, w*0.36, z*0.12);
    c.fillStyle=P.metal; c.beginPath(); c.ellipse(cx, sy+w*0.54, w*0.38, w*0.36, 0, Math.PI, 0); c.fill();
    c.fillStyle=`rgba(62,224,255,${0.28+0.3*pulse})`; c.beginPath(); c.ellipse(cx, sy+w*0.54, w*0.28, w*0.26, 0, Math.PI, 0); c.fill();
    // ring
    c.strokeStyle=P.glow2; c.globalAlpha=0.7; c.lineWidth=Math.max(2,z*0.06);
    c.beginPath(); c.ellipse(cx, sy+w*0.58, w*0.42, w*0.1, 0, 0, 7); c.stroke(); c.globalAlpha=1;
    glow(cx, sy+w*0.28, z*0.1, (Math.floor(t*4)%2)?P.glow:P.glow2);
    if (kind==='workshop' || kind==='assembler'){ c.save(); c.translate(sx+w*0.82, sy+w*0.7); c.rotate(t*3); c.strokeStyle=P.glow; c.lineWidth=2; c.strokeRect(-z*0.14,-z*0.14,z*0.28,z*0.28); c.restore(); }
    return;
  }
  if (kind==='smelter' || kind==='forge' || kind==='starforge'){
    // plasma furnace cylinder
    ffill(c, P.metalD, sx+w*0.22, sy+w*0.18, w*0.56, w*0.7, w*0.28);
    ffill(c, P.metal, sx+w*0.26, sy+w*0.22, w*0.48, w*0.62, w*0.24);
    const gl=0.4+0.6*Math.sin(t*6);
    c.fillStyle=`rgba(255,${80+gl*80|0},255,${0.45+gl*0.4})`;
    c.beginPath(); c.arc(cx, sy+w*0.55, w*0.16, 0, 7); c.fill();
    glow(cx, sy+w*0.2, z*0.12, P.glow);
    // vents
    for (let i=0;i<4;i++) formSmoke(b.x+0.4+i*0.3, b.y, 0.02);
    return;
  }
  if (kind==='cutter'){
    ffill(c, P.metalD, sx+w*0.1, sy+w*0.4, w*0.8, w*0.48, z*0.12);
    c.strokeStyle=P.glow; c.lineWidth=Math.max(2,z*0.07); c.globalAlpha=0.5+0.5*pulse;
    c.beginPath(); c.moveTo(sx+w*0.2, sy+w*0.55); c.lineTo(sx+w*0.8, sy+w*0.55); c.stroke(); c.globalAlpha=1;
    c.save(); c.translate(sx+w*0.78, sy+w*0.55); c.rotate(t*8); c.strokeStyle='#fff'; c.beginPath(); c.moveTo(-z*0.16,0); c.lineTo(z*0.16,0); c.moveTo(0,-z*0.16); c.lineTo(0,z*0.16); c.stroke(); c.restore();
    return;
  }
  if (kind==='quarry'){
    ffill(c, P.metalD, sx+w*0.1, sy+w*0.5, w*0.8, w*0.38, z*0.1);
    glow(sx+w*0.3, sy+w*0.4, z*0.12, P.glow);
    glow(sx+w*0.7, sy+w*0.36, z*0.1, P.glow2);
    return;
  }
  // default pod
  ffill(c, P.metalD, sx+w*0.14, sy+w*0.4, w*0.72, w*0.48, z*0.14);
  c.fillStyle=`rgba(62,224,255,${0.3+0.3*pulse})`; c.beginPath(); c.ellipse(cx, sy+w*0.5, w*0.28, w*0.22, 0, 0, 7); c.fill();
}

function drawFormIcon(c, type, form, x, y, s){
  const B = BUILDINGS[type]; if (!B) return;
  const z = s / Math.max(1, B.size);
  const sx = x - s/2, sy = y - s/2;
  R.iconDraw = true;
  try { drawFormBuilding(c, {type, x:0, y:0, born:0, lv:1}, form, sx, sy, s, z, z*0.07, z*0.16, z*0.2, false, x, y); } catch(e){}
  R.iconDraw = false;
}

function drawBuilding(b){
  if (R.moveHub && b && b.type==='hub') return;
  const B = b && BUILDINGS[b.type]; if (!B) return;
  if (B.landmark){ try { drawLandmark(b); } catch(e){} return; }
  const z = cam.z, sz = B.size;
  let [sx,sy] = toScreen(b.x, b.y); const w = sz*z;
  if (sx>W+w||sy>H+w||sx<-w*2||sy<-w*2) return;
  const age = R.time - b.born; let sc = age < 0.45 ? 0.6 + 0.4*easeOutBack(age/0.45) : 1;
  if (b.type==='hub' || (B && B.hubExt)) sc *= 1 + R.hubPulse*0.05;
  sc *= 1 + (b.pop||0)*0.06;
  const cx = sx + w/2, cy = sy + w/2; ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
  const pad = z*0.07, depth = z*0.16, rad = z*0.2;
  const gld = isGoldB(b) || (b.type==='hub' && (goldHub() || cosOn('prism') || cosOn('nova'))), gh = b.type==='hub' && gld;
  const form = formSetId();
  const drewForm = !B.hut && !!form && drawFormBuilding(ctx, b, form, sx, sy, w, z, pad, depth, rad, gld, cx, cy);
  if (!drewForm && !B.hut){
  ctx.fillStyle='rgba(0,0,0,.25)'; rr(ctx, sx+pad+z*.06, sy+pad+depth+z*.06, w-pad*2, w-pad*2, rad); ctx.fill();
  if (gld){ ctx.save(); ctx.shadowColor = 'rgba(255,200,40,'+(0.75+0.25*Math.sin(R.time*3+b.x))+')'; ctx.shadowBlur = z*0.45; }
  ctx.fillStyle = gld ? '#c98a00' : skinHex(B.side, 'side'); rr(ctx, sx+pad, sy+pad+depth*0.4, w-pad*2, Math.max(0, w-pad-depth*0.4), rad); ctx.fill();
  if (gld){ ctx.restore(); const g = ctx.createLinearGradient(sx, sy, sx+w, sy+w); const cz = b.type==='hub' ? (cosOn('nova') ? ['#ffd6ff','#a55eea','#3c1a78'] : cosOn('prism') ? ['#a8fff0','#ffd23f','#ff7eb6'] : null) : null; const cs = cz || ['#fff3b0','#ffd23f','#f0a500']; g.addColorStop(0,cs[0]); g.addColorStop(.45,cs[1]); g.addColorStop(1,cs[2]); ctx.fillStyle = g; } else { ctx.fillStyle = skinHex(B.top, 'top'); }
  rr(ctx, sx+pad, sy+pad-depth*0.4, w-pad*2, w-pad*2, rad); ctx.fill();
  if (B.mega && !gld){ ctx.strokeStyle = world().accent; ctx.lineWidth=Math.max(2,z*.08); rr(ctx,sx+pad,sy+pad-depth*0.4,w-pad*2,w-pad*2,rad); ctx.stroke(); }
  if (gld){ ctx.strokeStyle = '#fff6c9'; ctx.lineWidth = Math.max(1, z*0.04); rr(ctx, sx+pad, sy+pad-depth*0.4, w-pad*2, w-pad*2, rad); ctx.stroke();
    const tw = (Math.sin(R.time*4 + b.y*1.7)+1)/2; ctx.globalAlpha = 0.5+0.5*tw; sparkle(ctx, sx+pad+z*0.16, sy+pad-depth*0.4+z*0.16, z*0.09, '#ffffff'); ctx.globalAlpha = 1; }
  ctx.fillStyle='rgba(255,255,255,.25)'; rr(ctx, sx+pad+z*.06, sy+pad-depth*0.4+z*.05, w-pad*2-z*.12, z*.12, z*.06); ctx.fill();
  }
  const icx = cx, icy = cy - depth*0.4;
  if (drewForm){ /* themed silhouette already painted */ }
  else if (b.type==='hub'){
    // factory: roof stripes, chimney, flag
    ctx.fillStyle=gh?'#d99a00':'#5a4bd6'; for (let i=0;i<3;i++) rr(ctx, sx+z*0.45+i*z*0.75, sy+z*0.55, z*0.55, z*0.9, z*0.1), ctx.fill();
    ctx.fillStyle=gh?'#ffffff':'#ffeaa7'; for (let i=0;i<3;i++){ rr(ctx, sx+z*0.55+i*z*0.75, sy+z*1.75, z*0.35, z*0.35, z*0.06); ctx.fill(); }
    ctx.fillStyle=gh?'#a86b00':'#3d3290'; rr(ctx, sx+z*2.25, sy+z*0.32, z*0.38, z*0.75, z*0.08); ctx.fill();
    ctx.fillStyle='#ff7675'; ctx.fillRect(sx+z*2.25, sy+z*0.37, z*0.38, z*0.1);
    if (Math.random() < 0.04*(60/Math.max(30,fps))) R.parts.push({x:b.x+2.44, y:b.y+0.32, vx:(Math.random()-.5)*.2, vy:-.6, life:2, max:2, col:'rgba(240,240,250,', size:.22, smoke:true});
    // flag stays on the roof so it never plants into a factory sitting north of the Hub
    const fx = sx+z*0.35, fy = sy+z*0.52; ctx.strokeStyle='#2d3436'; ctx.lineWidth=z*.05; ctx.beginPath(); ctx.moveTo(fx,fy+z*.6); ctx.lineTo(fx,fy-z*.3); ctx.stroke();
    ctx.fillStyle=gh?'#ffd23f':'#00b894'; ctx.beginPath(); ctx.moveTo(fx,fy-z*.3); const wv = Math.sin(R.time*5)*z*.05; ctx.quadraticCurveTo(fx+z*.25,fy-z*.3+wv,fx+z*.5,fy-z*.2); ctx.lineTo(fx,fy-z*.05); ctx.fill();
    ctx.fillStyle=gh?'#7a4b00':'#fff'; ctx.font=`900 ${Math.max(8,z*0.3)}px -apple-system,Segoe UI,sans-serif`; ctx.textAlign='center'; ctx.fillText(gh?'👑 HUB':'HUB', cx, sy+z*2.55);
    if (gh){ for (let i=0;i<3;i++){ const tw=(Math.sin(R.time*3+i*2.1)+1)/2; ctx.globalAlpha=tw; sparkle(ctx, sx+z*(0.6+i*0.9), sy+z*(0.35+0.5*(i%2)), z*0.14, '#fff'); } ctx.globalAlpha=1; }
  } else if (B.hubExt){
    // Mini-Hub Extension: same factory language as Main Hub, sized for 4×4, world-accent trim
    const accent = world().accent || '#00b894';
    ctx.fillStyle='#5a4bd6'; for (let i=0;i<4;i++){ rr(ctx, sx+z*0.45+i*z*0.85, sy+z*0.7, z*0.6, z*1.15, z*0.1); ctx.fill(); }
    // windows
    ctx.fillStyle='#ffeaa7'; for (let i=0;i<3;i++){ rr(ctx, sx+z*0.85+i*z*0.9, sy+z*2.15, z*0.4, z*0.4, z*0.06); ctx.fill(); }
    // intake doors on left + right (belts feed in)
    ctx.fillStyle='#2d3436';
    rr(ctx, sx+pad+z*0.02, sy+z*1.55, z*0.38, z*1.25, z*0.08); ctx.fill();
    rr(ctx, sx+w-pad-z*0.4, sy+z*1.55, z*0.38, z*1.25, z*0.08); ctx.fill();
    ctx.fillStyle='#ffeaa7';
    rr(ctx, sx+pad+z*0.1, sy+z*1.8, z*0.22, z*0.75, z*0.05); ctx.fill();
    rr(ctx, sx+w-pad-z*0.32, sy+z*1.8, z*0.22, z*0.75, z*0.05); ctx.fill();
    // chimney + world-colored cap + smoke
    ctx.fillStyle='#3d3290'; rr(ctx, sx+z*3.15, sy+z*0.32, z*0.42, z*0.9, z*0.08); ctx.fill();
    ctx.fillStyle=accent; ctx.fillRect(sx+z*3.15, sy+z*0.38, z*0.42, z*0.12);
    if (Math.random() < 0.04*(60/Math.max(30,fps))) R.parts.push({x:b.x+3.35, y:b.y+0.32, vx:(Math.random()-.5)*.2, vy:-.6, life:2, max:2, col:'rgba(240,240,250,', size:.22, smoke:true});
    // flag stays on the roof so it never plants into a factory sitting north of the Hub
    const fx2 = sx+z*0.4, fy2 = sy+z*0.55; ctx.strokeStyle='#2d3436'; ctx.lineWidth=z*.05; ctx.beginPath(); ctx.moveTo(fx2,fy2+z*.7); ctx.lineTo(fx2,fy2-z*.35); ctx.stroke();
    ctx.fillStyle=accent; ctx.beginPath(); ctx.moveTo(fx2,fy2-z*.35); const wv2 = Math.sin(R.time*5)*z*.05; ctx.quadraticCurveTo(fx2+z*.28,fy2-z*.35+wv2,fx2+z*.55,fy2-z*.2); ctx.lineTo(fx2,fy2-z*.05); ctx.fill();
    // crate emblem + HUB 2 badge
    drawItem(ctx, 'box', icx, icy - z*0.1, z*0.7);
    ctx.fillStyle='#2d3436'; rr(ctx, cx-z*1.0, sy+z*3.25, z*2.0, z*0.55, z*0.12); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font=`900 ${Math.max(9,z*0.34)}px -apple-system,Segoe UI,sans-serif`; ctx.textAlign='center'; ctx.fillText('HUB 2', cx, sy+z*3.62);
  } else if (B.hut){
    drawHutCottage(ctx, b, sx, sy, w, z, cx, cy);
  }
  if (B.on){
    const item = harvestItem(b) || (b.tv != null && RES[b.tv] && RES[b.tv].item) || 'wood';
    const isz = B.mega ? z*1.15 : z*0.5;
    drawItem(ctx, item, icx, icy + (B.mega?z*0.06:z*0.04), isz);
    // spinning blade
    const working = !b.blocked; ctx.save(); ctx.translate(sx+w-pad-z*.18, sy+pad+z*.1); ctx.rotate(working ? R.time*6 : 0);
    ctx.fillStyle='#ecf0f1'; gearPath(ctx,0,0,z*(B.mega?0.28:0.16),6); ctx.fill(); ctx.fillStyle='#636e72'; ctx.beginPath(); ctx.arc(0,0,z*(B.mega?0.08:0.05),0,7); ctx.fill(); ctx.restore();
    const iv = ivOf(b)/(harvestMul()*lvSpeed(b.lv||1)); progRing(icx, icy, B.mega ? z*0.85 : z*0.4, Math.min(1,b.t/iv), b.blocked ? '#e17055' : '#fff');
    if (B.mega) drawMegaCaption(icx, sy+w-z*0.12, z, item);
  } else if (B.recipes){
    const r = RECIPES[b.recipe];
    const ringR = B.mega ? z*1.05 : z*0.62;
    ctx.fillStyle='rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(icx, icy, ringR, 0, 7); ctx.fill();
    drawItem(ctx, b.recipe, icx, icy, B.mega ? z*1.35 : z*0.82);
    if (r) progRing(icx, icy, ringR, b.crafting ? b.craftT/r.time : 0, '#6c5ce7');
    if (B.mega) drawMegaCaption(icx, sy+w-z*0.12, z, b.recipe);
    if (b.type==='smelter' && b.crafting){ ctx.fillStyle = `rgba(255,${150+Math.random()*80|0},60,.9)`; ctx.beginPath(); ctx.arc(sx+w-z*.4, sy+z*.35, z*.1+Math.random()*z*.04, 0, 7); ctx.fill(); }
    if (b.type==='workshop' && b.crafting){ ctx.save(); ctx.translate(sx+z*.35, sy+z*.3); ctx.rotate(R.time*4); ctx.fillStyle='#7f8c8d'; gearPath(ctx,0,0,z*.15,7); ctx.fill(); ctx.restore(); }
    if (r && !b.crafting && b.outQ===0){ const missing = !b.paused && Object.keys(r.in).some(k => crAvail(k) <= 0 && (b.buf[k]||0) + (b.inPath?inTransit(b.inPath,k):0) < r.in[k]); if (missing && Math.sin(R.time*4)>0){ ctx.fillStyle='#e17055'; ctx.beginPath(); ctx.arc(sx+w-pad-z*.12, sy+pad, z*.16, 0, 7); ctx.fill(); ctx.fillStyle='#fff'; ctx.font=`900 ${z*.24}px sans-serif`; ctx.textAlign='center'; ctx.fillText('!', sx+w-pad-z*.12, sy+pad+z*.09); } }
  }
  if (drewForm){
    if (!B.hut && (b.lv||1) >= 3){ ctx.strokeStyle=LV_COL[b.lv||1]; ctx.lineWidth=Math.max(2,z*.06); rr(ctx, sx+pad, sy+z*0.04, w-pad*2, w-z*0.1, rad); ctx.stroke(); }
    try { paintFormCosmetic(ctx, b, sx, sy, w, z); } catch(e){}
  } else {
    if (!B.hut && (b.lv||1) >= 3){ ctx.strokeStyle=LV_COL[b.lv||1]; ctx.lineWidth=Math.max(2,z*.06); rr(ctx, sx+pad, sy+pad-depth*0.4, w-pad*2, w-pad*2, rad); ctx.stroke(); }
    strokeBuildingOutline(ctx, b, sx, sy, z);
    if (!gld) try { paintBuildCosmetic(ctx, b, sx, sy, w, z, pad, depth, rad); } catch(e){}
  }
  if (b.paused){
    // slight dim / desaturate so the pause badge has a quiet building under it
    ctx.fillStyle = 'rgba(28,12,14,.48)';
    if (B.hut) rr(ctx, sx, sy, w, w, z*.16), ctx.fill();
    else rr(ctx, sx+pad, sy+pad-depth*0.4, w-pad*2, w-pad*2+depth, rad), ctx.fill();
  }
  ctx.restore();
}
// one label per building: a single pill "T3" / "T3 · x2", centred on the building's front edge.
// Drawn in its own pass after every building so neighbours, belts, rings and gears never cover it.
function drawBadge(b){
  const lv = b.lv||1; if (lv <= 1) return;
  const B = BUILDINGS[b.type], z = cam.z, [sx,sy] = toScreen(b.x, b.y);
  const cx = sx + B.size*z/2, cy = sy - z*0.15;
  ctx.save();
  ctx.fillStyle = LV_COL[lv] || '#fdcb6e';
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(9, z*0.22), 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#2d3436'; ctx.font = `900 ${Math.max(10, z*0.28)}px -apple-system,Segoe UI,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('L'+lv, cx, cy+0.5);
  ctx.restore();
}
function pauseBadgeLayout(b, force){
  if (!b || (!force && !b.paused)) return null;
  const B = BUILDINGS[b.type]; if (!B) return null;
  const z = cam.z, [sx,sy] = toScreen(b.x, b.y);
  const cx = sx + B.size*z/2, cy = sy + B.size*z * 0.22;
  // Visual size stays readable when zoomed out; hit target is at least 44px on iPhone.
  const r = Math.max(12, Math.min(30, z * (B.size >= 3 ? 0.40 : 0.50)));
  const hit = Math.max(22, r + 6);
  return {cx, cy, r, hit};
}
function pauseBadgeAt(sx, sy){
  let best = null, bd = Infinity;
  for (const b of allB()){
    const L = pauseBadgeLayout(b); if (!L) continue;
    const d = Math.hypot(sx-L.cx, sy-L.cy);
    if (d <= L.hit && d < bd){ bd = d; best = b; }
  }
  return best;
}
function resumeFromBadge(b){
  if (!b || !b.paused) return false;
  const L = pauseBadgeLayout(b, true);
  b.paused = false;
  if (L){
    if (!R.pausePop) R.pausePop = [];
    R.pausePop.push({sx:L.cx, sy:L.cy, r:L.r, t:0, max:0.45});
  }
  try { sfx('click'); } catch(e){}
  try { vibrate(12); } catch(e){}
  R.dirty = true;
  try { save(); } catch(e){}
  return true;
}
function drawPauseBadge(b){
  const L = pauseBadgeLayout(b); if (!L) return;
  const {cx, cy, r} = L;
  const pulse = 0.90 + 0.10*Math.sin((R.time||0)*3.4);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.arc(cx+1.2, cy+2.2, r, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(cx-r*.32, cy-r*.38, r*.08, cx, cy, r);
  g.addColorStop(0, '#ff7a72');
  g.addColorStop(.5, '#d63031');
  g.addColorStop(1, '#6b1010');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(2.2, r*0.16);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = Math.max(1, r*0.06);
  ctx.beginPath(); ctx.arc(cx, cy-r*0.08, r*0.72, Math.PI*1.15, Math.PI*1.9); ctx.stroke();
  ctx.fillStyle = '#fff';
  const bw = Math.max(3, r*0.22), bh = Math.max(9, r*0.74), gap = Math.max(2.5, r*0.15);
  rr(ctx, cx-gap-bw, cy-bh/2, bw, bh, Math.max(1, r*0.08)); ctx.fill();
  rr(ctx, cx+gap, cy-bh/2, bw, bh, Math.max(1, r*0.08)); ctx.fill();
  ctx.restore();
}
function drawPausePops(dt){
  const pops = R.pausePop; if (!pops || !pops.length) return;
  for (let i=pops.length-1;i>=0;i--){
    const p = pops[i]; p.t += dt;
    if (p.t >= p.max){ pops.splice(i,1); continue; }
    const u = p.t/p.max, pop = 1 + 0.55*Math.sin(Math.min(1, u*1.15)*Math.PI), a = u<0.2 ? u/0.2 : 1-(u-0.2)/0.8;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(p.sx, p.sy); ctx.scale(pop, pop);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = Math.max(2, p.r*0.1);
    ctx.beginPath(); ctx.arc(0, 0, p.r*(1+0.9*u), 0, 7); ctx.stroke();
    const g = ctx.createRadialGradient(-p.r*.3, -p.r*.35, p.r*.1, 0, 0, p.r);
    g.addColorStop(0, '#c8ffd8');
    g.addColorStop(.55, '#00b894');
    g.addColorStop(1, '#0a6b54');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(2.2, p.r*0.16);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-p.r*.18, -p.r*.32);
    ctx.lineTo(-p.r*.18, p.r*.32);
    ctx.lineTo(p.r*.4, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function progRing(x,y,r,f,col){ if (f<=0) return; ctx.strokeStyle=col; ctx.lineWidth=Math.max(2,cam.z*.06); ctx.lineCap='round'; ctx.beginPath(); ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+f*Math.PI*2); ctx.stroke(); }
const easeOutBack = t => { const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); };
function drawSel(){
  const sel = R.sel; if (!sel || !sel.ghost) return;
  const {type, x, y} = sel.ghost, z = cam.z;
  const ignore = (R.moveLand && R.moveLand.uid) || (R.moveHub && R.moveHub.uid) || 0;
  const ok = !placeCheck(type,x,y, ignore); const pulse = 0.5+0.5*Math.sin(R.time*6);
  ctx.fillStyle = ok ? `rgba(85,239,196,${.25+.15*pulse})` : `rgba(255,118,117,${.3+.15*pulse})`;
  ctx.strokeStyle = ok ? '#00b894' : '#d63031'; ctx.lineWidth = 3; ctx.setLineDash([8,6]); ctx.lineDashOffset = -R.time*20;
  for (const [fx,fy] of footprint(type,x,y)){
    const [sx,sy] = toScreen(fx,fy);
    rr(ctx, sx+2, sy+2, z-4, z-4, z*.18); ctx.fill(); ctx.stroke();
  }
  ctx.setLineDash([]);
}
function drawHutFlash(dt){
  const f = R.hutFlash; if (!f) return;
  f.t -= dt; if (f.t <= 0){ R.hutFlash = null; return; }
  if (!S || !Array.isArray(S.b)) return;
  let b = null;
  for (const o of S.b){ if (o && o.uid === f.uid){ b = o; break; } }
  if (!b || !BUILDINGS[b.type]){ R.hutFlash = null; return; }
  const [cx,cy] = hutCenter(b), [sx,sy] = toScreen(cx,cy), z = cam.z, s = BUILDINGS[b.type].size;
  const pulse = 0.5 + 0.5*Math.sin(R.time*8);
  const a = Math.min(1, f.t * 1.6);
  const r = s*z*0.72 + pulse*z*0.2;
  const rock = b.type==='rockHut';
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7);
  ctx.fillStyle = rock ? `rgba(200,196,188,${0.16+0.12*pulse})` : `rgba(74,168,98,${0.16+0.12*pulse})`;
  ctx.fill();
  ctx.strokeStyle = rock ? 'rgba(90,101,112,0.95)' : 'rgba(47,122,69,0.95)';
  ctx.lineWidth = Math.max(3, z*0.08);
  ctx.stroke();
  ctx.restore();
}
function drawParts(dt){
  const z = cam.z;
  for (let i=R.parts.length-1;i>=0;i--){
    const p = R.parts[i]; p.life -= dt; if (p.life<=0){ R.parts.splice(i,1); continue; }
    p.x += p.vx*dt; p.y += p.vy*dt; if (!p.smoke && !p.screen) p.vy += 3*dt; if (p.screen) { p.vy += 900*dt; p.rot += p.vr*dt; }
    const a = p.life/p.max;
    if (p.screen){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.col; ctx.globalAlpha=Math.min(1,a*2); ctx.fillRect(-5,-3,10,6); ctx.restore(); ctx.globalAlpha=1; continue; }
    const [sx,sy] = toScreen(p.x,p.y);
    if (p.smoke){ ctx.fillStyle = p.col + (a*0.6) + ')'; ctx.beginPath(); ctx.arc(sx,sy,(p.size*(2-a))*z,0,7); ctx.fill(); }
    else { ctx.fillStyle=p.col; ctx.globalAlpha=a; ctx.beginPath(); ctx.arc(sx,sy,p.size*z*a,0,7); ctx.fill(); ctx.globalAlpha=1; }
  }
  for (let i=R.floats.length-1;i>=0;i--){
    const f = R.floats[i]; f.life -= dt; if (f.life<=0){ R.floats.splice(i,1); continue; }
    const a = f.life/f.max; const [sx,sy] = toScreen(f.x, f.y - (1-a)*1.0 - 0.3);
    ctx.globalAlpha = Math.min(1, a*2); const s = Math.max(16, z*0.5);
    drawItem(ctx, f.id, sx - s*0.55, sy, s);
    ctx.font = `900 ${s*0.62}px -apple-system,Segoe UI,sans-serif`; ctx.textAlign='left'; ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.strokeText('+'+f.n, sx-s*0.05, sy+s*0.22); ctx.fillStyle='#fff'; ctx.fillText('+'+f.n, sx-s*0.05, sy+s*0.22);
    ctx.globalAlpha = 1;
  }
}
const pendingGains = {}; let gainTimer = 0;
function drawX2(dt){ const z = cam.z; for (let i=R.x2.length-1;i>=0;i--){ const f = R.x2[i]; f.life -= dt; if (f.life<=0){ R.x2.splice(i,1); continue; }
  const a = f.life/f.max, [sx,sy] = toScreen(f.x, f.y - (1-a)*0.7), s = Math.max(14, z*0.42)*(a>0.8 ? 1+(a-0.8)*2 : 1);
  ctx.globalAlpha = Math.min(1, a*2.5); ctx.font = `900 ${s}px -apple-system,Segoe UI,sans-serif`; ctx.textAlign='center'; ctx.lineWidth=4; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.strokeText('x2', sx, sy); ctx.fillStyle='#ffd32a'; ctx.fillText('x2', sx, sy); ctx.globalAlpha = 1; } }
function floatGain(id, n, atB){
  const key = (atB && atB.uid) ? 'b'+atB.uid : '_';
  let bag = pendingGains[key];
  if (!bag || !bag.items) bag = pendingGains[key] = { at: atB||null, items:{} };
  bag.at = atB || bag.at || null;
  bag.items[id] = (bag.items[id]||0) + n;
}
function flushGains(dt){
  gainTimer -= dt; if (gainTimer > 0 || !S.hub) return; gainTimer = 0.7;
  for (const key of Object.keys(pendingGains)){
    const bag = pendingGains[key]; if (!bag || !bag.items){ delete pendingGains[key]; continue; }
    const ids = Object.keys(bag.items); if (!ids.length){ delete pendingGains[key]; continue; }
    const at = bag.at && allB().find(b => b.uid === (bag.at.uid || bag.at));
    const bx = at ? at.x + BUILDINGS[at.type].size/2 : S.hub.x+1.5;
    const by = at ? at.y + 0.2 : S.hub.y+0.2;
    ids.forEach((id,k) => { R.floats.push({id, n:bag.items[id], x:bx+(k-(ids.length-1)/2)*1.1, y:by, life:1.2, max:1.2}); });
    delete pendingGains[key];
  }
}
function puff(x,y,col,n){ for (let i=0;i<n;i++){ const a=Math.random()*7, v=1+Math.random()*2.5; R.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.5,life:.6+Math.random()*.4,max:1,col,size:.12+Math.random()*.1}); } }
function confettiCols(){
  const c = COS_BY_ID[cosEq('fx')||''];
  if (c && c.fx==='gold') return ['#ffd23f','#fff3b0','#f0a500','#ffeaa7','#ffffff','#e8c06a','#ffb347'];
  if (c && c.fx==='aurora') return ['#ff6b9d','#ffd23f','#00cec9','#a29bfe','#fd79a8','#55efc4','#74b9ff','#ff7a3d'];
  if (c && c.fx==='party') return ['#ff3d7f','#ffd23f','#00e5ff','#7cff6b','#ff7a3d','#c77dff','#ffffff'];
  return ['#6c5ce7','#00b894','#fdcb6e','#e17055','#74b9ff','#fd79a8'];
}
function confetti(){
  const cols = confettiCols();
  const fx = (COS_BY_ID[cosEq('fx')||'']||{}).fx;
  const n = fx==='aurora' ? 160 : fx ? 130 : 90;
  const spread = fx==='aurora' ? 140 : 60;
  const vy0 = fx==='aurora' ? -420 : -300;
  const vx0 = fx ? 900 : 700;
  for (let i=0;i<n;i++) R.parts.push({screen:true,x:W/2+(Math.random()-.5)*spread,y:H*0.32,vx:(Math.random()-.5)*vx0,vy:vy0-Math.random()*500,life:1.6+Math.random(),max:2.6,col:cols[i%cols.length],rot:Math.random()*6,vr:(Math.random()-.5)*14});
}


function drawAmbient(dt){
  const w = world(), kind = w.particle; if (!kind || kind==='none'){ R.amb.length = 0; return; }
  const max = 36;
  if (R.amb.length < max && Math.random() < dt*8){
    const col = kind==='snow' ? '#fff' : kind==='ember' ? ['#e17055','#fdcb6e','#d63031'][Math.random()*3|0]
      : kind==='petal' ? w.flower[Math.random()*3|0] : kind==='leaf' ? w.canopy[Math.random()*3|0]
      : kind==='sand' ? '#e8c878' : kind==='spore' ? w.hi : w.accent;
    R.amb.push({x:Math.random()*W, y:-8, vx:(Math.random()-.5)*40, vy:20+Math.random()*40, life:4+Math.random()*3, max:6, col, r:2+Math.random()*3, rot:Math.random()*7, vr:(Math.random()-.5)*2});
  }
  for (let i=R.amb.length-1;i>=0;i--){
    const p = R.amb[i]; p.life -= dt; p.x += p.vx*dt; p.y += p.vy*dt; p.rot += p.vr*dt;
    if (kind==='ember'){ p.vy -= 8*dt; p.vx += Math.sin(R.time*3+i)*.4; }
    if (kind==='snow' || kind==='petal' || kind==='leaf') p.vx += Math.sin(R.time*2+i)*12*dt;
    if (p.life<=0 || p.y>H+10){ R.amb.splice(i,1); continue; }
    const a = Math.min(1, p.life/p.max*2); ctx.save(); ctx.globalAlpha = a*.85; ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.col;
    if (kind==='leaf' || kind==='petal'){ ctx.beginPath(); ctx.ellipse(0,0,p.r*1.4,p.r*.6,0,0,7); ctx.fill(); }
    else if (kind==='ember'){ ctx.beginPath(); ctx.arc(0,0,p.r,0,7); ctx.fill(); ctx.globalAlpha=a*.4; ctx.beginPath(); ctx.arc(0,0,p.r*2,0,7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0,0,p.r,0,7); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

let fps = 60, lastT = performance.now();
function frame(now){
  try {
  let dt = Math.min(0.1, (now-lastT)/1000); lastT = now; fps = fps*0.95 + (1/Math.max(dt,1e-3))*0.05;
  R.time += dt;
  if ((R.rzT = (R.rzT||0) + dt) > 0.5){ R.rzT = 0; R.ins = null; if (cv.clientWidth !== W || cv.clientHeight !== H) resize(); } // iOS toolbar/viewport changes that don't fire resize
  if (R.simClock && Date.now() - R.simClock > 5000 && !document.hidden){ const away = (Date.now()-R.simClock)/1000; try { catchUp(away, true); } catch(e){} } // frozen tab / missed visibility event
  R.simClock = Date.now();
  const sdt = dt*FF*boostMul();
  const sub = Math.min(4, Math.max(boostMul()|0, Math.ceil(sdt/0.05)));
  for (let i=0;i<sub;i++) try { simulate(sdt/sub); } catch(e){}
  R.hubPulse = Math.max(0, R.hubPulse - dt*4);
  stepZoomAnim(dt);
  if (!R.pan && !R.zoomAnim){ cam.x += cam.vx*dt; cam.y += cam.vy*dt; cam.vx *= Math.pow(0.02, dt); cam.vy *= Math.pow(0.02, dt); clampCam(); }
  flushGains(dt);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const sky = (world() && world().sky) || '#7ec850'; ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  const [ox,oy] = toScreen(0,0); ctx.imageSmoothingEnabled = true;
  // base wash (ocean worlds / beyond-map); land letterboxing is filled by drawMapBeyond
  ctx.fillStyle=(world() && world().sea) || sky; ctx.fillRect(0,0,W,H);
  try { drawMapBeyond(); } catch(e){}
  const ov = cam.z < OV_Z; R.ovOn = ov;
  if (ov){ try { drawOverview(); } catch(e){} try { drawBelts(); } catch(e){} try { drawBuildingsOverview(); } catch(e){} try { for (const b of allB()) drawPauseBadge(b); } catch(e){} try { multiFrame(dt); } catch(e){} }
  else {
  try { drawChunks('terr'); } catch(e){}
  try { drawBelts(); } catch(e){}
  try { drawChunks('res'); } catch(e){}
  try { drawItems(); } catch(e){}
  const list = allB().slice().sort((a,b)=>((a.y+((BUILDINGS[a.type]&&BUILDINGS[a.type].size)||1))-(b.y+((BUILDINGS[b.type]&&BUILDINGS[b.type].size)||1))));
  for (const b of list) try { drawBuilding(b); } catch(e){}
  try { drawHutFalls(dt); } catch(e){}
  try { drawHutWorkers(); } catch(e){}
  for (const b of list) try { drawBadge(b); } catch(e){}
  for (const b of list) try { drawPauseBadge(b); } catch(e){}
  try { multiFrame(dt); } catch(e){}
  try { drawMulti(); } catch(e){}
  }
  try { drawSel(); } catch(e){}
  try { drawHutFlash(dt); } catch(e){}
  try { drawHutGuides(); } catch(e){}
  try { drawParts(dt); } catch(e){}
  try { drawPausePops(dt); } catch(e){}
  try { drawX2(dt); } catch(e){}
  try { drawAmbient(dt); } catch(e){}
  if (R.dirty){ R.dirty=false; try { updateUI(); } catch(e){} }
  try { uiTick(dt); } catch(e){}
  } catch(e){ /* a single bad frame must never stop the loop */ R.dirty = true; }
  requestAnimationFrame(frame);
}

// ============================== MULTI-SELECT (bulk upgrade) ==============================
// Long-press a building (~350ms) then drag: every building of that SAME type inside the drag rectangle is selected.
// While selecting, taps toggle buildings of that type; the bar at the bottom opens the bulk panel or exits.
const plural = n => n.endsWith('y') ? n.slice(0,-1)+'ies' : n+'s';
const bName = (type, k) => k===1 ? BUILDINGS[type].name : plural(BUILDINGS[type].name);
const addCost = (a, c) => { for (const k in c) a[k] = (a[k]||0) + c[k]; return a; };
const costKnown = c => Object.keys(c).every(itemKnown);
const lockTxt = c => '🔒 needs '+Object.keys(c).filter(k=>!itemKnown(k)).map(k=>ITEMS[k].name).join(', ');
function multiList(){ const m = R.multi; if (!m) return []; return S.b.filter(b => m.set.has(b.uid)); }
function bAt(wx, wy){ return S.b.find(b => { const s = BUILDINGS[b.type].size; return wx>=b.x && wx<b.x+s && wy>=b.y && wy<b.y+s; }); }
function startMulti(b, sx, sy){
  const keep = R.multi && R.multi.type===b.type ? R.multi.set : new Set();
  const [wx,wy] = toWorld(sx,sy);
  R.multi = {type:b.type, set:new Set(keep), base:new Set(keep), drag:{x0:wx, y0:wy, fx:sx, fy:sy}};
  R.multi.set.add(b.uid); R.multi.base.add(b.uid);
  cam.vx = cam.vy = 0; vibrate(25); sfx('click'); if (sheetWrap.classList.contains('open')) closeSheet(); multiBar();
}
function multiDragUpdate(){
  const m = R.multi; if (!m || !m.drag) return; const d = m.drag;
  const [wx,wy] = toWorld(d.fx, d.fy); d.x1 = wx; d.y1 = wy;
  const x0 = Math.min(d.x0,wx), x1 = Math.max(d.x0,wx), y0 = Math.min(d.y0,wy), y1 = Math.max(d.y0,wy);
  m.set = new Set(m.base);
  for (const b of S.b){ if (b.type!==m.type) continue; const s = BUILDINGS[b.type].size; if (b.x < x1 && b.x+s > x0 && b.y < y1 && b.y+s > y0) m.set.add(b.uid); }
  if (m.set.size !== m.lastN){ if (m.lastN !== undefined && m.set.size > m.lastN) vibrate(6); m.lastN = m.set.size; multiBar(); }
}
function endMultiDrag(){ const m = R.multi; if (!m || !m.drag) return; multiDragUpdate(); m.drag = null; m.base = new Set(m.set); multiBar(); }
function exitMulti(){ R.multi = null; multiBar(); }
function toggleMulti(b){
  const m = R.multi; if (b.type !== m.type){ toast(`Selecting ${bName(m.type,2)} only — tap Done to finish`); sfx('err'); return; }
  if (m.set.has(b.uid)) m.set.delete(b.uid); else m.set.add(b.uid); m.base = new Set(m.set); sfx('click'); vibrate(8);
  if (!m.set.size) exitMulti(); else multiBar();
}
function selectAllOfType(type){ R.multi = {type, set:new Set(S.b.filter(b=>b.type===type).map(b=>b.uid)), base:null, drag:null}; R.multi.base = new Set(R.multi.set); multiBar(); }
function tierSummary(list){ const c = {}; for (const b of list) c[b.lv||1] = (c[b.lv||1]||0)+1; return Object.keys(c).sort().map(t=>`Lv${t} ×${c[t]}`).join(' · '); }
let mbar = null;
function multiBar(){
  if (!mbar){ mbar = document.createElement('div'); mbar.id = 'multibar'; document.body.appendChild(mbar);
    mbar.addEventListener('click', e => { const a = e.target.closest('[data-m]'); if (!a) return; if (a.dataset.m==='done') exitMulti(); else if (a.dataset.m==='open') openBulk(); }); }
  const m = R.multi; if (!m){ mbar.classList.remove('show'); return; }
  const list = multiList(), n = list.length;
  const html = `<div class="mb-t"><b>${n} ${bName(m.type,n)}</b> selected<span>${m.drag?'Drag to select more…':n?tierSummary(list)+' · tap to add/remove':'Tap buildings to select'}</span></div>`+
    `<button class="btn green" data-m="open" ${n?'':'disabled'}>Upgrade ${n}</button><button class="btn gray" data-m="done">Done</button>`;
  if (mbar.dataset.h !== html){ mbar.dataset.h = html; mbar.innerHTML = html; }
  mbar.classList.add('show');
}
// cost plans -------------------------------------------------------------
function planNext(list, kind){ // each building up one level (kind ignored — single track)
  const items = [], skip = [];
  for (const b of list){
    const cur = b.lv||1;
    if (cur >= MAX_LV){ skip.push(b); continue; }
    const c = lvCost(b.type, cur+1); if (!c){ skip.push(b); continue; }
    items.push({b, steps:[cur+1], cost:c});
  }
  return {items, skip};
}
function planTo(list, target){ // every building up to Level `target`
  const items = [], skip = [];
  for (const b of list){ const cur = b.lv||1; if (cur >= target){ skip.push(b); continue; }
    const cost = {}, steps = []; for (let t=cur+1;t<=target;t++){ addCost(cost, lvCost(b.type,t)||{}); steps.push(t); }
    items.push({b, steps, cost}); }
  return {items, skip};
}
const planTotal = items => items.reduce((a,it)=>addCost(a,it.cost), {});
function affordable(items){ // cheapest first, keep adding while the running total is payable
  const sorted = items.slice().sort((a,b) => Object.values(a.cost).reduce((s,v)=>s+v,0) - Object.values(b.cost).reduce((s,v)=>s+v,0));
  const pick = [], tot = {};
  for (const it of sorted){ const t2 = addCost({...tot}, it.cost); if (canPay(t2)){ pick.push(it); Object.assign(tot, t2); } }
  return {pick, tot};
}
function applyPlan(items, kind){
  let done = 0;
  for (const it of items){ const b = it.b;
    const fromLv = b.lv||1;
    for (const s of it.steps){ const c = lvCost(b.type,s); if (!c || !canPay(c)) break; pay(c); b.lv = s; b.tier = s; }
    if ((b.lv||1) > fromLv){ try { noteChProgress('upg', 1); } catch(e){} }
    b.pop = 1; const sz = BUILDINGS[b.type].size; puff(b.x+sz/2, b.y+sz/2, LV_COL[b.lv]||'#fdcb6e', 12); if ((b.lv||1)>=2) x2Pop(b); done++; }
  if (done){ sfx('upgrade'); vibrate(20); R.dirty = true; save(); }
  return done;
}
function removeRefund(list){ // exact sum of what demolish() will refund, in the same order
  const tot = {}, built = {...S.built};
  for (const b of list){ const key = bKeyOf(b); built[key] = Math.max(0,(built[key]||1)-1); const saveB = S.built; S.built = built; const c = costOf(b.type, key); S.built = saveB;
    for (const k in c) tot[k] = (tot[k]||0) + Math.floor(c[k]/2);
    for (let t=2;t<=(b.lv||1);t++){ const tc = lvCost(b.type,t)||{}; for (const k in tc) tot[k] = (tot[k]||0) + Math.floor(tc[k]/2); } }
  return tot;
}
// bulk panel --------------------------------------------------------------
function openBulk(){
  const m = R.multi; if (!m || !multiList().length) return;
  if (!m.target) m.target = Math.min(MAX_LV, Math.max(...multiList().map(b=>b.lv||1)) + 1);
  openSheet(`<div id="bulk"></div>`);
  const body = sheet.querySelector('#bulk'); let rmArm = false;
  const row = (label, sub, plan, act, kind) => {
    if (!plan.items.length) return `<div class="bk"><div class="bk-l"><b>${label}</b><span>${sub}</span></div><div class="bk-r"><span class="tcur">✓ All maxed</span></div></div>`;
    const tot = planTotal(plan.items), known = costKnown(tot), ok = known && canPay(tot);
    let h = `<div class="bk"><div class="bk-l"><b>${label}</b><span>${sub}</span><div class="bk-c">${known?costHTML(tot):lockTxt(tot)}</div>${plan.skip.length?`<span class="bk-s">Skips ${plan.skip.length} already ${kind==='to'?'at or above Level '+m.target:'maxed'}</span>`:''}</div>`+
      `<div class="bk-r"><button class="btn ${ok?'green':''}" data-k="${act}" ${ok?'':'disabled'}>${kind==='to'?'Upgrade':'Upgrade'} ${plan.items.length}</button></div></div>`;
    if (known && !ok){ const af = affordable(plan.items);
      h += `<div class="bk part"><div class="bk-l"><b>Upgrade as many as I can afford</b><span>${af.pick.length ? `${af.pick.length} of ${plan.items.length}, cheapest first` : 'Can\'t afford any yet'}</span>${af.pick.length?`<div class="bk-c">${costHTML(af.tot)}</div>`:''}</div>`+
        `<div class="bk-r"><button class="btn ${af.pick.length?'green':''}" data-k="${act}-part" ${af.pick.length?'':'disabled'}>Upgrade ${af.pick.length}</button></div></div>`; }
    return h;
  };
  const render = () => {
    const list = multiList(); if (!list.length){ closeSheet(); exitMulti(); return; }
    const n = list.length, nm = bName(m.type, n);
    const pT = planNext(list,'t'), pTo = planTo(list, m.target);
    const chips = [2,3,4,5].map(t=>`<button class="tchip ${m.target===t?'on':''}" data-to="${t}" style="--tc:${LV_COL[t]}">Lv${t}</button>`).join('');
    const rf = removeRefund(list);
    const h = `<h2>${n} ${nm} selected</h2><div class="sub">${tierSummary(list)}</div>
      <div class="sec"><div class="st">Upgrade</div>
        ${row('Upgrade all one level', 'Faster + higher double chance', pT, 'tn', 'next')}
        <div class="bk-to"><span>Or all to</span>${chips}</div>
        ${row(`Upgrade all to Level ${m.target}`, `${Math.round(lvSpeed(m.target)*100)}% speed · ${Math.round(lvDouble(m.target)*100)}% double`, pTo, 'tto', 'to')}</div>
      <div class="sec rm"><div class="bk-l"><b>Remove ${n} ${nm}</b><span>Refund ${costHTML(rf).replace(/cost no/g,'cost')}</span></div><button class="btn red" data-k="rm">${rmArm?'Tap again to remove '+n:'🗑 Remove'}</button></div>
      <div class="row"><button class="btn gray" data-k="more">Select more</button><button class="btn" data-k="done">Done</button></div>`;
    if (body.dataset.h !== h){ const st = sheet.scrollTop; body.dataset.h = h; body.innerHTML = h; sheet.scrollTop = st; }
  };
  body.addEventListener('click', e => {
    const to = e.target.closest('[data-to]'); if (to){ m.target = +to.dataset.to; sfx('click'); render(); return; }
    const a = e.target.closest('[data-k]'); if (!a || a.disabled) return; const k = a.dataset.k, list = multiList();
    if (k==='done'){ closeSheet(); exitMulti(); return; }
    if (k==='more'){ closeSheet(); toast('Tap or long-press-drag to add more', 2200); return; }
    if (k==='rm'){ if (!rmArm){ rmArm = true; render(); return; } const n = list.length; for (const b of list) demolish(b); toast(`Removed ${n} ${bName(m.type,n)}`); closeSheet(); exitMulti(); R.dirty = true; return; }
    const plan = k.startsWith('tto') ? planTo(list, m.target) : planNext(list, 't');
    const items = k.endsWith('-part') ? affordable(plan.items).pick : plan.items;
    if (!k.endsWith('-part') && !canPay(planTotal(items))) return;
    const done = applyPlan(items, 't');
    if (done) toast(`Upgraded ${done} ${bName(m.type,done)}`);
    render();
  });
  render();
  const mark = body; clearInterval(R.infoTimer); R.infoTimer = setInterval(() => { if (!sheetWrap.classList.contains('open') || !sheet.contains(mark)) { clearInterval(R.infoTimer); return; } render(); }, 250);
}
function drawMulti(){
  const m = R.multi; if (!m) return; const z = cam.z, pulse = 0.5+0.5*Math.sin(R.time*6);
  for (const b of S.b){ if (b.type!==m.type) continue; const sel = m.set.has(b.uid), s = BUILDINGS[b.type].size*z, [sx,sy] = toScreen(b.x,b.y);
    if (sx>W||sy>H||sx<-s||sy<-s) continue;
    if (sel){ ctx.strokeStyle = `rgba(0,206,201,${.75+.25*pulse})`; ctx.lineWidth = Math.max(3, z*.08); rr(ctx, sx+z*.03, sy+z*.03-z*.06, s-z*.06, s-z*.06+z*.06, z*.2); ctx.stroke();
      ctx.fillStyle = 'rgba(0,206,201,.18)'; ctx.fill();
      const r = Math.max(8, z*.17), cx = sx+s-r*0.9, cy = sy+r*0.6; ctx.fillStyle='#00cec9'; ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
      ctx.strokeStyle='#fff'; ctx.lineWidth=Math.max(2,r*.28); ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(cx-r*.45,cy); ctx.lineTo(cx-r*.1,cy+r*.35); ctx.lineTo(cx+r*.45,cy-r*.35); ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([5,4]); ctx.lineWidth = 2; rr(ctx, sx+z*.05, sy+z*.05-z*.06, s-z*.1, s-z*.1+z*.06, z*.2); ctx.stroke(); ctx.setLineDash([]); }
  }
  const d = m.drag; if (d && d.x1 !== undefined){ const [ax,ay] = toScreen(Math.min(d.x0,d.x1), Math.min(d.y0,d.y1)), [bx,by] = toScreen(Math.max(d.x0,d.x1), Math.max(d.y0,d.y1));
    ctx.fillStyle='rgba(0,206,201,.12)'; ctx.fillRect(ax,ay,bx-ax,by-ay); ctx.strokeStyle='#00cec9'; ctx.setLineDash([8,5]); ctx.lineWidth=2; ctx.strokeRect(ax,ay,bx-ax,by-ay); ctx.setLineDash([]);
    const n = m.set.size, t = `${n} ${bName(m.type,n)}`; ctx.font='900 15px -apple-system,Segoe UI,sans-serif'; const tw = ctx.measureText(t).width+20;
    const px = Math.min(W-tw-6, Math.max(6, d.fx - tw/2)), py = Math.max(150, d.fy - 70); ctx.fillStyle='#1e2430'; rr(ctx,px,py,tw,28,14); ctx.fill(); ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(t, px+10, py+15); ctx.textBaseline='alphabetic'; }
}
function multiFrame(dt){ // auto-pan while dragging near the screen edge so big areas can be selected
  const m = R.multi; if (!m || !m.drag) return; const d = m.drag, e = 46, sp = 9*dt;
  let vx = 0, vy = 0; if (d.fx < e) vx = -1; else if (d.fx > W-e) vx = 1; if (d.fy < 170) vy = -1; else if (d.fy > H-110) vy = 1;
  if (vx || vy){ cam.x += vx*sp; cam.y += vy*sp; clampCam(); }
  multiDragUpdate();
}

// ============================== INPUT ==============================
const ptrs = new Map(); let pinch = null, downInfo = null;
cv.addEventListener('pointerdown', () => { R.zoomAnim = null; }, true);
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:evX(e),y:evY(e)}); unlockAudio();
  if (ptrs.size===1){
    const x = evX(e), y = evY(e);
    downInfo = {x, y, t:performance.now(), moved:false};
    const badge = pauseBadgeAt(x, y);
    if (badge){
      // Instant unpause — swallow the gesture so it can't pan, long-press-select, place, or open the inspector.
      downInfo.badge = true; R.pan = false; cam.vx = cam.vy = 0; clearTimeout(R.lpT);
      resumeFromBadge(badge);
    } else {
      R.pan = true; cam.vx=cam.vy=0;
      // long-press on a building starts drag-select
      const di = downInfo, [wx,wy] = toWorld(x,y), hb = S.hub && (()=>{ const p = pickAt(wx,wy); return p && p.b && S.b.includes(p.b) ? p.b : null; })();
      clearTimeout(R.lpT); if (hb) R.lpT = setTimeout(() => { if (downInfo===di && !di.moved && ptrs.size===1){ di.sel = true; R.pan = false; startMulti(hb, di.x, di.y); } }, 350);
    } }
  else if (ptrs.size===2){ clearTimeout(R.lpT); const [a,b] = [...ptrs.values()]; pinch = {d:Math.hypot(a.x-b.x,a.y-b.y), z:cam.z}; if (downInfo){ downInfo.moved = true; if (downInfo.sel){ downInfo.sel = false; endMultiDrag(); } } } });
cv.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = evX(e)-p.x, dy = evY(e)-p.y; p.x=evX(e); p.y=evY(e);
  if (ptrs.size===1 && downInfo && downInfo.badge){ if (Math.hypot(evX(e)-downInfo.x, evY(e)-downInfo.y) > 9) downInfo.moved = true; return; }
  if (ptrs.size===1 && downInfo && downInfo.sel){ if (R.multi && R.multi.drag){ R.multi.drag.fx = evX(e); R.multi.drag.fy = evY(e); multiDragUpdate(); } return; }
  if (ptrs.size===1){ if (downInfo && Math.hypot(evX(e)-downInfo.x, evY(e)-downInfo.y) > 9){ downInfo.moved = true; clearTimeout(R.lpT); } if (downInfo && downInfo.moved){ cam.x -= dx/cam.z; cam.y -= dy/cam.z; cam.vx = -dx/cam.z*60; cam.vy = -dy/cam.z*60; clampCam(); } }
  else if (ptrs.size===2 && pinch){ const [a,b] = [...ptrs.values()]; const mx=(a.x+b.x)/2, my=(a.y+b.y)/2; const [wx,wy] = toWorld(mx,my); cam.z = pinch.z * Math.hypot(a.x-b.x,a.y-b.y)/pinch.d; clampCam(); const [wx2,wy2] = toWorld(mx,my); cam.x += wx-wx2; cam.y += wy-wy2; cam.x -= dx/cam.z/2; cam.y -= dy/cam.z/2; /* each finger moves the midpoint by half its delta */ clampCam(); } });
const endPtr = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  if (ptrs.size===0 && downInfo && downInfo.sel){ clearTimeout(R.lpT); R.pan=false; endMultiDrag(); downInfo=null; pinch=null; return; }
  if (ptrs.size===0){ clearTimeout(R.lpT); R.pan=false; if (downInfo && downInfo.badge){ downInfo=null; pinch=null; return; } if (downInfo && !downInfo.moved && performance.now()-downInfo.t < 600) tap(evX(e), evY(e)); else if (downInfo && performance.now()-downInfo.t > 120 && Math.hypot(cam.vx,cam.vy) < 0.5) {cam.vx=cam.vy=0;} downInfo=null; pinch=null; }
  else if (ptrs.size===1){ pinch=null; } };
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (!ptrs.size){ clearTimeout(R.lpT); if (downInfo && downInfo.sel) endMultiDrag(); R.pan=false; downInfo=null; pinch=null; } });
cv.addEventListener('wheel', e => { e.preventDefault(); R.zoomAnim = null; const [wx,wy] = toWorld(evX(e),evY(e)); cam.z *= Math.pow(0.999, e.deltaY); clampCam(); const [wx2,wy2] = toWorld(evX(e),evY(e)); cam.x += wx-wx2; cam.y += wy-wy2; clampCam(); }, {passive:false});
document.addEventListener('gesturestart', e => e.preventDefault()); document.addEventListener('dblclick', e => e.preventDefault());

// ---- clearing resource tiles: turns a tree/rock/ore tile into grass for good and pays a lump of that material
// Clear-tile lump yield: a flat 5 of that resource for every tile type (all worlds). Not harvest/refunds, not scaled by perks.
const CLEAR_YIELD = {}; for (const t in RES) CLEAR_YIELD[t] = 5;
function clearCheck(x, y){
  const i = idx(x,y), tv = R.terr[i];
  if (!RES[tv]) return 'Nothing to clear';
  if (RES[tv].unlock && !has(RES[tv].unlock)) return 'locked';
  if (R.occ[i]) return 'A building is on this tile';
  return null;
}
function clearTile(x, y){
  if (clearCheck(x,y)) return 0;
  const i = idx(x,y), tv = R.terr[i], item = RES[tv].item;
  // Worn trees/rocks pay the remaining hut hits (not a fresh 5) so a half-chopped tree isn't worth 7.
  const n = (tv===TREE || tv===STONE) ? hutWearLeft(i, tv) : CLEAR_YIELD[tv];
  R.terr[i] = GRASS; S.cleared.push(i); statAdd('cleared'); if (S.hutWear) delete S.hutWear[i]; invalidateChunks(x,y,1);
  S.stock[item] = (S.stock[item]||0) + n;
  renderTerrain();
  const col = RES[tv].col;
  puff(x+.5, y+.5, col, 22); puff(x+.5, y+.5, '#ffffff', 6);
  R.floats.push({id:item, n, x:x+.5, y:y+.1, life:1.4, max:1.4});
  sfx('build'); vibrate(15); R.dirty = true; save();
  return n;
}

// ============================== GATHERING HUTS ==============================
// Prestige huts: a worker walks out, takes 1 hit (1 resource), and carries it home. No belts.
// A tree or rock takes HUT_HITS trips before it turns to grass for good (nothing regrows).
// Brisk medium pace: a nearby (~3-tile) round trip is about 3.4s (1.2 walk + 1.0 chop + 1.2 back).
const HUT_WALK = 2.5;      // tiles / sec (base)
const HUT_CHOP = 1.0;      // seconds to chip one hit (base)
const HUT_REACH = 40;      // max walk in tiles (upgradeable)
const HUT_REACH_STEP = 16; // +tiles per reach upgrade
const HUT_HITS = 5;        // trips to fully clear a tree or rock
const HUT_PAYOUT = 1;      // resources granted per finished trip
const isHut = b => !!(b && BUILDINGS[b.type] && BUILDINGS[b.type].hut);
const hutTv = b => BUILDINGS[b.type].hutRes;
const hutItem = b => RES[hutTv(b)].item;
const hutCenter = b => { const s = BUILDINGS[b.type].size; return [b.x + s/2, b.y + s/2]; };
const hutAxe = b => Math.max(0, Math.min(2, b.axe|0));
const hutCrewLv = b => Math.max(0, Math.min(1, b.crew|0));
const hutReachLv = b => Math.max(0, Math.min(2, b.reach|0));
const hutWalkSp = b => HUT_WALK * (1 + 0.3*hutAxe(b));
const hutChopT = b => HUT_CHOP / (1 + 0.45*hutAxe(b));
const hutReach = b => HUT_REACH + HUT_REACH_STEP*hutReachLv(b);
const hutCrewN = b => 1 + hutCrewLv(b);

function hutWearMap(){ if (!S.hutWear || typeof S.hutWear !== 'object') S.hutWear = {}; return S.hutWear; }
function hutWearLeft(i, tv){
  if (tv != null && tv !== TREE && tv !== STONE) return HUT_HITS;
  const w = S && S.hutWear && S.hutWear[i];
  if (w == null) return HUT_HITS;
  return Math.max(0, Math.min(HUT_HITS, w|0));
}
function hutDrawWearMark(c, X, Y, P, left){
  const r = Math.max(6, P*0.16), bx = X+P*0.28, by = Y-P*0.22;
  c.fillStyle = 'rgba(45,20,16,.88)'; c.beginPath(); c.arc(bx, by, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,232,212,.85)'; c.lineWidth = Math.max(1, P*0.03); c.stroke();
  c.fillStyle = '#ffe8d4'; c.font = `900 ${Math.max(8, P*0.22)}px -apple-system,Segoe UI,sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(left), bx, by+0.5);
}

function hutBusy(){ if (!R.hutBusy) R.hutBusy = new Set(); return R.hutBusy; }
function hutReserve(i, on){ const s = hutBusy(); if (on) s.add(i); else s.delete(i); }
function hutReserved(i){ return !!(R.hutBusy && R.hutBusy.has(i)); }

function hutLineClear(x0,y0,x1,y1){
  // Workers don't wade: skip targets whose straight path crosses water (island worlds).
  const dx=x1-x0, dy=y1-y0, dist=Math.hypot(dx,dy);
  if (dist < 1e-6) return true;
  const n = Math.max(2, Math.ceil(dist*2));
  for (let k=1;k<n;k++){
    const t=k/n, ix=Math.floor(x0+dx*t), iy=Math.floor(y0+dy*t);
    if (!inMap(ix,iy)) return false;
    if (R.terr[idx(ix,iy)]===WATER) return false;
  }
  return true;
}
function hutTileOk(b, x, y, ignoreReserve){
  if (!inMap(x,y) || !R.terr) return false;
  const i = idx(x,y), tv = hutTv(b);
  if (R.terr[i] !== tv) return false;
  if (R.occ && R.occ[i]) return false;
  const r = RES[tv]; if (r && r.unlock && !has(r.unlock)) return false;
  if (!ignoreReserve && hutReserved(i)) return false;
  return true;
}
function hutFindTarget(b, fromX, fromY){
  const [cx,cy] = hutCenter(b), reach = hutReach(b);
  const x0 = Math.max(0, Math.floor(cx-reach)), x1 = Math.min(MAP_W-1, Math.ceil(cx+reach));
  const y0 = Math.max(0, Math.floor(cy-reach)), y1 = Math.min(MAP_H-1, Math.ceil(cy+reach));
  let best=null, bd=reach+1e-6;
  const ox = fromX==null ? cx : fromX, oy = fromY==null ? cy : fromY;
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    if (!hutTileOk(b,x,y)) continue;
    const d = Math.hypot((x+.5)-cx, (y+.5)-cy);
    if (d > reach || d >= bd) continue;
    if (!hutLineClear(cx, cy, x+.5, y+.5)) continue;
    if (!hutLineClear(ox, oy, x+.5, y+.5)) continue;
    bd = d; best = [x,y,d];
  }
  return best;
}
function hutEnsureCrew(b){
  if (!Array.isArray(b.workers)) b.workers = [];
  const [cx,cy] = hutCenter(b), n = hutCrewN(b);
  while (b.workers.length < n) b.workers.push({x:cx, y:cy+0.45, state:'idle', t:0, tx:0, ty:0, carry:0});
  while (b.workers.length > n){
    const w = b.workers.pop();
    if (w && w.state!=='idle' && w.state!=='walkBack' && w.tx!=null) hutReserve(idx(w.tx,w.ty), false);
    if (w && w.carry) hutGrant(b, w.carry, true);
  }
}
function hutGrant(b, n, quiet){
  if (!(n>0)) return;
  const id = hutItem(b);
  addStock(id, n);
  try { gainXp(id, n); } catch(e){}
  try { noteChProgress('deliver', id, n); } catch(e){}
  if (!quiet && !R.quiet){
    b.pop = 1;
    const [cx,cy] = hutCenter(b);
    R.floats.push({id, n, x:cx, y:cy-0.15, life:1.3, max:1.3});
    sfx('collect');
  }
  R.dirty = true;
}
function hutDoHit(x, y){
  // One trip: chip the tile by 1 and return HUT_PAYOUT (1). The 5th hit turns it to grass for good.
  // Does NOT add stock — the worker carries it home (or flowHut grants it). Returns 0 if it can't be hit.
  if (!inMap(x,y) || !R.terr) return 0;
  const i = idx(x,y), tv = R.terr[i];
  if ((tv !== TREE && tv !== STONE) || (R.occ && R.occ[i])) return 0;
  const left = hutWearLeft(i, tv) - 1;
  if (left <= 0){
    R.terr[i] = GRASS;
    if (!Array.isArray(S.cleared)) S.cleared = [];
    S.cleared.push(i);
    const wear = hutWearMap(); delete wear[i];
    if (!R.quiet){
      const col = RES[tv].col;
      puff(x+.5, y+.5, col, 16);
      puff(x+.5, y+.5, '#ffffff', 5);
      if (!R.falls) R.falls = [];
      R.falls.push({x:x+.5, y:y+.5, tv, life:0.7, max:0.7});
    }
  } else {
    hutWearMap()[i] = left;
    if (!R.quiet){
      const col = RES[tv].col;
      puff(x+.5, y+.5, col, 8);
    }
  }
  invalidateChunks(x,y,1);
  R.dirty = true;
  return HUT_PAYOUT;
}
function hutMoveToward(w, tx, ty, sp, dt){
  const dx=tx-w.x, dy=ty-w.y, d=Math.hypot(dx,dy);
  if (d <= sp*dt + 0.05){ w.x=tx; w.y=ty; return true; }
  w.x += dx/d*sp*dt; w.y += dy/d*sp*dt;
  w.facing = Math.atan2(dy,dx);
  return false;
}
function stepHut(b, dt){
  if (!BUILDINGS[b.type] || !BUILDINGS[b.type].hut) return;
  hutEnsureCrew(b);
  const [cx,cy] = hutCenter(b), sp = hutWalkSp(b), chop = hutChopT(b);
  for (const w of b.workers){
    if (w.state==='idle'){
      const t = hutFindTarget(b, w.x, w.y);
      if (!t){ hutMoveToward(w, cx + (w===b.workers[0]?-0.28:0.28), cy+0.58, sp*0.55, dt); continue; }
      w.tx=t[0]; w.ty=t[1]; w.state='walkOut'; w.t=0; w.carry=0;
      hutReserve(idx(w.tx,w.ty), true);
    }
    if (w.state==='walkOut'){
      if (!hutTileOk(b, w.tx, w.ty, true)){ hutReserve(idx(w.tx,w.ty), false); w.state='idle'; continue; }
      if (hutMoveToward(w, w.tx+0.5, w.ty+0.78, sp, dt)){ w.state='chop'; w.t=0; }
    } else if (w.state==='chop'){
      w.t += dt;
      if (!R.quiet && Math.random() < dt*14){
        const col = RES[hutTv(b)].col;
        R.parts.push({x:w.tx+.5+(Math.random()-.5)*.35, y:w.ty+.35, vx:(Math.random()-.5)*1.8, vy:-1.3-Math.random(), life:.45, max:.5, col, size:.07+Math.random()*.07});
      }
      if (w.t >= chop){
        hutReserve(idx(w.tx,w.ty), false);
        const n = hutTileOk(b, w.tx, w.ty, true) ? hutDoHit(w.tx, w.ty) : 0;
        w.carry = n; w.item = hutItem(b); w.state='walkBack'; w.t=0;
        if (n && !R.quiet) sfx('build');
      }
    } else if (w.state==='walkBack'){
      if (hutMoveToward(w, cx, cy+0.2, sp, dt)){ hutGrant(b, w.carry); w.carry=0; w.state='idle'; w.t=0; }
    }
  }
}
function hutDismiss(b){
  if (!b || !b.workers) return;
  for (const w of b.workers){
    if (w.tx!=null && w.ty!=null) hutReserve(idx(w.tx,w.ty), false);
    if (w.carry) hutGrant(b, w.carry, true); // drop off carried goods so nothing is lost
  }
  b.workers = [];
}
function hutRelink(){
  hutBusy().clear();
  if (!S || !Array.isArray(S.b)) return;
  if (!S.hutWear || typeof S.hutWear !== 'object' || Array.isArray(S.hutWear)) S.hutWear = {};
  if (R.terr){
    for (const k of Object.keys(S.hutWear)){
      const i = +k, left = S.hutWear[k]|0, x = i%MAP_W, y = (i/MAP_W)|0;
      if (!Number.isFinite(i) || !inMap(x, y) || left<=0 || left>=HUT_HITS){ delete S.hutWear[k]; continue; }
      const tv = R.terr[i];
      if (tv!==TREE && tv!==STONE) delete S.hutWear[k];
    }
  }
  for (const b of S.b){
    if (!isHut(b)) continue;
    if (!Array.isArray(b.workers)) { b.workers = []; continue; }
    b.workers = b.workers.filter(Boolean);
    for (const w of b.workers){
      if (!w || typeof w !== 'object') continue;
      if ((w.state==='walkOut' || w.state==='chop') && w.tx!=null && w.ty!=null && inMap(w.tx|0, w.ty|0)) hutReserve(idx(w.tx|0,w.ty|0), true);
    }
  }
}
function flowHut(b, sec, give){
  // Offline: workers repeatedly take the current nearest tile within reach.
  // One hit is applied when the chop would finish. Payout is granted when they'd get home,
  // or immediately if time runs out mid-walk-back (a finished chop is never lost).
  // Five hits clear the tile to grass, same as live play.
  hutEnsureCrew(b);
  const [cx,cy] = hutCenter(b), sp = hutWalkSp(b), chop = hutChopT(b);
  const nW = hutCrewN(b), free = new Array(nW).fill(0), item = hutItem(b);
  let guard = 0;
  while (guard++ < 8000){
    let progressed = false;
    for (let wi=0; wi<nW; wi++){
      if (free[wi] >= sec - 1e-9) continue;
      const t0 = free[wi];
      const targ = hutFindTarget(b, cx, cy);
      if (!targ){ free[wi] = sec; continue; }
      const dist = targ[2], tChopEnd = t0 + dist/sp + chop, tBack = tChopEnd + dist/sp;
      if (tChopEnd > sec){ free[wi] = sec; continue; } // didn't finish the chop — leave the tree
      const ti = idx(targ[0], targ[1]);
      hutReserve(ti, true);
      const n = hutDoHit(targ[0], targ[1]);
      hutReserve(ti, false);
      if (n>0) give(item, n);
      free[wi] = Math.min(sec, tBack);
      progressed = true;
    }
    if (!progressed) break;
  }
}
function hutUpgCost(b, kind){
  const L = kind==='axe' ? hutAxe(b) : kind==='crew' ? hutCrewLv(b) : hutReachLv(b);
  const max = kind==='crew' ? 1 : 2;
  if (L >= max) return null;
  const wood = b.type==='woodHut';
  if (kind==='axe') return wood ? {wood: 30*(L+1)} : {stone: 30*(L+1)};
  if (kind==='crew') return wood ? {wood: 90} : {stone: 90};
  return wood ? {wood: 45*(L+1)} : {stone: 45*(L+1)};
}
function hutBuyUpg(b, kind){
  const c = hutUpgCost(b, kind); if (!c || !canPay(c)) return false;
  const known = Object.keys(c).every(itemKnown); if (!known) return false;
  pay(c);
  if (kind==='axe') b.axe = hutAxe(b)+1;
  else if (kind==='crew'){ b.crew = hutCrewLv(b)+1; hutEnsureCrew(b); }
  else b.reach = hutReachLv(b)+1;
  sfx('upgrade'); vibrate(15); b.pop=1; save(); R.dirty=true;
  return true;
}
function openHutInfo(b){
  const B = BUILDINGS[b.type], tv = hutTv(b), item = hutItem(b), rock = b.type==='rockHut';
  R.sel = {ghost:null, b};
  const statusOf = () => {
    const workers = b.workers||[];
    const busy = workers.filter(w=>w.state && w.state!=='idle').length;
    if (busy) return busy+' worker'+(busy>1?'s':'')+' out '+(rock?'mining':'chopping');
    if (hutFindTarget(b, ...hutCenter(b))) return 'Looking for the next '+(rock?'rock':'tree');
    return 'No '+(rock?'rocks':'trees')+' in range';
  };
  const render = () => {
    const row = (kind, title, detail, lv, max) => {
      const c = hutUpgCost(b, kind), maxed = lv>=max;
      const locked = !!(c && Object.keys(c).some(k=>!itemKnown(k)));
      const name = title + (max>1 ? (' · '+lv+'/'+max) : '');
      let extra = '';
      if (!maxed && c){
        extra = locked
          ? (' · 🔒 ' + Object.keys(c).filter(k=>!itemKnown(k)).map(k=>ITEMS[k].name).join(', '))
          : (' · ' + costHTML(c));
      }
      const btn = maxed
        ? '<button class="btn" disabled>MAX</button>'
        : `<button class="btn ${c&&!locked&&canPay(c)?'green':''}" data-u="${kind}" ${c&&!locked&&canPay(c)?'':'disabled'}>Upgrade</button>`;
      return `<div class="opt"><div class="ob"><div class="on">${name}</div><div class="od">${detail}${extra}</div></div>${btn}</div>`;
    };
    openSheet(`<h2>${B.name}</h2>
      <div class="sub">No belts · ${rock?'Stone':'Wood'} comes straight to your count</div>
      <div class="sec" style="background:#fff4e6;border:2px solid #f0b27a;border-radius:14px;padding:10px 12px">
        <div class="st" style="color:#c0392b">⚠ Permanent</div>
        <div class="sub" style="margin:0">${rock?'Rocks he breaks':'Trees he cuts'} are gone for good. Each trip brings back 1 ${ITEMS[item].name}; a ${rock?'rock':'tree'} takes ${HUT_HITS} trips (you'll see it wear down). He keeps walking to the nearest one (up to ${Math.round(hutReach(b))} tiles). Demolish this hut to stop him.</div>
      </div>
      <div class="sr" style="margin-top:10px"><span>Status</span><b id="hst">${statusOf()}</b></div>
      <div class="sr"><span>Workers</span><b>${hutCrewN(b)}</b></div>
      <div class="sr"><span>Each trip</span><b>+${HUT_PAYOUT} ${ITEMS[item].name}</b></div>
      <div class="sec"><div class="st">Upgrades</div>
        ${row('axe','Faster tool','Walks and '+(rock?'breaks':'chops')+' quicker', hutAxe(b), 2)}
        ${row('crew','Extra worker','A second worker from this hut', hutCrewLv(b), 1)}
        ${row('reach','Longer walk','Search up to '+Math.round(hutReach({reach:hutReachLv(b)+(hutReachLv(b)<2?1:0), axe:0, crew:0, type:b.type}))+' tiles', hutReachLv(b), 2)}
      </div>
      <div class="sec rm"><span class="st" style="margin:0">Remove</span><button class="btn red" data-a="demo">🗑 Remove</button></div>
      <div class="row"><button class="btn" data-a="x">Done</button></div>`);
    sheet.querySelector('[data-a=x]').onclick = closeSheet;
    const dbtn = sheet.querySelector('[data-a=demo]');
    dbtn.onclick = () => { if (dbtn.dataset.c){ demolish(b); closeSheet(); } else { dbtn.dataset.c = 1; dbtn.textContent = 'Tap again to remove'; } };
    sheet.querySelectorAll('[data-u]').forEach(el => el.onclick = ev => { ev.stopPropagation(); if (hutBuyUpg(b, el.dataset.u)) render(); });
  };
  clearInterval(R.infoTimer); R.infoTimer = setInterval(() => {
    if (!sheetWrap.classList.contains('open') || !R.sel || R.sel.b !== b || !S.b.includes(b)) { clearInterval(R.infoTimer); return; }
    const st = sheet.querySelector('#hst'); if (st){ const m = statusOf(); if (st.textContent !== m) st.textContent = m; }
  }, 200);
  render();
}

function drawHutIcon(c, type, x, y, s){
  const rock = type==='rockHut';
  const wall = rock ? '#9a9388' : '#c9873c', wallHi = rock ? '#d2ccc2' : '#e2a85a';
  const roof = rock ? '#5a6570' : '#2f7a45', roofHi = rock ? '#8a97a3' : '#4aa862';
  c.fillStyle='rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, y+s*.34, s*.38, s*.1, 0,0,7); c.fill();
  c.fillStyle=wall; rr(c, x-s*.32, y-s*.06, s*.64, s*.42, s*.06); c.fill();
  c.fillStyle=wallHi; rr(c, x-s*.32, y-s*.06, s*.64, s*.14, s*.06); c.fill();
  // roof
  c.fillStyle=roof; c.beginPath(); c.moveTo(x-s*.42, y-s*.02); c.lineTo(x, y-s*.42); c.lineTo(x+s*.42, y-s*.02); c.closePath(); c.fill();
  c.fillStyle=roofHi; c.beginPath(); c.moveTo(x-s*.28, y-s*.06); c.lineTo(x, y-s*.34); c.lineTo(x+s*.08, y-s*.06); c.closePath(); c.fill();
  // chimney
  c.fillStyle=rock?'#6d6560':'#6b3e1a'; rr(c, x+s*.14, y-s*.4, s*.1, s*.22, s*.02); c.fill();
  c.fillStyle=rock?'#c0392b':'#b03a2e'; c.fillRect(x+s*.14, y-s*.4, s*.1, s*.04);
  // door + window
  c.fillStyle='#3d2a16'; rr(c, x-s*.08, y+s*.08, s*.16, s*.24, s*.03); c.fill();
  c.fillStyle='#ffeaa7'; rr(c, x+s*.12, y+s*.04, s*.12, s*.12, s*.02); c.fill();
  drawItem(c, rock?'stone':'wood', x-s*.22, y+s*.22, s*.28);
}
function drawHutCottage(ctx, b, sx, sy, w, z, cx, cy){
  const rock = b.type==='rockHut';
  const wall = skinHex(rock ? '#9a9388' : '#c9873c', 'side'), wallHi = skinHex(rock ? '#c9c2b5' : '#e0a050', 'top');
  const roof = skinHex(rock ? '#4e5964' : '#246b3a', 'top'), roofHi = skinHex(rock ? '#7f8c8d' : '#3d9a58', 'top');
  const pad = z*0.08;
  // side / foundation
  ctx.fillStyle = rock ? '#6d6560' : '#6b3e1a';
  rr(ctx, sx+pad, sy+w*0.55, w-pad*2, w*0.38, z*0.08); ctx.fill();
  ctx.fillStyle = wall;
  rr(ctx, sx+pad, sy+w*0.28, w-pad*2, w*0.5, z*0.1); ctx.fill();
  ctx.fillStyle = wallHi;
  rr(ctx, sx+pad+z*0.04, sy+w*0.3, w-pad*2-z*0.08, z*0.1, z*0.04); ctx.fill();
  // timber beams
  ctx.strokeStyle = rock ? 'rgba(60,55,50,.35)' : 'rgba(80,40,15,.35)'; ctx.lineWidth = Math.max(1, z*0.04);
  ctx.beginPath(); ctx.moveTo(sx+w*0.33, sy+w*0.32); ctx.lineTo(sx+w*0.33, sy+w*0.78);
  ctx.moveTo(sx+w*0.67, sy+w*0.32); ctx.lineTo(sx+w*0.67, sy+w*0.78); ctx.stroke();
  // peaked roof
  const rx=sx+pad-z*0.08, ry=sy+w*0.34, rw=w-pad*2+z*0.16;
  ctx.fillStyle='rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.moveTo(rx+z*0.04, ry+z*0.08); ctx.lineTo(sx+w/2, sy+z*0.02); ctx.lineTo(rx+rw+z*0.04, ry+z*0.08); ctx.closePath(); ctx.fill();
  ctx.fillStyle=roof;
  ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(sx+w/2, sy-z*0.08); ctx.lineTo(rx+rw, ry); ctx.closePath(); ctx.fill();
  ctx.fillStyle=roofHi;
  ctx.beginPath(); ctx.moveTo(rx+rw*0.18, ry-z*0.02); ctx.lineTo(sx+w/2, sy+z*0.02); ctx.lineTo(sx+w/2+z*0.12, ry-z*0.02); ctx.closePath(); ctx.fill();
  // chimney + smoke
  ctx.fillStyle = rock ? '#5a524c' : '#5a3016';
  rr(ctx, sx+w*0.68, sy-z*0.02, z*0.22, z*0.42, z*0.04); ctx.fill();
  ctx.fillStyle = rock ? '#c0392b' : '#b03a2e';
  ctx.fillRect(sx+w*0.68, sy-z*0.02, z*0.22, z*0.07);
  if (!R.quiet && Math.random() < 0.035*(60/Math.max(30,fps))) R.parts.push({x:b.x+1.45, y:b.y+0.05, vx:(Math.random()-.5)*.15, vy:-.55, life:1.8, max:1.8, col:'rgba(240,240,250,', size:.16, smoke:true});
  // door
  ctx.fillStyle='#3d2a16'; rr(ctx, cx-z*0.16, sy+w*0.5, z*0.32, z*0.42, z*0.05); ctx.fill();
  ctx.fillStyle='#f0c36a'; ctx.beginPath(); ctx.arc(cx+z*0.08, sy+w*0.7, z*0.035, 0, 7); ctx.fill();
  // window
  ctx.fillStyle='#ffeaa7'; rr(ctx, cx+z*0.28, sy+w*0.42, z*0.28, z*0.24, z*0.04); ctx.fill();
  ctx.strokeStyle='rgba(80,50,20,.45)'; ctx.lineWidth=Math.max(1,z*0.03);
  ctx.beginPath(); ctx.moveTo(cx+z*0.42, sy+w*0.42); ctx.lineTo(cx+z*0.42, sy+w*0.66);
  ctx.moveTo(cx+z*0.28, sy+w*0.54); ctx.lineTo(cx+z*0.56, sy+w*0.54); ctx.stroke();
  // porch pile
  drawItem(ctx, rock?'stone':'wood', sx+z*0.32, sy+w*0.78, z*0.38);
  // warning badge
  const bx = sx+w-z*0.18, by = sy+z*0.22;
  ctx.fillStyle='#c0392b'; ctx.beginPath(); ctx.arc(bx, by, Math.max(7, z*0.16), 0, 7); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font=`900 ${Math.max(9,z*0.22)}px -apple-system,Segoe UI,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!', bx, by+0.5);
}
function drawHutWorker(w, b){
  const z = cam.z; if (z < OV_Z) return;
  const [sx,sy] = toScreen(w.x, w.y);
  if (sx<-40||sy<-40||sx>W+40||sy>H+40) return;
  const rock = b.type==='rockHut';
  const walk = (w.state==='walkOut'||w.state==='walkBack');
  const chop = w.state==='chop';
  const bob = walk ? Math.sin(R.time*14 + w.x*8)*z*0.05 : (chop ? Math.sin(Math.min(1,w.t/Math.max(0.01,hutChopT(b)))*Math.PI)*z*0.04 : 0);
  const flip = Math.cos(w.facing||0) < 0;
  const s = z*0.62;
  ctx.save(); ctx.translate(sx, sy - z*0.12 + bob); if (flip) ctx.scale(-1,1);
  // shadow
  ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, s*0.42, s*0.28, s*0.1, 0,0,7); ctx.fill();
  // legs
  const swing = walk ? Math.sin(R.time*14 + w.x*8)*s*0.12 : 0;
  ctx.fillStyle = rock ? '#4a4a52' : '#5c3317';
  ctx.fillRect(-s*0.13, s*0.12, s*0.11, s*0.28+swing);
  ctx.fillRect(s*0.02, s*0.12, s*0.11, s*0.28-swing);
  // body
  ctx.fillStyle = rock ? '#7f8c8d' : '#1e8449';
  rr(ctx, -s*0.2, -s*0.18, s*0.4, s*0.36, s*0.08); ctx.fill();
  ctx.fillStyle = rock ? '#b2bec3' : '#2ecc71';
  rr(ctx, -s*0.2, -s*0.18, s*0.4, s*0.14, s*0.08); ctx.fill();
  // head
  ctx.fillStyle='#f3d2b1'; ctx.beginPath(); ctx.arc(0, -s*0.32, s*0.16, 0,7); ctx.fill();
  // hat / hair
  if (rock){
    ctx.fillStyle='#f1c40f'; rr(ctx, -s*0.18, -s*0.46, s*0.36, s*0.14, s*0.05); ctx.fill();
    ctx.fillRect(-s*0.24, -s*0.36, s*0.48, s*0.05);
  } else {
    ctx.fillStyle='#4a2a12'; ctx.beginPath(); ctx.arc(0, -s*0.36, s*0.15, Math.PI, 0); ctx.fill();
  }
  // tool or cargo
  const chopAng = chop ? -0.9 + Math.sin((w.t/Math.max(0.01,hutChopT(b)))*Math.PI)*1.6 : -0.5;
  if (w.state==='walkBack' && w.carry){
    ctx.save(); ctx.translate(-s*0.22, -s*0.02); ctx.rotate(-0.6);
    drawItem(ctx, w.item || hutItem(b), 0, 0, s*0.7);
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(s*0.22, -s*0.02); ctx.rotate(chopAng);
    if (rock){
      ctx.strokeStyle='#5d6d7e'; ctx.lineWidth=s*0.07; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, s*0.42); ctx.stroke();
      ctx.fillStyle='#95a5a6'; ctx.beginPath(); ctx.moveTo(-s*0.14, s*0.08); ctx.lineTo(s*0.14, s*0.08); ctx.lineTo(s*0.04, -s*0.04); ctx.lineTo(-s*0.04, -s*0.04); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle='#6b3e1a'; ctx.lineWidth=s*0.07; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, s*0.4); ctx.stroke();
      ctx.fillStyle='#b2bec3'; ctx.beginPath(); ctx.moveTo(-s*0.12, s*0.36); ctx.lineTo(s*0.16, s*0.28); ctx.lineTo(s*0.16, s*0.4); ctx.lineTo(-s*0.12, s*0.48); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
function drawHutWorkers(){
  if (!S || !S.b || cam.z < OV_Z) return;
  const list = [];
  for (const b of S.b) if (isHut(b) && b.workers) for (const w of b.workers) list.push([w,b]);
  list.sort((a,b)=>a[0].y-b[0].y);
  for (const [w,b] of list) drawHutWorker(w,b);
}
function drawHutFalls(dt){
  if (!R.falls || !R.falls.length) return;
  const z = cam.z, wld = world();
  for (let i=R.falls.length-1;i>=0;i--){
    const f = R.falls[i]; f.life -= dt; if (f.life<=0){ R.falls.splice(i,1); continue; }
    const a = f.life/f.max, [sx,sy] = toScreen(f.x, f.y);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate((1-a)*1.15); ctx.globalAlpha = Math.min(1, a*1.6); ctx.scale(0.7+0.3*a, 0.7+0.3*a);
    if (f.tv===TREE) drawWorldTree(ctx, 0, 0, z*0.95, (f.x*31+f.y*17)|0, wld);
    else {
      ctx.fillStyle='#8a8276'; ctx.beginPath(); ctx.ellipse(0, z*0.08, z*0.28, z*0.16, 0.4, 0, 7); ctx.fill();
      ctx.fillStyle='#c9c2b5'; ctx.beginPath(); ctx.ellipse(-z*0.06, 0, z*0.2, z*0.14, -0.3, 0, 7); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
function drawHutGuides(){
  const sel = R.sel; if (!sel) return;
  const ghost = sel.ghost && BUILDINGS[sel.ghost.type] && BUILDINGS[sel.ghost.type].hut ? sel.ghost : null;
  const b = sel.b && isHut(sel.b) ? sel.b : null;
  const src = b || ghost; if (!src) return;
  const type = src.type, reach = hutReach(b || {type, reach:0});
  const [cx,cy] = b ? hutCenter(b) : [src.x + BUILDINGS[type].size/2, src.y + BUILDINGS[type].size/2];
  const [sx,sy] = toScreen(cx, cy), r = reach * cam.z;
  if (r < 8) return;
  const rock = type==='rockHut';
  ctx.save();
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7);
  ctx.fillStyle = 'rgba(192,57,43,.10)'; ctx.fill();
  ctx.strokeStyle = 'rgba(192,57,43,.7)'; ctx.lineWidth = 2.5; ctx.setLineDash([7,6]); ctx.lineDashOffset = -R.time*18; ctx.stroke();
  ctx.setLineDash([]);
  // Pill sits just above the hut (the 40-tile ring usually runs off-screen at play zoom).
  const label = rock ? 'Rocks gone for good' : 'Trees gone for good';
  ctx.font = '800 13px -apple-system,Segoe UI,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const tw = ctx.measureText('⚠ '+label).width;
  const hutTop = sy - BUILDINGS[type].size * cam.z / 2;
  let ly = hutTop - 18;
  ly = Math.max(16, Math.min(H - 80, ly));
  let lx = sx;
  lx = Math.max(tw/2+12, Math.min(W - tw/2-12, lx));
  ctx.fillStyle='rgba(45,20,16,.9)'; rr(ctx, lx-tw/2-10, ly-11, tw+20, 22, 10); ctx.fill();
  ctx.fillStyle='#ffe8d4'; ctx.fillText('⚠ '+label, lx, ly);
  ctx.restore();
}

function tap(sx, sy){
  if (DESK.on) R.dkTab = 'build'; // desktop: docked panel never blocks the map — the click goes straight through
  else if (sheetWrap.classList.contains('open')){ closeSheet(); return; } // sheet backdrop owns dismiss; never build under a sheet
  const badge = pauseBadgeAt(sx, sy);
  if (badge){ resumeFromBadge(badge); return; }
  if (cam.z < TAP_ZOOM_Z){ const [wx,wy] = toWorld(sx,sy); zoomTo(wx, wy, 36); sfx('click'); if (!S.hub) toast('Zooming in — tap open grass to place your Main Hub', 2200); return; } // tiny scale: zoom in first, never place or build
  const [wx,wy] = toWorld(sx,sy), tx = Math.floor(wx), ty = Math.floor(wy);
  if (!inMap(tx,ty)) return;
  ripple(wx,wy);
  if (R.placeLand || R.moveLand){ try { finishLandmarkTap(tx, ty); } catch(e){} return; }
  if (R.moveHub){
    if (!S.hub){ endHubMove(); return; }
    const p = pickAt(wx,wy);
    if (p && p.b === S.hub){ cancelHubMove(); toast('Move cancelled', 1800); return; }
    openHubMovePlace(tx-1, ty-1); return;
  }
  if (!S.hub){ openHubPlace(tx-1, ty-1); return; }
  const p = pickAt(wx,wy) || {tile:[tx,ty]};
  if (R.multi){ const b = p.b && S.b.includes(p.b) ? p.b : null; if (b) toggleMulti(b); else if (p.b) toast('Tap Done to leave selection'); return; }
  if (p.b){ openInfo(p.b); return; }
  const [x,y] = p.res || p.tile; openBuildMenu(x, y);
}
function ripple(x,y){ R.parts.push({x,y,vx:0,vy:0,life:.35,max:.35,col:'rgba(255,255,255,',size:.25,smoke:true}); }

// ============================== UI ==============================
const $ = id => document.getElementById(id);
const sheetWrap = $('sheetWrap'), sheet = $('sheet');
function sheetScroller(){ return sheet.querySelector('.bld-body') || sheet; }
function updateSheetMore(){
  if (!sheetWrap.classList.contains('open')){ sheet.classList.remove('sheet-more'); return; }
  const sc = sheetScroller();
  const more = sc.scrollHeight > sc.clientHeight + 10 && (sc.scrollTop + sc.clientHeight < sc.scrollHeight - 12);
  sheet.classList.toggle('sheet-more', more);
}
function openSheet(html, onClose, opts){
  opts = opts || {};
  const rerender = !!(opts.keep && sheetWrap.classList.contains('open'));
  const sc0 = rerender ? sheetScroller() : null;
  const keepY = sc0 && sc0 !== sheet ? sc0.scrollTop : (rerender ? sheet.scrollTop : 0);
  if (!rerender) R.sheetT = performance.now();
  sheet.innerHTML = '<div class="grab"></div>' + html;
  sheetWrap.classList.add('open');
  R.onClose = onClose;
  sheet.classList.toggle('has-bld-head', !!opts.pin);
  sheet.scrollTop = 0;
  const sc = sheetScroller();
  if (sc !== sheet){
    sc.scrollTop = keepY;
    if (R._bldScroll && R._bldScroll !== sc) R._bldScroll.removeEventListener('scroll', updateSheetMore);
    sc.addEventListener('scroll', updateSheetMore, {passive:true});
    R._bldScroll = sc;
  }
  requestAnimationFrame(updateSheetMore);
  if (DESK.on) deskSync();
}
function navSel(id){ document.querySelectorAll('#bottom .nav').forEach(el => el.classList.toggle('sel', !!id && el.id===id)); }
function closeSheet(){ navSel(null); sheetWrap.classList.remove('open'); R.dkTab = 'build'; if (DESK.on) deskSync(); sheet.classList.remove('sheet-more','has-bld-head'); R.sel = null; if (R.onClose){ const f=R.onClose; R.onClose=null; f(); } if (R.pendingDaily) offerDailySoon(); else if (R.pendingEraNews || needsEraNews()) offerEraNewsSoon(); }
// Tap the dimmed game band above the sheet to dismiss — never let that tap reach the canvas/build
sheetWrap.addEventListener('pointerdown', e => {
  if (e.target !== sheetWrap) return;
  e.preventDefault(); e.stopPropagation();
  closeSheet();
}, true);
sheet.addEventListener('scroll', updateSheetMore, {passive:true});
// swallow the ghost click from the map tap that just opened this sheet (it could otherwise hit a Build button under the finger)
sheet.addEventListener('click', e => { if (e.isTrusted && performance.now() - (R.sheetT||0) < 350){ e.stopPropagation(); e.preventDefault(); } }, true);
const costHTML = c => { const k = Object.keys(c); if (!k.length) return '<b style="color:#00b894">FREE</b>'; return k.map(id => `<span class="cost ${(S.stock[id]||0)>=c[id]?'':'no'}">${itag(id, c[id])}</span>`).join(' '); };
function megaBlurb(type, tv){
  const ore = (tv!=null && RES[tv]) ? RES[tv].name : 'ore';
  const map = {
    megaCutter: 'Big 3×3 harvester. Chops Wood 8× faster than a Wood Cutter. Must sit on trees.',
    megaQuarry: 'Big 3×3 quarry. Digs Stone 8× faster than a Quarry. Must sit on stone.',
    megaDrill: 'Big 3×3 drill. Mines '+ore+' 8× faster than an Ore Drill. Must sit on ore tiles.',
    megaBlock: 'Big 3×3 workshop. Crafts Planks, Bricks, Gears, Wire, and Silver Contacts 5× faster than a Workshop. Place on open grass.',
    megaSmelter: 'Big 3×3 smelter. Melts ore into metal and glass 5× faster than a Smelter. Place on open grass.',
    megaHub: 'Big 4×4 extra Hub. Nearby buildings belt here automatically. Free to place, as many as you like.',
  };
  return map[type] || (BUILDINGS[type] && BUILDINGS[type].desc) || '';
}
const recipeHTML = r => { const R_ = RECIPES[r]; return Object.keys(R_.in).map(k=>itag(k, R_.in[k])).join('<span class="op">+</span>') + `<span class="op">→</span>${itag(r, R_.out)}`; };
function openHubPlace(x, y){
  [x, y] = clampHubPlace(x, y, 'hub');
  R.sel = {ghost:{type:'hub', x, y}};
  const err = placeCheck('hub', x, y);
  openSheet(`<h2>Main Hub</h2><div class="sub">Everything you make gets delivered here. Pick a spot near trees!</div>
    ${err?`<div class="sub" style="color:#d63031">${err}. Tap another spot.</div>`:''}
    <div class="row"><button class="btn gray" data-a="x">Cancel</button><button class="btn green" data-a="ok" ${err?'disabled':''}>Place Hub Here</button></div>`);
  sheet.querySelector('[data-a=x]').onclick = closeSheet;
  sheet.querySelector('[data-a=ok]').onclick = () => { if (build('hub', x, y)){ closeSheet(); cam.vx=cam.vy=0; toast('Hub placed! Now tap a tree to build a Wood Cutter (first one is free)', 3200); } };
}
function openBuildMenu(tx, ty){
  const tv = R.terr[idx(tx,ty)];
  if (tv===WATER){ toast('That\'s water'); return; }
  const opts = [];
  const anchorsFor = (type) => {
    const cells = footprint(type, 0, 0);
    if (cells.length<=1) return [[tx,ty]];
    return cells.map(([dx,dy]) => [tx-dx, ty-dy]);
  };
  for (const type of BUILD_ORDER){
    const B = BUILDINGS[type];
    // Owned megas always listed once unlocked (any era). Resource megas still show on grass
    // so you can aim a 3×3 footprint that covers a nearby patch; placeCheck explains if not.
    if (B.landmark){ if (tv!==GRASS) continue; }
    else if (B.mega){ if (!megaUnlocked(type)) continue; if (B.on){ if (!B.on.includes(tv) && tv!==GRASS) continue; } else if (tv!==GRASS) continue; }
    else { if (B.on){ if (!B.on.includes(tv)) continue; } else if (tv!==GRASS) continue; }
    if (type==='rockHut' && !has('res:stone')) continue;
    if (B.hut && !megaUnlocked(type)) continue; // perk-gated: hide until bought (don't show as a quest lock)
    let locked = B.unlockPerk ? !megaUnlocked(type) : (type!=='cutter' && !has('b:'+type) && !B.hut && !B.landmark);
    if (B.on && RES[tv] && RES[tv].unlock && !has(RES[tv].unlock) && !B.landmark) locked = true;
    // Landmarks are Style Shop cosmetics — never era/quest gated. Owned = placeable; unowned = "Buy in Style Shop".
    if (B.landmark) locked = !cosOwned(type);
    let x = tx, y = ty;
    if (B.size>=2 || (B.mask && B.mask.length)){ const cands=anchorsFor(type); const good=cands.find(([a,b])=>!placeCheck(type,a,b)); if (good) [x,y]=good; else [x,y]=cands[0]; }
    opts.push({type, x, y, locked, err: placeCheck(type,x,y), mega:!!B.mega, land:!!B.landmark});
  }
  if (!opts.length){ toast('Nothing to build here'); return; }
  // Owned placeable megas rise above locked era buildings so Hub Extension isn't buried
  // under Assembler/Lab locks on early eras / short iPhone sheets. Prefer affordable first.
  opts.sort((a,b) => {
    const score = o => {
      if (o.locked) return 4;
      if (o.err) return 3;
      const pay = canPay(costOf(o.type, bKey(o.type,o.x,o.y)));
      if (o.mega && pay) return 0;                       // owned mega you can afford (e.g. free Hub Extension)
      if (!o.mega && pay) return 1;                      // normal unlocked + affordable
      if (o.mega) return 2;                              // mega visible but can't afford yet
      return 2.5;
    };
    return score(a)-score(b) || BUILD_ORDER.indexOf(a.type)-BUILD_ORDER.indexOf(b.type);
  });
  const first = opts.find(o=>!o.locked && !o.err) || opts[0];
  R.sel = {ghost:{type:first.type, x:first.x, y:first.y}};
  const lockMsg = o => { const B = BUILDINGS[o.type]; if (B.landmark) return 'Buy in Style Shop'; if (B.on && RES[tv] && RES[tv].unlock && has('b:'+o.type) === false && o.type!=='cutter') return 'Unlock with quests'; return 'Unlock with quests'; };
  const title = tv===GRASS ? 'Build on open land' : (RES[tv] ? RES[tv].name : 'Build');
  const clr = RES[tv] ? (() => { const e = clearCheck(tx,ty), n = (tv===TREE || tv===STONE) ? hutWearLeft(idx(tx,ty), tv) : CLEAR_YIELD[tv], it = RES[tv].item;
    return `<div class="opt clr" id="clrOpt"><div class="oi clri">💥</div><div class="ob"><div class="on">Clear ${tv===TREE?'Tree':'Tile'}</div><div class="od">${e==='locked'?'🔒 Unlock '+RES[tv].name+' with quests first':e?'<span class="cost no">'+e+'</span>':'Turns it into open grass for good — room for Workshops &amp; Smelters'}</div></div>${e?'':`<button class="btn orange" data-a="clr">Clear · +${n} ${iname(it,n)}</button>`}</div>`; })() : '';
  openSheet(`<h2>${title}</h2><div class="sub">${tv===GRASS?'Crafters get their own belts to and from the Hub automatically.':'Harvesters auto-belt everything to your Hub.'} <span class="brtip">🌉 Belts that cross hop over each other on bridges automatically.</span></div>
    ${opts.map((o,i)=>{ const B = BUILDINGS[o.type], c = costOf(o.type, bKey(o.type,o.x,o.y));
      // Gold FREE must follow the same costOf/harvKeyOf logic as the Build button (includes Mega Drill / Mega Harvester / Mega Quarry).
      const hk = harvKeyOf(o.type, bKey(o.type,o.x,o.y));
      const gk = !o.locked && !!(hk && isGoldKey(hk));
      const pay = canPay(c);
      const oreName = (o.type==='drill' || o.type==='megaDrill') && !o.locked && (RES[drillOreTv(o.type,o.x,o.y)]||RES[tv]);
      const blurb = o.locked ? ('🔒 '+lockMsg(o))
        : o.err ? ('<span class="cost no">'+o.err+'</span>')
        : (megaBlurb(o.type, (drillOreTv(o.type,o.x,o.y) ?? tv)) || B.desc);
      const hutMax = !!(B.hut && !o.locked && hutAtCap(o.type));
      const hutLeft = B.hut ? hutSlotsLeft(o.type) : 0;
      const goldNote = gk ? `<div class="goldnote">${goldBonusLine(hk)}</div>` : '';
      const need = (!o.locked && !o.err && !pay && !gk && !B.hut) ? `<div class="needwhy">Can't build yet — need ${Object.keys(c).filter(k=>(S.stock[k]||0)<c[k]).map(k=>itag(k,c[k])).join(' ')}</div>` : '';
      const hutFree = (!!B.hut && !o.locked && !hutMax && !o.err) ? ` · <b class="goldfree">FREE · ${hutLeft} of ${HUT_PLACE_MAX} left</b>` : '';
      const btn = o.locked ? '' : hutMax ? `<button class="btn" data-b="${i}" disabled>Max 3 placed</button>` : o.err ? '' : `<button class="btn ${pay?'green':''}" data-b="${i}" ${pay?'':'disabled'}>${B.landmark?'Place':(gk?'Build · FREE':'Build')}</button>`;
      return `<div class="opt ${o===first?'sel':''} ${o.locked?'lock':''} ${gk?'goldopt':''} ${o.land?'landopt':''}" data-i="${i}"><img class="oi" src="${icon(o.type)}"><div class="ob"><div class="on">${B.name}${oreName?' ('+oreName.name+')':''}${o.mega&&!o.locked?' <span class="mega-tag">MEGA</span>':''}${o.land?' <span class="land-tag">LOOKS</span>':''}</div><div class="od">${blurb}${o.locked||o.err||gk||B.hut?'':(' · '+costHTML(c))}${gk&&!o.err&&!o.locked?' · <b class="goldfree">★ FREE · 25% faster</b>':''}${hutFree}</div>${(!o.err&&!o.locked)?goldNote:''}${need}</div>
      ${btn}</div>`; }).join('')}${clr}`);
  const cb = sheet.querySelector('[data-a=clr]'); if (cb) cb.onclick = ev => { ev.stopPropagation(); const n = clearTile(tx,ty); if (n){ closeSheet(); sfx('collect'); toast(`Cleared! +${n} ${iname(RES[tv].item,n)}`); } };
  sheet.querySelectorAll('.opt').forEach(el => el.onclick = () => { const o = opts[+el.dataset.i]; if (!o) return; R.sel = {ghost:{type:o.type,x:o.x,y:o.y}}; sheet.querySelectorAll('.opt').forEach(e=>e.classList.remove('sel')); el.classList.add('sel'); });
  sheet.querySelectorAll('[data-b]').forEach(el => el.onclick = ev => { ev.stopPropagation(); const o = opts[+el.dataset.b]; R.lastBuildErr = null; const b = build(o.type, o.x, o.y); if (b){ closeSheet(); if (BUILDINGS[o.type].recipes) setTimeout(()=>openInfo(b), 250); }
    else if (R.lastBuildErr==='route'){ const co = sheet.querySelector('#clrOpt'); if (co){ co.classList.remove('hot'); void co.offsetWidth; co.classList.add('hot'); co.scrollIntoView({block:'nearest', behavior:'smooth'}); } } });
}
function openInfo(b){
  const B = BUILDINGS[b.type]; R.sel = {ghost:null, b}; navSel(null);
  if (B && B.landmark){ openLandmarkInfo(b); return; }
  if (B && B.hut){ openHutInfo(b); return; }
  if (BUILDINGS[b.type] && BUILDINGS[b.type].hubExt){
    const nFeed = S.b.filter(o => o.outPath && o.outPath.hubUid === b.uid).length;
    openSheet(`<h2>Hub Extension</h2>
      <div class="sub">Extra Hub · 4×4 · Free to place, as many as you like</div>
      <div class="sec"><div class="st">What it does</div>
        <div class="sub" style="margin:0">Extra Hub: anything belted here counts as delivered to your Hub. Nearby buildings send here automatically.</div>
        <div class="sr" style="margin-top:8px"><span>Buildings delivering here now</span><b>${nFeed}</b></div>
        <div class="sub" style="margin-top:8px">Belts pick the closest Hub or Extension. Place this near far resource patches so harvesters take the short path.</div>
      </div>
      <div class="sec rm"><span class="st" style="margin:0">Remove</span><button class="btn red" data-a="demo">🗑 Remove</button></div>
      <div class="row"><button class="btn" data-a="x">Done</button></div>`);
    sheet.querySelector('[data-a=x]').onclick = closeSheet;
    const dbtn = sheet.querySelector('[data-a=demo]'); dbtn.onclick = () => { if (dbtn.dataset.c){ demolish(b); closeSheet(); } else { dbtn.dataset.c = 1; dbtn.textContent = 'Tap again to remove'; } };
    return;
  }
  if (b.type==='hub'){
    const hubSub = () => `${eraLabel(S.rebirths)} · ${eraName(S.rebirths)} · ${S.b.length} building${S.b.length===1?'':'s'} · ✦ ${S.pp}`;
    const hubKeys = () => Object.keys(S.stock).filter(k=>S.stock[k]>0 && ITEMS[k]);
    const cell = k => `<div data-k="${k}">${img(k)}<span class="hq">${fmt(S.stock[k]||0)}</span> ${ITEMS[k].name}</div>`;
    const keys = hubKeys();
    openSheet(`<h2>Main Hub</h2><div class="sub" id="hsub">${hubSub()}</div>
      <div class="inv" id="hinv">${keys.length?keys.map(cell).join(''):'<div class="hempty">Empty</div>'}</div>
      <div class="row" style="margin-top:10px"><button class="btn" data-a="mv">Move Hub</button><button class="btn" data-a="x">Done</button></div>`);
    const mv = sheet.querySelector('[data-a=mv]'); if (mv) mv.onclick = () => { closeSheet(); startHubMove(); };
    const done = sheet.querySelector('[data-a=x]'); if (done) done.onclick = closeSheet;
    // live refresh in place (~4.5x/sec): update numbers, append newly arrived items; never rebuild or reset scroll
    const tickHub = () => {
      const sub = sheet.querySelector('#hsub'), inv = sheet.querySelector('#hinv'); if (!sub || !inv) return;
      const t = hubSub(); if (sub.textContent !== t) sub.textContent = t;
      for (const k of hubKeys()){
        let el = inv.querySelector(`[data-k="${k}"]`);
        if (!el){ const em = inv.querySelector('.hempty'); if (em) em.remove(); inv.insertAdjacentHTML('beforeend', cell(k)); el = inv.lastElementChild; el.classList.add('new'); setTimeout(()=>el.classList.remove('new'), 600); continue; }
        const q = el.querySelector('.hq'), v = fmt(S.stock[k]||0);
        if (q.textContent !== v){ const up = (S.stock[k]||0) > (+el.dataset.n||0); q.textContent = v; if (up){ el.classList.add('up'); clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('up'), 350); } }
        el.dataset.n = S.stock[k]||0;
      }
      inv.querySelectorAll('[data-k]').forEach(el => { const k = el.dataset.k; if (!(S.stock[k]>0)){ const q = el.querySelector('.hq'); if (q.textContent !== '0') q.textContent = '0'; el.dataset.n = 0; } });
    };
    clearInterval(R.infoTimer); R.infoTimer = setInterval(() => { if (!sheetWrap.classList.contains('open') || !R.sel || R.sel.b !== b || S.hub !== b) { clearInterval(R.infoTimer); return; } tickHub(); }, 220);
    tickHub();
    return;
  }
  const rf = n => (n>=10 ? Math.round(n) : +n.toFixed(1)) + '/min';
  const doUpg = (toLv) => {
    const from = b.lv || 1;
    if (toLv <= from || toLv > MAX_LV) return;
    const tot = {};
    for (let n = from+1; n <= toLv; n++){
      const c = lvCost(b.type, n); if (!c) return;
      for (const k in c) tot[k] = (tot[k]|0) + c[k];
    }
    if (!Object.keys(tot).every(itemKnown) || !canPay(tot)) return;
    pay(tot); b.lv = toLv; b.tier = toLv; b.pop = 1;
    try { noteChProgress('upg', 1); } catch(e){}
    puff(b.x+B.size/2, b.y+B.size/2, LV_COL[toLv], 18); if (lvDouble(toLv)>lvDouble(from)) x2Pop(b);
    sfx('upgrade'); vibrate(20);
    toast(`${B.name} → Level ${toLv} (${Math.round(lvSpeed(toLv)*100)}% speed, ${Math.round(lvDouble(toLv)*100)}% double)`);
    R.dirty = true; save(); render();
  };
  const render = () => {
    const lv0 = b.lv || 1, tm = lvSpeed(lv0), dch = dblChance(b);
    let stats = '', prog = '', recipes = '';
    if (B.on){ const item = harvestItem(b) || 'wood'; const rate = 60*harvestMul()*tm/ivOf(b);
      stats = `<div class="sh">Speed</div><div class="sr">${img(item)}<span>${(ITEMS[item]||{name:'?'}).name}</span><b>${rf(rate)}</b></div>` + (dch ? `<div class="sr avg"><span>Avg with doubles (${Math.round(dch*100)}% x2)</span><b>${rf(rate*(1+dch))}</b></div>` : '');
      prog = `<div class="ph"><span>${(ITEMS[item]||{name:'?'}).name}</span><em id="ist">${b.blocked?'Belt full':'Working'}</em></div><div class="pbar"><i id="ipb"></i></div>`;
    } else {
      const r = RECIPES[b.recipe];
      const mc = B.megaCraft || 1;
      const baseLabel = b.type==='megaBlock' ? 'Workshop' : b.type==='megaSmelter' ? 'Smelter' : null;
      if (r){ const T = r.time/(craftMul()*tm*mc); // includes megaCraft (5× Block / Smelter)
        stats = (mc>1 && baseLabel ? `<div class="sh">Speed</div><div class="sr"><span></span><b>${mc}× ${baseLabel}</b></div>` : '') +
          `<div class="sh"${mc>1 && baseLabel?' style="margin-top:6px"':''}>Max Input</div>` + Object.keys(r.in).map(k=>`<div class="sr">${img(k)}<span>${ITEMS[k].name}</span><b>${rf(r.in[k]*60/T)}</b></div>`).join('') +
          `<div class="sh" style="margin-top:6px">Max Output</div><div class="sr">${img(b.recipe)}<span>${ITEMS[b.recipe].name}</span><b>${rf(r.out*60/T)}</b></div>` + (dch ? `<div class="sr avg"><span>Avg with doubles (${Math.round(dch*100)}% x2)</span><b>${rf(r.out*60/T*(1+dch))}</b></div>` : '');
        prog = `<div class="ph"><span>${ITEMS[b.recipe].name}</span><em id="ist"></em></div><div class="pin" id="ipin"></div><div class="pbar"><i id="ipb"></i></div>`;
      }
      recipes = `<div class="sec"><div class="st">Recipe</div><div class="sub" style="margin:0 0 6px">Ingredients come from the Hub on the blue belt; products return on the orange belt.${mc>1?` This building crafts <b>${mc}×</b> as fast as a normal ${baseLabel||'crafter'}.`:''}</div>` +
        B.recipes.map(rid => { const ok = has('r:'+rid); const t = RECIPES[rid].time/(craftMul()*tm*mc); return `<div class="opt ${b.recipe===rid?'sel':''} ${ok?'':'lock'}" data-r="${rid}"><img class="oi" src="${icon(rid)}"><div class="ob"><div class="on">${ITEMS[rid].name}</div><div class="od">${ok?recipeHTML(rid)+` · ${t<10?t.toFixed(1):Math.round(t)}s`:'🔒 Unlock with quests'}</div></div></div>`; }).join('') + `</div>`;
    }
    // —— clear single-track upgrade panel ——
    const lv = lv0;
    const stars = (n) => Array.from({length:MAX_LV}, (_,i) => i < n ? '★' : '☆').join('');
    const fmtSec = s => (s >= 10 ? Math.round(s) : s.toFixed(1)) + 's';
    const baseIv = B.on ? ivOf(b) / harvestMul() : (RECIPES[b.recipe] ? RECIPES[b.recipe].time / (craftMul()*(B.megaCraft||1)) : 1);
    const everyNow = baseIv / tm;
    const everyNext = lv < MAX_LV ? baseIv / lvSpeed(lv+1) : everyNow;
    const dblNow = Math.round(lvDouble(lv)*100), dblNext = lv < MAX_LV ? Math.round(lvDouble(lv+1)*100) : dblNow;
    const next = lv + 1, cNext = lv < MAX_LV ? lvCost(b.type, next) : null;
    const costLine = (c) => {
      if (!c) return '';
      const parts = Object.keys(c).map(k => `${fmt(c[k])} ${(ITEMS[k]||{name:k}).name}`);
      return parts.join(', ');
    };
    const needLine = (c) => {
      if (!c) return '';
      const miss = Object.keys(c).filter(k => (S.stock[k]||0) < c[k]);
      if (!miss.length) return '';
      return 'Need ' + miss.map(k => { const n = c[k] - (S.stock[k]|0); return fmt(n) + ' more ' + (ITEMS[k]||{name:k}).name; }).join(', ');
    };
    const tip = (!S.stats.upgTip) ? `<div class="upg-tip" id="upgTip">💡 Upgrades make this building faster and sometimes produce double.</div>` : '';
    const gain = lv < MAX_LV
      ? `1 every <b>${fmtSec(everyNow)}</b> → <b>${fmtSec(everyNext)}</b> · double <b>${dblNow}%</b> → <b>${dblNext}%</b>`
      : `1 every <b>${fmtSec(everyNow)}</b> · double <b>${dblNow}%</b>`;
    let planN = 0, planTo = lv, planTot = {};
    if (lv < MAX_LV){
      const pool = {}; for (const k in S.stock) pool[k] = S.stock[k]|0;
      let pLv = lv;
      while (pLv < MAX_LV){
        const c = lvCost(b.type, pLv+1); if (!c) break;
        if (!Object.keys(c).every(k => itemKnown(k) && (pool[k]|0) >= c[k])) break;
        for (const k in c){ pool[k] -= c[k]; planTot[k] = (planTot[k]|0) + c[k]; }
        pLv++;
      }
      planN = pLv - lv; planTo = pLv;
    }
    let upgBtn, xBtn = '', need = '';
    if (lv >= MAX_LV){
      upgBtn = `<button class="btn upg-btn max" disabled>MAX — Level ${MAX_LV}</button>`;
    } else {
      const known = Object.keys(cNext).every(itemKnown), ok = known && canPay(cNext);
      need = needLine(cNext);
      upgBtn = `<button class="btn upg-btn ${ok?'green':''}" data-lv="${next}" ${ok?'':'disabled'}><span class="upg-main"><b>Upgrade</b> <em>Lv ${lv} → ${next}</em></span><span class="upg-cost">${costHTML(cNext)}</span></button>`;
      if (planN >= 2){
        const lab = planTo >= MAX_LV ? 'Max' : ('x'+planN);
        xBtn = `<button class="btn upg-xbtn" data-x="${planN}" data-to="${planTo}"><b>${lab}</b><small>Lv ${planTo}</small></button>`;
      }
    }
    const pauseBtn = B.recipes
      ? (b.paused
        ? `<button class="btn upg-pbtn is-paused" data-a="pause"><b>Resume</b><small>Paused</small></button>`
        : `<button class="btn upg-pbtn" data-a="pause"><b>Pause</b></button>`)
      : '';
    const pinSide = (xBtn && pauseBtn) ? `<div class="upg-side">${xBtn}${pauseBtn}</div>` : (xBtn + pauseBtn);
    const head = `<div class="bld-head">
      <div class="bld-title"><h2>${B.name}</h2><div class="bld-lv" style="--tc:${LV_COL[lv]}">${stars(lv)} <span>Lv ${lv}</span></div></div>
      <div class="upg-pin">${upgBtn}${pinSide}</div>
      ${need ? `<div class="upg-need" id="upgNeed">${need}</div>` : `<div class="upg-need" id="upgNeed" hidden></div>`}
      <div class="upg-gain">${gain}</div>
    </div>`;
    const upg = `<div class="sec upg-sec">
      <div class="st">Upgrade details</div>
      ${tip}
      <div class="upg-stars" style="--tc:${LV_COL[lv]}">${stars(lv)} <span>Level ${lv} of ${MAX_LV}</span></div>
      <div class="upg-cmp">
        <div class="upg-row"><span class="uk">Speed</span><span class="uv">makes 1 every <b>${fmtSec(everyNow)}</b>${lv<MAX_LV?` → <b>${fmtSec(everyNext)}</b>`:''}</span></div>
        <div class="upg-row"><span class="uk">Double chance</span><span class="uv"><b>${dblNow}%</b>${lv<MAX_LV?` → <b>${dblNext}%</b>`:''} <small>(sometimes makes 2 instead of 1)</small></span></div>
      </div>
    </div>`;
    openSheet(`${head}<div class="bld-body">
      <div class="sec stats">${stats||'<div class="sub">Pick a recipe below</div>'}</div>
      ${prog?`<div class="sec">${prog}</div>`:''}${recipes}${upg}
      <div class="sec selall"><div class="bk-l"><b>Upgrade many at once</b><span>Long-press a building and drag to select more of the same kind</span></div><button class="btn" data-a="selall">☑ Select all ${plural(B.name)} (${S.b.filter(o=>o.type===b.type).length})</button></div>
      <div class="sec rm"><span class="st" style="margin:0">Remove Building</span><button class="btn red" data-a="demo">🗑 Remove</button></div>
      <div class="row"><button class="btn" data-a="x">Done</button></div>
    </div>`, null, {keep:true, pin:true});
    if (!S.stats.upgTip){ S.stats.upgTip = 1; save(); }
    const pz = sheet.querySelector('[data-a=pause]'); if (pz) pz.onclick = ev => { ev.stopPropagation(); b.paused = !b.paused; if (b.paused && b.inPath) refundItems(b.inPath); save(); render(); };
    sheet.querySelector('[data-a=x]').onclick = closeSheet;
    sheet.querySelector('[data-a=selall]').onclick = () => { closeSheet(); selectAllOfType(b.type); openBulk(); };
    const dbtn = sheet.querySelector('[data-a=demo]'); dbtn.onclick = () => { if (dbtn.dataset.c){ demolish(b); closeSheet(); } else { dbtn.dataset.c = 1; dbtn.textContent = 'Tap again (50% refund)'; } };
    sheet.querySelectorAll('[data-r]').forEach(el => el.onclick = () => { const r = el.dataset.r; if (!has('r:'+r)) { toast('Locked — keep completing quests'); return; } setRecipe(b, r); sfx('click'); render(); });
    const ub = sheet.querySelector('[data-lv]');
    if (ub) ub.onclick = ev => { ev.stopPropagation(); doUpg(+ub.dataset.lv); };
    const xb = sheet.querySelector('[data-to]');
    if (xb) xb.onclick = ev => { ev.stopPropagation(); doUpg(+xb.dataset.to); };
    tick();
  };
  // live affordability for the pinned Upgrade button (and Max/xN if present)
  const afford = () => {
    const bt = sheet.querySelector('button[data-lv]'); if (!bt) return;
    const c = lvCost(b.type, +bt.dataset.lv); if (!c) return;
    const known = Object.keys(c).every(itemKnown), ok = known && canPay(c);
    const need = (() => { const miss = Object.keys(c).filter(k => (S.stock[k]||0) < c[k]); if (!miss.length) return ''; return 'Need ' + miss.map(k => fmt(c[k]-(S.stock[k]|0)) + ' more ' + (ITEMS[k]||{name:k}).name).join(', '); })();
    const ne = sheet.querySelector('#upgNeed');
    if (ne){ if (need){ ne.hidden = false; if (ne.textContent !== need) ne.textContent = need; } else ne.hidden = true; }
    const costEl = bt.querySelector('.upg-cost');
    const costH = costHTML(c);
    if (costEl && costEl.innerHTML !== costH) costEl.innerHTML = costH;
    if (bt.disabled === ok){ bt.disabled = !ok; bt.classList.toggle('green', ok); }
    const pin = sheet.querySelector('.upg-pin'); if (!pin) return;
    const from = b.lv || 1;
    const pool = {}; for (const k in S.stock) pool[k] = S.stock[k]|0;
    let pLv = from, pN = 0;
    while (pLv < MAX_LV){
      const cc = lvCost(b.type, pLv+1); if (!cc) break;
      if (!Object.keys(cc).every(k => itemKnown(k) && (pool[k]|0) >= cc[k])) break;
      for (const k in cc) pool[k] -= cc[k];
      pLv++; pN++;
    }
    const pz = pin.querySelector('[data-a=pause]');
    let side = pin.querySelector('.upg-side');
    const host = () => {
      if (pz){
        if (!side){ side = document.createElement('div'); side.className = 'upg-side'; pin.appendChild(side); side.appendChild(pz); }
        return side;
      }
      return pin;
    };
    let xb = pin.querySelector('[data-to]');
    if (pN >= 2){
      const lab = pLv >= MAX_LV ? 'Max' : ('x'+pN);
      if (!xb){
        xb = document.createElement('button'); xb.className = 'btn upg-xbtn';
        const h = host();
        if (pz && h === side) h.insertBefore(xb, pz);
        else h.appendChild(xb);
        xb.onclick = ev => { ev.stopPropagation(); doUpg(+xb.dataset.to); };
      }
      xb.dataset.x = pN; xb.dataset.to = pLv;
      const html = `<b>${lab}</b><small>Lv ${pLv}</small>`;
      if (xb.innerHTML !== html) xb.innerHTML = html;
    } else if (xb){
      xb.remove();
      if (side && pz){ pin.appendChild(pz); side.remove(); side = null; }
      else if (side && !side.childElementCount){ side.remove(); side = null; }
    }
  };
  // live progress while this panel is open
  const tick = () => {
    afford();
    const pb = sheet.querySelector('#ipb'); if (!pb) return;
    if (B.on){ const iv = ivOf(b)/(harvestMul()*lvSpeed(b.lv||1)); pb.style.width = Math.min(100, 100*b.t/iv)+'%'; const st = sheet.querySelector('#ist'); if (st) st.textContent = b.blocked ? 'Belt full' : 'Working'; }
    else { const r = RECIPES[b.recipe]; if (!r) return; pb.style.width = (b.crafting ? Math.min(100, 100*b.craftT/r.time) : 0)+'%';
      const wait = Object.keys(r.in).filter(k => (b.buf[k]||0) < r.in[k]);
      const st = sheet.querySelector('#ist');
      if (st){
        let msg;
        if (b.paused) msg = 'Paused';
        else if (b.crafting) msg = 'Crafting…';
        else if (b.outQ) msg = 'Sending output';
        else if (wait.length){
          // plain-words starve line: needs X/min vs getting Y/min (EMA of hub→belt pulls)
          const k = wait[0], needPm = Math.round(r.in[k]*craftRate(b)*60), gotPm = Math.round(((b.inFlow&&b.inFlow[k])||0)/2*60);
          msg = `Waiting for ${ITEMS[k].name} — needs ${needPm}/min, getting ${gotPm}/min`;
        } else msg = 'Ready';
        if (st.textContent !== msg) st.textContent = msg;
      }
      const pin = sheet.querySelector('#ipin'); if (pin){ const h = Object.keys(r.in).map(k=>`<span class="it">${img(k)}<span class="iq">${b.buf[k]||0}/${r.in[k]}</span> <span class="nm">${ITEMS[k].name}</span></span>`).join('') + `<span class="op">→</span><span class="it">${img(b.recipe)}<span class="iq">${b.outQ||0}</span> <span class="nm">${ITEMS[b.recipe].name}</span></span>`; if (pin.dataset.h !== h){ pin.dataset.h = h; pin.innerHTML = h; } } }
  };
  clearInterval(R.infoTimer); R.infoTimer = setInterval(() => { if (!sheetWrap.classList.contains('open') || !R.sel || R.sel.b !== b || !S.b.includes(b)) { clearInterval(R.infoTimer); return; } tick(); }, 150);
  render();
}
const ascendPts = n => 10 * Math.max(1, n|0); // arriving at ★N grants 10×N ✦
const rebirthPoints = () => (S.rebirths >= lastEraOf() ? ascendPts((S.asc|0) + 1) : 1);
const eraLabel = e => `Era ${e+1}/${capOf()}`;

// ============================== IN-APP PURCHASES (iOS app only, StoreKit 2 via @capgo/native-purchases) ==============================
// Web/Safari has no store: shop rows show "Available in the App Store" and Ascension is never paywalled there.
// Consumables are credited to the ACTIVE save exactly once per StoreKit transaction id (ledger in localStorage),
// and the transaction is finished only after the credit is saved, so a crash mid-purchase re-delivers it on next launch.
const IAP_IDS = {asc:'com.pocketrivet.beltopolis.ascensions', respec:'com.pocketrivet.beltopolis.respec', pp25:'com.pocketrivet.beltopolis.pp25', respack:'com.pocketrivet.beltopolis.respack', boost:'com.pocketrivet.beltopolis.speed2x'};
const IAP_PERM = {asc:1, boost:1}; // non-consumable, device-wide, restorable
function iapProduct(k){ return IAP.products[IAP_IDS[k]]; }
function iapComingSoon(k){ return !!(IAP.native && IAP.ready && IAP_IDS[k] && !iapProduct(k) && !IAP.owned(k)); }
const IAP_KEY = 'beltopolis_iap_v1';
const IAP_INFO = {
  asc:   {ic:'⭐', name:'Ascension Pass', price:'$1.99', theme:'gold',   tag:'ONE-TIME · FOREVER',
          lines:['Unlock every Ascension after ★1','New themed worlds & island chains','One more resource turns GOLD each time','Restorable on all your devices']},
  respec:{ic:'↺', name:'Perk Respec',    price:'$0.99', theme:'violet', tag:'REFUND ALL PERKS',
          lines:['Refund every ✦ spent on perks','Re-choose perks any way you like','Mega buildings & Huts from refunded perks are removed','Your factory and items stay']},
  pp25:  {ic:'✦',  name:'25 Prestige Points', price:'$0.99', theme:'teal', tag:'+25 ✦ INSTANTLY',
          lines:['Adds 25 ✦ to this save','Spend them in the Perk shop or Style Shop','Buy as many times as you like']},
  respack:{ic:'📦', name:'Resource Pack', price:'$0.99', theme:'green', tag:'≈10 MIN OF PRODUCTION',
          lines:['The resources your factory is using right now','About 10 minutes of production of each','Grows with your factory · buy any time']},
  boost: {ic:'⚡', name:'Speed Boost', price:'$2.99', theme:'gold',   tag:'ONE-TIME · FOREVER',
          lines:['Run your whole factory at 2× speed, forever','Harvesters, crafters, belts and offline progress','Level up twice as fast while you play','Turn it on or off anytime in the Menu','Restorable on all your devices']},
};
const IAP = {
  native:false, plugin:null, products:{}, busy:false, ready:false,
  led(){ let l=null; try { l = JSON.parse(lsGet(IAP_KEY)); } catch(e){} if (!l || typeof l!=='object') l = {}; if (!l.owned) l.owned = {}; if (!l.cr) l.cr = {}; return l; },
  put(l){ lsSet(IAP_KEY, JSON.stringify(l)); },
  owned(k){ return !!this.led().owned[k]; },
  price(k){ const p = this.products[IAP_IDS[k]]; return (p && p.priceString) || IAP_INFO[k].price; },
  keyOf(pid){ return Object.keys(IAP_IDS).find(k => IAP_IDS[k]===pid); },
};
function iapDetect(){
  try {
    const C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
    if (C.isPluginAvailable && !C.isPluginAvailable('NativePurchases')) return null;
    return (C.Plugins && C.Plugins.NativePurchases) || null;
  } catch(e){ return null; }
}
// total ✦ spent on perks (tiered perks: level n costs n; fixed-cost perks: cost × level)
function perkSpent(perks){
  let n = 0; const P = perks || S.perks || {};
  for (const id in P){ const L = P[id]|0, d = PERKS.find(p=>p.id===id); if (!d || L<=0) continue; n += d.cost != null ? d.cost*L : L*(L+1)/2; }
  return n;
}
const perkOfType = t => { const B = BUILDINGS[t]; return B ? (B.unlockPerk || (B.hut ? t : null)) : null; };
// Perk Respec: refund every perk ✦, clear perks, remove placed buildings that needed a refunded perk.
function applyRespec(){
  const refund = perkSpent(S.perks);
  const doomed = S.b.filter(b => b && perkOfType(b.type));
  const exts = doomed.filter(b => BUILDINGS[b.type].hubExt), rest = doomed.filter(b => !BUILDINGS[b.type].hubExt);
  S.perks = {};
  R.quietDemo = true;
  try {
    for (const b of rest) if (S.b.includes(b)) demolish(b);
    for (const b of exts) if (S.b.includes(b)) demolish(b); // removing an extension re-routes everything to the Main Hub
  } finally { R.quietDemo = false; }
  // anything left without a delivery route gets one more routing pass
  for (const b of S.b){ if (!needsBelt(b)) continue; if (!b.outPath && !b.inPath){ try { routeBuildingSafe(b); } catch(e){} } }
  S.pp = (S.pp|0) + refund; R.dirty = true; save();
  return {refund, removed: doomed.length};
}
// ---- Resource Pack (v66): the 4-6 items this era's factory is making/spending, ~10 min of current production each ----
const RESPACK_MIN = 10, RESPACK_BASIC = ['wood','stone','plank','brick'], RESPACK_FLOOR = 1000;
function factoryFlows(){
  const hm = harvestMul(), cm = craftMul(), prod = {}, use = {};
  for (const b of S.b){ const B = b && BUILDINGS[b.type]; if (!B) continue;
    if (B.on){ const id = harvestItem(b); if (id && ITEMS[id]) prod[id] = (prod[id]||0) + hm*lvSpeed(b.lv||1)*(1+dblChance(b))/ivOf(b); }
    else if (B.recipes && RECIPES[b.recipe] && !b.paused){ const r = RECIPES[b.recipe], rate = cm*lvSpeed(b.lv||1)*(B.megaCraft||1)/r.time;
      prod[b.recipe] = (prod[b.recipe]||0) + rate*r.out*(1+dblChance(b)); for (const k in r.in) use[k] = (use[k]||0) + rate*r.in[k]; } }
  return {prod, use};
}
const niceRound = n => { if (n < 100) return Math.round(n); const p = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n/p)*p; };
function respackItems(){
  if (!S) return [];
  const {prod, use} = factoryFlows(), q = eraQuest(S.rebirths) || {};
  // the quest's ingredient tree (what this era is about), excluding the quest item itself
  const tree = new Set(), st = q.item && RECIPES[q.item] ? Object.keys(RECIPES[q.item].in) : (q.item ? [q.item] : []);
  while (st.length){ const k = st.pop(); if (tree.has(k)) continue; tree.add(k); if (RECIPES[k]) for (const i in RECIPES[k].in) st.push(i); }
  if (q.item && !RECIPES[q.item]) tree.add(q.item);
  const flow = k => (prod[k]||0) + (use[k]||0);
  const ok = k => ITEMS[k] && itemKnown(k);
  let cands = [...tree].filter(ok).sort((a, b) => flow(b) - flow(a));
  const busy = Object.keys(prod).concat(Object.keys(use)).filter(k => ok(k) && !tree.has(k) && k !== q.item).sort((a, b) => flow(b) - flow(a));
  const pick = [];
  for (const k of cands) if (pick.length < 6 && (flow(k) > 0 || pick.length < 4)) pick.push(k);
  for (const k of busy) if (pick.length < 6 && !pick.includes(k)) pick.push(k);
  for (const k of RESPACK_BASIC) if (pick.length < 4 && ok(k) && !pick.includes(k)) pick.push(k);
  const lv = Math.max(1, S.level|0), scale = 1 + 0.02*Math.min(80, lv-1) + 0.08*Math.min(40, S.asc|0);
  return pick.map(id => {
    const tv = rawOf(id); let base;
    if (tv != null && RES[tv]) base = harvestMul()/(RES[tv].iv||4); else if (RECIPES[id]) base = craftMul()/(RECIPES[id].time||6)*(RECIPES[id].out||1); else base = 0.15;
    const live = (prod[id]||0)*60*RESPACK_MIN, floorN = RESPACK_BASIC.includes(id) ? RESPACK_FLOOR : Math.max(base*60*RESPACK_MIN*scale*3, RESPACK_FLOOR*1.5/Math.max(1.5, itemXp(id)));
    return {id, n: niceRound(Math.max(live, floorN, 25))};
  });
}
function respackHTML(items, cls){ return `<div class="rp-grid ${cls||''}">${(items||respackItems()).map(p => `<span class="rp-i">${img(p.id)}<b>+${fmt(p.n)}</b><small>${ITEMS[p.id].name}</small></span>`).join('')}</div>`; }
function grantRespack(){ const items = respackItems(); for (const p of items) addStock(p.id, p.n); R.dirty = true; save(); return items; }
function showRespackPop(items){
  let el = $('packPop'); if (!el){ el = document.createElement('div'); el.id = 'packPop'; el.setAttribute('role', 'dialog'); document.body.appendChild(el); }
  el.innerHTML = `<div class="rp-box"><div class="mp-kick">THANK YOU!</div><div class="rp-crate"><div class="mv-rays"></div><span>📦</span></div><h2>Resource Pack delivered</h2><div class="mp-sub">Added to your Hub</div>${respackHTML(items, 'big')}<div class="row"><button type="button" class="btn green" data-a="x">Collect</button></div></div>`;
  el.classList.add('show'); try { confetti(); setTimeout(() => { try { confetti(); } catch(e){} }, 400); } catch(e){} sfx('collect');
  el.querySelector('[data-a=x]').onclick = () => { sfx('click'); el.classList.remove('show'); try { updateUI(); } catch(e){} };
}
function iapGrant(k, tx){
  if (k==='respec'){ const r = applyRespec(); return `🔄 Perks refunded: +${r.refund} ✦${r.removed?` · ${r.removed} perk building${r.removed===1?'':'s'} removed`:''}`; }
  if (k==='pp25'){ S.pp = (S.pp|0) + 25; save(); return '✦ +25 Prestige Points added'; }
  if (k==='respack'){ const items = grantRespack(); R.lastPack = items; return '📦 Resource Pack added: ' + items.map(p => '+'+fmt(p.n)+' '+ITEMS[p.id].name).join(', '); }
  return '';
}
// Single entry point for every StoreKit transaction (purchase result, launch catch-up, background updates).
async function iapHandleTx(tx, quiet){
  if (!tx || !tx.productIdentifier) return null;
  const k = IAP.keyOf(tx.productIdentifier), id = String(tx.transactionId||'');
  let msg = null;
  if (k){
    const l = IAP.led();
    if (IAP_PERM[k]){
      if (tx.revocationDate){ delete l.owned[k]; }
      else {
        if (!l.owned[k]) msg = k==='boost' ? '⚡ Speed Boost unlocked — your factory can run at 2×, forever' : '⭐ Ascension Pass unlocked — every Ascension is yours';
        l.owned[k] = Date.now();
        if (k==='boost' && l.boostOn == null) l.boostOn = true;
      }
      IAP.put(l);
    } else if (id && !l.cr[id] && !tx.revocationDate){
      msg = iapGrant(k, tx);                        // credit + save() first…
      l.cr[id] = {k, t:Date.now(), slot:META && META.active}; IAP.put(l); // …then remember it so it is never credited twice
    }
  }
  if (id && IAP.plugin){ try { await IAP.plugin.finishTransaction({transactionId:id}); } catch(e){} }
  if (msg && !quiet){ if (k==='respack' && R.lastPack){ try { showRespackPop(R.lastPack); } catch(e){ toast(msg, 3200); } R.lastPack = null; } else toast(msg, 3200); }
  try { updateUI(); } catch(e){}
  return msg;
}
async function iapSyncEntitlements(){
  try {
    const r = await IAP.plugin.getPurchases({onlyCurrentEntitlements:true});
    const list = (r && r.purchases) || [];
    const l = IAP.led(); let any = false;
    for (const k of Object.keys(IAP_PERM)){
      const has = list.some(p => p.productIdentifier===IAP_IDS[k] && !p.revocationDate);
      if (has){ if (!l.owned[k]){ l.owned[k] = Date.now(); if (k==='boost' && l.boostOn == null) l.boostOn = true; } any = true; }
    }
    IAP.put(l);
    return any;
  } catch(e){ return null; }
}
async function iapInit(){
  IAP.plugin = iapDetect(); IAP.native = !!IAP.plugin;
  if (!IAP.native) return;
  const P = IAP.plugin;
  try { await P.configure({autoFinishTransactions:false}); } catch(e){}
  try { P.addListener('transactionUpdated', tx => { iapHandleTx(tx); }); } catch(e){}
  try { const r = await P.getProducts({productIdentifiers:Object.values(IAP_IDS), productType:'inapp'}); for (const p of (r && r.products)||[]) IAP.products[p.identifier] = p; } catch(e){}
  try { const u = await P.getUnfinishedTransactions(); for (const tx of (u && u.transactions)||[]) await iapHandleTx(tx); } catch(e){}
  await iapSyncEntitlements();
  IAP.ready = true;
}
async function iapBuy(k){
  if (!IAP.native){ toast('Available in the Beltopolis app on the App Store'); return false; }
  if (IAP.busy) return false;
  if (iapComingSoon(k)){ toast('Coming soon'); return false; }
  if (IAP_PERM[k] && IAP.owned(k)){ toast(k==='boost' ? 'You already own the Speed Boost' : 'You already own the Ascension Pass'); return true; }
  IAP.busy = true;
  try {
    const tx = await IAP.plugin.purchaseProduct({productIdentifier:IAP_IDS[k], productType:'inapp', quantity:1});
    await iapHandleTx(tx);
    sfx('quest'); try { confetti(); } catch(e){}
    return true;
  } catch(e){
    const m = String((e && (e.message||e.errorMessage)) || e || '');
    if (/cancel/i.test(m)) {} else if (/pending/i.test(m)) toast('Purchase pending — it will arrive once approved', 3200);
    else toast('Purchase didn\'t go through' + (m ? ' — ' + m.slice(0,80) : ''), 3200);
    return false;
  } finally { IAP.busy = false; }
}
async function iapRestore(){
  if (!IAP.native){ toast('Restore works in the Beltopolis app on the App Store'); return; }
  toast('Restoring purchases…', 2500);
  try { await IAP.plugin.restorePurchases(); } catch(e){}
  try { const u = await IAP.plugin.getUnfinishedTransactions(); for (const tx of (u && u.transactions)||[]) await iapHandleTx(tx, true); } catch(e){}
  const has = await iapSyncEntitlements();
  const owned = [];
  if (IAP.owned('asc')) owned.push('Ascension Pass');
  if (IAP.owned('boost')) owned.push('Speed Boost');
  toast(owned.length ? ('✓ Restored: ' + owned.join(' · ')) : (has===null ? 'Couldn\'t reach the App Store — try again' : 'No purchases to restore on this Apple ID'), 3200);
}
// Polished full-screen purchase screen (matches the Rebirth/Ascension celebration look)
function openIapScreen(k, opts){
  opts = opts || {};
  const I = IAP_INFO[k];
  let el = $('iapScreen'); if (!el){ el = document.createElement('div'); el.id = 'iapScreen'; document.body.appendChild(el); }
  const owned = !!(IAP_PERM[k] && IAP.owned(k));
  const soon = iapComingSoon(k);
  const spent = perkSpent(S.perks);
  const extra = k==='respec' ? `<div class="iap-note">${spent ? `You'll get back <b>${spent} ✦</b>` : 'You haven\'t spent any ✦ on perks yet'}</div>`
              : k==='pp25' ? `<div class="iap-note">You have <b>${S.pp|0} ✦</b> → <b>${(S.pp|0)+25} ✦</b></div>`
              : k==='respack' ? `<div class="iap-note rp-note">You'd get right now:${respackHTML()}</div>`
              : k==='boost' ? `<div class="iap-note">${owned ? (boostOn() ? 'Speed Boost is on — turn it off anytime in the Menu.' : 'Speed Boost is off — turn it on anytime in the Menu.') : 'One-time unlock. Turn it on or off anytime in the Menu.'}</div>`
              : (opts.gate ? `<div class="iap-note">Ascension ★1 was free. Get the Pass to start <b>Ascension ★${(S.asc|0)+1}</b>.</div>` : '');
  const can = IAP.native && !owned && !soon && !(k==='respec' && !spent);
  const btn = !IAP.native ? `<div class="iap-store">Available in the App Store</div>`
            : owned ? `<button class="iap-buy owned" disabled>✓ Owned</button>`
            : soon ? `<button class="iap-buy" disabled>Coming soon</button>`
            : `<button class="iap-buy" data-a="buy" ${can?'':'disabled'}><span>${IAP_PERM[k]?'Unlock':'Buy'} for</span><b>${IAP.price(k)}</b></button>`;
  el.className = 'show th-' + I.theme;
  el.innerHTML = `<div class="iap-box">
    <button class="iap-x" data-a="x" aria-label="Close">✕</button>
    <div class="iap-tag">${I.tag}</div>
    <div class="iap-hero"><div class="iap-rays"></div><div class="iap-badge"><span>${I.ic}</span></div>${k==='pp25'?'<div class="iap-num">+25</div>':''}</div>
    <h1 class="iap-h">${I.name}</h1>
    <ul class="iap-list">${I.lines.map(t=>`<li><i>✓</i>${t}</li>`).join('')}</ul>
    ${extra}
    ${btn}
    ${(IAP_PERM[k] && IAP.native && !owned) ? '<button class="iap-link" data-a="restore">Restore Purchases</button>' : ''}
    <button class="iap-link dim" data-a="x">${opts.gate?'Not now':'Close'}</button>
  </div>`;
  const close = () => { el.className = ''; el.innerHTML = ''; };
  el.querySelectorAll('[data-a=x]').forEach(b => b.onclick = () => { sfx('click'); close(); if (opts.onClose) opts.onClose(); });
  const bb = el.querySelector('[data-a=buy]');
  if (bb) bb.onclick = async () => { bb.disabled = true; bb.classList.add('wait'); const ok = await iapBuy(k); if (ok){ close(); if (opts.onDone) opts.onDone(); } else { bb.disabled = false; bb.classList.remove('wait'); } };
  const rs = el.querySelector('[data-a=restore]');
  if (rs) rs.onclick = async () => { await iapRestore(); if (IAP_PERM[k] && IAP.owned(k)){ close(); if (opts.onDone) opts.onDone(); } };
  sfx('click');
}
// Shop rows for the Perk shop
function iapShopHTML(){
  const row = k => { const I = IAP_INFO[k], own = !!(IAP_PERM[k] && IAP.owned(k)), soon = iapComingSoon(k);
    const right = !IAP.native ? '<span class="iap-pill store">App Store</span>' : own ? '<span class="iap-pill own">✓ Owned</span>' : soon ? '<span class="iap-pill soon">Coming soon</span>' : `<span class="iap-pill">${IAP.price(k)}</span>`;
    const sub = k==='respack' ? `<span class="rp-row">${respackItems().map(p => `<span class="rp-c">${img(p.id)}${fmt(p.n)}</span>`).join('')}</span>` : `<small>${I.lines[0]}</small>`;
    return `<button class="iap-row th-${I.theme}${k==='respack'?' rp':''}${soon?' soon':''}${own?' owned':''}" data-iap="${k}" ${soon?'disabled':''}><span class="iap-ri"><span>${I.ic}</span></span><span class="iap-rb"><b>${I.name}</b>${sub}</span>${right}</button>`; };
  return `<div class="pk-sec">Store <span>· ${IAP.native ? 'support Pocket Rivet' : 'available in the App Store'}</span></div><div class="iap-shop">${row('boost')}${row('respack')}${row('pp25')}${row('respec')}${row('asc')}</div>`;
}
const ascGated = () => IAP.native && (S.asc|0) >= 1 && !IAP.owned('asc');
function openPerks(){
  R.dkTab = 'perk';
  const render = () => {
    const can = S.finalDone, q = eraQuest(S.rebirths), nx = eraReveal(S.rebirths+1);
    openSheet(`<div class="shop-tabs"><button class="stab on" data-go="perks">✦ Perks</button><button class="stab" data-go="cos">🎨 Styles</button></div>
      <h2>Rebirth & Perks</h2>
      <div class="rb-card${can?' ready':''}">
        <div class="rb-row"><div><div class="rb-era">${eraLabel(S.rebirths)} · ${eraName(S.rebirths)}</div>
          <div class="rb-q">${can ? '✅ Quest done! Ready to rebirth' : `Quest: deliver ${fmt(q.n)} ${ITEMS[q.item].name} (${fmt(Math.min(S.qprog,q.n))}/${fmt(q.n)})`}</div></div>
          <div class="rb-pp"><span>✦</span>${S.pp}</div></div>
        <div class="rb-next">${img(nx.item)}<div><small>Next era: ${eraName(S.rebirths+1)}</small><b>${nx.kind}: ${nx.text}</b></div></div>
        ${can ? `<button class="btn gold rb-go" data-a="rb">${S.rebirths>=lastEraOf()?(ascGated()?"⭐ Ascend now · Ascension Pass":`Ascend now · +${ascendPts((S.asc|0)+1)} ✦`):"Rebirth now · +1 ✦"}</button>` : `<div class="rb-lock">🔒 Finish this era's quest to rebirth. Each rebirth gives 1 ✦; Ascending gives 10 ✦, then 20, then 30…</div>`}
      </div>
      <h3 class="sl-h">Perk shop <span class="pk-sub">permanent · banked ✦ stay forever</span></h3>` +
      (() => {
        const row = p => { const L = perk(p.id), cost = perkCost(p.id), max = L>=p.max;
          return `<div class="opt pk${p.mega?' mega':''}"><div class="oi pk-ic">${p.ic}</div><div class="ob"><div class="on">${p.name}${p.mega?' <span class="mega-tag">MEGA</span>':''}</div>${p.max>1?`<div class="pk-pips">${Array.from({length:p.max},(_,i)=>`<i class="${i<L?'on':''}"></i>`).join('')}</div>`: (L?`<div class="pk-own">✓ Unlocked</div>`:`<div class="pk-costline">${cost} ✦ once</div>`)}<div class="od">${p.desc}</div></div><button class="btn gold" data-p="${p.id}" ${max||S.pp<cost?'disabled':''}>${max?'OWNED':cost+' ✦'}</button></div>`; };
        const basic = PERKS.filter(p=>!p.cost), mid = PERKS.filter(p=>p.cost>0&&!p.mega), mega = PERKS.filter(p=>p.mega);
        return `<div class="pk-sec">Core upgrades <span>· level N costs N ✦</span></div>${basic.map(row).join('')}<div class="pk-sec">Factory boosts <span>· mid sinks</span></div>${mid.map(row).join('')}<div class="pk-sec">Mega buildings <span>· unlock then build</span></div>${mega.map(row).join('')}`;
      })());
    const rb = sheet.querySelector('[data-a=rb]'); if (rb) rb.onclick = () => doRebirth();
    sheet.querySelectorAll('[data-iap]').forEach(el => el.onclick = () => openIapScreen(el.dataset.iap, {onDone: () => { if (sheetWrap.classList.contains('open')) render(); }}));
    sheet.querySelectorAll('[data-p]').forEach(el => el.onclick = () => { const p = PERKS.find(p=>p.id===el.dataset.p), cost = perkCost(p.id); if (S.pp < cost || perk(p.id) >= p.max) return; S.pp -= cost; S.perks[p.id] = perk(p.id)+1; sfx('upgrade'); save(); render(); });
    const cosTab = sheet.querySelector('[data-go=cos]'); if (cosTab) cosTab.onclick = () => { sfx('click'); openCosmetics(); };
  };
  render(); navSel('bPerk');
}
function doRebirth(){
  if (!S.finalDone) return false;
  const from = S.rebirths, pts = rebirthPoints(), ascend = S.rebirths >= lastEraOf();
  const nextAsc = (S.asc|0) + (ascend ? 1 : 0);
  if (ascend && nextAsc >= 2 && ascGated()){ openIapScreen('asc', {gate:true, onDone: () => { if (!ascGated()) doRebirth(); }}); return false; }
  const next = freshState({rebirths: ascend ? 0 : S.rebirths+1, asc: nextAsc, eraCap: cycleLen(nextAsc), pp:S.pp+pts, perks:S.perks, sound:S.sound, ...retainKeep(S)});
  S = next; statAdd('rebirths'); setupWorld(); cam.x = MAP_W/2; cam.y = MAP_H/2; cam.z = 44; cam.vx = cam.vy = 0; R.simClock = Date.now(); closeSheet(); save(); R.dirty = true;
  if (ascend) celebrateAscension(S.asc, pts); else celebrate(from, pts);
  if (S.terrGen===TERR_GEN_ISLANDS) setTimeout(()=>toast('🏝️ This Ascension is an archipelago — Hub on the main island; belts bridge the water', 3800), 1600);
  else setTimeout(()=>toast('Place your Hub near the middle — it needs room around it for belts', 3200), 1600);
  return true;
}
// the big rebirth moment: points gained + reveal of what the new era brings
function celebrate(from, pts){
  const e = S.rebirths, nx = eraReveal(e), q = eraQuest(e);
  let el = $('celebrate'); if (!el){ el = document.createElement('div'); el.id = 'celebrate'; document.body.appendChild(el); }
  const canBuy = PERKS.some(p => perk(p.id) < p.max && perkCost(p.id) <= S.pp);
  el.innerHTML = `<div class="cb-box">
    <div class="cb-top">${eraLabel(from)} complete!</div>
    <h1>Rebirth!</h1>
    <div class="cb-pp"><span>+${pts} ✦</span><small>Prestige points: ${S.pp}</small></div>
    <div class="cb-reveal"><div class="cb-rays"></div><img src="${icon(nx.item)}" alt=""></div>
    <div class="cb-kind">${nx.kind}!</div>
    <div class="cb-name">${nx.text}</div>
    <div class="cb-era">${eraLabel(e)} · ${eraName(e)}</div>
    <div class="cb-q">Quest: deliver <b>${fmt(q.n)} ${ITEMS[q.item].name}</b></div>
    <div class="row">${canBuy?`<button class="btn gold" data-c="perk">Spend ✦</button>`:''}<button class="btn green" data-c="go">Start ${eraLabel(e).split('/')[0]}</button></div>
  </div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  const close = () => { el.classList.remove('show'); if (q.tip) setTimeout(()=>toast(q.tip, 3800), 300); };
  el.querySelector('[data-c=go]').onclick = () => { sfx('click'); close(); };
  const pk = el.querySelector('[data-c=perk]'); if (pk) pk.onclick = () => { close(); openPerks(); };
  confetti(); setTimeout(confetti, 450); sfx('quest'); setTimeout(()=>sfx('upgrade'), 650); vibrate(40);
}
function eraUnlockOf(asc){
  const n = asc|0; if (n < 1) return null;
  const now = cycleLen(n), prev = cycleLen(n-1);
  if (now <= prev) return {cap:true, era:MAX_ERAS, cycle:now};
  const E = POST_ERAS[now - BASE_ERAS - 1];
  if (!E) return {cap: now>=MAX_ERAS, era:now, cycle:now};
  const craftId = crafterOf(E.prod);
  return {
    cap:false, era:now, cycle:now, E,
    raw:E.raw, prod:E.prod, rawName:E.rawName, prodName:E.prodName, eraName:E.era,
    bld:craftId, bldName: craftId && BUILDINGS[craftId] && BUILDINGS[craftId].name,
    newCrafter: !!E.bld
  };
}
function eraUnlockHTML(u, extra){
  if (!u) return '';
  if (u.cap){
    return `<div class="era-unlock cap">
      <div class="eu-k">Cycle complete</div>
      <div class="eu-art eu-capart"><span class="eu-fifty">50</span></div>
      <div class="eu-line">All ${MAX_ERAS} eras unlocked</div>
      <div class="eu-craft">Every era is now in this cycle — no further eras will be added.</div>
      ${extra||''}
    </div>`;
  }
  const craft = u.bldName
    ? (u.newCrafter ? `Processed in a new <b>${u.bldName}</b>` : `Processed in the <b>${u.bldName}</b>`)
    : '';
  return `<div class="era-unlock">
    <div class="eu-k">Era ${u.era} unlocked</div>
    <div class="eu-art">${img(u.raw)}<span class="eu-arrow">→</span>${img(u.prod)}</div>
    <div class="eu-line">${u.rawName} → ${u.prodName}</div>
    <div class="eu-sub">${u.eraName}${craft ? ' · '+craft : ''}</div>
    ${extra||''}
  </div>`;
}
function markEraNews(st, asc){ const s = st||S; if (!s) return; s.eraNews = cycleLen(asc!=null ? asc : (s.asc|0)); }
function needsEraNews(st){
  const s = st||S; if (!s || (s.asc|0) < 1) return false;
  const cap = capOf(s); if (cap <= BASE_ERAS) return false;
  return (s.eraNews|0) < cap;
}
function offerEraNewsSoon(){ setTimeout(() => { try { maybeEraNews(); } catch(e){} }, 700); }
function maybeEraNews(){
  if (!needsEraNews()) return false;
  if ($('celebrate') && $('celebrate').classList.contains('show')) return false;
  if ($('daily') && $('daily').classList.contains('show')){ R.pendingEraNews = true; return false; }
  if (sheetWrap && sheetWrap.classList.contains('open')){ R.pendingEraNews = true; return false; }
  R.pendingEraNews = false;
  showEraNewsCatchup();
  return true;
}
function showEraNewsCatchup(){
  const u = eraUnlockOf(S.asc); if (!u){ markEraNews(); try{ save(); }catch(e){} return; }
  const first = Math.max(BASE_ERAS+1, (S.eraNews|0)+1);
  const lastNew = u.cap ? MAX_ERAS : u.era;
  const extra2 = lastNew > first
    ? `<div class="eu-more">Your Ascensions added Eras ${first}–${lastNew} to this cycle.</div>`
    : '';
  let el = $('celebrate'); if (!el){ el = document.createElement('div'); el.id='celebrate'; document.body.appendChild(el); }
  el.innerHTML = `<div class="cb-box asc">
    <div class="cb-top">Your cycle grew</div>
    <h1 class="asc-h">${u.cap ? 'ALL 50 ERAS' : 'New era!'}</h1>
    ${eraUnlockHTML(u, extra2)}
    <div class="cb-q">This cycle has <b>${capOf()} eras</b>. New ones appear after Quantum Computer.</div>
    <div class="row"><button class="btn gold" data-c="go">Got it</button></div>
  </div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  el.querySelector('[data-c=go]').onclick = () => { sfx('click'); el.classList.remove('show'); };
  confetti(); sfx('quest'); vibrate(30);
  markEraNews(); try { save(); } catch(e){}
}
function celebrateAscension(n, pts){
  const k = ASC_ORDER[n-1], item = k ? RES[RES_BY_KEY[k]].item : 'qcomp', q = eraQuest(0);
  const u = eraUnlockOf(n);
  let el = $('celebrate'); if (!el){ el = document.createElement('div'); el.id = 'celebrate'; document.body.appendChild(el); }
  const gold = ASC_ORDER.slice(0, Math.min(n, GOLD_HUB_AT)).map(k => `<span class="asc-chip">${img(RES[RES_BY_KEY[k]].item)}</span>`).join('');
  const capNote = (u && !u.cap && u.era===MAX_ERAS) ? `<div class="eu-more">That's the last one — all ${MAX_ERAS} eras are now in this cycle.</div>` : '';
  const reveal = eraUnlockHTML(u, capNote);
  el.innerHTML = `<div class="cb-box asc">
    <div class="cb-top">All ${cycleLen(n-1)} eras complete!</div>
    <h1 class="asc-h">ASCENSION ★${n}</h1>
    <div class="cb-pp"><span>+${pts} ✦</span><small>Prestige points: ${S.pp}</small></div>
    ${reveal}
    <div class="cb-name asc-n">${k ? `${img(item,'asc-gico')} ${HARV_NAME[k]} are now GOLD &amp; FREE!` : 'Every harvester is already gold!'}</div>
    <div class="cb-era">${k ? 'Free to build, no limit, and 25% faster — forever' : 'Keep ascending for glory'}</div>
    <div class="asc-world"><img class="aw-prev" src="${worldPreview(n)}" alt=""/><div><div class="aw-l">New World</div><b>${worldName(n)}</b><small>${isIslandAsc(n)?'🏝️ Archipelago — belts bridge the water':'Look only — same resources &amp; recipes'}</small></div></div>
    <div class="asc-row">${gold}</div>
    <div class="asc-prog"><div class="gp-h"><b>Gold harvesters</b><span>${Math.min(n,10)}/10</span></div><div class="bar gold"><i style="width:${Math.min(n,10)*10}%"></i></div></div>
    ${n===10 ? `<div class="gh-win">👑 <b>GOLDEN HUB UNLOCKED!</b><br>All 10 original harvester types are gold — your Hub turns gold and <b>everything produces +25%, forever</b>.</div>` : n<10 ? `<div class="asc-hint">Make all 10 original types gold to unlock the 👑 Golden Hub (+25% all production)</div>` : `<div class="asc-hint">New cosmic drills also turn gold, one per Ascension.</div>`}
    <div class="cb-q">Back to Era 1 · Quest: deliver <b>${fmt(q.n)} ${ITEMS[q.item].name}</b></div>
    <div class="row"><button class="btn gold" data-c="go">Start Ascension ★${n}</button></div>
  </div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); if (n===GOLD_HUB_AT || n===ASC_ORDER.length || (u && (u.cap || u.era===MAX_ERAS))){ setTimeout(confetti, 900); setTimeout(confetti, 1300); setTimeout(()=>sfx('quest'), 1000); }
  el.querySelector('[data-c=go]').onclick = () => {
    sfx('click'); el.classList.remove('show');
    const t = (u && !u.cap) ? `Era ${u.era} unlocked: ${u.rawName} → ${u.prodName}` : (u && u.cap) ? 'All 50 eras unlocked' : `★ Gold ${k ? HARV_NAME[k] : 'harvesters'}: free & 25% faster`;
    setTimeout(()=>toast(t, 4200), 300);
    try { requestNativeReview(); } catch(e){}
  };
  confetti(); setTimeout(confetti, 350); setTimeout(confetti, 800); sfx('quest'); setTimeout(()=>sfx('upgrade'), 650); setTimeout(()=>sfx('quest'), 1300); vibrate(60);
  markEraNews(S, n); try { save(); } catch(e){}
}

// ============================== RECIPE BOOK ==============================
const crafterOf = id => Object.keys(BUILDINGS).find(t => (BUILDINGS[t].recipes||[]).includes(id));
const rawOf = id => { for (const t in RES) if (RES[t].item===id) return +t; return null; }
const usedIn = id => Object.keys(RECIPES).filter(r => RECIPES[r].in[id]);
function itemEra(id){
  if (id==='wood') return 0;
  for (let e=0;e<ERAS.length;e++){
    const u = ERAS[e].unlock;
    if (u.some(x => x==='r:'+id || x==='res:'+(Object.values(RES).find(r=>r.item===id)||{}).key)) return e;
  }
  // raw keyed by RES.unlock era
  const tv = rawOf(id); if (tv!=null){ const un = RES[tv].unlock; if (!un) return 0;
    for (let e=0;e<ERAS.length;e++) if (ERAS[e].unlock.includes(un)) return e; }
  return 0;
}
function recipeTreeHTML(id, mul, depth, seen){
  mul = mul||1; depth = depth||0; seen = seen||new Set();
  const known = itemKnown(id), lock = !known;
  const r = RECIPES[id], tv = rawOf(id), craft = crafterOf(id);
  let body = '';
  if (r){
    const rows = Object.entries(r.in).map(([k,n]) => {
      const need = n*mul;
      return `<div class="rt-ing">${recipeTreeHTML(k, need, depth+1, seen)}</div>`;
    }).join('<div class="rt-plus">+</div>');
    body = `<div class="rt-ins">${rows}</div>
      <div class="rt-arrow">▼ ${craft?BUILDINGS[craft].name:'Craft'} · ${r.time}s → <b>×${r.out*mul}</b></div>`;
  } else if (tv!=null){
    const H = {2:'Wood Cutter',3:'Quarry'}[tv] || 'Ore Drill';
    body = `<div class="rt-raw">⛏ Harvested by <b>${H}</b> · every ${RES[tv].iv}s</div>`;
  }
  const used = usedIn(id);
  const usedHtml = depth===0 && used.length ? `<div class="rt-used"><div class="rt-uh">Used in</div>${used.map(u => {
    const ok = itemKnown(u);
    return `<button class="rt-chip${ok?'':' dim'}" data-goto="${u}">${ok?img(u)+' '+ITEMS[u].name:'❓ ???'}</button>`;
  }).join('')}</div>` : '';
  return `<div class="rt-node${lock?' lock':''}" style="--d:${depth}">
    <div class="rt-head">${lock?'<span class="rt-ic">❓</span>':img(id)}<div><b>${lock?'???':ITEMS[id].name}</b>
      <small>${lock?'Locked — keep completing eras':(r?`Craft ×${mul}`:`Raw ×${mul}`)}${!lock && S.stock[id]!=null?` · have ${fmt(S.stock[id]||0)}`:''}</small></div></div>
    ${lock?'':body}${usedHtml}</div>`;
}
function openRecipeBook(focus){
  R.dkTab = 'book';
  // group items by the era that unlocks them
  const groups = [];
  for (let e=0;e<ERAS.length;e++){
    const ids = [];
    for (const id of Object.keys(ITEMS)) if (itemEra(id)===e) ids.push(id);
    // also raw resources unlocking this era
    if (ids.length) groups.push({e, name: ERAS[e].name, ids});
  }
  // ensure every item appears once
  const seen = new Set(groups.flatMap(g=>g.ids));
  const orphan = Object.keys(ITEMS).filter(id => !seen.has(id));
  if (orphan.length) groups.push({e:99, name:'Other', ids:orphan});
  let html = `<h2>📖 Recipe Book</h2><div class="sub">Tap any item to see what makes it — and what it is used in.</div>`;
  for (const g of groups){
    html += `<div class="rbk-h">Era ${g.e===99?'—':g.e+1} · ${g.name}</div><div class="rbk-grid">`;
    for (const id of g.ids){
      const ok = itemKnown(id);
      html += `<button class="rbk-item${ok?'':' dim'}" data-id="${id}">${ok?img(id):'<span class="rbk-q">❓</span>'}<span>${ok?ITEMS[id].name:'???'}</span></button>`;
    }
    html += `</div>`;
  }
  html += `<div class="row"><button class="btn" data-a="x">Close</button></div>`;
  openSheet(html);
  sheet.querySelector('[data-a=x]').onclick = closeSheet;
  sheet.querySelectorAll('[data-id]').forEach(el => el.onclick = () => { sfx('click'); openRecipeTree(el.dataset.id); });
  if (focus) setTimeout(() => openRecipeTree(focus), 0);
}
function openRecipeTree(id){
  R.dkTab = 'book';
  const ok = itemKnown(id);
  openSheet(`<h2>${ok?img(id)+' '+ITEMS[id].name:'❓ Locked item'}</h2>
    <div class="sub">${ok?'Full ingredient chain down to raw resources.':'Finish more eras to unlock this recipe.'}</div>
    <div class="rt-wrap">${recipeTreeHTML(id, 1, 0)}</div>
    <div class="row"><button class="btn gray" data-a="back">← All recipes</button><button class="btn" data-a="x">Close</button></div>`);
  sheet.querySelector('[data-a=x]').onclick = closeSheet;
  sheet.querySelector('[data-a=back]').onclick = () => { sfx('click'); openRecipeBook(); };
  sheet.querySelectorAll('[data-goto]').forEach(el => el.onclick = () => { sfx('click'); openRecipeTree(el.dataset.goto); });
}

// Store, reachable from the Menu so purchases are easy to find
function openStore(){
  R.dkTab = 'menu';
  const render = () => {
    openSheet(`<h2>🛒 Store</h2>
      ${iapShopHTML()}
      ${IAP.native ? `<button class="opt achbtn" data-a="restore"><span class="ach-ic">🛍️</span><span class="ob"><b>Restore Purchases</b><small>${[IAP.owned('asc')&&'Ascension Pass ✓',IAP.owned('boost')&&'Speed Boost ✓'].filter(Boolean).join(' · ')||'Get back your purchases on this device'}</small></span><span class="chev">›</span></button>` : ''}
      <div class="row"><button class="btn gray" data-a="back">‹ Menu</button><button class="btn" data-a="x">Close</button></div>`);
    navSel('bMenu');
    sheet.querySelectorAll('[data-iap]').forEach(el => el.onclick = () => openIapScreen(el.dataset.iap, {onDone: () => { if (sheetWrap.classList.contains('open')) render(); }}));
    const rsp = sheet.querySelector('[data-a=restore]'); if (rsp) rsp.onclick = async () => { sfx('click'); await iapRestore(); if (sheetWrap.classList.contains('open')) render(); };
    sheet.querySelector('[data-a=back]').onclick = () => { sfx('click'); openMenu(); };
    sheet.querySelector('[data-a=x]').onclick = closeSheet;
  };
  render();
}

const REVIEW_URL = 'https://apps.apple.com/app/id6833869822?action=write-review';
function openReviewPage(){
  try {
    const C = window.Capacitor;
    if (C && C.isNativePlatform && C.isNativePlatform()){
      window.open(REVIEW_URL, '_blank');
      return;
    }
  } catch(e){}
  window.open(REVIEW_URL, '_blank');
}
// Hook for a future Capacitor StoreKit review plugin. beltopolis-ios currently
// ships only @capacitor/splash-screen and @capgo/native-purchases, so this is a
// no-op on web and on the current native app. The Menu Rate row still opens REVIEW_URL.
async function requestNativeReview(){
  try {
    const C = window.Capacitor;
    if (!(C && C.isNativePlatform && C.isNativePlatform())) return false;
    const plugins = (C.Plugins || {});
    const p = plugins.InAppReview || plugins.Review || plugins.StoreReview || null;
    if (p && typeof p.requestReview === 'function'){
      await p.requestReview();
      return true;
    }
  } catch(e){}
  return false;
}

function isFindableBuilding(type){
  const B = BUILDINGS[type]; if (!B) return false;
  if (B.hut || B.landmark) return false;
  if (type==='hub' || B.hubExt) return true;
  if (B.mega) return true;
  if (B.recipes) return true;
  return false;
}
function buildingsOfType(type){
  const list = [];
  if (!S) return list;
  if (type==='hub' && S.hub) list.push(S.hub);
  if (Array.isArray(S.b)){
    for (const b of S.b) if (b && b.type===type && b!==S.hub) list.push(b);
  }
  list.sort((a,c) => (a.uid|0)-(c.uid|0) || (a.y-c.y) || (a.x-c.x));
  return list;
}
function buildingsByType(){
  const groups = [];
  if (!S) return groups;
  const order = (typeof BUILD_ORDER!=='undefined' && BUILD_ORDER.length) ? BUILD_ORDER.slice() : Object.keys(BUILDINGS);
  if (!order.includes('hub')) order.unshift('hub');
  const seen = new Set();
  const add = type => {
    if (seen.has(type) || !isFindableBuilding(type)) return;
    seen.add(type);
    const list = buildingsOfType(type);
    if (!list.length) return;
    const B = BUILDINGS[type] || {name:type};
    const lvs = list.map(b => (b.lv||1)).sort((a,c)=>a-c);
    const lo = lvs[0], hi = lvs[lvs.length-1];
    groups.push({type, name:B.name||type, n:list.length, lv: lo===hi ? ('Lv '+lo) : ('Lv '+lo+'–'+hi), list});
  };
  add('hub');
  for (const t of order) add(t);
  if (Array.isArray(S.b)) for (const b of S.b) if (b && b.type) add(b.type);
  return groups;
}
function showFindToast(msg){
  let el = $('findToast');
  if (!el){ el = document.createElement('div'); el.id = 'findToast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showFindToast._t);
  showFindToast._t = setTimeout(() => el.classList.remove('show'), 3200);
}
function goToBuilt(type){
  const list = buildingsOfType(type);
  if (!list.length){ toast('None of those on the map', 1800); return null; }
  if (!R.findI) R.findI = {};
  let i = R.findI[type]|0;
  if (i < 0 || i >= list.length) i = 0;
  const b = list[i];
  const shown = i+1;
  R.findI[type] = (i+1) % list.length;
  closeSheet();
  const s = BUILDINGS[b.type].size;
  const cx = b.x + s/2, cy = b.y + s/2;
  zoomTo(cx, cy, 48);
  R.hutFlash = {uid:b.uid, t:1.25};
  b.pop = 1;
  sfx('click');
  const name = BUILDINGS[b.type].name || type;
  showFindToast(list.length>1 ? (shown+' of '+list.length+'  •  tap again for next') : name);
  return b;
}
function openMyBuildings(){
  R.dkTab = 'menu';
  const groups = buildingsByType();
  const total = groups.reduce((n,g)=>n+g.n, 0);
  const rows = groups.map(g => `<button type="button" class="mb-row" data-type="${g.type}">
      <canvas class="mb-ico" data-type="${g.type}" width="44" height="44" aria-hidden="true"></canvas>
      <span class="mb-tx"><b>${g.name}</b><small>${g.lv}</small></span>
      <span class="mb-n">×${g.n}</span>
      <span class="chev">›</span>
    </button>`).join('');
  openSheet(`<div class="shop-tabs"><button class="stab" data-a="back">‹ Menu</button><button class="stab on">My Buildings</button></div>
    <h2>My Buildings</h2>
    <div class="sub">${total? (total+' built · tap a row to jump there') : 'No workshops, smelters, or hubs placed yet.'}</div>
    <div class="mb-list">${rows||''}</div>`);
  navSel('bMenu');
  const back = sheet.querySelector('[data-a=back]'); if (back) back.onclick = () => { sfx('click'); openMenu(); };
  sheet.querySelectorAll('.mb-ico').forEach(cv => {
    const type = cv.dataset.type, dpr = Math.min(2, window.devicePixelRatio||1), s = 44;
    cv.width = s*dpr; cv.height = s*dpr;
    cv.style.width = s+'px'; cv.style.height = s+'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr,0,0,dpr,0,0);
    c.clearRect(0,0,s,s);
    try { drawBuildingIcon(c, type, s/2, s/2+2, s*0.92); } catch(e){}
  });
  sheet.querySelectorAll('.mb-row').forEach(btn => {
    btn.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); goToBuilt(btn.dataset.type); };
  });
}

function openMenu(){
  R.dkTab = 'menu';
  try { ensureEvents(); } catch(e){}
  const ds = dailyState(), spinDone = S.daily && S.daily.last === today();
  const dSub = ds ? '🎰 Free spin ready — prizes scale with your level' : (spinDone ? 'Already spun today — come back tomorrow' : 'Come back tomorrow for a free spin');
  const dc = dailyChCounts();
  const wk = S.weekEvent || {};
  const wkClaimed = wk.state==='claimed';
  const wkSub = wkClaimed ? ((COS_BY_ID[wk.beltId]&&COS_BY_ID[wk.beltId].name)||'Belt')+' unlocked' : ((wk.name||'Weekly Event')+' · ends in '+fmtRemain(msUntilWeekEnd()));
  openSheet(`<h2>Beltopolis</h2>
    <button class="opt achbtn ratebtn" data-a="rate"><span class="ach-ic">⭐</span><span class="ob"><b>Rate Beltopolis</b><small>Enjoying the game? A quick review really helps!</small></span><span class="chev">›</span></button>
    <button class="opt achbtn" data-a="dailych"><span class="ach-ic">🎯</span><span class="ob"><b>Daily Challenges</b><small>${dc.done} of ${dc.n} done · New in ${fmtRemain(msUntilMidnight())}</small></span><span class="ch-badge">${dc.done}/${dc.n}</span></button>
    <button class="opt achbtn" data-a="weekly"><span class="ach-ic">📅</span><span class="ob"><b>Weekly Event</b><small>${wkSub}</small></span><span class="ch-badge ${wkClaimed?'':'live'}">${wkClaimed?'DONE':(wk.state==='ready'?'CLAIM':'LIVE')}</span></button>
    <button class="opt achbtn storebtn" data-a="store"><span class="ach-ic">🛒</span><span class="ob"><b>Store</b><small>${IAP.native ? 'Speed Boost · Resource Pack · +25 ✦ · Perk Respec · Ascension Pass' + (IAP.owned('asc')||IAP.owned('boost')?' ✓':'') : 'Purchases · available in the App Store'}</small></span><span class="chev">›</span></button>
    <button class="opt achbtn" data-a="spin"><span class="ach-ic">🎰</span><span class="ob"><b>Daily Spin</b><small>${dSub}</small></span><span class="chev">›</span></button>
    <button class="opt achbtn" data-a="myblds"><span class="ach-ic">🏭</span><span class="ob"><b>My Buildings</b><small>Tap a type to jump to it on the map</small></span><span class="chev">›</span></button>
    <button class="opt achbtn" data-a="ach"><span class="ach-ic">🏆</span><span class="ob"><b>Achievements</b><small>${ACH.filter(a=>S.ach[a.id]).length}/${ACH.length} unlocked · Gold harvesters ${Math.min(ascN(),10)}/10</small></span><span class="chev">›</span></button>
    ${medalMenuBtn()}
    <button class="opt achbtn" data-a="book"><span class="ach-ic">📖</span><span class="ob"><b>Recipe Book</b><small>What makes what — full ingredient trees</small></span><span class="chev">›</span></button>
    <button class="opt achbtn cosbtn" data-a="cos"><span class="ach-ic">🎨</span><span class="ob"><b>Style Shop</b><small>Spend ✦ on looks · belts, buildings, maps, trails & landmarks · Lv ${S.level||1}</small></span><span class="chev">›</span></button>
    ${IAP.native ? `<button class="opt achbtn" data-a="restore"><span class="ach-ic">🛍️</span><span class="ob"><b>Restore Purchases</b><small>${[IAP.owned('asc')&&'Ascension Pass ✓',IAP.owned('boost')&&'Speed Boost ✓'].filter(Boolean).join(' · ')||'Get back your purchases on this device'}</small></span><span class="chev">›</span></button>` : ''}
    ${S.hub ? `<button class="opt achbtn" data-a="mvhub"><span class="ach-ic">🏠</span><span class="ob"><b>Move Hub</b><small>Pick it up and place it on a new open spot</small></span><span class="chev">›</span></button>` : ''}
    <button class="opt achbtn" data-a="photo"><span class="ach-ic">📷</span><span class="ob"><b>Photo Mode</b><small>Hide the UI and share a picture of your factory</small></span><span class="chev">›</span></button>
    <div class="world-tag">${world().ic} <b>${world().name}</b><small>${S.terrGen===TERR_GEN_ISLANDS?'Archipelago · belts bridge water':'Ascension world · look only'}</small></div><h3 class="sl-h">Saves</h3><div id="slots">${slotCards()}</div>
    ${boostOwned() ? `<button class="opt achbtn" data-a="boost"><span class="ach-ic">⚡</span><span class="ob"><b>Speed Boost</b><small>${boostOn()?'On · factory runs at 2× — tap to turn off':'Off · tap to run your factory at 2×'}</small></span><span class="chev">${boostOn()?'On':'Off'}</span></button>` : ''}
    <div class="row"><button class="btn gray" data-a="snd">Sound: ${S.sound?'On':'Off'}</button><button class="btn red" data-a="reset">Reset this slot</button></div>
    <div class="sub" style="margin-top:12px"><b>How to play</b><br>1. Place your Main Hub, then tap trees, rocks or ore to build harvesters — belts lay themselves to the Hub. When two belts cross at a right angle they hop over each other on a 🌉 bridge — items pass straight through both ways.<br>2. Tap open grass to build crafters (Workshop, Smelter, Assembler, Quantum Lab, and later a Fusion Forge, Collider, Starforge and Nexus). They pull ingredients from the Hub (blue belt) and send products back (orange belt).<br>3. Every era has ONE quest. Finish it, then Rebirth: you get 1 ✦ prestige point and a brand-new world with something new — Wood → Planks → Stone → … → Quantum.<br>4. Spend ✦ in the Perk shop (Rebirth button) on permanent upgrades — faster harvesters, crafting and belts, cheaper buildings and more. They're the only factory-wide upgrades, and they stay forever.<br>5. Finish every era in the cycle to ASCEND: back to Era 1 with your ✦ and perks, plus 10 ✦ for ★1, 20 ✦ for ★2, 30 ✦ for ★3, and so on. One more resource's harvesters turn GOLD — free, unlimited and 25% faster (Wood first, then Stone, Iron…). Each Ascension also adds one new era with a brand-new resource after Quantum, up to 50 eras.<br>6. Tap any building to upgrade just that one: Tiers 1–5 (more speed) and Double Output. The gold tile shows how many times you've reborn.<br>Drag to pan, pinch to zoom — pinch all the way out (or tap 🗺 Map) to see the whole map; tap 🏠 Hub to jump back to your base. 📷 Photo Mode is in this Menu. Progress saves automatically and keeps going at full speed while you're away (24h, more with Night Shift).<br>🏝️ Every 3rd Ascension from ★3 onward (★3, ★6, ★9, ★12…) is an island chain — belts cross water on causeways (no boats). 🎁 Open the game every day for one free Daily Spin — prizes scale with your level and Ascension, with a streak bonus and a rare Style Shop jackpot. 🏆 Achievements and the 📖 Recipe Book are in this Menu. Tap the quest card to see that item's recipe. 🌍 Each Ascension loads a new themed world — same resources, new look. 🪓 The Woodcutter's Hut and Quarry Hut are 5✦ perks: you can place up to 3 of each, all free. A worker walks out, brings back 1 Wood or Stone per trip (no belts), and a tree or rock takes 5 trips before it's gone for good. Demolish a hut to free a slot. ⭐ You have a Player Level that never resets — harvesting and crafting earn XP while you are playing (not while away). Every 10 levels grants +1 ✦ up to Level 100, then every 25 levels. Every 25 levels also earns a Medal. Spend ✦ in the Style Shop (Menu or the Rebirth tab) on belt colors, building looks, building styles, map themes and item trails. Looks only — unequip anytime. Tap a Hub on the map to open it.</div>
    <div class="row"><button class="btn" data-a="x">Close</button></div>`);
  wireSlots(); navSel('bMenu');
  const rateBtn = sheet.querySelector('[data-a=rate]'); if (rateBtn) rateBtn.onclick = () => { sfx('click'); openReviewPage(); };
  const dch = sheet.querySelector('[data-a=dailych]'); if (dch) dch.onclick = () => { sfx('click'); openDailyChallenges(); };
  const wkb = sheet.querySelector('[data-a=weekly]'); if (wkb) wkb.onclick = () => { sfx('click'); openWeeklyEvent(); };
  sheet.querySelector('[data-a=spin]').onclick = () => { sfx('click'); const spin = S.daily && S.daily.spin && S.daily.spin.day === today() && !S.daily.spin.shown; const ready = !!dailyState(); closeSheet(); R.pendingDaily = false; if (spin) openSpinResult(S.daily.spin); else if (ready) openDaily(); else toast(S.daily && S.daily.last === today() ? 'Already spun today — come back tomorrow!' : 'No free spin right now', 2400); };
  const mb = sheet.querySelector('[data-a=myblds]'); if (mb) mb.onclick = () => { sfx('click'); openMyBuildings(); };
  sheet.querySelector('[data-a=store]').onclick = () => { sfx('click'); openStore(); };
  sheet.querySelector('[data-a=ach]').onclick = () => { sfx('click'); openAch(); };
  const mdb = sheet.querySelector('[data-a=medals]'); if (mdb) mdb.onclick = () => { sfx('click'); openMedals(); };
  sheet.querySelector('[data-a=book]').onclick = () => { sfx('click'); openRecipeBook(); };
  sheet.querySelector('[data-a=cos]').onclick = () => { sfx('click'); openCosmetics(); };
  const rsp = sheet.querySelector('[data-a=restore]'); if (rsp) rsp.onclick = async () => { sfx('click'); await iapRestore(); if (sheetWrap.classList.contains('open')) openMenu(); };
  const mvh = sheet.querySelector('[data-a=mvhub]'); if (mvh) mvh.onclick = () => { sfx('click'); closeSheet(); startHubMove(); };
  const ph = sheet.querySelector('[data-a=photo]'); if (ph) ph.onclick = () => { sfx('click'); closeSheet(); enterPhotoMode(); };
  sheet.querySelector('[data-a=x]').onclick = closeSheet;
  sheet.querySelector('[data-a=snd]').onclick = () => { S.sound = !S.sound; if (S.sound){ unlockAudio(); setTimeout(()=>sfx('collect'), 60); } else { audioSession(false); if (AC) AC.suspend().catch(()=>{}); } save(); openMenu(); };
  const bst = sheet.querySelector('[data-a=boost]'); if (bst) bst.onclick = () => { sfx('click'); setBoostOn(!boostOn()); toast(boostOn() ? '⚡ Speed Boost on — 2× factory speed' : 'Speed Boost off', 2200); openMenu(); };
  const rs = sheet.querySelector('[data-a=reset]'); rs.onclick = () => { if (rs.dataset.c){ const snd = S.sound; S = freshState(); S.sound = snd; setupWorld(); cam.x = MAP_W/2; cam.y = MAP_H/2; R.simClock = Date.now(); closeSheet(); R.dirty=true; save(); R.pendingDaily = true; toast('New game — place your Hub, then claim today’s free Daily Spin', 3200); } else { rs.dataset.c=1; rs.textContent=`Tap again: erase ${slotName(META.active)}`; } };
}
function slotSummary(d){
  if (!d) return null;
  const nb = (d.b||[]).length, e = d.rebirths|0;
  return { line1: `${d.asc?'★'+d.asc+' · ':''}Lv ${d.level||1} · ${eraLabel(e)} · ${eraName(e)} · ✦ ${d.pp|0}${d.quest?' · ✅ ready to rebirth':''}`,
           line2: `${worldName(d.asc|0)} · ` + (d.hub ? `${nb} building${nb===1?'':'s'} · ${fmt(Object.values(d.totalDelivered||{}).reduce((a,b)=>a+(+b||0),0))} delivered` : 'Hub not placed yet') };
}
function slotCards(){
  let h = '';
  for (let n = 1; n <= SLOTS; n++){
    const act = n === META.active, d = act ? JSON.parse(JSON.stringify({v:SAVE_V, b:S.b.map(()=>0), quest:S.quest, rebirths:S.rebirths, asc:S.asc|0, pp:S.pp, hub:S.hub?1:null, totalDelivered:S.totalDelivered, level:S.level||1})) : slotData(n), sm = slotSummary(d);
    h += `<div class="slot${act?' on':''}${sm?'':' empty'}" data-slot="${n}">
      <div class="sl-top"><b class="sl-n">${esc(slotName(n))}</b><button class="sl-ed" data-s="ren" title="Rename">✏️</button>${act?'<span class="sl-tag">▶ Playing</span>':''}</div>
      ${sm ? `<div class="sl-s">${sm.line1}</div><div class="sl-s">${sm.line2}</div><div class="sl-t">${act?'Playing now':'Last played '+ago(d.last||0)}</div>` : '<div class="sl-s">Empty slot</div>'}
      <div class="sl-b">${act ? '' : sm ? `<button class="btn green" data-s="load">Load</button><button class="btn red" data-s="del">Delete</button>` : `<button class="btn" data-s="new">New Game</button>`}</div></div>`;
  }
  return h;
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function wireSlots(){
  sheet.querySelectorAll('.slot').forEach(el => {
    const n = +el.dataset.slot, q = s => el.querySelector(`[data-s=${s}]`);
    q('ren').onclick = ev => { ev.stopPropagation(); const v = prompt('Name this save', slotName(n)); if (v !== null){ renameSlot(n, v); openMenu(); } };
    if (q('load')) q('load').onclick = () => { switchSlot(n); toast(`Loaded ${slotName(n)}`); };
    if (q('new')) q('new').onclick = () => { switchSlot(n); toast(`${slotName(n)}: new game! Tap the map to place your Hub`, 2600); };
    const del = q('del'); if (del) del.onclick = () => { if (del.dataset.c){ deleteSlot(n); toast(`${slotName(n)} deleted`); openMenu(); } else { del.dataset.c = 1; del.textContent = 'Tap again to delete'; } };
  });
}
function welcomeBack(sec, gains){
  const h = Math.floor(sec/3600), m = Math.floor(sec%3600/60);
  const rows = (gains||[]).filter(g => g && ITEMS[g[0]] && g[0] !== 'xp' && g[0] !== 'level');
  const top = rows.slice(0, 9), more = rows.length - top.length;
  openSheet(`<div class="away"><div class="aw-h">🏭</div><h2>While you were away (${h?h+'h ':''}${m}m)</h2>
    <div class="sub">Your factory kept running at full speed${sec >= offCap()-1 ? ` (${Math.round(offCap()/3600)}h max)` : ''}.${gains&&gains.quests>0?` <b>Era quest complete — tap Rebirth!</b>`:''}</div>
    <div class="aw-list">${top.map(([k,n])=> `<div class="aw-i">${img(k)}<span class="aw-n">${ITEMS[k].name}</span><b>+${fmt(n)}</b></div>`).join('')}</div>
    ${more>0?`<div class="aw-more">+ ${more} more item${more>1?'s':''}</div>`:''}
    <div class="row"><button class="btn green" data-a="x">Collect</button></div></div>`);
  sheet.querySelector('[data-a=x]').onclick = () => { closeSheet(); confetti(); sfx('collect'); };
}
$('rbTile').onclick = () => { sfx('click'); toast(S.rebirths || ascN() ? `${ascN()?'Ascension ★'+ascN()+' · ':''}Rebirth #${S.rebirths} · ${eraLabel(S.rebirths)} · ${ERAS[S.rebirths] ? ERAS[S.rebirths].name : ''}` : 'No rebirths yet — finish this era\'s quest!'); };
$('bPerk').onclick = () => { sfx('click'); openPerks(); }; $('quest').onclick = () => { sfx('click'); if (S.finalDone) openPerks(); else { const q = eraQuest(S.rebirths); openRecipeTree(q.item); } }; if ($('bMap')) $('bMap').onclick = () => { sfx('click'); closeSheet(); if (cam.z > fitZ()*1.25){ R.prevView = {x:cam.x, y:cam.y, z:cam.z}; wholeMap(); navSel('bMap'); } else { const v = R.prevView || (S.hub ? {x:S.hub.x+1.5, y:S.hub.y+1.5, z:44} : {x:MAP_W/2, y:MAP_H/2, z:44}); zoomTo(v.x, v.y, Math.max(30, v.z)); navSel(null); } };
$('bMenu').onclick = () => { sfx('click'); openMenu(); };
function goToHub(){
  closeSheet();
  if (!S || !S.hub){ toast('Place your Main Hub first', 2200); return false; }
  const b = S.hub, cx = b.x + 1.5, cy = b.y + 1.5;
  zoomTo(cx, cy, 44);
  b.pop = 1;
  navSel('bHub');
  return true;
}
if ($('bHub')) $('bHub').onclick = ev => { ev.preventDefault(); sfx('click'); goToHub(); };
if ($('photoBar')){
  const bar = $('photoBar');
  const bind = (a, fn) => { const el = bar.querySelector('[data-a='+a+']'); if (el) el.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); fn(); }; };
  bind('x', () => { sfx('click'); exitPhotoMode(); });
  bind('shot', () => { sfx('click'); takeFactoryPhoto(); });
}
const HUT_LOC_Z = 44;
function hutsOf(type){
  const list = [];
  if (!S || !Array.isArray(S.b)) return list;
  for (const b of S.b) if (b && b.type===type) list.push(b);
  list.sort((a,c) => (a.uid|0)-(c.uid|0) || (a.y-c.y) || (a.x-c.x));
  return list;
}
function paintHutLocIcon(el, type){
  if (!el) return;
  const cv = el.querySelector('canvas'); if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio||1), s = 36;
  cv.width = s*dpr; cv.height = s*dpr;
  const c = cv.getContext('2d'); if (!c) return;
  c.setTransform(dpr,0,0,dpr,0,0);
  c.clearRect(0,0,s,s);
  try { drawHutIcon(c, type, s/2, s/2+1, s*0.95); } catch(e){}
  el.dataset.painted = '1';
}
function updateHutLocators(){
  for (const type of ['woodHut','rockHut']){
    const el = $(type==='woodHut' ? 'locWoodHut' : 'locRockHut'); if (!el) continue;
    const n = hutsOf(type).length, show = n>0;
    if (el.hidden === show){ // hidden should be !show
      el.hidden = !show;
      if (show && !el.dataset.painted) paintHutLocIcon(el, type);
    } else if (show && !el.dataset.painted) paintHutLocIcon(el, type);
    const bd = el.querySelector('.hutloc-badge');
    if (bd){ if (n>1) bd.textContent = String(n); bd.hidden = n<=1; }
  }
}
function goToHut(type){
  const list = hutsOf(type);
  if (!list.length){ try { updateHutLocators(); } catch(e){} return null; }
  if (!R.hutLocI) R.hutLocI = {woodHut:0, rockHut:0};
  let i = R.hutLocI[type]|0;
  if (i < 0 || i >= list.length) i = 0;
  const b = list[i];
  R.hutLocI[type] = (i+1) % list.length;
  const [cx,cy] = hutCenter(b);
  zoomTo(cx, cy, HUT_LOC_Z);
  R.hutFlash = {uid:b.uid, t:1.25};
  b.pop = 1;
  sfx('click');
  return b;
}
if ($('locWoodHut')) $('locWoodHut').onclick = () => goToHut('woodHut');
if ($('locRockHut')) $('locRockHut').onclick = () => goToHut('rockHut');

function updateXpBar(){
  const bar = $('xpBar'); if (!bar || !S) return;
  try { medalSync(); } catch(e){}
  const lv = S.level||1, need = xpNeed(lv), have = S.xp||0, f = need ? Math.max(0, Math.min(1, have/need)) : 0;
  const badge = $('xpBadge'), fill = $('xpFill'), lab = $('xpLab');
  const bt = 'Lv '+lv;
  if (badge && badge.textContent !== bt) badge.textContent = bt;
  if (fill) fill.style.width = (f*100).toFixed(1)+'%';
  if (lab){
    const tx = fmt(have)+' / '+fmt(need);
    if (lab.textContent !== tx) lab.textContent = tx;
  }
}
function celebrateLevel(to, ups, pps){
  try { updateXpBar(); } catch(e){}
  const bar = $('xpBar');
  if (bar){ bar.classList.remove('lvlup'); void bar.offsetWidth; bar.classList.add('lvlup'); }
  if (pps > 0){
    showBanner('Level '+to+'!', (ups>1 ? ('+'+ups+' levels · ') : '') + '+'+pps+' ✦ Prestige');
    try { confetti(); } catch(e){}
    sfx('quest'); vibrate(25);
  } else {
    toast(ups>1 ? ('Level '+to+'! (+'+ups+')') : ('Level '+to+'!'), 1600);
    if (cosEq('fx')) try { confetti(); } catch(e){}
    sfx('upgrade');
  }
}
function buyCosmetic(id){
  const c = COS_BY_ID[id]; if (!c || !S) return false;
  if (c.event && !cosOwned(id)){ toast('Earn this from the Weekly Event'); sfx('err'); return false; }
  if (cosOwned(id)) return c.slot==='land' ? true : equipCosmetic(id, true);
  if ((S.pp|0) < c.cost){ toast('Need '+c.cost+' ✦'); sfx('err'); return false; }
  S.pp -= c.cost; S.cosOwn = S.cosOwn || {}; S.cosOwn[id] = 1;
  if (c.slot==='land'){ try { refreshSandboxBadge(); } catch(e){} sfx('upgrade'); vibrate(12); save(); toast('Owned! Place it from the build menu, or tap Place.', 2800); return true; }
  equipCosmetic(id, true);
  sfx('upgrade'); vibrate(12);
  return true;
}
function equipCosmetic(id, on){
  const c = COS_BY_ID[id]; if (!c || !S || !cosOwned(id)) return false;
  if (c.slot==='land') return true;
  S.cosEq = S.cosEq || {};
  const turnOn = on===true || (on==null && S.cosEq[c.slot] !== id);
  S.cosEq[c.slot] = turnOn ? id : null;
  if (c.slot==='map'){ R.themeWorld = null; R.themeWorldKey = null; try { renderTerrain(); applyWorldFrame(); } catch(e){} }
  if (c.slot==='item') try { beltSpr.clear(); } catch(e){}
  R.dirty = true; save();
  return true;
}
function openCosmetics(){
  R.dkTab = 'style';
  const cats = [
    {id:'belt', ic:'➰', name:'Belts'},
    {id:'build', ic:'🏠', name:'Buildings'},
    {id:'form', ic:'🏘️', name:'Styles'},
    {id:'map', ic:'🌍', name:'Maps'},
    {id:'trail', ic:'✨', name:'Trails'},
    {id:'item', ic:'📦', name:'Items'},
    {id:'fx', ic:'🎉', name:'Moments'},
    {id:'land', ic:'🏛️', name:'Landmarks'},
  ];
  const cat = R.cosCat || 'belt';
  const lv = S.level||1, need = xpNeed(lv), have = S.xp||0, f = need ? Math.min(1, have/need) : 0;
  const nextPp = xpNextPp(lv);
  const swatch = c => {
    if (c.slot==='belt') return `<div class="cos-sw" style="background:${c.core||'#1e2430'}"><span class="sw-a" style="background:${c.railOut||c.out}"></span><span class="sw-b" style="background:${c.tread||c.inn}"></span></div>`;
    if (c.slot==='build') return `<div class="cos-sw build" style="--c1:${c.top};--c2:${c.side||c.top}"></div>`;
    if (c.slot==='map'){ const p = MAP_PALETTES[c.id]||{}; return `<div class="cos-sw map" style="--c1:${p.sky||'#6c5ce7'};--c2:${(p.grass&&p.grass[0])||'#7ccf6a'}"></div>`; }
    if (c.slot==='item') return `<div class="cos-sw item ${c.item||''}"></div>`;
    if (c.slot==='fx') return `<div class="cos-sw fx ${c.fx||''}"></div>`;
    if (c.slot==='land') return `<div class="cos-sw land"><img src="${icon(c.id)}" alt=""></div>`;
    if (c.slot==='form') return `<div class="cos-sw form"><img src="${formSetIcon(c.form||c.id)}" alt=""></div>`;
    return `<div class="cos-sw trail ${c.trail||''}"></div>`;
  };
  const card = c => {
    const own = cosOwned(c.id), eq = c.slot!=='land' && cosEq(c.slot)===c.id;
    const label = c.slot==='land' ? (own ? 'Place' : (c.cost+' ✦')) : (eq ? 'Equipped' : own ? 'Equip' : (c.cost+' ✦'));
    const dis = !own && (S.pp|0) < c.cost ? ' disabled' : '';
    return `<div class="cos-card${own?' own':''}${eq?' eq':''}"><div aria-hidden="true">${swatch(c)}</div><div class="cos-info"><b>${c.ic} ${c.name}</b><small>${c.desc}</small></div><button class="btn ${eq?'gold':own?'green':'gold'}" data-c="${c.id}"${dis}>${label}</button></div>`;
  };
  openSheet(`<div class="shop-tabs"><button class="stab" data-go="perks">✦ Perks</button><button class="stab on" data-go="cos">🎨 Styles</button></div>
    <div class="lv-hero"><div class="lv-badge">LV<br>${lv}</div><div class="lv-meta"><b>Player Level</b><small>Stays through Rebirth & Ascension · +1 ✦ every 10 levels to Lv 100, then every 25</small><div class="lv-bar"><i style="width:${(f*100).toFixed(1)}%"></i></div><div class="lv-n">${fmt(have)} / ${fmt(need)} XP · next ✦ at Lv ${nextPp}</div></div><div class="rb-pp"><span>✦</span>${S.pp|0}</div></div>
    <div class="cos-cats">${cats.map(k => `<button class="cos-cat${k.id===cat?' on':''}" data-cat="${k.id}"><span class="cos-cat-ic">${k.ic}</span>${k.name}</button>`).join('')}</div>
    <div class="sub">Looks only — nothing changes how the factory runs. Tap Equipped to take it off.</div>
    ${COSMETICS.filter(c=>c.slot===cat && (!c.event || cosOwned(c.id))).map(card).join('')}`);
  navSel('bMenu');
  const pk = sheet.querySelector('[data-go=perks]'); if (pk) pk.onclick = () => { sfx('click'); openPerks(); };
  sheet.querySelectorAll('[data-cat]').forEach(el => el.onclick = () => { R.cosCat = el.dataset.cat; sfx('click'); openCosmetics(); });
  sheet.querySelectorAll('[data-c]').forEach(el => el.onclick = () => {
    const id = el.dataset.c, c = COS_BY_ID[id]; if (!c) return;
    if (c.slot==='land'){
      if (cosOwned(id)){ sfx('click'); closeSheet(); startLandmarkPlace(id); }
      else if (buyCosmetic(id)) openCosmetics();
      return;
    }
    if (cosOwned(id)){ equipCosmetic(id, cosEq(c.slot)!==id); sfx('click'); openCosmetics(); }
    else if (buyCosmetic(id)) openCosmetics();
  });
}
if ($('xpBar')) $('xpBar').onclick = () => { sfx('click'); openCosmetics(); };

const fmt = n => n>=1e12 ? (n/1e12).toFixed(1)+'T' : n>=1e9 ? (n/1e9).toFixed(1)+'B' : n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e4 ? (n/1e3).toFixed(1)+'k' : String(Math.floor(n));
let lastStock = {};
function updateUI(){
  try { ensureEvents(); } catch(e){}
  const qe = $('quest'), q = eraQuest(S.rebirths);
  if (!S.finalDone){ const n = q.n, f = Math.min(1, S.qprog/n);
    const ww = world(); const qh = `<div class="qi">${img(q.item)}</div><div class="qb"><div class="qt">${eraLabel(S.rebirths)} · ${eraName(S.rebirths)} · <span class="ww">${ww.ic} ${ww.name}</span></div><div class="qn">Deliver ${fmt(n)} ${ITEMS[q.item].name}</div><div class="bar"><i style="width:${f*100}%"></i></div><div class="qr"><b>${fmt(S.qprog)}/${fmt(n)}</b> · then Rebirth for +1 ✦</div></div>`;
    if (qe.dataset.h !== qh){ qe.dataset.h = qh; qe.innerHTML = qh; qe.classList.remove('ready'); }
  } else {
    const qh = `<div class="qi" style="font-size:26px">🌟</div><div class="qb"><div class="qt">${eraLabel(S.rebirths)} complete!</div><div class="qn">Tap here to Rebirth (+1 ✦)</div><div class="qr">Next: ${eraName(S.rebirths+1)} · ${eraReveal(S.rebirths+1).text}</div></div>`;
    if (qe.dataset.h !== qh){ qe.dataset.h = qh; qe.innerHTML = qh; qe.classList.add('ready'); }
  }
  const keys = Object.keys(ITEMS).filter(k => (S.stock[k]||0) > 0 || (S.totalDelivered[k]||0) > 0);
  const st = $('stock'), sig = keys.join(',');
  if (st.dataset.sig !== sig){ st.dataset.sig = sig; st.innerHTML = keys.map(k => `<div class="chip" data-k="${k}">${img(k)}<span class="cq">${fmt(S.stock[k]||0)}</span><span class="cn">${ITEMS[k].name}</span></div>`).join(''); }
  else for (const ch of st.children){ const k = ch.dataset.k, v = fmt(S.stock[k]||0), q = ch.firstElementChild.nextElementSibling;
    if (q.textContent !== v){ q.textContent = v; if (lastStock[k]!==undefined && (S.stock[k]||0) > lastStock[k]){ ch.classList.remove('bump'); void ch.offsetWidth; ch.classList.add('bump'); } } }
  lastStock = {...S.stock};
  $('bPerk').classList.toggle('glow', !!S.finalDone);
  { const n = String(S.rebirths||0); if ($('rbNum').textContent !== n) $('rbNum').textContent = n;
    const an = ascN(), at = an ? '★'+an : ''; if ($('ascNum').textContent !== at){ $('ascNum').textContent = at; $('ascNum').classList.toggle('show', an>0); }
    const pp = S.pp||0, bd = $('ppBadge'), canBuy = PERKS.some(p => perk(p.id) < p.max && pp >= perkCost(p.id)); const t = pp ? '✦'+pp : '';
    if (bd.textContent !== t) bd.textContent = t; bd.classList.toggle('show', pp > 0); $('bPerk').classList.toggle('has', canBuy && !S.finalDone); }
  try { updateHutLocators(); } catch(e){}
  try { updateXpBar(); } catch(e){}
  try { refreshSandboxBadge(); } catch(e){}
  if (DESK.on) try { deskSync(); } catch(e){}
}
let hintT = 0, uiT = 0;
function uiTick(dt){
  if (S.hub && S.stats) S.stats.playSec += dt;
  uiT += dt; if (uiT > 0.22){ uiT = 0; R.dirty = true; if ((R.achT = (R.achT||0)+1) % 5 === 0) checkAch(); if (R.achT % 50 === 0 && !sheetWrap.classList.contains('open') && !($('daily')||{classList:{contains:()=>0}}).classList.contains('show')) maybeDaily(); }
  hintT -= dt; if (hintT > 0) return; hintT = 0.5;
  let h = '';
  if (R.placeLand) h = '🏛️ Tap open grass to place the '+(BUILDINGS[R.placeLand]&&BUILDINGS[R.placeLand].name||'landmark');
  else if (R.moveLand) h = '🏛️ Tap open grass to move the '+(BUILDINGS[R.moveLand.type].name);
  else if (R.moveHub) h = '🏠 Tap a new open spot for your Hub · tap the old Hub to cancel';
  else if (!S.hub) h = '👆 Tap open grass near the middle to place your Main Hub';
  else if (!S.built.cutter) h = '🌲 Tap a tree to build a Wood Cutter (free!)';
  else if (S.finalDone) h = '🌟 Era complete! Tap the quest card to Rebirth';
  else if (has('b:workshop') && !S.built.workshop && S.rebirths===1) h = '🔨 Tap open grass to build a Workshop';
  else if (S.rebirths===2 && !S.built.quarry) h = '🪨 Tap grey stone to build a Quarry';
  else if (S.rebirths===4 && !nBuilt('drill')) h = '⛏ Tap iron ore to build an Ore Drill';
  else if (S.rebirths===5 && !S.built.smelter) h = '🔥 Build a Smelter to make Iron Ingots';
  else if (S.rebirths===10 && !S.built.assembler) h = '🤖 Build an Assembler on open grass';
  else if (S.rebirths===19 && !S.built.lab) h = '🔮 Build a Quantum Lab on open grass';
  else if ((S.pp||0) > 0 && PERKS.some(p => perk(p.id) < p.max && S.pp >= perkCost(p.id))) h = `✦ You have ${S.pp} prestige point${S.pp>1?'s':''} — tap Rebirth to buy perks`;
  else if (S.b.length >= 6 && !S.b.some(b => (b.lv||1) > 1) && S.rebirths >= 3) h = '⬆ Tap a building to Upgrade — faster and sometimes double';
  if (DESK.on) h = h.replace(/\bTap\b/g, 'Click').replace(/\btap\b/g, 'click');
  $('hint').textContent = sheetWrap.classList.contains('open') || R.multi ? '' : h;
}
let toastTimer;
function toast(msg, ms=1800){ const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('show'), ms); }
function showBanner(a, b){ const e = $('banner'); e.innerHTML = `<b>${a}</b><span>${b}</span>`; e.classList.add('show'); setTimeout(()=>e.classList.remove('show'), 2200); }
function vibrate(ms){ try { navigator.vibrate && navigator.vibrate(ms); } catch(e){} }

// ============================== SOUND ==============================
// iPhone notes: Safari only lets audio start inside a real tap (touchend/click), suspends the context when the app
// goes to the background, and the ringer/silent switch mutes Web Audio unless the page is in the "playback" audio session.
let AC = null, MASTER = null, primed = false, silentEl = null;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints > 1);
function ensureAC(){
  if (AC) return AC;
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  try { AC = new C({latencyHint:'interactive'}); } catch(e){ try { AC = new C(); } catch(e2){ return null; } }
  const comp = AC.createDynamicsCompressor(); MASTER = AC.createGain(); MASTER.gain.value = 1;
  MASTER.connect(comp); comp.connect(AC.destination);
  return AC;
}
function silentWav(){ // 0.5s of 8-bit silence, used to put older iOS into the "playback" session
  const n = 4000, b = new Uint8Array(44+n), v = new DataView(b.buffer), w = (o,t)=>{ for (let i=0;i<t.length;i++) b[o+i]=t.charCodeAt(i); };
  w(0,'RIFF'); v.setUint32(4,36+n,true); w(8,'WAVEfmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,8000,true); v.setUint32(28,8000,true); v.setUint16(32,1,true); v.setUint16(34,8,true); w(36,'data'); v.setUint32(40,n,true); b.fill(128,44);
  return URL.createObjectURL(new Blob([b], {type:'audio/wav'}));
}
function audioSession(on){
  try { if (navigator.audioSession) navigator.audioSession.type = on ? 'playback' : 'ambient'; } catch(e){}
  if (!navigator.audioSession && IOS){
    if (on && !document.hidden){ if (!silentEl){ silentEl = new Audio(silentWav()); silentEl.loop = true; silentEl.setAttribute('playsinline',''); silentEl.preload = 'auto'; } const pr = silentEl.play(); if (pr && pr.catch) pr.catch(()=>{}); }
    else if (silentEl) silentEl.pause();
  }
}
function unlockAudio(){ // runs on every tap; cheap once audio is running
  if (!S || !S.sound) return;
  audioSession(true);
  const ac = ensureAC(); if (!ac) return;
  if (ac.state !== 'running'){ try { const pr = ac.resume(); if (pr && pr.catch) pr.catch(()=>{}); } catch(e){} }
  if (!primed){ try { const src = ac.createBufferSource(); src.buffer = ac.createBuffer(1, 1, 22050); src.connect(ac.destination); src.start(0); primed = true; } catch(e){} }
}
for (const ev of ['touchstart','touchend','pointerdown','pointerup','mousedown','click','keydown']) document.addEventListener(ev, unlockAudio, {capture:true, passive:true});
document.addEventListener('visibilitychange', () => {
  if (document.hidden){ if (silentEl) silentEl.pause(); if (AC && AC.state === 'running') AC.suspend().catch(()=>{}); }
  else if (AC && S && S.sound){ AC.resume().catch(()=>{}); audioSession(true); } // iOS may still need the next tap; unlockAudio handles it
});
function tone(f, d, type='sine', v=0.2, when=0, f2){
  if (!AC || !S || !S.sound) return;
  if (AC.state !== 'running'){ AC.resume().catch(()=>{}); if (AC.state !== 'running') return; }
  const t = AC.currentTime + 0.005 + when, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t+d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t+0.012); g.gain.exponentialRampToValueAtTime(0.0001, t+d);
  o.connect(g); g.connect(MASTER); o.start(t); o.stop(t+d+0.03);
  R.sndCount = (R.sndCount||0) + 1;
}
let lastTick = 0;
function sfx(k){
  R.lastSfx = k;
  if (k==='build'){ tone(392,.12,'triangle',.3); tone(587,.16,'triangle',.26,.07); }
  else if (k==='quest'){ [523,659,784,1046].forEach((f,i)=>tone(f,.32,'triangle',.24,i*.09)); }
  else if (k==='upgrade'){ [440,554,659,880].forEach((f,i)=>tone(f,.16,'square',.09,i*.055)); tone(880,.3,'triangle',.2,.22); }
  else if (k==='collect'){ tone(988,.09,'square',.08); tone(1319,.22,'triangle',.22,.07); }
  else if (k==='err') tone(300,.16,'square',.1,0,200);
  else if (k==='demo') tone(420,.22,'triangle',.28,0,160);
  else if (k==='click') tone(880,.05,'triangle',.16);
  else if (k==='tick'){ const now = performance.now(); if (now - lastTick < 350) return; lastTick = now; tone(1500 + Math.random()*300, .035, 'sine', .05); }
}

// ============================== RETENTION: daily reward, achievements, golden hub ==============================
const GOLD_HUB_MUL = 1.25, GOLD_HUB_AT = 10; // original 10 harvester types; later cosmic drills also gold, but the Hub unlocks at ★10
const goldHub = () => ascN() >= GOLD_HUB_AT;
const prodMul = () => goldHub() ? GOLD_HUB_MUL : 1;
function retainInit(st){ // migration-safe: fill any missing fields. Never wipe an existing save — only default holes.
  if (!st || typeof st !== 'object') return st;
  if (!Array.isArray(st.b)) st.b = [];
  st.b = st.b.filter(b => b && typeof b === 'object');
  if (!st.stock || typeof st.stock !== 'object') st.stock = {};
  if (!st.perks || typeof st.perks !== 'object') st.perks = {};
  if (!st.built || typeof st.built !== 'object') st.built = {};
  if (!Array.isArray(st.cleared)) st.cleared = [];
  if (!st.hutWear || typeof st.hutWear !== 'object' || Array.isArray(st.hutWear)) st.hutWear = {};
  if (!st.totalDelivered || typeof st.totalDelivered !== 'object') st.totalDelivered = {};
  if (st.hub && typeof st.hub !== 'object') st.hub = null;
  st.rebirths = st.rebirths|0; st.asc = st.asc|0; st.pp = st.pp|0; st.quest = st.quest|0; st.qprog = st.qprog|0;
  if (!st.daily || typeof st.daily !== 'object') st.daily = {last:'', streak:0, claims:0};
  if (!st.ach || typeof st.ach !== 'object') st.ach = {};
  if (!st.stats || typeof st.stats !== 'object') st.stats = {};
  if (!st.stats.del) st.stats.del = {};
  delete st.boosts; delete st.boostEnd; // 2× boosts were removed: old inventories are simply dropped
  // legendary counters: backfill from what older saves already know (all idempotent maxes)
  const s = st.stats, mx = (k, v) => { if (!((s[k]||0) >= v)) s[k] = v; };
  mx('rebirths', (st.asc|0)*21 + (st.rebirths|0)); mx('days', st.daily.claims|0); mx('bestStreak', st.daily.streak|0); mx('streakLong', st.daily.streak|0);
  mx('bridgesBuilt', s.maxBridges|0); s.playSec = +s.playSec || 0; if (!s.cos) s.cos = {};
  // Player level / cosmetics: existing saves start at level 1, 0 XP, no shop items. Never wipe what is already there.
  if (st.level == null || (st.level|0) < 1) st.level = 1; else st.level = st.level|0;
  st.xp = Math.max(0, Math.floor(+st.xp || 0));
  if (!st.cosOwn || typeof st.cosOwn !== 'object') st.cosOwn = {};
  if (!st.cosEq || typeof st.cosEq !== 'object') st.cosEq = {};
  try { migrateEraCap(st); } catch(e){ st.eraCap = cycleLen(st.asc|0); }
  // v43: one-time level/XP reset onto the slower curve. Idempotent via xpv. Leaves PP and the factory alone.
  try { migrateXpReset(st); } catch(e){ try { st.xpv = XP_CURVE_V; } catch(e2){} }
  if (st.levelPp == null || (st.levelPp|0) < 0) st.levelPp = 0; else st.levelPp = st.levelPp|0;
  if (!Array.isArray(st.landmarks)) st.landmarks = [];
  return st;
}
const retainKeep = st => ({daily:st.daily, ach:st.ach, stats:st.stats, level:st.level, xp:st.xp, xpv:st.xpv, levelPp:st.levelPp, cosOwn:st.cosOwn, cosEq:st.cosEq, eraNews:st.eraNews, testSandbox:st.testSandbox, testPPGranted:st.testPPGranted, landmarks: snapshotLandmarks(st), challenges:st.challenges, weekEvent:st.weekEvent});
function statAdd(k, n){ const s = S.stats; s[k] = (s[k]||0) + (n==null?1:n); }
function statMax(k, v){ const s = S.stats; if (v > (s[k]||0)) s[k] = v; }
// ---- daily spin wheel (replaces the old 7-day pack calendar) ----
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => R.fakeDay || dayKey(new Date());

// ---- Daily Challenges + Weekly Event (v72) ----
const WEEK_BELTS = ['weekClay','weekAurora','weekFrost','weekForge','weekIvy','weekSun','weekCobalt','weekRose'];
const WEEK_POOL = [
  {item:'brick', name:'Brick Rush'},
  {item:'plank', name:'Plank Party'},
  {item:'gear', name:'Gear Grind'},
  {item:'wire', name:'Wire Week'},
  {item:'steel', name:'Steel Surge'},
  {item:'circuit', name:'Circuit Sprint'},
  {item:'glass', name:'Glass Gale'},
  {item:'chip', name:'Chip Rush'},
  {item:'stone', name:'Stone Surge'},
  {item:'wood', name:'Wood Rush'},
  {item:'ironIngot', name:'Ingot Drive'},
  {item:'copperIngot', name:'Copper Drive'}
];
const CH_ITEMS = ['wood','plank','stone','brick','ironIngot','gear','copperIngot','wire','steel','circuit','glass','chip','ironOre','copperOre','coal'];
function clockDate(){
  if (R.fakeNow) return new Date(R.fakeNow);
  if (R.fakeDay){
    const d = keyDate(R.fakeDay);
    const n = new Date();
    d.setHours(n.getHours(), n.getMinutes(), n.getSeconds(), n.getMilliseconds());
    return d;
  }
  return new Date();
}
function weekStartKey(d){
  const x = d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : (() => { const c = clockDate(); return new Date(c.getFullYear(), c.getMonth(), c.getDate()); })();
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  return dayKey(x);
}
function weekEndDate(wk){
  const d = keyDate(wk || weekStartKey());
  d.setDate(d.getDate() + 7);
  return d;
}
function msUntilMidnight(){
  const n = clockDate();
  const end = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  return Math.max(0, end - n);
}
function msUntilWeekEnd(){
  return Math.max(0, weekEndDate() - clockDate());
}
function fmtRemain(ms){
  let s = Math.max(0, Math.floor((ms||0)/1000));
  const d = Math.floor(s/86400); s -= d*86400;
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.max(d||h ? 0 : 1, Math.floor(s/60));
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}
function hashStr(s){
  let h = 2166136261;
  s = String(s||'');
  for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function niceAmt(n){
  const steps = [40,50,80,100,150,200,250,400,500,750,1000,1500,2000,2500,3000,4000,5000,7500,10000,15000,20000,25000,30000,40000,50000,75000,100000,150000,200000,250000,500000];
  n = Math.max(1, Math.round(+n||0));
  for (const s of steps) if (s >= n) return s;
  return Math.round(n/100000)*100000;
}
function chFmt(n){ return Math.floor(+n||0).toLocaleString('en-US'); }
function knownEventItems(){
  return CH_ITEMS.filter(k => ITEMS[k] && (typeof itemKnown === 'function' ? itemKnown(k) : k==='wood'));
}
function pickDailyDeliverItem(){
  const known = knownEventItems();
  const list = known.length ? known : ['wood'];
  const q = (typeof eraQuest==='function') ? eraQuest(S && S.rebirths || 0) : null;
  if (q && q.item && list.includes(q.item) && list.length > 1 && (hashStr(today()+'q')&1)) return q.item;
  return list[hashStr(today()+'|'+(S && S.rebirths|0)) % list.length];
}
function dailyDeliverNeed(item){
  const q = (typeof eraQuest==='function') ? eraQuest(S && S.rebirths || 0) : {n:50};
  return niceAmt(Math.max(40, (q.n||50) * 0.3));
}
function weekEventNeed(item){
  const q = (typeof eraQuest==='function') ? eraQuest(S && S.rebirths || 0) : {n:50};
  return niceAmt(Math.max(400, (q.n||50) * 5));
}
function weekBeltName(id){ const c = COS_BY_ID[id]; return c ? c.name : 'Event Belt'; }
function pickWeekSpec(wk){
  const known = knownEventItems();
  const h = hashStr(wk||'');
  const beltId = WEEK_BELTS[h % WEEK_BELTS.length];
  let spec = WEEK_POOL[h % WEEK_POOL.length];
  if (known.length && !known.includes(spec.item)){
    const fallback = WEEK_POOL.filter(p => known.includes(p.item));
    spec = (fallback.length ? fallback[h % fallback.length] : {item: known[0], name: (ITEMS[known[0]]&&ITEMS[known[0]].name||known[0])+' Rush'});
  } else if (!known.length){
    spec = {item:'wood', name:'Wood Rush'};
  }
  return {item:spec.item, name:spec.name, beltId};
}
function bumpGoal(g, n){
  if (!g || g.state==='claimed') return false;
  const add = Math.max(0, +n||0);
  if (!add) return false;
  g.have = Math.min(g.need, (g.have|0) + add);
  if (g.have >= g.need && g.state==='work') g.state = 'ready';
  return true;
}
function ensureDailyChallenges(){
  if (!S) return null;
  const day = today();
  const good = S.challenges && S.challenges.day===day && Array.isArray(S.challenges.goals) && S.challenges.goals.length===3;
  if (!good){
    const item = pickDailyDeliverItem();
    const need = dailyDeliverNeed(item);
    const spun = !!(S.daily && S.daily.last === day);
    S.challenges = { day, goals: [
      {id:'deliver', item, need, have:0, rew:2, state:'work', title:'Deliver '+chFmt(need)+' '+(ITEMS[item]&&ITEMS[item].name||item)},
      {id:'upg', need:3, have:0, rew:2, state:'work', title:'Upgrade 3 buildings'},
      {id:'spin', need:1, have: spun?1:0, rew:2, state: spun?'ready':'work', title:'Spin the Daily Wheel'}
    ] };
  } else {
    S.challenges.goals.forEach(x => { if (x.state!=='claimed' && (x.rew|0) > 2) x.rew = 2; });
    const g = S.challenges.goals.find(x => x.id==='spin');
    if (g && g.state!=='claimed' && S.daily && S.daily.last===day){
      g.have = 1;
      if (g.state==='work') g.state = 'ready';
    }
  }
  return S.challenges;
}
function ensureWeekEvent(){
  if (!S) return null;
  const wk = weekStartKey();
  const cur = S.weekEvent;
  if (!cur || cur.week !== wk || !cur.item || !cur.need || !cur.beltId){
    const spec = pickWeekSpec(wk);
    S.weekEvent = { week:wk, item:spec.item, name:spec.name, need:weekEventNeed(spec.item), have:0, beltId:spec.beltId, state:'work' };
  }
  return S.weekEvent;
}
function ensureEvents(){
  if (!S) return;
  ensureDailyChallenges();
  ensureWeekEvent();
}
function dailyChCounts(){
  ensureDailyChallenges();
  const goals = (S.challenges && S.challenges.goals) || [];
  const done = goals.filter(g => g.state==='ready' || g.state==='claimed').length;
  return { done, n: goals.length || 3 };
}
function noteChProgress(kind, id, n){
  if (!S) return;
  try { ensureEvents(); } catch(e){ return; }
  const add = n==null ? 1 : n;
  if (kind==='deliver' && id){
    const g = S.challenges && S.challenges.goals && S.challenges.goals.find(x => x.id==='deliver' && x.item===id);
    if (g) bumpGoal(g, add);
    const w = S.weekEvent;
    if (w && w.item===id && w.state!=='claimed'){
      w.have = Math.min(w.need, (w.have|0) + add);
      if (w.have >= w.need && w.state==='work') w.state = 'ready';
    }
  } else if (kind==='upg'){
    const g = S.challenges && S.challenges.goals && S.challenges.goals.find(x => x.id==='upg');
    if (g) bumpGoal(g, add);
  } else if (kind==='spin'){
    const g = S.challenges && S.challenges.goals && S.challenges.goals.find(x => x.id==='spin');
    if (g) bumpGoal(g, 1);
  }
}
function claimChallenge(id){
  if (!S) return false;
  ensureDailyChallenges();
  const g = S.challenges.goals.find(x => x.id===id);
  if (!g || g.state!=='ready') return false;
  g.state = 'claimed';
  g.have = g.need;
  S.pp = (S.pp|0) + (g.rew|0);
  R.dirty = true;
  save();
  try { toast('+'+g.rew+' ✦'); confetti(); sfx('collect'); } catch(e){}
  return true;
}
function claimWeekEvent(){
  if (!S) return false;
  const w = ensureWeekEvent();
  if (!w || w.state!=='ready') return false;
  w.state = 'claimed';
  w.have = w.need;
  S.cosOwn = S.cosOwn || {};
  const already = !!S.cosOwn[w.beltId];
  if (!already && COS_BY_ID[w.beltId]) S.cosOwn[w.beltId] = 1;
  R.dirty = true;
  save();
  const name = weekBeltName(w.beltId);
  try { toast(already ? (name+' already yours') : (name+' unlocked — equip it in the Style Shop')); confetti(); sfx('quest'); } catch(e){}
  return true;
}
function chIconHTML(g){
  if (g.id==='deliver' && g.item) return `<span class="dc-ic">${img(g.item)}</span>`;
  if (g.id==='upg') return `<span class="dc-ic dc-emoji">⬆️</span>`;
  if (g.id==='spin') return `<span class="dc-ic dc-emoji">🎰</span>`;
  return `<span class="dc-ic dc-emoji">🎯</span>`;
}
function openDailyChallenges(){
  ensureEvents();
  const {done, n} = dailyChCounts();
  const goals = S.challenges.goals;
  const cards = goals.map(c => {
    const pct = Math.min(100, Math.round(100 * (c.have||0) / Math.max(1,c.need)));
    const st = c.state;
    const title = c.title || (c.id==='upg' ? 'Upgrade 3 buildings' : c.id==='spin' ? 'Spin the Daily Wheel' : 'Daily goal');
    const action = st==='ready'
      ? `<button class="btn green dc-claim" data-claim="${c.id}">Claim +${c.rew} ✦</button>`
      : (st==='claimed' ? `<div class="dc-claimed">Claimed</div>` : '');
    return `<div class="dc-card ${st}">
      <div class="dc-top">
        ${chIconHTML(c)}
        <div class="dc-tx"><b>${title}</b><small>${chFmt(c.have)} / ${chFmt(c.need)}</small></div>
        <span class="dc-rew">+${c.rew} ✦</span>
      </div>
      <div class="bar${st==='claimed'?' dim':(st==='ready'?' gold':'')}"><i style="width:${pct}%"></i></div>
      ${action}
    </div>`;
  }).join('');
  openSheet(`<div class="shop-tabs"><button class="stab" data-a="back">‹ Menu</button><button class="stab on">Daily Challenges</button></div>
    <div class="dc-head">
      <div>
        <h2>Daily Challenges</h2>
        <div class="sub dc-sub">${done} of ${n} done · 2 ✦ each</div>
      </div>
      <div class="dc-timer">New in <b>${fmtRemain(msUntilMidnight())}</b></div>
    </div>
    ${cards}`);
  navSel('bMenu');
  const back = sheet.querySelector('[data-a=back]'); if (back) back.onclick = () => { sfx('click'); openMenu(); };
  sheet.querySelectorAll('[data-claim]').forEach(el => {
    el.onclick = () => { sfx('click'); if (claimChallenge(el.dataset.claim)) openDailyChallenges(); };
  });
}
function paintWeekBelt(cv, cos){
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio||1), w=72, h=72;
  cv.width = w*dpr; cv.height = h*dpr;
  cv.style.width = w+'px'; cv.style.height = h+'px';
  const c = cv.getContext('2d');
  c.setTransform(dpr,0,0,dpr,0,0);
  const r = 14;
  c.fillStyle = (cos && (cos.core||cos.bg)) || '#2a1a12';
  c.beginPath();
  c.moveTo(r,0); c.lineTo(w-r,0); c.quadraticCurveTo(w,0,w,r);
  c.lineTo(w,h-r); c.quadraticCurveTo(w,h,w-r,h);
  c.lineTo(r,h); c.quadraticCurveTo(0,h,0,h-r);
  c.lineTo(0,r); c.quadraticCurveTo(0,0,r,0);
  c.fill();
  const drawRail = (pts, col, lw) => {
    c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i=1;i<pts.length;i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
  };
  const path = [[14,16],[14,48],[58,48]];
  const rail = (cos && (cos.railOut||cos.out)) || '#c4693a';
  const hi = (cos && (cos.railIn||cos.inn||cos.tread)) || '#f0c090';
  drawRail(path, '#1a100c', 22);
  drawRail(path, rail, 14);
  drawRail(path, hi, 6);
  c.fillStyle = hi;
  [[14,22],[14,34],[14,46],[26,48],[38,48],[50,48]].forEach(([x,y]) => { c.beginPath(); c.arc(x,y,2.2,0,7); c.fill(); });
}
function openWeeklyEvent(){
  ensureEvents();
  const w = S.weekEvent;
  const itemName = (ITEMS[w.item] && ITEMS[w.item].name) || w.item;
  const pct = Math.min(100, Math.round(100 * (w.have||0) / Math.max(1,w.need)));
  const cos = COS_BY_ID[w.beltId] || {};
  const st = w.state||'work';
  const live = st!=='claimed';
  const sub = st==='claimed' ? 'Yours forever · equip from Styles' : 'Exclusive belt color · this week only';
  const action = st==='ready'
    ? `<button class="btn green dc-claim" data-a="claimwk">Claim ${cos.name||'belt color'}</button>`
    : (st==='claimed' ? `<div class="dc-claimed">Unlocked · equip from Styles</div>` : '');
  openSheet(`<div class="shop-tabs"><button class="stab" data-a="back">‹ Menu</button><button class="stab on">Weekly Event</button></div>
    <div class="wk-card ${st}">
      <div class="wk-meta">${live?`<span class="wk-live">${st==='ready'?'CLAIM':'LIVE'}</span>`:`<span class="wk-live done">DONE</span>`}<span class="wk-ends">Ends in <b>${fmtRemain(msUntilWeekEnd())}</b></span></div>
      <h2>${w.name||'Weekly Event'}</h2>
      <p class="wk-goal">Make ${chFmt(w.need)} ${itemName} this weekend</p>
      <div class="bar wk-bar"><i style="width:${pct}%"></i></div>
      <div class="wk-prog"><b>${chFmt(w.have)} / ${chFmt(w.need)}</b> ${itemName}</div>
      <div class="wk-rew">
        <canvas class="wk-belt" width="72" height="72" aria-hidden="true"></canvas>
        <div class="wk-rewt">
          <small>${st==='claimed'?'Unlocked':'Finish to unlock'}</small>
          <b>${cos.name||'Event Belt'}</b>
          <span>${sub}</span>
        </div>
      </div>
      ${action}
    </div>`);
  navSel('bMenu');
  const back = sheet.querySelector('[data-a=back]'); if (back) back.onclick = () => { sfx('click'); openMenu(); };
  const ck = sheet.querySelector('[data-a=claimwk]'); if (ck) ck.onclick = () => { sfx('click'); if (claimWeekEvent()) openWeeklyEvent(); };
  paintWeekBelt(sheet.querySelector('.wk-belt'), cos);
}

const keyDate = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
const dayGap = (a, b) => Math.round((keyDate(b) - keyDate(a))/864e5);
// Achievement packs still use the paced bundle (unchanged). Spin prizes are tiny & fixed — never PACE_PACK.
const BUNDLE = [['qcore',4],['plate',10],['chip',10],['circuit',12],['steel',20],['wire',40],['copperIngot',40],['gear',30],['ironIngot',40],['brick',60],['stone',200],['plank',90],['wood',200]];
function bundle(m){ const o = {}; let c = 0; for (const [k,n] of BUNDLE){ if (c >= 3) break; if (itemKnown(k)){ o[k] = Math.max(1, Math.round(n*m*(1 + 0.15*Math.min(20, S.rebirths))*PACE_PACK)); c++; } } return o; }
function packTxt(m){ const parts = Object.entries(bundle(m)).map(([k,n]) => itag(k, n)); return parts.length ? `📦 Pack: ${parts.join(' · ')}` : '📦 Pack'; }
function rewardItems(r){ const out = []; if (r.fix) for (const [k,n] of Object.entries(r.fix)) out.push(itag(k, fmt(n))); if (r.res) for (const [k,n] of Object.entries(bundle(r.res))) out.push(itag(k, fmt(n))); if (r.pp) out.push(`<span class="it">✦<span class="iq">+${r.pp}</span> <span class="nm">Prestige</span></span>`); return out; }
function grant(r, why){ if (r.cos && S.stats){ S.stats.cos = S.stats.cos||{}; S.stats.cos[r.cos] = 1; } if (r.fix){ for (const k in r.fix) addStock(k, r.fix[k]); } if (r.res){ const b = bundle(r.res); for (const k in b) addStock(k, b[k]); } if (r.pp) S.pp = (S.pp|0) + r.pp; R.dirty = true; }
const rewardTxt = r => [r.fix?Object.entries(r.fix).map(([k,n])=>`+${n} ${ITEMS[k]?ITEMS[k].name:k}`).join(', '):'', r.res?'resources':'', r.pp?`+${r.pp} ✦`:''].filter(Boolean).join(' + ');
// Daily spin: item prizes ≈ a few minutes of current production, scaled by level / Ascension / streak.
// +1 ✦ ~6%. Rare gold jackpot (~3.5%) is an unowned Style Shop cosmetic, or +3 ✦ if everything is owned.
const SPIN_PP_FRAC = 0.06, SPIN_JACK_FRAC = 0.035;
const SPIN_COLS = ['#6c5ce7','#00b894','#fdcb6e','#e17055','#74b9ff','#fd79a8','#55efc4','#a29bfe','#ffeaa7'];
function spinStreakInfo(){
  const ds = (typeof dailyState === 'function') ? dailyState() : null;
  let day;
  if (ds && ds.day) day = ds.day|0;
  else if (S && S.daily && S.daily.last === today()) day = Math.min(7, Math.max(1, S.daily.streak|0));
  else day = 1;
  day = Math.min(7, Math.max(1, day|0));
  return {day, mul: 1 + 0.10*(day-1), pct: 10*(day-1)};
}
function spinItemAmount(id, minutes){
  minutes = minutes == null ? 4 : minutes;
  const tv = typeof rawOf === 'function' ? rawOf(id) : null;
  let perSec;
  if (tv != null && RES[tv]) perSec = harvestMul() / (RES[tv].iv || 4);
  else if (RECIPES[id]) perSec = craftMul() / (RECIPES[id].time || 6) * (RECIPES[id].out || 1);
  else perSec = 0.15;
  const lv = Math.max(1, (S && S.level)|0 || 1);
  const asc = (S && S.asc)|0;
  const scale = 1 + 0.02*Math.min(80, Math.max(0, lv-1)) + 0.08*Math.min(40, asc);
  const mul = spinStreakInfo().mul;
  return Math.max(1, Math.min(9999, Math.round(perSec * 60 * minutes * scale * mul)));
}
function spinPrizeItems(){
  const era = (S && S.rebirths)|0;
  const E = (typeof eraOf === 'function' && eraOf(era)) || {};
  const un = E.unlock || [];
  const rawKey = (un.find(x => x.startsWith('res:'))||'').slice(4);
  const prod = (un.find(x => x.startsWith('r:'))||'').slice(2) || (E.q && E.q.item);
  const rawItem = (rawKey && RES_BY_KEY[rawKey] != null && RES[RES_BY_KEY[rawKey]]) ? RES[RES_BY_KEY[rawKey]].item : (era===0 ? 'wood' : null);
  const out = [];
  const add = (id, w, minutes, tag) => {
    if (!id || !ITEMS[id] || !itemKnown(id)) return;
    if (out.some(p => p.id===id)) return;
    out.push({id, w, n: spinItemAmount(id, minutes), tag: tag||''});
  };
  add('wood', 16, 4);
  add('stone', 12, 4);
  add(rawItem, 22, 4, 'era');
  add(prod, 20, 2, 'era');
  const extras = ['plank','brick','ironIngot','gear','copperIngot','wire','steel','circuit','chip','plate','qcore','qcomp'];
  for (const k of extras) add(k, 8, 2);
  const knownRaw = Object.keys(RES).map(t => RES[t]).filter(r => r && itemKnown(r.item));
  if (knownRaw.length) add(knownRaw[knownRaw.length-1].item, 16, 4, 'era');
  const eraItems = out.filter(p => p.tag==='era');
  const rest = out.filter(p => p.tag!=='era');
  const picked = [];
  for (const p of eraItems) if (picked.length < 3) picked.push(p);
  for (const p of rest) if (picked.length < 7) picked.push(p);
  if (!picked.length) picked.push({id:'wood', w:30, n: spinItemAmount('wood', 4), tag:''});
  // Early eras have few unlocked items — split into small / standard / big amounts so the wheel stays lively.
  if (picked.length < 4){
    const extra = [];
    for (const p of picked.slice()){
      extra.push({id:p.id, w:Math.max(5, (p.w*0.55)|0), n:Math.max(1, Math.round(p.n*0.5)), tag:p.tag});
      extra.push({id:p.id, w:Math.max(3, (p.w*0.35)|0), n:Math.max(p.n+1, Math.round(p.n*1.8)), tag:p.tag});
    }
    for (const p of extra) if (picked.length < 6) picked.push(p);
  }
  return picked;
}
function jackpotSlice(){
  const pool = (COSMETICS||[]).filter(c => c && c.id && !cosOwned(c.id));
  if (!pool.length) return {kind:'pp', n:3, jackpot:true, col:'#ffd23f', label:'+3 ✦', name:'Jackpot Prestige', frac:SPIN_JACK_FRAC};
  const c = pool[(Math.random()*pool.length)|0];
  return {kind:'cos', id:c.id, n:1, jackpot:true, col:'#ffd23f', label:c.ic||'★', name:c.name, frac:SPIN_JACK_FRAC};
}
function spinSlices(){
  const items = spinPrizeItems();
  const rSum = items.reduce((a,p)=>a+p.w, 0) || 1;
  const itemFrac = 1 - SPIN_PP_FRAC - SPIN_JACK_FRAC;
  const slices = items.map((p,i) => ({kind:'item', id:p.id, n:p.n, w:p.w, col:SPIN_COLS[i%SPIN_COLS.length],
    label:'+'+p.n, name:ITEMS[p.id].name, frac: itemFrac * (p.w/rSum)}));
  slices.push({kind:'pp', n:1, col:'#ffe566', label:'+1 ✦', name:'Prestige', frac:SPIN_PP_FRAC});
  slices.push(jackpotSlice());
  let acc = 0;
  slices.forEach(s => { s.pct = Math.round(s.frac*1000)/10; s.start = acc; acc += s.frac; s.end = acc; });
  const psum = slices.reduce((a,s)=>a+s.pct,0);
  if (Math.abs(psum-100)>0.05){ const last=slices[slices.length-1]; last.pct = Math.round((last.pct+(100-psum))*10)/10; }
  return slices;
}
function pickSpin(slices){ let r = Math.random(), a = 0; for (let i=0;i<slices.length;i++){ a += slices[i].frac; if (r < a) return i; } return slices.length-1; }
function prizeGrant(pr){
  if (!pr || !S) return;
  if (pr.kind==='pp'){ S.pp = (S.pp|0) + (pr.n|0); }
  else if (pr.kind==='cos'){
    if (pr.id){ S.cosOwn = S.cosOwn || {}; S.cosOwn[pr.id] = 1; }
  } else if (pr.id){ addStock(pr.id, pr.n); }
  R.dirty = true;
}
function prizeHTML(pr){
  if (!pr) return '';
  if (pr.kind==='pp') return `<span class="it spin-pp">✦<span class="iq">+${pr.n}</span> <span class="nm">${pr.n>=3?'Jackpot Prestige':'Prestige'}</span></span>`;
  if (pr.kind==='cos'){
    const c = COS_BY_ID[pr.id] || {ic:'🎨', name:pr.name||'Style Shop prize'};
    return `<span class="it spin-jack">${c.ic||'🎨'} <span class="nm">${c.name}</span></span>`;
  }
  return itag(pr.id, pr.n);
}
function prizeTxt(pr){
  if (!pr) return '';
  if (pr.kind==='pp') return `+${pr.n} ✦ Prestige`;
  if (pr.kind==='cos'){ const c = COS_BY_ID[pr.id]; return (c ? c.name : pr.name) || 'Style Shop prize'; }
  return `+${pr.n} ${ITEMS[pr.id].name}`;
}
function dailyState(){ const d = S.daily, t = today(); if (d.last === t) return null;
  const day = d.last && dayGap(d.last, t) === 1 ? (d.streak % 7) + 1 : 1; return {day, reset: !!d.last && dayGap(d.last, t) > 1 && d.streak > 0}; }
function trackDay(){ if (!S || !S.stats) return; const t = today(); if (S.stats.lastDay !== t){ if (S.stats.days == null) S.stats.days = (S.daily&&S.daily.claims)|0; S.stats.days = (S.stats.days|0)+1; S.stats.lastDay = t; } }
function maybeDaily(force){
  trackDay(); if (window.AF_NODAILY || !S || $('celebrate')?.classList.contains('show')) return false;
  // restore a result that was credited but not yet acknowledged (reload mid-spin) — even over a sheet
  if (S.daily && S.daily.spin && S.daily.spin.day === today() && !S.daily.spin.shown){ openSpinResult(S.daily.spin); return true; }
  if (dailyState() === null) return false;
  if ($('daily')?.classList.contains('show')) return true; // already offering
  // Brand-new / reset games: wait until the Hub is placed so the wheel isn't missed under the "place Hub" hint.
  // Menu can force-open earlier (openDaily). Reset/New Game sets R.pendingDaily so Hub placement opens it.
  if (!force && !S.hub){ R.pendingDaily = true; return false; }
  // Defer under offline/welcome/menus so the wheel isn't buried or swapped for another modal
  if (sheetWrap.classList.contains('open')){ R.pendingDaily = true; return false; }
  R.pendingDaily = false; openDaily(); return true;
}
function offerDailySoon(force){ setTimeout(() => { try { maybeDaily(!!force); } catch(e){} }, 500); }
function openDaily(){
  const ds = dailyState(); if (!ds) return;
  // already spinning this session
  if (R.spinning) return;
  const slices = spinSlices();
  const streak = spinStreakInfo();
  const lv = Math.max(1, (S.level|0) || 1), asc = S.asc|0;
  let el = $('daily'); if (!el){ el = document.createElement('div'); el.id = 'daily'; document.body.appendChild(el); }
  const oddLine = s => {
    if (s.jackpot) return (s.kind==='pp' ? '✦ +3 Prestige JACKPOT' : '🎨 '+s.name+' JACKPOT');
    if (s.kind==='pp') return '✦ +1 Prestige';
    return (typeof img==='function'?img(s.id):'')+' +'+s.n+' '+s.name;
  };
  const odds = slices.map(s => `<div class="sp-odd${s.jackpot?' jack':''}" style="--c:${s.col}"><i style="background:${s.col}"></i>${oddLine(s)}<b>${s.pct}%</b></div>`).join('');
  el.innerHTML = `<div class="dl-box spin-box">
    <div class="dl-top">Daily Spin</div>
    <h1>🎰 Free Spin</h1>
    <div class="sp-streak"><b>🔥 Day ${streak.day} streak${streak.pct?` · +${streak.pct}%`:''}</b><span>Item prizes scale with Lv${lv}${asc?` · ★${asc}`:''}</span></div>
    <div class="dl-sub">One free spin each day. Item prizes are about a few minutes of your current production. <b>✦ Prestige</b> is uncommon, and a rare <b>gold jackpot</b> grants an unowned Style Shop cosmetic — or +3 ✦ if you already own them all.</div>
    <div class="sp-wrap"><div class="sp-pin">▼</div><canvas class="sp-cv" width="360" height="360"></canvas></div>
    <div class="sp-odds">${odds}</div>
    <div class="row"><button class="btn gold sp-go" data-a="spin">Spin!</button></div>
    <button class="sp-x" data-a="x" aria-label="Later">Later</button>
  </div>`;
  if (!el.classList.contains('show')){ el.classList.add('show'); }
  const cv = el.querySelector('.sp-cv'); drawWheel(cv, slices, 0);
  el.querySelector('[data-a=spin]').onclick = () => startSpin(slices);
  el.querySelector('[data-a=x]').onclick = () => { el.classList.remove('show'); offerEraNewsSoon(); };
}
function drawWheel(cv, slices, rot){
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W/2, cy = H/2, R = Math.min(cx,cy)-6;
  c.clearRect(0,0,W,H);
  c.save(); c.translate(cx,cy); c.rotate(rot);
  for (const s of slices){
    const a0 = s.start*Math.PI*2 - Math.PI/2, a1 = s.end*Math.PI*2 - Math.PI/2;
    c.beginPath(); c.moveTo(0,0); c.arc(0,0,R,a0,a1); c.closePath();
    if (s.jackpot){
      const g = c.createRadialGradient(0,0,R*0.1,0,0,R);
      g.addColorStop(0, '#fff6c0'); g.addColorStop(0.45, '#ffd23f'); g.addColorStop(1, '#c47a10');
      c.fillStyle = g;
    } else c.fillStyle = s.col;
    c.fill();
    c.strokeStyle = s.jackpot ? 'rgba(255,248,200,.95)' : 'rgba(255,255,255,.85)';
    c.lineWidth = s.jackpot ? 3.5 : 2; c.stroke();
    const mid = (a0+a1)/2, lr = R*(s.jackpot ? 0.58 : 0.62);
    c.save(); c.rotate(mid); c.translate(lr,0); c.rotate(Math.PI/2);
    c.fillStyle = (s.kind==='pp' || s.jackpot) ? '#5a3a00' : '#fff';
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3;
    const fs = s.jackpot ? Math.max(13, Math.min(22, R*0.12)) : Math.max(12, Math.min(20, R*Math.max(s.frac,0.08)*2.1));
    c.font = `900 ${fs}px -apple-system,Segoe UI,sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeText(s.label, 0, 0); c.fillText(s.label, 0, 0);
    c.restore();
  }
  c.beginPath(); c.arc(0,0,R*0.16,0,7); c.fillStyle = '#fff'; c.fill();
  c.strokeStyle = '#5a45e0'; c.lineWidth = 4; c.stroke();
  c.fillStyle = '#5a45e0'; c.font = '900 18px -apple-system,Segoe UI,sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('✦',0,1);
  c.restore();
  c.beginPath(); c.arc(cx,cy,R,0,7); c.strokeStyle = '#fff'; c.lineWidth = 6; c.stroke();
  c.beginPath(); c.arc(cx,cy,R+4,0,7); c.strokeStyle = 'rgba(255,210,63,.45)'; c.lineWidth = 3; c.stroke();
}
function startSpin(slices){
  if (R.spinning) return;
  const el = $('daily'); if (!el) return;
  const btn = el.querySelector('[data-a=spin]'); if (btn){ btn.disabled = true; btn.textContent = 'Spinning…'; }
  // already claimed today (double-tap / race)
  if (dailyState() === null){ if (S.daily.spin && S.daily.spin.day === today()) openSpinResult(S.daily.spin); return; }
  const idx = pickSpin(slices);
  const pr = slices[idx];
  // TRANSACTION: credit + lock the day BEFORE the animation so reload can't duplicate or lose
  const consec = !!S.daily.last && dayGap(S.daily.last, today()) === 1;
  S.stats.streakLong = consec ? (S.stats.streakLong|0)+1 : 1; statMax('bestStreak', S.stats.streakLong); trackDay();
  prizeGrant(pr);
  const streak = consec ? (S.daily.streak|0)+1 : 1;
  S.daily = { last: today(), streak, claims: (S.daily.claims|0)+1,
    spin: { day: today(), idx, kind: pr.kind, id: pr.id||null, n: pr.n, jackpot: !!pr.jackpot, name: pr.name||null, shown: false,
      fracs: slices.map(s => +s.frac.toFixed(6)), cols: slices.map(s=>s.col), labels: slices.map(s=>s.label) } };
  if (streak > 0 && streak % 7 === 0) statAdd('week7');
  save(); checkAch();
  try { noteChProgress('spin'); } catch(e){}
  R.spinning = true; sfx('click'); vibrate(10);
  const cv = el.querySelector('.sp-cv');
  // land pointer (top, -PI/2) on the mid-angle of the winning slice
  const mid = (pr.start + pr.end)/2; // 0..1 from top-going-clockwise in our draw (start at -PI/2)
  const target = (Math.PI*2*4) + (Math.PI*2*(1 - mid)); // 4 full turns + align mid to pin
  const t0 = performance.now(), dur = 4200;
  const tick = now => {
    const t = Math.min(1, (now-t0)/dur);
    const e = 1 - Math.pow(1-t, 3); // ease-out cubic
    drawWheel(cv, slices, e*target);
    if (t < 1){ R.spinRaf = requestAnimationFrame(tick); return; }
    R.spinning = false; confetti(); sfx('quest'); setTimeout(()=>sfx('collect'), 280); vibrate(30);
    if (pr.jackpot || (pr.kind==='pp' && pr.n>=3)){ setTimeout(confetti, 400); setTimeout(confetti, 800); vibrate(50); }
    openSpinResult(S.daily.spin);
  };
  R.spinRaf = requestAnimationFrame(tick);
}
function openSpinResult(spin){
  if (!spin) return;
  let el = $('daily'); if (!el){ el = document.createElement('div'); el.id = 'daily'; document.body.appendChild(el); }
  const pr = {kind:spin.kind, id:spin.id, n:spin.n, jackpot:!!spin.jackpot, name:spin.name};
  const jack = !!(spin.jackpot || (spin.kind==='pp' && (spin.n|0)>=3));
  const ppNote = spin.kind==='pp' ? `<div class="sp-note">✦ Prestige points are spent in the Rebirth perk shop on permanent upgrades that never reset.</div>` : '';
  const cosNote = spin.kind==='cos' ? `<div class="sp-note">It's yours forever — open the Style Shop from the Menu to equip or place it.</div>` : '';
  const streak = (S.daily && S.daily.streak)|0;
  el.classList.toggle('jack-bg', jack);
  el.innerHTML = `<div class="dl-box spin-box${jack?' jackpot':''}">
    <div class="dl-top">Daily Spin</div>
    <h1>${jack ? '🏆 JACKPOT!' : 'You won!'}</h1>
    <div class="sp-win${jack?' jackpot':''}">${prizeHTML(pr)}</div>
    ${ppNote}${cosNote}
    <div class="dl-sub">${streak?`Streak: <b>day ${Math.min(7,streak)}</b> · `:''}Come back tomorrow for another free spin. Odds are shown on the wheel each day.</div>
    <div class="row"><button class="btn green" data-a="ok">${jack?'Amazing!':'Nice!'}</button></div>
  </div>`;
  el.classList.add('show');
  if (jack){ try { confetti(); } catch(e){} }
  spin.shown = true; S.daily.spin = spin; save();
  el.querySelector('[data-a=ok]').onclick = () => { el.classList.remove('show'); el.classList.remove('jack-bg'); offerEraNewsSoon(); };
}
// Back-compat aliases used by older tests / AF exports
const DAILY = []; // calendar removed — eligibility is still S.daily.last === today()
function claimDaily(){ /* no-op: spinning claims via startSpin */ return false; }

// ---- achievements ----
const harvN = () => S.b.filter(b => BUILDINGS[b.type].on).length;
const lifeDel = k => (S.stats.del||{})[k]||0;
const eraReached = () => Math.max(S.stats.maxEra||0, S.rebirths);
const R1 = {res:1}, R2 = {res:2}, BO = {res:3}, B2 = {res:4}, P1 = {pp:1};
const ACH = [
  {id:'hub', ic:'🏠', name:'Groundbreaker', desc:'Place your Main Hub', p:()=>[S.hub||S.stats.hub?1:0,1], r:R1},
  {id:'h5', ic:'🪓', name:'Work Crew', desc:'Have 5 harvesters at once', p:()=>[S.stats.maxHarv||0,5], r:R1},
  {id:'h25', ic:'⛏', name:'Harvest Machine', desc:'Have 25 harvesters at once', p:()=>[S.stats.maxHarv||0,25], r:BO},
  {id:'h60', ic:'🏭', name:'Resource Empire', desc:'Have 60 harvesters at once', p:()=>[S.stats.maxHarv||0,60], r:P1},
  {id:'b10', ic:'➰', name:'Belt Layer', desc:'Run 10 belts at once', p:()=>[S.stats.maxBelts||0,10], r:R1},
  {id:'b40', ic:'🛤', name:'Conveyor King', desc:'Run 40 belts at once', p:()=>[S.stats.maxBelts||0,40], r:BO},
  {id:'b100', ic:'🍝', name:'Spaghetti Master', desc:'Run 100 belts at once', p:()=>[S.stats.maxBelts||0,100], r:P1},
  {id:'br1', ic:'🌉', name:'Over & Under', desc:'Get your first belt bridge', p:()=>[S.stats.maxBridges||0,1], r:BO},
  {id:'br10', ic:'🌁', name:'Bridge Builder', desc:'Have 10 belt bridges at once', p:()=>[S.stats.maxBridges||0,10], r:B2},
  {id:'w1k', ic:'🌲', name:'Timber!', desc:'Deliver 1,000 Wood (all time)', p:()=>[lifeDel('wood'),1000], r:R1},
  {id:'w100k', ic:'🌳', name:'Lumber Baron', desc:'Deliver 100,000 Wood', p:()=>[lifeDel('wood'),100000], r:BO},
  {id:'s10k', ic:'🪨', name:'Rock Solid', desc:'Deliver 10,000 Stone', p:()=>[lifeDel('stone'),10000], r:R2},
  {id:'fe5k', ic:'🔩', name:'Iron Will', desc:'Deliver 5,000 Iron Ingots', p:()=>[lifeDel('ironIngot'),5000], r:BO},
  {id:'cu5k', ic:'🟠', name:'Copper Top', desc:'Deliver 5,000 Copper Ingots', p:()=>[lifeDel('copperIngot'),5000], r:R2},
  {id:'ci500', ic:'💾', name:'Chip Maker', desc:'Deliver 500 Circuits', p:()=>[lifeDel('circuit'),500], r:BO},
  {id:'qc100', ic:'🔮', name:'Quantum Leap', desc:'Deliver 100 Quantum Cores', p:()=>[lifeDel('qcore'),100], r:P1},
  {id:'rb1', ic:'♻️', name:'Born Again', desc:'Rebirth for the first time', p:()=>[S.stats.rebirths||0,1], r:BO},
  {id:'e6', ic:'⚙️', name:'Industrial', desc:'Reach Era 6', p:()=>[eraReached()+1,6], r:R2},
  {id:'e11', ic:'🤖', name:'Automation', desc:'Reach Era 11', p:()=>[eraReached()+1,11], r:B2},
  {id:'e21', ic:'💻', name:'Endgame', desc:'Reach Era 21', p:()=>[eraReached()+1, BASE_ERAS], r:P1},
  {id:'a1', ic:'⭐', name:'Ascension ★1', desc:'Ascend for the first time', p:()=>[ascN(),1], r:P1},
  {id:'a3', ic:'🌟', name:'Ascension ★3', desc:'Reach Ascension ★3', p:()=>[ascN(),3], r:P1},
  {id:'a5', ic:'💫', name:'Ascension ★5', desc:'Reach Ascension ★5', p:()=>[ascN(),5], r:{pp:2}},
  {id:'a10', ic:'👑', name:'All That Glitters', desc:'All 10 harvester types GOLD (★10)', p:()=>[ascN(),10], r:{pp:4}},
  {id:'d7', ic:'📅', name:'Loyal Forger', desc:'Spin on 7 days in a row', p:()=>[S.stats.week7||0,1], r:B2},
  {id:'bo1', ic:'🔨', name:'Busy Builder', desc:'Build 100 buildings (all time)', p:()=>[S.stats.built||0,100], r:R1},
  {id:'t5', ic:'🔝', name:'Max Power', desc:'Upgrade a building to Level 5', p:()=>[S.b.some(b=>(b.lv||1)>=5)||S.stats.t5?1:0,1], r:BO},
  {id:'cl20', ic:'💥', name:'Landscaper', desc:'Clear 20 tiles', p:()=>[S.stats.cleared||0,20], r:R1},
  // ---- LEGENDARY: months of dedication (one full 21-era run ≈ 6-8h of play; a dedicated player ascends about once a week; casual ~1-2 weeks per star) ----
  {L:1, id:'L_s30', ic:'🔥', name:'Iron Streak', desc:'Spin the daily wheel 30 days in a row', est:'≈1 month', p:()=>[S.stats.bestStreak||0,30], r:{pp:5}},
  {L:1, id:'L_s100', ic:'☄️', name:'Unbreakable', desc:'Spin the daily wheel 100 days in a row', est:'≈3½ months', p:()=>[S.stats.bestStreak||0,100], r:{pp:11, cos:'aurora'}},
  {L:1, id:'L_d60', ic:'🗓', name:'Regular', desc:'Play on 60 different days', est:'≈2 months', p:()=>[S.stats.days||0,60], r:{pp:5}},
  {L:1, id:'L_d180', ic:'📆', name:'Devoted', desc:'Play on 180 different days', est:'≈6 months', p:()=>[S.stats.days||0,180], r:{pp:9}},
  {L:1, id:'L_d365', ic:'🎂', name:'A Year of Forging', desc:'Play on 365 different days', est:'≈1 year', p:()=>[S.stats.days||0,365], r:{pp:17, cos:'prism'}},
  {L:1, id:'L_rb250', ic:'♾️', name:'Rebirth Veteran', desc:'Rebirth 250 times (all time)', est:'≈4-6 months', p:()=>[S.stats.rebirths||0,250], r:{pp:6}},
  {L:1, id:'L_rb600', ic:'🌀', name:'Eternal Cycle', desc:'Rebirth 600 times (all time)', est:'≈10-14 months', p:()=>[S.stats.rebirths||0,600], r:{pp:11}},
  {L:1, id:'L_a25', ic:'🌠', name:'Star Forger', desc:'Reach Ascension ★25', est:'≈6-10 months', p:()=>[ascN(),25], r:{pp:8}},
  {L:1, id:'L_a50', ic:'🌌', name:'Supernova', desc:'Reach Ascension ★50', est:'≈1½-2 years', p:()=>[ascN(),50], r:{pp:16, cos:'nova'}},
  {L:1, id:'L_h2k', ic:'⏳', name:'Never Sleeps', desc:'2,000 hours of factory time (online + offline)', est:'≈4 months', p:()=>[Math.floor((S.stats.playSec||0)/3600),2000], r:{pp:8}},
  {L:1, id:'L_bo300', ic:'🏗️', name:'Master Builder', desc:'Build 15,000 buildings (all time)', est:'≈6-8 months', p:()=>[S.stats.built||0,15000], r:{pp:7}},
  {L:1, id:'L_br15k', ic:'🏗', name:'Bridge Engineer', desc:'Build 15,000 belt bridges (all time)', est:'≈6-8 months', p:()=>[S.stats.bridgesBuilt||0,15000], r:{pp:7}},
];
const COS_NAME = {aurora:'Aurora belts', prism:'Prismatic Hub', nova:'Supernova Hub'};
const cosOn = k => !!(S && S.stats && S.stats.cos && S.stats.cos[k]);
const rTxt = r => [r.res?packTxt(r.res):'', r.pp?`+${r.pp} ✦`:'', r.cos?`🎨 ${COS_NAME[r.cos]}`:''].filter(Boolean).join(' · ');
function checkAch(){
  if (!S || !S.ach) return [];
  if (S.hub) S.stats.hub = 1; statMax('maxHarv', harvN()); statMax('maxBelts', S.b.length); statMax('maxBridges', (R.bridges||[]).length); statMax('maxEra', S.rebirths);
  if (S.b.some(b=>(b.lv||1)>=5)) S.stats.t5 = 1;
  const got = [];
  for (const a of ACH){ if (S.ach[a.id]) continue; const [c, t] = a.p(); if (c >= t){ S.ach[a.id] = Date.now(); grant(a.r); got.push(a); } }
  if (got.length){ for (const a of got) achToast(a); save(); }
  return got;
}
const achQ = []; let achBusy = false;
function achToast(a){ achQ.push(a); if (!achBusy) achNext(); }
function achNext(){
  const a = achQ.shift(); if (!a){ achBusy = false; return; } achBusy = true;
  let el = $('achToast'); if (!el){ el = document.createElement('div'); el.id = 'achToast'; document.body.appendChild(el); }
  el.classList.toggle('legend', !!a.L); if (a.L){ confetti(); setTimeout(confetti, 400); sfx('quest'); }
  el.innerHTML = `<div class="at-ic">${a.ic}</div><div><small>${a.L?'✦ LEGENDARY unlocked!':'🏆 Achievement unlocked!'}</small><b>${a.name}</b><div class="at-r">${rTxt(a.r)}</div></div>`;
  el.classList.remove('show','gone'); void el.offsetWidth; el.classList.add('show'); sfx('collect');
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { if (!el.classList.contains('show')) el.classList.add('gone'); achNext(); }, 400); }, R.achMs || 3000);
}
function goldProgHTML(){
  const n = Math.min(ascN(), ASC_ORDER.length);
  const shown = ASC_ORDER.slice(0, Math.max(GOLD_HUB_AT, n));
  const chips = shown.map((k,i) => `<span class="gp-c ${i<n?'on':''}" title="${HARV_NAME[k]}">${img(RES[RES_BY_KEY[k]].item)}</span>`).join('');
  const extra = n>GOLD_HUB_AT ? ` +${n-GOLD_HUB_AT} cosmic types also gold.` : '';
  return `<div class="gprog ${goldHub()?'done':''}"><div class="gp-h"><b>${goldHub()?'👑 Golden Hub unlocked!':'Gold harvesters'}</b><span>${Math.min(n,GOLD_HUB_AT)}/${GOLD_HUB_AT}</span></div>
    <div class="bar gold"><i style="width:${Math.min(n,GOLD_HUB_AT)/GOLD_HUB_AT*100}%"></i></div><div class="gp-row">${chips}</div>
    <div class="gp-s">${goldHub()?'+25% production on everything, forever.'+extra:'Make all 10 original harvester types gold (Ascension ★10) to unlock the <b>Golden Hub</b>: +25% all production, forever.'}</div></div>`;
}
function openAch(){
  R.dkTab = 'menu';
  checkAch(); const n = ACH.filter(a=>S.ach[a.id]).length, LG = ACH.filter(a=>a.L), nl = LG.filter(a=>S.ach[a.id]).length;
  const row = a => { const [c,t] = a.p(), done = !!S.ach[a.id], f = Math.min(1, c/t);
    return `<div class="ach ${done?'done':''} ${a.L?'leg':''}"><div class="ach-ic">${a.ic}</div><div class="ach-b">${a.L?'<i class="lg-tag">LEGENDARY</i>':''}<b>${a.name}</b><small>${a.desc}</small>
      ${done?'':`<div class="bar${a.L?' leg':''}"><i style="width:${f*100}%"></i></div><small class="ach-p">${fmt(Math.min(c,t))} / ${fmt(t)}${a.est?` · ⏱ ${a.est} for a dedicated player`:''}</small>`}<div class="ach-r">${done?'✅ ':''}${rTxt(a.r)}</div></div></div>`; };
  openSheet(`<h2>🏆 Achievements <span class="pk-sub">${n}/${ACH.length}</span></h2>${goldProgHTML()}
    <div class="achs">${ACH.filter(a=>!a.L).map(row).join('')}</div>
    <div class="lg-h"><span>✦ LEGENDARY ✦</span><small>${nl}/${LG.length} · the long haul — weeks to months each</small></div>
    <div class="achs">${LG.map(row).join('')}</div>
    <div class="row"><button class="btn" data-a="x">Close</button></div>`);
  sheet.querySelector('[data-a=x]').onclick = closeSheet;
}

function bootTestSandbox(){
  if (!TEST_MODE) return;
  const q = new URLSearchParams(location.search);
  const reset = q.get('reset') === '1';
  const wantPP = TEST_PP || 1000;
  const forceTop = q.get('topup') === '1' || q.get('refill') === '1';
  const wantAsc = q.has('asc') ? Math.max(0, Math.min(50, +q.get('asc')||0)) : null;
  const wantEra = q.has('era') ? Math.max(1, Math.min(MAX_ERAS, +q.get('era')||1)) : null;
  const priorGranted = () => {
    const g = S && (S.testPPGranted|0);
    return g===1 ? 1000 : g; // v48/v49 sandboxes stored this as 1 after the 1,000 grant
  };
  if (reset || !S || !S.testSandbox){
    let asc = wantAsc != null ? wantAsc : 0;
    let eraIdx = 0;
    if (wantEra != null){
      eraIdx = Math.min(wantEra-1, cycleLen(asc)-1);
    } else if (asc >= 1){
      // Jump to the first post-quantum era so the new resources are immediately in play.
      eraIdx = Math.min(BASE_LAST+1, cycleLen(asc)-1);
    }
    const snd = !S || S.sound !== false;
    S = freshState({rebirths:eraIdx, asc, pp:wantPP, perks:{}, sound:snd, eraCap:cycleLen(asc)});
    S.testSandbox = 1; S.testPPGranted = wantPP; S.eraNews = capOf(S);
    try { setupWorld(); } catch(e){}
    cam.x = MAP_W/2; cam.y = MAP_H/2; cam.z = 44; cam.vx = cam.vy = 0;
    R.simClock = Date.now(); R.pendingDaily = false; R.dirty = true;
    try { save(); } catch(e){}
    const bits = ['Test sandbox: '+wantPP.toLocaleString()+' ✦', 'real save untouched'];
    if (asc) bits.splice(1, 0, 'Ascension ★'+asc);
    if (eraIdx) bits.splice(asc?2:1, 0, eraLabel(eraIdx));
    try { toast(bits.join(' · '), 4500); } catch(e){}
  } else if (forceTop || priorGranted() < wantPP){
    const before = S.pp|0;
    if (before < wantPP) S.pp = wantPP;
    S.testPPGranted = Math.max(priorGranted(), wantPP);
    S.testSandbox = 1;
    try { save(); } catch(e){}
    if ((S.pp|0) > before){
      try { toast('Test sandbox: topped up to '+wantPP.toLocaleString()+' ✦ · real save untouched', 4500); } catch(e){}
    } else if (forceTop){
      try { toast('Test sandbox: already at or above '+wantPP.toLocaleString()+' ✦ · real save untouched', 3000); } catch(e){}
    }
  }
  let el = $('testBadge');
  if (!el){ el = document.createElement('div'); el.id = 'testBadge'; document.body.appendChild(el); }
  el.textContent = sandboxBadgeText();
  el.classList.add('show');
}
function sandboxBadgeText(){ return 'SANDBOX · '+((S.pp|0).toLocaleString ? (S.pp|0).toLocaleString('en-US') : (S.pp|0))+' ✦'; }
function refreshSandboxBadge(){
  if (!TEST_MODE) return;
  let el = $('testBadge');
  if (!el){ el = document.createElement('div'); el.id = 'testBadge'; document.body.appendChild(el); el.classList.add('show'); }
  el.textContent = sandboxBadgeText();
  el.classList.add('show');
}


// ============================== MEDALS (v66) ==============================
// One medal every 25 player levels, up to Lv 1000 (40 medals). Earned medals are derived from the highest
// level ever reached (S.stats.medalTop), so older saves get theirs retroactively — quietly, with one toast + one glow.
// S.stats.medalSeen = how many medals the game already knows about; S.stats.medalNew = earned but not opened yet.
const MEDAL_EVERY = 25, MEDAL_N = 40;
const MEDAL_TIERS = [
  {n:'Bronze',   c:4, m:['#ffe0bd','#d98c4a','#7a3a12','#f3b57c'], e:['#a8432a','#4a140b'], rib:['#7a1f12','#e07b2c','#ffd2a1'], ink:'#fff1de'},
  {n:'Silver',   c:4, m:['#ffffff','#c3ccd6','#56626f','#eef3f8'], e:['#2f5fa8','#0e2450'], rib:['#173f7a','#dfe8f4','#4c8ae0'], ink:'#ffffff'},
  {n:'Gold',     c:4, m:['#fff7c9','#f6c437','#8f5a04','#ffe27e'], e:['#c4182a','#4e0610'], rib:['#a3101b','#ffd23f','#ffffff'], ink:'#fff6cc'},
  {n:'Platinum', c:4, m:['#ffffff','#dce9f2','#7590a3','#f4fbff'], e:['#16707a','#032a33'], rib:['#0f2b3b','#9fe3ff','#ffffff'], ink:'#f4feff'},
  {n:'Emerald',  c:3, m:['#fff7c9','#f2c23c','#8a5806','#ffe48a'], e:['#22c76f','#03381c'], rib:['#05502a','#2ee38a','#fff3b0'], gem:['#d2ffe6','#19c46b','#04411f'], ink:'#f0fff6'},
  {n:'Sapphire', c:3, m:['#ffffff','#d5e3ef','#6d879c','#f2faff'], e:['#2f7bff','#071c5c'], rib:['#0a2a7a','#5aa0ff','#ffffff'], gem:['#dceaff','#2f7bff','#081f66'], ink:'#eef5ff'},
  {n:'Ruby',     c:3, m:['#fff7c9','#f4c03a','#8a5605','#ffe384'], e:['#ec2846','#4d0210'], rib:['#5e0212','#ff3b5c','#ffd23f'], gem:['#ffe0e5','#ee2343','#5e0313'], ink:'#fff0f2'},
  {n:'Amethyst', c:3, m:['#ffe8e0','#e8a58e','#80423a','#ffd0c0'], e:['#a24bff','#2a0750'], rib:['#3d0a6e','#c07bff','#ffe0f4'], gem:['#f3e0ff','#a84bff','#3a0a68'], ink:'#faf0ff'},
  {n:'Diamond',  c:4, m:['#ffffff','#e3f3ff','#86a9c2','#ffffff'], e:['#4fb4e6','#0a2f4d'], rib:['#0c3a5c','#d9f6ff','#7fd6ff'], gem:['#ffffff','#c4f1ff','#4f9fc6'], ink:'#ffffff', icy:1},
  {n:'Solar',    c:4, m:['#fffbe0','#ffb81c','#a83a00','#ffe066'], e:['#ff6a00','#5c0a00'], rib:['#7a0a00','#ff7a00','#ffe066'], gem:['#fff3c0','#ff9a00','#8a2200'], ink:'#fffbe8', glow:'#ffb000'},
  {n:'Cosmic',   c:3, m:['#f8f0ff','#9fe8ff','#5a2fb0','#ffd6ff'], e:['#2a1170','#05021a'], rib:['#14063f','#7f5bff','#5ff3ff'], gem:['#e6fbff','#5ff3ff','#3b2ab8'], ink:'#ffffff', glow:'#a07bff', space:1},
  {n:'Legend',   c:1, m:['#ffffff','#ffe27a','#b0570e','#fff3b8'], e:['#ff3d7f','#2b0a4a'], rib:['#ff3d7f','#ffd23f','#3dd9ff'], gem:['#ffffff','#ff5fa8','#5a1aa8'], ink:'#ffffff', glow:'#ffd23f', prism:1},
];
const MEDALS = (() => { const out = []; MEDAL_TIERS.forEach((t, ti) => { for (let s=0; s<t.c; s++) out.push({i:out.length, lv:(out.length+1)*MEDAL_EVERY, ti, s, t}); }); return out; })();
const medalLv = i => (i+1)*MEDAL_EVERY;
const medalName = i => { const m = MEDALS[i]; return m.ti===11 ? 'Beltopolis Legend' : m.t.n+' Medal'; };
const medalTop = () => !S ? 1 : Math.max(S.level|0, (S.stats && S.stats.medalTop)|0, 1);
const medalEarned = () => Math.min(MEDAL_N, Math.floor(medalTop()/MEDAL_EVERY));
const medalFx = i => i>=39 ? 'm-legend' : i>=36 ? 'm-cosmic' : i>=32 ? 'm-solar' : '';
// ---- procedural art (Canvas 2D so it shares cleanly on iOS: no SVG-in-canvas tainting) ----
function mPathStar(c, cx, cy, n, ro, ri, rot){ c.beginPath(); for (let k=0; k<n*2; k++){ const a = rot + k*Math.PI/n, r = k%2 ? ri : ro; c.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); } c.closePath(); }
function mPathGear(c, cx, cy, n, ro, ri){ c.beginPath(); const st = Math.PI*2/n; for (let k=0; k<n; k++){ const a = -Math.PI/2 + k*st; const p = [[a-st*.5, ri],[a-st*.3, ri],[a-st*.18, ro],[a+st*.18, ro],[a+st*.3, ri],[a+st*.5, ri]]; for (const [aa, r] of p) c.lineTo(cx+Math.cos(aa)*r, cy+Math.sin(aa)*r); } c.closePath(); }
function mPathScallop(c, cx, cy, n, r, d){ c.beginPath(); const st = Math.PI*2/n; for (let k=0; k<n; k++){ const a0 = -Math.PI/2 + k*st, a1 = a0+st, am = a0+st/2; c.lineTo(cx+Math.cos(a0)*r, cy+Math.sin(a0)*r); c.quadraticCurveTo(cx+Math.cos(am)*(r+d*2), cy+Math.sin(am)*(r+d*2), cx+Math.cos(a1)*r, cy+Math.sin(a1)*r); } c.closePath(); }
function mPathPoly(c, cx, cy, n, r, rot, rr){ const pts = []; for (let k=0; k<n; k++){ const a = rot + k*Math.PI*2/n; pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]); } const mid = k => { const p = pts[k%n], q = pts[(k+1)%n]; return [(p[0]+q[0])/2, (p[1]+q[1])/2]; }; c.beginPath(); const m0 = mid(0); c.moveTo(m0[0], m0[1]); for (let k=1; k<=n; k++){ const p = pts[k%n], m = mid(k); c.arcTo(p[0], p[1], m[0], m[1], rr); } c.closePath(); }
function mPathFlower(c, cx, cy, n, r, ri){ c.beginPath(); const st = Math.PI*2/n; for (let k=0; k<n; k++){ const a0 = -Math.PI/2 + k*st - st/2, a1 = a0+st, am = a0+st/2; if (!k) c.moveTo(cx+Math.cos(a0)*ri, cy+Math.sin(a0)*ri); c.bezierCurveTo(cx+Math.cos(a0+st*.05)*r*1.12, cy+Math.sin(a0+st*.05)*r*1.12, cx+Math.cos(a1-st*.05)*r*1.12, cy+Math.sin(a1-st*.05)*r*1.12, cx+Math.cos(a1)*ri, cy+Math.sin(a1)*ri); } c.closePath(); }
function mPathFlame(c, cx, cy, n, ro, ri){ c.beginPath(); const st = Math.PI*2/n; for (let k=0; k<n; k++){ const a = -Math.PI/2 + k*st; const a0 = a - st/2; if (!k) c.moveTo(cx+Math.cos(a0)*ri, cy+Math.sin(a0)*ri); c.quadraticCurveTo(cx+Math.cos(a-st*.32)*ro*.92, cy+Math.sin(a-st*.32)*ro*.92, cx+Math.cos(a+st*.08)*ro, cy+Math.sin(a+st*.08)*ro); c.quadraticCurveTo(cx+Math.cos(a+st*.2)*ri*1.05, cy+Math.sin(a+st*.2)*ri*1.05, cx+Math.cos(a+st/2)*ri, cy+Math.sin(a+st/2)*ri); } c.closePath(); }
function mPathShield(c, cx, cy, r){ c.beginPath(); c.moveTo(cx, cy-r*1.04); c.bezierCurveTo(cx+r*.45, cy-r*.82, cx+r*.8, cy-r*.9, cx+r*.98, cy-r*.86); c.bezierCurveTo(cx+r*1.08, cy+r*.1, cx+r*.7, cy+r*.78, cx, cy+r*1.12); c.bezierCurveTo(cx-r*.7, cy+r*.78, cx-r*1.08, cy+r*.1, cx-r*.98, cy-r*.86); c.bezierCurveTo(cx-r*.8, cy-r*.9, cx-r*.45, cy-r*.82, cx, cy-r*1.04); c.closePath(); }
function mBodyPath(c, m, cx, cy, r){
  const s = m.s;
  switch (m.ti){
    case 0: c.beginPath(); c.arc(cx, cy, r*.93, 0, Math.PI*2); return;
    case 1: mPathGear(c, cx, cy, 14+2*s, r, r*.86); return;
    case 2: mPathScallop(c, cx, cy, 16+2*s, r*.9, r*.05); return;
    case 3: mPathPoly(c, cx, cy, 6, r*1.06, -Math.PI/2, r*.22); return;
    case 4: mPathPoly(c, cx, cy, 8, r*1.04, -Math.PI/2+Math.PI/8, r*.14); return;
    case 5: mPathShield(c, cx, cy, r*.98); return;
    case 6: mPathStar(c, cx, cy, 8, r*1.08, r*.84, -Math.PI/2); return;
    case 7: mPathFlower(c, cx, cy, 10, r*1.0, r*.82); return;
    case 8: mPathStar(c, cx, cy, 12, r*1.1, r*.86, -Math.PI/2); return;
    case 9: mPathFlame(c, cx, cy, 14+2*s, r*1.12, r*.84); return;
    case 10: mPathStar(c, cx, cy, 16, r*1.08, r*.88, -Math.PI/2); return;
    default: mPathStar(c, cx, cy, 24, r*1.12, r*.9, -Math.PI/2);
  }
}
function mMetal(c, m, x0, y0, x1, y1, flip){
  const g = c.createLinearGradient(x0, y0, x1, y1), k = m.t.m;
  const st = flip ? [[0,k[2]],[.35,k[1]],[.5,k[0]],[.62,k[1]],[1,k[3]]] : [[0,k[0]],[.28,k[1]],[.52,k[2]],[.72,k[1]],[1,k[3]]];
  if (m.t.prism){ const pr = ['#ff5f8f','#ffd23f','#7dff8a','#3dd9ff','#b27bff','#ff5f8f']; pr.forEach((col, j) => g.addColorStop(j/(pr.length-1), col)); return g; }
  for (const [o, col] of st) g.addColorStop(o, col); return g;
}
function mGem(c, x, y, sz, col){
  c.save(); c.translate(x, y);
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = sz*.5; c.shadowOffsetY = sz*.15;
  c.beginPath(); c.moveTo(0, -sz); c.lineTo(sz*.86, -sz*.3); c.lineTo(sz*.6, sz*.75); c.lineTo(-sz*.6, sz*.75); c.lineTo(-sz*.86, -sz*.3); c.closePath();
  const g = c.createLinearGradient(-sz, -sz, sz, sz); g.addColorStop(0, col[0]); g.addColorStop(.45, col[1]); g.addColorStop(1, col[2]); c.fillStyle = g; c.fill();
  c.shadowColor = 'transparent'; c.lineWidth = Math.max(1, sz*.12); c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  c.beginPath(); c.moveTo(-sz*.86, -sz*.3); c.lineTo(sz*.86, -sz*.3); c.moveTo(0, -sz); c.lineTo(-sz*.3, -sz*.3); c.lineTo(0, sz*.75); c.moveTo(0, -sz); c.lineTo(sz*.3, -sz*.3); c.lineTo(0, sz*.75);
  c.lineWidth = Math.max(.6, sz*.06); c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
  c.beginPath(); c.ellipse(-sz*.28, -sz*.5, sz*.22, sz*.12, -.5, 0, Math.PI*2); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill();
  c.restore();
}
function mRivet(c, x, y, r, m){
  const g = c.createRadialGradient(x-r*.35, y-r*.4, r*.1, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, m.t.m[1]); g.addColorStop(1, m.t.m[2]);
  c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fillStyle = g; c.fill(); c.lineWidth = Math.max(.5, r*.25); c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();
}
function mStar5(c, x, y, r, fill){ mPathStar(c, x, y, 5, r, r*.45, -Math.PI/2); c.fillStyle = fill; c.fill(); c.lineWidth = Math.max(.6, r*.18); c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke(); }
function mLaurel(c, m, cx, cy, r, leaves){
  const k3 = m.t.m, lr = r*1.17;
  for (const side of [-1, 1]){
    c.beginPath(); c.arc(cx, cy, lr, Math.PI/2 + side*0.2, Math.PI/2 + side*(0.2 + leaves*0.25), side<0); c.lineWidth = r*.045; c.strokeStyle = k3[2]; c.stroke();
    for (let k=0; k<leaves; k++){
      const a = Math.PI/2 + side*(0.34 + k*0.25), lx = cx + Math.cos(a)*lr, ly = cy + Math.sin(a)*lr;
      for (const off of [-1, 1]){
        c.save(); c.translate(lx, ly); c.rotate(a + off*0.75 + (side<0 ? Math.PI : 0) + Math.PI/2*side*0);
        const L = r*(.27 - k*.008), Wd = r*.1;
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(off*Wd, side*-L*.5, 0, side*-L); c.quadraticCurveTo(-off*Wd*.3, side*-L*.5, 0, 0); c.closePath();
        const gg = c.createLinearGradient(-Wd, 0, Wd, -L); gg.addColorStop(0, k3[0]); gg.addColorStop(.5, k3[1]); gg.addColorStop(1, k3[2]);
        c.fillStyle = gg; c.fill(); c.lineWidth = r*.014; c.strokeStyle = 'rgba(0,0,0,.5)'; c.stroke();
        c.restore();
      }
    }
  }
}
function mWings(c, m, cx, cy, r, sz){
  const fill = mMetal(c, m, cx-r*1.6, cy-r, cx+r*1.6, cy+r);
  for (const side of [-1, 1]){
    for (let k=0; k<4+sz; k++){
      const len = r*(0.62 + 0.11*sz) * (1 - k*0.11), y = cy - r*.55 + k*r*.17;
      c.save(); c.translate(cx + side*r*.72, y); c.rotate(side*(-0.32 + k*0.13));
      c.beginPath(); c.moveTo(0, -r*.07); c.quadraticCurveTo(side*len*.7, -r*.16, side*len, -r*.02); c.quadraticCurveTo(side*len*.6, r*.09, 0, r*.07); c.closePath();
      c.fillStyle = fill; c.fill(); c.lineWidth = r*.018; c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke();
      c.restore();
    }
  }
}
function mCrown(c, m, cx, y, w){
  const h = w*.62; c.save();
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = w*.12; c.shadowOffsetY = w*.04;
  c.beginPath(); c.moveTo(cx-w/2, y); c.lineTo(cx-w/2, y-h*.55); c.lineTo(cx-w*.27, y-h*.25); c.lineTo(cx, y-h); c.lineTo(cx+w*.27, y-h*.25); c.lineTo(cx+w/2, y-h*.55); c.lineTo(cx+w/2, y); c.closePath();
  c.fillStyle = mMetal(c, {t:MEDAL_TIERS[2]}, cx-w/2, y-h, cx+w/2, y); c.fill(); c.shadowColor = 'transparent'; c.lineWidth = w*.04; c.strokeStyle = '#7a4a00'; c.stroke();
  mGem(c, cx, y-h*.32, w*.11, m.t.gem || ['#ffe0e5','#ee2343','#5e0313']);
  for (const dx of [-w/2, 0, w/2]){ const gy = dx ? y-h*.55 : y-h; c.beginPath(); c.arc(cx+dx, gy, w*.06, 0, Math.PI*2); c.fillStyle = '#fff6c2'; c.fill(); c.strokeStyle = '#7a4a00'; c.lineWidth = w*.02; c.stroke(); }
  c.restore();
}
function mRibbon(c, m, y0, cx, cy, r){
  const t = m.t, top = y0, w = r*.62, stripes = 1 + (m.i % 3);
  for (const side of [-1, 1]){
    c.save();
    c.beginPath(); const x0 = cx + side*r*.62, x1 = cx + side*r*.16, yb = cy - r*.55;
    c.moveTo(x0 - w*.5, top); c.lineTo(x0 + w*.5, top); c.lineTo(x1 + w*.5, yb); c.lineTo(x1 - w*.5, yb); c.closePath();
    const g = c.createLinearGradient(x0 - w*.5, 0, x0 + w*.5, 0); g.addColorStop(0, t.rib[0]); g.addColorStop(.5, t.rib[1]); g.addColorStop(1, t.rib[0]); c.fillStyle = g; c.fill();
    c.clip();
    for (let k=0; k<stripes; k++){
      const f = (k+1)/(stripes+1); c.beginPath(); c.moveTo(x0 - w*.5 + w*f, top); c.lineTo(x1 - w*.5 + w*f, yb);
      c.lineWidth = w*(0.13 - stripes*0.02); c.strokeStyle = t.rib[2]; c.stroke();
    }
    const sh = c.createLinearGradient(0, top, 0, yb); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(.25, 'rgba(255,255,255,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.3)'); c.fillStyle = sh; c.fillRect(cx - r*2, top, r*4, yb - top);
    c.restore();
  }
}
function drawMedal(c, i, x, y, W, face){
  const m = MEDALS[i], t = m.t, H = W*1.3, cx = x + W/2, cy = y + H*0.6, r = W*0.3, s = m.s;
  c.save();
  // halo / glow for the top tiers
  if (t.glow || t.prism){
    const g = c.createRadialGradient(cx, cy, r*.4, cx, cy, r*1.75); g.addColorStop(0, t.glow+'cc'); g.addColorStop(.55, t.glow+'44'); g.addColorStop(1, t.glow+'00');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r*1.75, 0, Math.PI*2); c.fill();
  }
  // sunburst rays from Gold onward, growing in count and reach
  if (i >= 8){
    const n = 12 + Math.floor((i-8)/2)*2, len = r*(1.22 + Math.min(.42, (i-8)*.014));
    c.save(); c.translate(cx, cy);
    for (let k=0; k<n; k++){
      const a = k*Math.PI*2/n + (k%2 ? Math.PI/n*.0 : 0), l = k%2 ? len*.86 : len, wd = Math.PI/n*.42;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a-wd)*l, Math.sin(a-wd)*l); c.lineTo(Math.cos(a)*l*1.03, Math.sin(a)*l*1.03); c.lineTo(Math.cos(a+wd)*l, Math.sin(a+wd)*l); c.closePath();
      const g = c.createLinearGradient(0, 0, Math.cos(a)*l, Math.sin(a)*l); g.addColorStop(0, t.m[0]); g.addColorStop(.55, t.m[1]); g.addColorStop(1, t.prism ? ['#ff5f8f','#ffd23f','#7dff8a','#3dd9ff','#b27bff'][k%5] : mixHex(t.m[1], t.m[2], .35));
      c.fillStyle = g; c.fill();
    }
    c.restore();
  }
  if (!face) mRibbon(c, m, y, cx, cy, r);
  if (i >= 28 && !face) mWings(c, m, cx, cy, r, Math.min(4, Math.floor((i-28)/3)));
  if (i >= 2) mLaurel(c, m, cx, cy, r, Math.min(9, 3 + Math.floor(i/5)));
  // body: bold metal with a dark bevel edge and a drop shadow
  c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = r*.18; c.shadowOffsetY = r*.08;
  mBodyPath(c, m, cx, cy, r); c.fillStyle = mMetal(c, m, cx-r, cy-r, cx+r, cy+r); c.fill(); c.restore();
  mBodyPath(c, m, cx, cy, r); c.lineWidth = r*.045; c.strokeStyle = t.prism ? '#5a1aa8' : t.m[2]; c.stroke();
  mBodyPath(c, m, cx, cy, r*.965); c.lineWidth = r*.02; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  // bronze coin gets a milled edge
  if (m.ti === 0){ const n = 28 + s*6; c.save(); c.strokeStyle = 'rgba(70,30,8,.55)'; c.lineWidth = r*.02; for (let k=0; k<n; k++){ const a = k*Math.PI*2/n; c.beginPath(); c.moveTo(cx+Math.cos(a)*r*.86, cy+Math.sin(a)*r*.86); c.lineTo(cx+Math.cos(a)*r*.92, cy+Math.sin(a)*r*.92); c.stroke(); } c.restore(); }
  // recessed rim ring
  c.beginPath(); c.arc(cx, cy, r*.84, 0, Math.PI*2); c.fillStyle = mMetal(c, m, cx-r, cy-r, cx+r, cy+r, true); c.fill();
  c.lineWidth = r*.03; c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();
  // enamel face
  c.save(); c.beginPath(); c.arc(cx, cy, r*.71, 0, Math.PI*2); c.clip();
  if (t.space){ const g = c.createRadialGradient(cx-r*.2, cy-r*.25, r*.05, cx, cy, r*.75); g.addColorStop(0, '#5b3bd6'); g.addColorStop(.6, t.e[0]); g.addColorStop(1, t.e[1]); c.fillStyle = g; c.fillRect(cx-r, cy-r, r*2, r*2);
    let sd = 7 + i*13; const rnd = () => (sd = (sd*9301+49297)%233280)/233280; for (let k=0; k<40; k++){ c.beginPath(); c.arc(cx-r*.75+rnd()*r*1.5, cy-r*.75+rnd()*r*1.5, r*(.006+rnd()*.02), 0, Math.PI*2); c.fillStyle = 'rgba(255,255,255,'+(.5+rnd()*.5)+')'; c.fill(); }
    c.beginPath(); c.ellipse(cx, cy, r*.66, r*.2, -.35, 0, Math.PI*2); c.lineWidth = r*.04; c.strokeStyle = 'rgba(95,243,255,.55)'; c.stroke();
  } else if (t.prism){ const g = c.createLinearGradient(cx-r*.7, cy-r*.7, cx+r*.7, cy+r*.7); ['#ff3d7f','#ff9a3d','#ffd23f','#3ddc84','#3dd9ff','#7b5bff','#d43dff'].forEach((col, j, a) => g.addColorStop(j/(a.length-1), col)); c.fillStyle = g; c.fillRect(cx-r, cy-r, r*2, r*2);
    const v = c.createRadialGradient(cx, cy, r*.1, cx, cy, r*.75); v.addColorStop(0, 'rgba(40,10,70,.15)'); v.addColorStop(1, 'rgba(40,10,70,.65)'); c.fillStyle = v; c.fillRect(cx-r, cy-r, r*2, r*2);
  } else { const g = c.createRadialGradient(cx-r*.15, cy-r*.25, r*.05, cx, cy, r*.75); g.addColorStop(0, t.icy ? '#ffffff' : mixHex(t.e[0], '#ffffff', .25)); g.addColorStop(.55, t.e[0]); g.addColorStop(1, t.e[1]); c.fillStyle = g; c.fillRect(cx-r, cy-r, r*2, r*2);
    if (t.gem){ c.globalAlpha = .18; for (let k=0; k<10; k++){ const a = k*Math.PI/5; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); c.lineTo(cx+Math.cos(a+Math.PI/10)*r, cy+Math.sin(a+Math.PI/10)*r); c.closePath(); c.fillStyle = k%2 ? '#ffffff' : '#000000'; c.fill(); } c.globalAlpha = 1; }
  }
  // embossed factory gear behind the number
  c.save(); mPathGear(c, cx, cy - r*.05, 10 + (i%4)*2, r*.5, r*.42); c.arc(cx, cy - r*.05, r*.2, 0, Math.PI*2, true); c.fillStyle = 'rgba(255,255,255,.13)'; c.fill('evenodd'); c.restore();
  // conveyor-belt band with chevrons
  const by = cy + r*.33, bh = r*.15;
  c.fillStyle = 'rgba(15,18,26,.82)'; c.fillRect(cx - r*.8, by, r*1.6, bh);
  c.fillStyle = t.m[1]; c.fillRect(cx - r*.8, by, r*1.6, r*.02); c.fillRect(cx - r*.8, by + bh - r*.02, r*1.6, r*.02);
  c.beginPath(); for (let k=-6; k<=6; k++){ const xx = cx + k*r*.16; c.moveTo(xx - r*.03, by + r*.035); c.lineTo(xx + r*.035, by + bh/2); c.lineTo(xx - r*.03, by + bh - r*.035); }
  c.lineWidth = r*.03; c.strokeStyle = t.m[3]; c.stroke();
  // tier stars under the belt: 1-4 within each tier
  const ns = m.ti === 11 ? 5 : s + 1, ss = r*.075;
  const sg = c.createLinearGradient(0, cy + r*.52, 0, cy + r*.68); sg.addColorStop(0, '#fffbe6'); sg.addColorStop(1, '#ffc93a');
  for (let k=0; k<ns; k++) mStar5(c, cx + (k - (ns-1)/2)*ss*2.3, cy + r*.6, ss, sg);
  c.restore();
  // inner rim shadow
  c.beginPath(); c.arc(cx, cy, r*.71, 0, Math.PI*2); c.lineWidth = r*.035; c.strokeStyle = 'rgba(0,0,0,.45)'; c.stroke();
  // rivets on the rim: more every medal
  const nr = 6 + Math.min(18, m.ti*2 + s*2);
  for (let k=0; k<nr; k++){ const a = -Math.PI/2 + (k+.5)*Math.PI*2/nr; mRivet(c, cx + Math.cos(a)*r*.775, cy + Math.sin(a)*r*.775, r*.032, m); }
  // level number, embossed
  const txt = String(m.lv), fs = r*(txt.length >= 4 ? .44 : txt.length === 3 ? .5 : .62);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 '+fs+'px -apple-system,"Segoe UI",Roboto,sans-serif';
  const ty = cy - r*.04;
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(txt, cx + r*.02, ty + r*.035);
  const ng = c.createLinearGradient(0, ty - fs/2, 0, ty + fs/2); ng.addColorStop(0, '#ffffff'); ng.addColorStop(.45, t.ink); ng.addColorStop(.55, t.m[1]); ng.addColorStop(1, t.prism ? '#ffd23f' : t.m[3]);
  c.fillStyle = ng; c.fillText(txt, cx, ty); c.lineWidth = Math.max(1, r*.012); c.strokeStyle = 'rgba(0,0,0,.35)'; c.strokeText(txt, cx, ty);
  c.font = '900 '+(r*.13)+'px -apple-system,"Segoe UI",Roboto,sans-serif'; c.fillStyle = 'rgba(255,255,255,.88)'; c.fillText('LEVEL', cx, cy - r*.42);
  // gems: from Platinum (small) through the gem tiers (more + bigger each medal)
  const gc = t.gem || (m.ti === 3 ? ['#ffffff','#bfe9ff','#5aa2c8'] : null);
  if (gc && (m.ti >= 4 || s >= 2)){
    const ng2 = m.ti === 3 ? 2 : Math.min(8, 2 + s*2 + (m.ti >= 8 ? 2 : 0));
    for (let k=0; k<ng2; k++){ const a = Math.PI/2 + (k - (ng2-1)/2) * 0.42 + Math.PI; mGem(c, cx + Math.cos(a)*r*.93, cy + Math.sin(a)*r*.93, r*(.075 + Math.min(.04, m.ti*.003)), gc); }
    if (m.ti >= 4){ mGem(c, cx, cy + r*.9, r*(.11 + s*.02), gc); }
  }
  if (i >= 34 && !face) mCrown(c, m, cx, cy - r*1.0, r*(.6 + (i-34)*.06));
  // glossy shine sweep clipped to the body
  c.save(); mBodyPath(c, m, cx, cy, r); c.clip();
  const sh = c.createLinearGradient(cx - r, cy - r, cx + r*.4, cy + r*.4); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.36, 'rgba(255,255,255,0)'); sh.addColorStop(.45, 'rgba(255,255,255,.42)'); sh.addColorStop(.52, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sh; c.fillRect(cx - r*1.2, cy - r*1.2, r*2.4, r*2.4);
  c.beginPath(); c.ellipse(cx - r*.1, cy - r*.62, r*.55, r*.22, -.12, 0, Math.PI*2); c.fillStyle = 'rgba(255,255,255,.16)'; c.fill();
  c.restore();
  // sparkles on legendary tiers
  if (i >= 32){ const sp = [[-.95,-.9,.09],[1.0,-.55,.07],[.85,.95,.06],[-1.05,.55,.05],[.15,-1.25,.06]]; for (const [dx, dy, sz] of sp.slice(0, 2 + Math.min(3, i-32))){ c.save(); c.translate(cx + dx*r, cy + dy*r); mPathStar(c, 0, 0, 4, r*sz*1.6, r*sz*.35, 0); c.fillStyle = '#fffbe6'; c.shadowColor = t.glow || '#fff'; c.shadowBlur = r*.15; c.fill(); c.restore(); } }
  c.restore();
}
const medalCache = new Map();
function medalURL(i, w, face){
  const k = i+':'+w+(face?'f':''); if (medalCache.has(k)) return medalCache.get(k);
  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio||1)), cw = Math.round(w*dpr), ch = face ? cw : Math.round(w*1.3*dpr);
  const can = document.createElement('canvas'); can.width = cw; can.height = ch;
  // face: square close-up of just the medal (no ribbon) for small icons like the Level pill
  try { if (face){ const r = cw/2.3, W = r/0.3; drawMedal(can.getContext('2d'), i, cw/2 - W/2, cw/2 - W*1.3*0.6, W, true); } else drawMedal(can.getContext('2d'), i, 0, 0, cw); } catch(e){}
  const u = can.toDataURL('image/png'); medalCache.set(k, u); return u;
}
// ---- state ----
const medalQ = [];
function medalSync(){
  if (!S || !S.stats) return;
  const st = S.stats; st.medalTop = medalTop();
  if (!Array.isArray(st.medalNew)) st.medalNew = [];
  const earned = medalEarned();
  if (R.medalS !== S){
    // First look at this save (load, slot switch, rebirth): never pop up. Old saves get one toast + one glow.
    R.medalS = S;
    const was = st.medalSeen == null ? 0 : Math.max(0, st.medalSeen|0);
    if (earned > was){
      st.medalSeen = earned;
      if (!st.medalNew.includes(earned-1)) st.medalNew.push(earned-1);
      const n = earned - was;
      clearTimeout(R.medalToastT); R.medalToastT = setTimeout(() => { try { toast(n > 1 ? `🏅 You've earned ${n} Medals! See Menu → Medals` : `🏅 New Medal: Level ${medalLv(earned-1)}! See Menu → Medals`, 3400); } catch(e){} }, 2600);
    } else if (st.medalSeen == null) st.medalSeen = earned;
    st.medalNew = st.medalNew.filter(j => j >= 0 && j < earned);
    medalUI(); return;
  }
  if (earned > (st.medalSeen|0)){
    st.medalAt = st.medalAt || {};
    for (let j = st.medalSeen|0; j < earned; j++){ medalQ.push(j); if (!st.medalNew.includes(j)) st.medalNew.push(j); st.medalAt[j] = Date.now(); }
    st.medalSeen = earned; medalUI(); try { save(); } catch(e){}
    setTimeout(medalPump, 900);
  }
}
const medalNewList = () => (S && S.stats && Array.isArray(S.stats.medalNew)) ? S.stats.medalNew : [];
function medalMarkSeen(i){
  const st = S && S.stats; if (!st || !Array.isArray(st.medalNew)) return;
  const n = st.medalNew.length; st.medalNew = st.medalNew.filter(j => j !== i);
  if (st.medalNew.length !== n){ medalUI(); try { save(); } catch(e){} }
}
function medalUI(){
  const earned = S ? medalEarned() : 0, fresh = medalNewList().length > 0, key = earned+':'+fresh;
  if (R.medalUIKey === key) return; R.medalUIKey = key;
  const mb = $('bMenu'); if (mb) mb.classList.toggle('medal-new', fresh);
  const dt = document.querySelector('#dock .dk-tab[data-t=menu]'); if (dt) dt.classList.toggle('medal-new', fresh);
  const el = $('xpMedal');
  if (el){ if (earned > 0){ el.hidden = false; const im = el.querySelector('img'); const u = medalURL(earned-1, 30, true); if (im && im.src !== u) im.src = u; el.className = 'xp-medal ' + medalFx(earned-1); el.setAttribute('aria-label', 'Best medal: Level '+medalLv(earned-1)); } else el.hidden = true; }
}
function medalBlocked(){
  if (document.body.classList.contains('photo-mode')) return true;
  for (const id of ['celebrate','daily','iapScreen','photoPrev','medalView','medalPop']){ const e = $(id); if (e && e.classList.contains('show')) return true; }
  return false;
}
function medalPump(){
  if (!medalQ.length) return;
  if (medalBlocked()){ clearTimeout(R.medalPumpT); R.medalPumpT = setTimeout(medalPump, 1200); return; }
  showMedalPop(medalQ.shift());
}
function showMedalPop(i){
  let el = $('medalPop'); if (!el){ el = document.createElement('div'); el.id = 'medalPop'; el.setAttribute('role', 'dialog'); document.body.appendChild(el); }
  const more = medalQ.length;
  el.innerHTML = `<div class="mp-box"><div class="mp-kick">🏅 NEW MEDAL UNLOCKED</div>
    <div class="mv-art ${medalFx(i)}"><div class="mv-rays"></div><img alt="" src="${medalURL(i, 210)}"><div class="mv-shine" style="-webkit-mask-image:url(${medalURL(i, 210)});mask-image:url(${medalURL(i, 210)})"></div></div>
    <h2>Level ${medalLv(i)} Medal</h2><div class="mp-sub">${medalName(i)} · ${i+1} of ${MEDAL_N}</div>
    <div class="row"><button type="button" class="btn" data-a="x">${more ? 'Next' : 'Nice!'}</button><button type="button" class="btn gold" data-a="v">View Medal</button></div></div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  try { confetti(); setTimeout(() => { try { confetti(); } catch(e){} }, 450); } catch(e){}
  sfx('quest'); try { vibrate(30); } catch(e){}
  const done = () => { el.classList.remove('show'); setTimeout(medalPump, 350); };
  el.querySelector('[data-a=x]').onclick = () => { sfx('click'); done(); };
  el.querySelector('[data-a=v]').onclick = () => { sfx('click'); el.classList.remove('show'); openMedalView(i); };
}
// ---- Menu → Medals wall ----
function medalMenuBtn(){
  const e = medalEarned(), fresh = medalNewList().length > 0, nx = e < MEDAL_N ? medalLv(e) : 0;
  return `<button class="opt achbtn medalbtn${fresh?' medal-new':''}" data-a="medals"><span class="ach-ic md-ic${e?'':' lock'}"><img alt="" src="${medalURL(e ? e-1 : 0, 40, true)}"></span><span class="ob"><b>Medals${fresh?' <i class="md-newtag">NEW</i>':''}</b><small>${e}/${MEDAL_N} earned · ${nx ? 'next at Lv '+nx : 'all earned!'}</small></span><span class="chev">›</span></button>`;
}
function openMedals(){
  R.dkTab = 'menu'; R.medalWall = true;
  const earned = medalEarned(), lv = S.level||1, top = medalTop(), fresh = new Set(medalNewList());
  const next = earned < MEDAL_N ? medalLv(earned) : null, prev = earned ? medalLv(earned-1) : 0;
  const f = next ? Math.max(0, Math.min(1, (top - prev)/(next - prev))) : 1;
  const tile = m => { const got = m.i < earned, nw = got && fresh.has(m.i);
    return `<button type="button" class="md-t ${got?'got':'lock'}${nw?' new':''} ${got?medalFx(m.i):''}" data-m="${m.i}" aria-label="Level ${m.lv} medal${got?'':' (locked)'}"><img alt="" src="${medalURL(m.i, 64, true)}" loading="lazy"><b>Lv ${m.lv}</b>${got?'':'<i class="md-lock">🔒</i>'}${nw?'<i class="md-new">NEW</i>':''}</button>`; };
  const tiers = MEDAL_TIERS.map((t, ti) => { const ms = MEDALS.filter(m => m.ti === ti), g = ms.filter(m => m.i < earned).length;
    return `<div class="md-tier"><span>${ti===11?'✦ Legend':t.n}</span><small>${g}/${ms.length}</small></div><div class="md-grid">${ms.map(tile).join('')}</div>`; }).join('');
  const heroI = earned ? earned-1 : 0;
  openSheet(`<div class="shop-tabs"><button class="stab" data-a="back">‹ Menu</button><button class="stab on">🏅 Medals</button></div>
    <div class="md-hero"><div class="md-hi ${earned?medalFx(heroI):'lock'}"><img alt="" src="${medalURL(heroI, 80, true)}"></div><div class="md-hm"><b>${earned}/${MEDAL_N} Medals</b><small>One every ${MEDAL_EVERY} levels · you're Lv ${lv}</small>
      <div class="lv-bar"><i style="width:${(f*100).toFixed(1)}%"></i></div><div class="lv-n">${next ? `Next: <b>Level ${next} Medal</b> · ${next - top} level${next-top===1?'':'s'} to go` : 'Every medal earned — legendary!'}</div></div></div>
    <div class="sub">Tap an earned medal to show it off. Greyed medals unlock at the level shown.</div>
    ${tiers}
    <div class="row"><button class="btn" data-a="x">Close</button></div>`, () => { R.medalWall = false; });
  navSel('bMenu');
  sheet.querySelector('[data-a=back]').onclick = () => { sfx('click'); openMenu(); };
  sheet.querySelector('[data-a=x]').onclick = closeSheet;
  sheet.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const i = +b.dataset.m; if (i < medalEarned()){ sfx('click'); openMedalView(i); } else { sfx('err'); toast(`Reach Level ${medalLv(i)} to unlock`, 1800); } });
}
// ---- full-screen show-off view ----
function medalMeta(i){
  const bits = [];
  try { bits.push(slotName(META.active)); } catch(e){}
  if (ascN()) bits.push('★'+ascN());
  try { bits.push(world().ic+' '+world().name); } catch(e){}
  const at = S.stats && S.stats.medalAt && S.stats.medalAt[i];
  if (at) bits.push('Earned '+new Date(at).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}));
  return bits.join(' · ');
}
function openMedalView(i){
  let el = $('medalView'); if (!el){ el = document.createElement('div'); el.id = 'medalView'; el.setAttribute('role', 'dialog'); document.body.appendChild(el); }
  const earned = medalEarned(); i = Math.max(0, Math.min(earned-1, i)); if (i < 0) return;
  medalMarkSeen(i);
  const big = medalURL(i, 250);
  el.className = 'show t'+MEDALS[i].ti;
  el.innerHTML = `<div class="mv-box"><div class="mp-kick">BELTOPOLIS · MEDAL ${i+1} OF ${MEDAL_N}</div>
    <div class="mv-art big ${medalFx(i)}"><div class="mv-rays"></div><img alt="Level ${medalLv(i)} medal" src="${big}"><div class="mv-shine" style="-webkit-mask-image:url(${big});mask-image:url(${big})"></div></div>
    <h2>Level ${medalLv(i)}</h2><div class="mp-sub">${medalName(i)}</div><div class="mv-meta">${esc(medalMeta(i))}</div>
    <div class="row"><button type="button" class="btn mv-nav" data-a="p" ${i<=0?'disabled':''} aria-label="Previous medal">‹</button><button type="button" class="btn green mv-share" data-a="sh">Save / Share</button><button type="button" class="btn mv-nav" data-a="n" ${i>=earned-1?'disabled':''} aria-label="Next medal">›</button></div>
    <button type="button" class="btn mv-close" data-a="x">Close</button></div>`;
  const close = () => { el.classList.remove('show'); if (R.medalWall && sheetWrap.classList.contains('open')) openMedals(); setTimeout(medalPump, 300); };
  el.querySelector('[data-a=x]').onclick = () => { sfx('click'); close(); };
  el.querySelector('[data-a=p]').onclick = () => { sfx('click'); openMedalView(i-1); };
  el.querySelector('[data-a=n]').onclick = () => { sfx('click'); openMedalView(i+1); };
  el.querySelector('[data-a=sh]').onclick = async () => { sfx('click'); await shareMedal(i); };
}
function medalIcon(){
  return new Promise(res => { try { const l = document.querySelector('link[rel="apple-touch-icon"]'); if (!l) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = l.href; } catch(e){ res(null); } });
}
async function medalCard(i){
  const Wc = 1080, Hc = 1350, can = document.createElement('canvas'); can.width = Wc; can.height = Hc;
  const c = can.getContext('2d'), m = MEDALS[i], t = m.t;
  const bg = c.createLinearGradient(0, 0, 0, Hc); bg.addColorStop(0, mixHex(t.e[1], '#000000', .25)); bg.addColorStop(.55, t.e[1]); bg.addColorStop(1, '#090b14'); c.fillStyle = bg; c.fillRect(0, 0, Wc, Hc);
  const gl = c.createRadialGradient(Wc/2, 560, 40, Wc/2, 560, 620); gl.addColorStop(0, (t.glow || t.m[1])+'aa'); gl.addColorStop(1, (t.glow || t.m[1])+'00'); c.fillStyle = gl; c.fillRect(0, 0, Wc, Hc);
  c.save(); c.translate(Wc/2, 560); c.globalAlpha = .16; for (let k=0; k<24; k++){ const a = k*Math.PI/12; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a-.07)*1100, Math.sin(a-.07)*1100); c.lineTo(Math.cos(a+.07)*1100, Math.sin(a+.07)*1100); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); } c.restore();
  // rivet frame
  c.lineWidth = 14; c.strokeStyle = 'rgba(255,255,255,.14)'; c.strokeRect(28, 28, Wc-56, Hc-56);
  for (const [x, y] of [[52,52],[Wc-52,52],[52,Hc-52],[Wc-52,Hc-52]]) mRivet(c, x, y, 14, m);
  drawMedal(c, i, Wc/2 - 330, 60, 660);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = '900 112px -apple-system,"Segoe UI",Roboto,sans-serif'; c.fillStyle = 'rgba(0,0,0,.45)'; c.fillText('LEVEL '+m.lv, Wc/2+4, 1040+6);
  const tg = c.createLinearGradient(0, 940, 0, 1040); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, t.m[1]); c.fillStyle = tg; c.fillText('LEVEL '+m.lv, Wc/2, 1040);
  c.font = '800 46px -apple-system,"Segoe UI",Roboto,sans-serif'; c.fillStyle = '#ffeaa7'; c.fillText(medalName(i)+' · '+(i+1)+' of '+MEDAL_N, Wc/2, 1108);
  let cap = ''; try { cap = photoCaption(); } catch(e){}
  c.font = '700 34px -apple-system,"Segoe UI",Roboto,sans-serif'; c.fillStyle = 'rgba(255,255,255,.75)'; c.fillText(cap, Wc/2, 1162);
  const icon = await medalIcon(); const brand = 'Beltopolis'; c.font = '900 54px -apple-system,"Segoe UI",Roboto,sans-serif';
  const bw = c.measureText(brand).width + (icon ? 86 : 0), bx = Wc/2 - bw/2;
  if (icon){ c.save(); c.beginPath(); c.roundRect ? c.roundRect(bx, 1206, 70, 70, 16) : c.rect(bx, 1206, 70, 70); c.clip(); c.drawImage(icon, bx, 1206, 70, 70); c.restore(); }
  c.textAlign = 'left'; c.fillStyle = '#ffffff'; c.fillText(brand, bx + (icon ? 86 : 0), 1260);
  return can;
}
async function shareMedal(i){
  try {
    const can = await medalCard(i); const blob = await blobFromCanvas(can);
    if (!photoLooksValid(can, blob)){ toast('Could not make the picture'); return; }
    showPhotoPreview(can, blob);
    const im = document.querySelector('#photoPrev img'); if (im) im.alt = 'Your Level '+medalLv(i)+' medal';
  } catch(e){ toast('Could not make the picture'); }
}
if ($('xpMedal')) $('xpMedal').addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); sfx('click'); openMedals(); });


// ============================== DESKTOP LAYOUT ==============================
// Wide screens (PC / Mac browsers) get a Steam-style docked panel on the right instead of bottom sheets.
// Phones never match (and the iOS app never uses it), so the iPhone layout is untouched.
function deskWanted(){
  try { const C = window.Capacitor; if (C && C.isNativePlatform && C.isNativePlatform()) return false; } catch(e){}
  try { const q = new URLSearchParams(location.search).get('desk'); if (q === '0') return false; if (q === '1') return true; } catch(e){}
  if (!DESK.mq) DESK.mq = matchMedia('(min-width: 1000px) and (min-height: 560px) and (min-aspect-ratio: 5/4)');
  return DESK.mq.matches;
}
const DK_TABS = { build: () => closeSheet(), perk: () => openPerks(), style: () => openCosmetics(), book: () => openRecipeBook(), menu: () => openMenu() };
function deskIdleHTML(){
  if (!S || !S.hub) return `<h2>🔨 Build</h2><div class="sub">Start here</div>
    <div class="dk-steps"><div class="dk-step big"><span>🏠</span><div><b>Click open grass near trees</b><small>to place your Main Hub</small></div></div></div>
    <div class="dk-tip">🖱️ Drag to move the map · scroll to zoom</div>`;
  return `<h2>🔨 Build</h2><div class="sub">Click the map to build or upgrade</div>
    <div class="dk-steps">
      <div class="dk-step"><span>🌲</span><div><b>Click a tree, rock or ore</b><small>build a harvester — belts lay themselves</small></div></div>
      <div class="dk-step"><span>🟩</span><div><b>Click open grass</b><small>build a crafter (Workshop, Smelter…)</small></div></div>
      <div class="dk-step"><span>⬆️</span><div><b>Click any building</b><small>upgrade it or see what it makes</small></div></div>
      <div class="dk-step"><span>✦</span><div><b>Finish the quest, then Rebirth</b><small>use the Rebirth tab above</small></div></div>
    </div>
    <div class="dk-tip">🖱️ Drag to move the map · scroll to zoom · 🗺 Map shows everything</div>`;
}
function deskSync(){
  if (!DESK.on) return;
  const open = sheetWrap.classList.contains('open'), t = open ? (R.dkTab || 'build') : 'build';
  document.querySelectorAll('#dock .dk-tab').forEach(el => el.classList.toggle('on', el.dataset.t === t));
  const idle = $('dkIdle');
  if (idle){ idle.hidden = open; if (!open){ const k = (S && S.hub ? 1 : 0); if (idle.dataset.k !== String(k)){ idle.dataset.k = k; idle.innerHTML = deskIdleHTML(); } } }
  const pp = $('ppBadge'), dpp = $('dkPP'); if (pp && dpp){ if (dpp.textContent !== pp.textContent) dpp.textContent = pp.textContent; dpp.classList.toggle('show', pp.classList.contains('show')); }
  const rb = document.querySelector('#dock .dk-tab[data-t=perk]'), bp = $('bPerk');
  if (rb && bp){ rb.classList.toggle('glow', bp.classList.contains('glow')); rb.classList.toggle('has', bp.classList.contains('has')); }
  const wn = $('dkWorld'); if (wn){ try { const w = world(), v = (w.ic||'')+' '+w.name; if (wn.textContent !== v) wn.textContent = v; } catch(e){} }
}
function deskApply(){
  const want = deskWanted();
  if (want === DESK.on) return;
  const dock = $('dock'), status = $('dkStatus'), body = $('dkBody'), xp = $('xpBar'), q = $('quest');
  if (!dock || !status || !body) return;
  if (!DESK.home) DESK.home = { xp:[xp.parentNode, xp.nextSibling], q:[q.parentNode, q.nextSibling], sw:[sheetWrap.parentNode, sheetWrap.nextSibling] };
  DESK.on = want;
  document.documentElement.classList.toggle('desk', want);
  if (want){
    status.appendChild(xp); status.appendChild(q); body.appendChild(sheetWrap);
    const lg = $('dkLogo'), ic = document.querySelector('link[rel="apple-touch-icon"]'); if (lg && ic && !lg.src) lg.src = ic.href;
  } else {
    const H_ = DESK.home; H_.xp[0].insertBefore(xp, H_.xp[1]); H_.q[0].insertBefore(q, H_.q[1]); H_.sw[0].insertBefore(sheetWrap, H_.sw[1]);
  }
  R.ins = null; resize(); try { clampCam(); } catch(e){}
  if (want) deskSync();
}
(function deskInit(){
  const dock = $('dock'); if (!dock) return;
  dock.querySelectorAll('.dk-tab').forEach(el => el.addEventListener('click', () => { sfx('click'); const f = DK_TABS[el.dataset.t]; if (!f) return; if (el.dataset.t !== 'build' && sheetWrap.classList.contains('open')) closeSheet(); f(); }));
  addEventListener('keydown', e => { if (DESK.on && e.key === 'Escape' && sheetWrap.classList.contains('open') && !document.querySelector('#daily.show,#celebrate.show,#iapScreen.show')) closeSheet(); });
  try { deskWanted(); const h = () => deskApply(); if (DESK.mq.addEventListener) DESK.mq.addEventListener('change', h); else DESK.mq.addListener(h); } catch(e){}
  addEventListener('resize', () => deskApply());
  deskApply();
})();

// ============================== BOOT ==============================
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200)); if (window.visualViewport) visualViewport.addEventListener('resize', resize); resize();
try { load(); } catch(e){ try { if (!S) S = freshState(); retainInit(S); if (!R.terr) setupWorld(); } catch(e2){} }
try { bootTestSandbox(); } catch(e){}
setTimeout(maybeDaily, 900);
try { iapInit().catch(()=>{}); } catch(e){}
// leaving the app records the time; coming back to it catches up everything that happened meanwhile
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { setTimeout(maybeDaily, 600); const away = (Date.now() - (R.simClock||Date.now()))/1000; R.simClock = Date.now(); if (away >= 2){ R.simClock -= away*1000; catchUp(away, true); } } });
addEventListener('pagehide', save); addEventListener('beforeunload', save);
addEventListener('pageshow', e => { if (e.persisted){ const away = (Date.now() - (R.simClock||Date.now()))/1000; if (away >= 2) catchUp(away, true); } });
setInterval(save, 5000);
if ('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
// test hooks
window.AF = { DESK, deskSync, closeSheet, openMenu, openStore, openCosmetics, openReviewPage, requestNativeReview, REVIEW_URL, isFindableBuilding, openMyBuildings, goToBuilt, buildingsByType, showFindToast, ensureEvents, ensureDailyChallenges, ensureWeekEvent, noteChProgress, claimChallenge, claimWeekEvent, openDailyChallenges, openWeeklyEvent, dailyChCounts, weekStartKey, clockDate, fmtRemain, WEEK_BELTS, IAP, IAP_IDS, iapInit, iapHandleTx, iapBuy, iapRestore, openIapScreen, applyRespec, perkSpent, ascGated, BUILD_ORDER, HUT_WALK, HUT_CHOP, HUT_REACH, HUT_HITS, HUT_PAYOUT, isHut, hutTv, hutItem, hutCenter, hutFindTarget, hutDoHit, hutWearLeft, stepHut, flowHut, hutReach, hutDismiss, hutRelink, hutCrewN, hutWalkSp, hutChopT, hutUpgCost, hutBuyUpg, openHutInfo, hutsOf, goToHut, goToHub, updateHutLocators, HUT_LOC_Z, BUILDING_OUTLINE, BUILDING_OUTLINE_COLOR, buildingOutlineW, strokeBuildingOutline, craftRate, harvTvOf, repairHarvesterTerrain, migrateMapCoords, migrateHubFromEdge, moveHubTo, findHubSafeSpot, startHubMove, cancelHubMove, endHubMove, openHubMovePlace, hubFits, hubEdgePad, hubEdgeErr, clampHubPlace, HUB_EDGE, lvSpeed, lvDouble, lvCost, migrateBuildingLv, MAX_LV, harvestItem, harvestMul, craftMul, beltSpeed, perkSpeed, paceQuest, PERKS, perkCost, megaUnlocked, openRecipeBook, openRecipeTree, crafterOf, updateUI, WORLDS, world, worldOf, worldIdx, worldName, worldPreview, applyWorldFrame, mixHex, setWorld(i){ R.forceWorld = i==null?null:(i%WORLDS.length); if (R.terr) renderTerrain(); else applyWorldFrame(); R.dirty=true; }, trackDay, cosOn, ACH, checkAch, openAch, openDaily, claimDaily, dailyState, maybeDaily, offerDailySoon, spinSlices, startSpin, pickSpin, prizeGrant, today, dayGap, prodMul, goldHub, retainInit, DAILY, gainXp, itemXp, xpNeed, xpNeedV3, xpPpAt, xpNextPp, XP_BASE, XP_GROW, XP_PP_EVERY, XP_CURVE_V, migrateXpReset, migrateAllSlotsXp, BASE_ERAS, MAX_ERAS, BASE_LAST, cycleLen, capOf, lastEraOf, migrateEraCap, POST_ERAS, POST_ART, applyPostQuantum, drawPauseBadge, pauseBadgeAt, pauseBadgeLayout, resumeFromBadge, COSMETICS, COS_BY_ID, MAP_PALETTES, beltSkin, beltPalette, skinHex, applyMapTheme, paintBuildCosmetic, rainbowHex, cosOwned, cosEq, buyCosmetic, equipCosmetic, openCosmetics, updateXpBar, celebrateLevel, flushLevelUp, xpLive, TEST_MODE, TEST_PP, testPPAmount, bootTestSandbox, refreshSandboxBadge, sandboxBadgeText, harvKeyOf, costOf, canPay, goldBonusLine, megaBlurb, bKey, drillOreTv, isLandType, isLandB, LAND_ORDER, LAND_OLD_SIZE, startLandmarkPlace, finishLandmarkTap, snapshotLandmarks, restoreLandmarks, migrateLandmarkScale, landFitErr, enterPhotoMode, exitPhotoMode, captureFactoryPhoto, shareFactoryPhoto, takeFactoryPhoto, showPhotoPreview, sharePhotoFromPreview, sharePreparedPhoto, closePhotoPreview, photoLooksValid, photoShareFile, formSetId, formKind, drawFormBuilding, drawFormIcon, formSetIcon, HUT_PLACE_MAX, isHutType, hutPlaced, hutSlotsLeft, hutAtCap, placeCheck, footprint, openBuildMenu, build, demolish, doRebirth, MAP_W, MAP_H, GRASS, TREE, STONE, IRON, SILVER, get terr(){return R.terr;}, get cam(){return cam;}, get bridges(){return R.bridges;}, recountBelts, routeBuilding, routeBuildingSafe, pickRoute, unroute, routeAllBuildings, beltConflicts, beltBlocked, needsBelt, celebrateAscension, eraUnlockOf, eraUnlockHTML, needsEraNews, markEraNews, maybeEraNews, showEraNewsCatchup, isGoldB, isGoldKey, ASC_ORDER, ASC_SPEED, ivOf, pickAt, get W(){return W;}, get H(){return H;}, get S(){return S;}, get multi(){return R.multi;}, openBulk, selectAllOfType, planNext, planTo, planTotal, affordable, removeRefund, exitMulti, toggleMulti, clearTile, clearCheck, CLEAR_YIELD, openBuildMenu, dblCost, DBL_CHANCE, tierCost, tierMul, openInfo, findRoute, placeCheck, setRecipe, costOf, canPay, bKey, nBuilt, recountBuilt, growthMul, reset(seed, era){ S = era ? freshState({rebirths:era, pp:0, perks:{}, sound:S.sound, ...retainKeep(S)}) : freshState(); if (seed) S.seed = seed; setupWorld(); R.dirty = true; R.pendingDaily = !!dailyState(); }, R, cam, build, tap, toWorld, toScreen, ERAS, eraQuest, eraUnlocks, eraReveal, eraName, eraLabel, doRebirth, celebrate, openPerks, RES, RES_BY_KEY, ORE_T, ITEMS, gotoEra(e, pp, seed, asc){ S = freshState({rebirths:e, asc: asc===undefined ? S.asc|0 : asc, pp:pp||0, perks:S.perks, sound:S.sound, ...retainKeep(S)}); if (seed) S.seed = seed; setupWorld(); cam.x = MAP_W/2; cam.y = MAP_H/2; R.dirty = true; }, migrateFishRemoval, migrateHutRemoval, migrateSurveyRemoval, migrateOuterResources, paintOuterResources, isIslandAsc, terrGenForAsc, islandGen, islandLayoutId, islandThemeId, islandLook, ISLAND_THEME, repairIslandResources, genIslandMapLegacy, TERR_GEN_LAND, TERR_GEN_ISLANDS, genMap, genIslandMap, spinStreakInfo, spinItemAmount, spinPrizeItems, jackpotSlice, SPIN_PP_FRAC, SPIN_JACK_FRAC, fitZ, clampCam, wholeMap, zoomTo, hudInsets, OV_Z, TAP_ZOOM_Z, BUILDINGS, idx, MAP_W, MAP_H, TREE:TREE, STONE, GRASS, drawItem, drawBuildingIcon, save, load, switchSlot, get AC(){return AC;}, get MASTER(){return MASTER;}, unlockAudio, sfx, get silentEl(){return silentEl;}, IOS, deleteSlot, renameSlot, get META(){return META;}, slotData, slotKey, SAVE_KEY, META_KEY, offlineProgress, catchUp, welcomeBack, doRebirth, completeQuest, step: simulate, RECIPES, has, reserveOf, bundle, packTxt, rTxt, grant, itemKnown, deliver };
Object.assign(window.AF, { respackItems, grantRespack, showRespackPop, factoryFlows, iapShopHTML, MEDALS, MEDAL_TIERS, MEDAL_N, MEDAL_EVERY, medalSync, medalEarned, medalTop, medalURL, drawMedal, openMedals, openMedalView, showMedalPop, medalCard, shareMedal, medalMarkSeen, medalNewList, medalUI, medalQ, medalPump, boostMul, boostOn, setBoostOn, boostOwned, forceBoost, grantBoost, iapComingSoon, iapProduct, IAP_PERM, IAP_INFO, ascendPts, rebirthPoints, xpNeedV4, itemXpBase, XP_ITEM_MUL, XP_GROW_V4, PACE_PROD });
})();
