/* ===== 罗马战略 · 引擎层（军团制 + 分省后勤） ===== */
var G = { state:null };

G.SEASONS = ["春","夏","秋","冬"];

/* 日志兜底（UI 层会重写为带 DOM 的版本） */
G.log = function(msg, cls){ if(G.state) G.state.log.push({t:msg, c:cls||""}); };

/* ---------- 工具 ---------- */
G.rngState = 218;
G.rand = function(){
  G.rngState |= 0; G.rngState = G.rngState + 0x6D2B79F5 | 0;
  var t = Math.imul(G.rngState ^ G.rngState >>> 15, 1 | G.rngState);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
G.adjMap = {};
(function(){
  DATA.adj.forEach(function(e){ (G.adjMap[e[0]] = G.adjMap[e[0]]||[]).push({p:e[1],s:!!e[2]}); (G.adjMap[e[1]] = G.adjMap[e[1]]||[]).push({p:e[0],s:!!e[2]}); });
})();
G.neighbors = function(pid){ return G.adjMap[pid] || []; };
G.isSea = function(a,b){ var n = G.neighbors(a); for(var i=0;i<n.length;i++) if(n[i].p===b) return n[i].s; return false; };
G.owner = function(pid){ return G.state.provs[pid].owner; };
G.legionsAt = function(pid){ return G.state.legions.filter(function(l){ return l.pid===pid; }); };
G.facLegions = function(fac){ return G.state.legions.filter(function(l){ return l.fac===fac; }); };
G.legion = function(id){ for(var i=0;i<G.state.legions.length;i++) if(G.state.legions[i].id===id) return G.state.legions[i]; return null; };
G.facColor = function(fid){ return DATA.factions[fid] ? DATA.factions[fid].color : "#888"; };
G.legionStr = function(l){ return l.units.reduce(function(s,u){ var d=DATA.units[u.u]; return s + u.n*(d.atk+d.def)/2; },0); };
G.legionCount = function(l){ return l.units.reduce(function(s,u){ return s+u.n; },0); };
G.atWar = function(a,b){ return G.state.wars.indexOf(a+"|"+b) >= 0 || G.state.wars.indexOf(b+"|"+a) >= 0; };
G.setWar = function(a,b,v){
  var k1 = a+"|"+b, i = G.state.wars.indexOf(k1);
  if(v && i<0){ G.state.wars.push(k1); G.log(a+" 向 "+DATA.factions[b].nm+" 宣战！", "war"); }
  if(!v && i>=0){ G.state.wars.splice(i,1); G.log(a+" 与 "+DATA.factions[b].nm+" 缔结和约。", "good"); }
};

/* ---------- 初始化 ---------- */
G.newGame = function(){
  var sc = DATA.scenario, provs = {}, legions = [];
  Object.keys(DATA.provinces).forEach(function(pid){
    var p = DATA.provinces[pid];
    provs[pid] = { owner: sc.owners[pid], bld:[], bqueue:[], loyalty:60, mpPool: p.mp*2,
      chest: 60 + p.tax*2,      /* 分省钱库：不再全局共享 */
      granary: p.grain*6,       /* 分省粮库 */
      conquered:0 };
  });
  sc.legions.forEach(function(d){
    legions.push({ id:d.id, no:d.no, fac:d.fac, pid:d.pid, gen:d.gen, kind:d.kind,
      chest:150, grain:80,
      units: d.units.map(function(u){ return {u:u[0], n:u[1], aux:0}; }) });
  });
  var rel = {};
  Object.keys(DATA.factions).forEach(function(f){ rel[f] = {}; });
  Object.keys(DATA.factions).forEach(function(f){ Object.keys(DATA.factions).forEach(function(t){ if(f!==t) rel[f][t]=0; }); });
  Object.keys(sc.relations).forEach(function(k){
    var p = k.split("|"); rel[p[0]][p[1]] = sc.relations[k]; rel[p[1]][p[0]] = sc.relations[k];
  });
  G.state = { turn: sc.startTurn, year: sc.year, season: sc.season,
    player: sc.playerFac, provs: provs, legions: legions, rel: rel, wars: sc.wars.map(function(w){return w.join("|")}), feud: sc.feud,
    aerarium: {}, granaryCentral: {}, transit: [], log: [], legionSeq: {} };
  Object.keys(DATA.factions).forEach(function(f){
    if(f!=="REBEL"){ G.state.aerarium[f] = 250; G.state.granaryCentral[f] = 150; }
  });
  return G.state;
};

/* 到首都的最短路径步数（BFS，海运算 1 步） */
G.pathDistTo = function(pid, cap){
  if(!cap) return 99;
  if(pid === cap) return 0;
  var dist = {}; dist[pid] = 0; var q = [pid];
  while(q.length){
    var cur = q.shift();
    var ns = G.neighbors(cur);
    for(var i=0;i<ns.length;i++){
      var nx = ns[i].p;
      if(dist[nx] === undefined){
        dist[nx] = dist[cur] + 1;
        if(nx === cap) return dist[nx];
        q.push(nx);
      }
    }
  }
  return 99;
};
G.starveLegion = function(l){
  l.units.forEach(function(u){ u.n = Math.max(0.5, u.n*0.95); });
  l.starve = 2;
  if(l.fac === G.state.player) G.log("✹ " + l.no + " 断粮，部队减员！", "war");
};
G.fieldSupply = function(l, upkeep, need){ /* 敌境：吃随军粮；饷从随军战利品出（以战养战） */
  if(l.grain >= need){ l.grain -= need; }
  else { l.grain = 0; G.starveLegion(l); }
  l.chest -= upkeep;
  if(l.chest < 0){ l.chest = 0; l.owe = 2; } else if(l.owe > 0) l.owe--;
};

/* ---------- 经济：分省钱粮 + 军团随军补给 ---------- */
G.scarcityVal = function(res){ return DATA.scarcity[res] || 1; };
G.provTax = function(pid){
  var p = DATA.provinces[pid], st = G.state.provs[pid], t = p.tax;
  if(st.bld.indexOf("workshop")>=0) t *= 1.3;
  return t * (0.5 + st.loyalty/200);
};
G.provTrade = function(pid){
  var p = DATA.provinces[pid], st = G.state.provs[pid], tv = 0;
  Object.keys(p.spec).forEach(function(r){ tv += p.spec[r] * G.scarcityVal(r); });
  var mult = 1;
  if(st.bld.indexOf("market")>=0) mult += 0.25;
  if(p.port && st.bld.indexOf("port_b")>=0) mult += 0.3;
  return tv * mult;
};
G.legionUpkeep = function(l){ return l.units.reduce(function(s,u){ return s + DATA.units[u.u].up*u.n; },0); };
G.legionGrainNeed = function(l){ return G.legionCount(l)*0.15; };

G.economyTick = function(){
  /* 0) 在途税款到账（上一季发出的车队） */
  G.state.transit.forEach(function(t){
    if(t.arriveTurn <= G.state.turn){
      G.state.aerarium[t.fac] = (G.state.aerarium[t.fac]||0) + t.gold;
      G.state.granaryCentral[t.fac] = (G.state.granaryCentral[t.fac]||0) + t.grain;
      t.done = true;
    }
  });
  G.state.transit = G.state.transit.filter(function(t){ return !t.done; });
  /* 1) 行省收入：缴税省 60% 装车转运（下季到账，按到首都路径损耗）；边远/低忠诚省不上缴 */
  Object.keys(G.state.provs).forEach(function(pid){
    var p = DATA.provinces[pid], st = G.state.provs[pid];
    if(st.owner === "REBEL") return;
    var fac = st.owner, fd = DATA.factions[fac];
    var cap = fd ? fd.cap : null;
    var income = G.provTax(pid) + G.provTrade(pid);
    st.granary = Math.min(p.grain*12, st.granary + p.grain*(G.state.season===2?1.25:1));
    var dist = G.pathDistTo(pid, cap);
    var remote = !cap || dist > DATA.TRANSIT.remoteSteps || st.loyalty < DATA.TRANSIT.loyalMin;
    if(remote){
      st.chest += income;
      st.transitGold = 0; st.transitLoss = 0; st.transitDist = dist; st.remote = true;
    } else {
      var sendGold = income * DATA.TRANSIT.taxRate;
      var sendGrain = p.grain * DATA.TRANSIT.taxRate;
      st.chest += income * (1 - DATA.TRANSIT.taxRate);
      var loss = Math.min(0.8, DATA.TRANSIT.lossPerStep * dist);
      st.granary = Math.max(0, st.granary - sendGrain);
      G.state.transit.push({ fac:fac, gold: sendGold*(1-loss), grain: sendGrain*(1-loss), arriveTurn: G.state.turn + 1 });
      st.transitGold = sendGold*(1-loss); st.transitLoss = loss; st.transitDist = dist; st.remote = false;
    }
  });
  /* 2) 军团：军饷与粮（身份由组建地锁定） */
  G.state.legions.forEach(function(l){
    var st = G.state.provs[l.pid];
    var fd = DATA.factions[l.fac];
    var cap = fd ? fd.cap : null;
    var dist = cap ? G.pathDistTo(l.pid, cap) : 99;
    var friendly = st.owner === l.fac;
    var upkeep = G.legionUpkeep(l), need = G.legionGrainNeed(l);
    if(!l.kind) l.kind = "border";
    if(l.kind === "central"){
      if(l.pid === cap){
        /* 驻京：国库付饷，中央粮储供粮并补满随军粮 */
        G.state.aerarium[l.fac] -= upkeep;
        if(G.state.aerarium[l.fac] < 0){ G.state.aerarium[l.fac] = 0; l.owe = 2; } else if(l.owe > 0) l.owe--;
        var sup = Math.min(DATA.GRAIN_CAP - l.grain, G.state.granaryCentral[l.fac]);
        if(sup > 0){ l.grain += sup; G.state.granaryCentral[l.fac] -= sup; }
        if(l.grain >= need){ l.grain -= need; }
        else { G.state.granaryCentral[l.fac] += l.grain; l.grain = 0; G.starveLegion(l); }
      } else if(friendly && dist <= DATA.CORE_STEPS){
        /* 核心圈内己方省：国库付饷，粮从中央粮储随取随吃 */
        G.state.aerarium[l.fac] -= upkeep;
        if(G.state.aerarium[l.fac] < 0){ G.state.aerarium[l.fac] = 0; l.owe = 2; } else if(l.owe > 0) l.owe--;
        if(l.grain < need){
          var sup2 = Math.min(need - l.grain, G.state.granaryCentral[l.fac]);
          l.grain += sup2; G.state.granaryCentral[l.fac] -= sup2;
        }
        if(l.grain >= need){ l.grain -= need; }
        else G.starveLegion(l);
      } else if(friendly){
        /* 远离首都的己方省（边疆）：军饷就地征发驻省省库，占用当地军饷 */
        if(st.chest >= upkeep){ st.chest -= upkeep; l.owe = 0; } else { st.chest = 0; l.owe = 2; }
        var dg = Math.min(DATA.GRAIN_CAP - l.grain, Math.floor(st.granary*0.5));
        if(dg > 0){ l.grain += dg; st.granary -= dg; }
        if(l.grain >= need){ l.grain -= need; }
        else {
          var take = Math.min(st.granary, need - l.grain);
          st.granary -= take; l.grain += take - need;
          if(l.grain < 0) G.starveLegion(l);
        }
      } else {
        G.fieldSupply(l, upkeep, need); /* 敌境：以战养战 */
      }
    } else {
      /* 边军：就地取饷取粮；敌境吃随军粮+战利品充饷 */
      if(friendly){
        if(st.chest >= upkeep){ st.chest -= upkeep; l.owe = 0; } else { st.chest = 0; l.owe = 2; }
        var dg2 = Math.min(DATA.GRAIN_CAP - l.grain, Math.floor(st.granary*0.5));
        if(dg2 > 0){ l.grain += dg2; st.granary -= dg2; }
        if(l.grain >= need){ l.grain -= need; }
        else {
          var take2 = Math.min(st.granary, need - l.grain);
          st.granary -= take2; l.grain += take2 - need;
          if(l.grain < 0) G.starveLegion(l);
        }
      } else {
        G.fieldSupply(l, upkeep, need);
      }
    }
    if(l.starve > 0) l.starve--;
  });
  /* 3) 人力回充 */
  Object.keys(G.state.provs).forEach(function(pid){
    var st = G.state.provs[pid], base = DATA.provinces[pid].mp;
    st.mpPool = Math.min(base*4, st.mpPool + base);
  });
};

/* ---------- 招募（分省金库 + 军团身份决定费用 + 当地辅兵） ----------
   费用矩阵：中央军 公民兵×1.0 / 佣兵×1.5；边军 公民兵×1.8 / 佣兵×0.8 */
G.canRecruit = function(pid, uid){
  var p = DATA.provinces[pid], st = G.state.provs[pid], u = DATA.units[uid], req = u.req || {};
  var fd = DATA.factions[st.owner];
  if(req.capital && (!fd || pid !== fd.cap)) return "仅首都可募";
  if(req.cul && req.cul !== p.cul) return "需当地文化 " + req.cul;
  if(req.bld && st.bld.indexOf(req.bld)<0) return "需建筑 " + DATA.buildings[req.bld].nm;
  if(req.bld==="elephant_yard" && !(p.spec.elephants>=2)) return "需战象特产";
  if(req.spec && !(p.spec[req.spec]>=2)) return "需特产兵源";
  if(req.merc && st.bld.indexOf("market")<0) return "佣兵需市场";
  return true;
};
G.isAux = function(pid, uid){ /* 当地辅兵/佣兵：士气略低 */
  var u = DATA.units[uid], p = DATA.provinces[pid];
  return (u.req.merc || (u.req.cul && !G.culMatch(G.owner(pid), p.cul))) ? 1 : 0;
};
G.newLegionNo = function(fac){
  G.state.legionSeq[fac] = (G.state.legionSeq[fac]||0) + 1;
  return DATA.factions[fac].nm + "第" + G.state.legionSeq[fac] + "军";
};
G.recruit = function(pid, uid, n, legionId){
  n = n || 1;
  var ok = G.canRecruit(pid, uid);
  if(ok !== true) return ok;
  var u = DATA.units[uid], p = DATA.provinces[pid], st = G.state.provs[pid], fac = st.owner;
  var fd = DATA.factions[fac];
  var cap = fd ? fd.cap : null;
  var aux = G.isAux(pid, uid);
  var isMerc = !!u.req.merc || !!aux;
  /* 目标军团：禁卫只能编入中央军；其他编入驻省本方未满编军团，否则新建（身份由组建地锁定） */
  var target = null;
  if(u.req.capital){
    var cands = G.legionsAt(pid).filter(function(l){ return l.fac===fac && l.kind==="central" && l.units.length < DATA.LEGION_MAX; });
    target = (legionId && G.legion(legionId) && G.legion(legionId).kind==="central") ? G.legion(legionId) : (cands[0] || null);
    if(!target){
      target = { id:"L"+Math.abs(G.rngState=(G.rngState*31+7)|0)+"_"+pid, no:G.newLegionNo(fac), fac:fac, pid:pid, kind:"central", gen:null, chest:50, grain:30, units:[] };
      G.state.legions.push(target);
      G.log("新编成中央军团：" + target.no + "（驻 " + p.nm + "）", "good");
    }
  } else {
    if(legionId) target = G.legion(legionId);
    if(!target){
      var here = G.legionsAt(pid).filter(function(l){ return l.fac===fac && l.units.length < DATA.LEGION_MAX; });
      target = here[0] || null;
    }
    if(!target){
      var kind = (pid === cap) ? "central" : "border";
      target = { id:"L"+Math.abs(G.rngState=(G.rngState*31+7)|0)+"_"+pid, no:G.newLegionNo(fac), fac:fac, pid:pid, kind:kind, gen:null, chest:50, grain:30, units:[] };
      G.state.legions.push(target);
      G.log("新编成" + DATA.LEGION_KIND[kind].nm + "：" + target.no + "（驻 " + p.nm + "）", "good");
    }
  }
  if(target.units.length >= DATA.LEGION_MAX) return "军团满编（" + DATA.LEGION_MAX + "队）";
  var kind = target.kind;
  var mul = isMerc ? (kind==="central" ? 1.5 : 0.8) : (kind==="central" ? 1.0 : 1.8);
  var cost = u.cost*n*mul, mpUse = u.req.merc ? 0 : n;
  if(st.chest < cost) return "本省金库不足（" + Math.floor(st.chest) + "/" + Math.round(cost) + "，费率×" + mul.toFixed(1) + "）";
  if(st.mpPool < mpUse) return "人力不足";
  st.chest -= cost; st.mpPool -= mpUse;
  var ex = target.units.filter(function(x){ return x.u===uid && !!x.aux===!!aux; })[0];
  if(ex) ex.n += n; else target.units.push({u:uid, n:n, aux:aux});
  if(isMerc && fac===G.state.player) G.log(target.no + " 征募 " + DATA.units[uid].nm + "（" + DATA.LEGION_KIND[kind].nm + "费率×" + mul.toFixed(1) + (aux?"，当地辅兵士气-20%":"") + "）");
  return true;
};
G.renameLegion = function(lid, no){
  var l = G.legion(lid);
  if(l && no && no.length<=12){ l.no = no; G.log("军团更名：" + no); return true; }
  return false;
};

/* ---------- 建筑 ---------- */
G.startBuild = function(pid, bid){
  var b = DATA.buildings[bid], st = G.state.provs[pid];
  if(st.bld.indexOf(bid)>=0 || st.bqueue.length) return "已建成/建造中";
  if(b.reqSpec && !(DATA.provinces[pid].spec[b.reqSpec]>=2)) return "缺特产 " + DATA.specName[b.reqSpec];
  if(st.chest < b.cost) return "本省金库不足";
  st.chest -= b.cost;
  st.bqueue.push({b:bid, t:b.turns});
  return true;
};

/* ---------- 战斗快算（AI 用 / 测试用） ---------- */
G.FRONT_W = 24;
G.battle = function(atkArmy, defArmy, ctx){
  ctx = ctx || {};
  var lines = [];
  function prep(army, isDef){
    var g = army.gen ? DATA.generals[army.gen] : null;
    var gmod = function(cls){
      var m = 0;
      if(g && g.mod[cls]) m += g.mod[cls];
      if(g && g.skl.indexOf("defend")>=0 && isDef && !ctx.attackerHasInitiative) m += 0.25;
      return 1+m;
    };
    var units = army.units.filter(function(u){ return u.n>0; }).map(function(u){
      var d = DATA.units[u.u];
      return { id:u.u, aux:!!u.aux, nm:d.nm + (u.aux?"(辅)":""), cls:d.cls, atk:d.atk, def:d.def, mis:d.mis, chg:d.chg,
        mor:d.mor*(u.aux?0.8:1), armor:d.armor, front:d.front||1, flag:d.flag||"", n:u.n, gm:gmod(d.cls) };
    });
    var frontW = 0, front = [], rear = [], cav = [];
    units.sort(function(a,b){ return (b.cls==="EL") - (a.cls==="EL") || (b.cls==="HI") - (a.cls==="HI"); });
    units.forEach(function(u){
      u._engaged = 0;
      if(u.cls==="LR"){ rear.push(u); return; }
      if(u.cls==="LC" || u.cls==="HC"){ cav.push(u); return; }
      var fit = Math.min(u.n, Math.floor((G.FRONT_W - frontW) / u.front));
      if(fit > 0){ u._engaged = fit; front.push(u); frontW += fit * u.front; }
    });
    var reserves = units.filter(function(u){ return u._engaged===0 && u.cls!=="LR" && u.cls!=="LC" && u.cls!=="HC"; });
    return { all:units, front:front, rear:rear, cav:cav, g:g, frontW:frontW, reserves:reserves,
      initMor: units.reduce(function(s,u){ return s + u.n*u.mor*(u.cls==="LV"?0.6:1); },0) };
  }
  function mixMult(side, cls){
    var s=0, tot=0;
    side.front.forEach(function(u){ s += u._engaged * DATA.MATX[cls][u.cls]; tot += u._engaged; });
    return tot? s/tot : 1;
  }
  function cavPower(side){ return side.cav.reduce(function(s,u){ return s + u.n * u.atk * u.gm; },0); }
  function rearCount(side){ return side.rear.reduce(function(s,u){ return s+u.n; },0); }

  var A = prep(atkArmy,false), B = prep(defArmy,true);
  lines.push("—— 会战开始 ——");
  lines.push("攻方战线 " + A.frontW + "/" + G.FRONT_W + " 战位，预备队 " + A.reserves.reduce(function(x,u){ return x+u.n; },0) + " 队 | 守方战线 " + B.frontW + "/" + G.FRONT_W + "，预备队 " + B.reserves.reduce(function(x,u){ return x+u.n; },0) + " 队");

  for(var r=1; r<=3; r++){
    function skirmish(src, dst){
      if(!src.rear.length || !dst.front.length) return;
      src.rear.forEach(function(s){
        if(s.n<=0) return;
        var eles = dst.front.filter(function(t){ return t.cls==="EL" && t.n>0; });
        var targets = eles.length? eles : dst.front;
        var tot = targets.reduce(function(x,t){ return x + (t._engaged||t.n); },0);
        if(!tot) return;
        targets.forEach(function(t){
          var w = (t._engaged||t.n)/tot;
          t._skirt = (t._skirt||0) + s.mis * s.n * DATA.MATX[s.cls][t.cls] * (16/(8+t.armor)) * w;
        });
      });
    }
    skirmish(A,B); skirmish(B,A);
    [A,B].forEach(function(side){
      side.front.forEach(function(t){
        if(!t._skirt) return;
        var lost = Math.max(0, Math.min(t._engaged*0.35, t._skirt / (t.def*t.gm*2.2)));
        t.n -= lost;
        if(t.cls==="EL" && t.n>0 && t._skirt > t.def*4){
          t.n = Math.max(0, t.n - 1);
          lines.push("  ⚠ " + t.nm + " 被远程火力激怒发生恐慌！（远程对大象 ×2.8）");
        }
        t._skirt = 0;
      });
      side.all = side.all.filter(function(u){return u.n>0.05;});
      side.front = side.front.filter(function(u){return u.n>0.05;});
      side.cav = side.cav.filter(function(u){return u.n>0.05;});
      side.rear = side.rear.filter(function(u){return u.n>0.05;});
    });
    [[A,B],[B,A]].forEach(function(pr){
      var s = pr[0], e = pr[1];
      var eles = s.front.filter(function(u){return u.cls==="EL" && u.n>0;});
      if(eles.length && rearCount(s)===0 && rearCount(e)>0){
        eles.forEach(function(t){ t.n = Math.max(0, t.n*0.7); });
        s.front.forEach(function(t){ if(t.cls!=="EL") t.n = Math.max(0, t.n*0.93); });
        lines.push("  ⚠ " + (s===A?"攻方":"守方") + "战象缺乏远程掩护而失控，反踩己方战线！");
      }
    });
    var cavA = cavPower(A), cavB = cavPower(B);
    var advA = (cavA+cavB)>0 ? (cavA-cavB)/(cavA+cavB) : 0;
    function meleeScore(side, enemy, dir){
      var s = 0;
      var flanked = (dir==="def") && (advA*(side===B?1:-1) > 0.3);
      side.front.forEach(function(u){
        if(u._engaged<=0) return;
        var mm = mixMult(enemy, u.cls);
        var pw = u.atk * mm * u.gm * u._engaged;
        if(r===1) pw += u.chg * u._engaged * (u.cls==="HC"||u.cls==="LC"||u.cls==="EL"?1.5:1);
        if(u.flag==="legion" && r>=2) pw *= 1.1;
        s += pw;
      });
      side.cav.forEach(function(u){
        var mm = mixMult(enemy, u.cls);
        s += u.atk * mm * u.gm * u.n * (r===1?1.3:1) * (dir==="def"?0.3:0.9);
      });
      if(dir==="def"){
        var df = 0;
        side.front.forEach(function(u){
          if(u._engaged<=0) return;
          var d = u.def * u.gm * u._engaged;
          if(u.flag==="phalanx") d *= flanked ? 0.6 : 1.35;
          if(ctx.walls && side===B) d *= 1.15;
          df += d;
        });
        return { a: s, d: df };
      }
      return { a: s, d: 0 };
    }
    var sa = meleeScore(A,B,"atk"), sb = meleeScore(B,A,"def");
    var R = sa.a / Math.max(1, sb.d);
    var lossB = Math.min(0.5, 0.10 + Math.max(0,(R-1))*0.28);
    var lossA = Math.min(0.4, 0.08 + Math.max(0,(1/R-1))*0.25);
    [A,B].forEach(function(side){
      var frac = side===A? lossA : lossB;
      side.front.forEach(function(u){
        if(u._engaged<=0) return;
        u.n = Math.max(0, u.n - u._engaged*frac*(u.cls==="LR"?0.4:1));
      });
      side.all = side.all.filter(function(u){return u.n>0.05;});
      side.front = side.front.filter(function(u){return u.n>0.05;});
      side.cav = side.cav.filter(function(u){return u.n>0.05;});
      side.rear = side.rear.filter(function(u){return u.n>0.05;});
    });
    lines.push("第" + r + "轮：近战交换 攻损" + Math.round(lossA*100) + "% 守损" + Math.round(lossB*100) + "%（骑侧翼比 攻" + (advA*100).toFixed(0) + "%）");
    function morPool(side){ return side.all.reduce(function(s,u){ return s + u.n*u.mor*(u.cls==="LV"?0.6:1); },0); }
    var mA = morPool(A), mB = morPool(B);
    var brokeA = mA < A.initMor*0.38, brokeB = mB < B.initMor*0.38;
    if(brokeA || brokeB){
      var winner = brokeA && brokeB ? ((mA/A.initMor) < (mB/B.initMor) ? "B" : "A") : (brokeA ? "B" : "A");
      lines.push("★ 士气崩溃！第" + r + "轮结束战斗。");
      return finish(winner, r);
    }
  }
  function str(side){ return side.all.reduce(function(s,u){ return s + u.n*(u.atk+u.def)/2; },0); }
  function morPool2(side){ return side.all.reduce(function(s,u){ return s + u.n*u.mor*(u.cls==="LV"?0.6:1); },0); }
  var winner = (str(A) + morPool2(A)*0.3) > (str(B) + morPool2(B)*0.3) ? "A" : "B";
  lines.push("—— 三轮鏖战，攻方" + (winner==="A"?"惨胜":"被击退") + " ——");
  return finish(winner, 3);

  function finish(winner, rounds){
    var wSide = winner==="A"? A:B, lSide = winner==="A"? B:A;
    var cav = wSide.cav.reduce(function(s,u){return s+u.n;},0);
    var pursuit = Math.min(0.3, cav*0.015);
    lSide.all.forEach(function(u){ u.n = Math.max(0, u.n*(1-pursuit)); });
    function writeBack(side, army){
      var byKey = {};
      side.all.forEach(function(u){ byKey[u.id + (u.aux?"|a":"")] = Math.round(u.n); });
      army.units = Object.keys(byKey).map(function(k){
        var parts = k.split("|");
        return {u:parts[0], n:byKey[k], aux:parts[1]?1:0};
      }).filter(function(x){ return x.n>0; });
    }
    writeBack(A, atkArmy); writeBack(B, defArmy);
    lines.push("胜者：" + (winner==="A"?"攻方":"守方") + "（" + rounds + "轮，追击损耗 +" + Math.round(pursuit*100) + "%）");
    return { winner: winner, lines: lines };
  }
};

/* ---------- 军团移动 / 攻击 ---------- */
G.moveLegion = function(lid, to){
  var l = G.legion(lid);
  if(!l) return "无此军团";
  var from = l.pid;
  if(from === to) return "原地";
  if(G.neighbors(from).filter(function(n){return n.p===to;}).length===0) return "不相邻";
  if(G.isSea(from,to) && G.state.season===3) return "冬季海运封航";
  var defOwner = G.owner(to);
  if(defOwner === l.fac){
    l.pid = to;
    return true;
  }
  var hostile = defOwner === "REBEL" || G.atWar(l.fac, defOwner);
  if(!hostile) return "未交战（先宣战）";
  var defenders = G.legionsAt(to).filter(function(d){ return d.fac !== l.fac; });
  if(defenders.length === 0){
    return G.captureProvince(l, to);
  }
  return { battle: true, atkLegion: l, to: to, defenders: defenders };
};

G.captureProvince = function(l, to){
  var st = G.state.provs[to], p = DATA.provinces[to];
  /* 掳掠：混乱中只抢到一半，其余散失 */
  var seizedC = Math.floor(st.chest*0.5), seizedG = Math.floor(st.granary*0.5);
  l.chest = Math.min(DATA.CHEST_CAP, l.chest + seizedC);
  l.grain = Math.min(DATA.GRAIN_CAP, l.grain + seizedG);
  st.owner = l.fac; st.loyalty = 35; st.conquered = 6;
  st.chest -= seizedC; st.granary -= seizedG;
  G.state.legions = G.state.legions.filter(function(x){ return x.pid!==to || x.fac===l.fac; });
  G.log("⚑ " + p.nm + " 被 " + l.no + " 攻占！掳获 " + seizedC + " 金 / " + seizedG + " 粮（其余在混乱中散失）。", "war");
  return { captured: true };
};

/* 战斗后结算：单位写回 + 空军团解散 + 胜者占领 */
G.applyBattle = function(atkLegion, to, defLegions, winnerIsAtk, atkUnits, defUnits){
  var totalDef0 = 0;
  defLegions.forEach(function(d){ totalDef0 += G.legionCount(d) || 0.0001; });
  atkLegion.units = atkUnits.filter(function(u){ return u.n>0; });
  if(atkLegion.units.length === 0){
    G.state.legions = G.state.legions.filter(function(x){ return x!==atkLegion; });
    G.log(atkLegion.no + " 全军覆没，番号撤销。", "war");
  }
  var byUid = {};
  defUnits.forEach(function(u){ var k=u.u+(u.aux?"|a":""); byUid[k] = (byUid[k]||0) + u.n; });
  defLegions.forEach(function(d){
    var share0 = Math.max(0.0001, G.legionCount(d)/totalDef0);
    var nu = [];
    Object.keys(byUid).forEach(function(k){
      var parts = k.split("|");
      var give = Math.round(byUid[k]*share0);
      if(give>0) nu.push({u:parts[0], n:give, aux:parts[1]?1:0});
    });
    d.units = nu;
  });
  var alive = defLegions.filter(function(d){ return d.units.length>0; });
  defLegions.forEach(function(d){ if(alive.indexOf(d)<0){ G.state.legions = G.state.legions.filter(function(x){ return x!==d; }); G.log(d.no + " 全军覆没，番号撤销。", "war"); } });
  if(winnerIsAtk){
    G.captureProvince(atkLegion, to);
  } else if(atkLegion.units.length>0){
    G.log(atkLegion.no + " 攻势被击退，退回原地。", "war");
  }
};

G.quickBattle = function(atkLegion, to, defenders){
  var atkArmy = { gen: atkLegion.gen, units: atkLegion.units };
  var defUnits = [];
  defenders.forEach(function(d){ defUnits = defUnits.concat(d.units); });
  var defGens = defenders.filter(function(d){ return d.gen; });
  var defArmy = { gen: defGens.length? defGens[0].gen : null, units: defUnits };
  var ctx = { walls: G.state.provs[to].bld.indexOf("walls")>=0 };
  var res = G.battle(atkArmy, defArmy, ctx);
  G.log("⚔ " + DATA.provinces[to].nm + " 会战：" + atkLegion.no + " vs " + defenders.map(function(d){return d.no;}).join("+") + " → " + (res.winner==="A"?"攻方胜":"守方胜"), "war");
  res.lines.forEach(function(l){ G.log("   " + l); });
  G.applyBattle(atkLegion, to, defenders, res.winner==="A", atkArmy.units, defArmy.units);
  return res;
};

/* ---------- 忠诚度 ---------- */
G.loyaltyTick = function(){
  Object.keys(G.state.provs).forEach(function(pid){
    var st = G.state.provs[pid], p = DATA.provinces[pid];
    var fac = st.owner;
    if(!fac || fac==="REBEL") return;
    var garr = 0;
    G.legionsAt(pid).forEach(function(l){ if(l.fac===fac) garr += G.legionCount(l); });
    var target = 55 + (G.culMatch(fac,p.cul)? 12 : -12) + Math.min(20, garr*2);
    if(st.conquered>0){ target -= st.conquered*4; st.conquered--; }
    st.loyalty += (target - st.loyalty)*0.3;
    st.loyalty = Math.max(0, Math.min(100, st.loyalty));
    if(st.loyalty < 20 && G.rand() < 0.4){
      st.owner = "REBEL"; st.loyalty = 45;
      G.state.legions.push({ id:"RB"+pid, no:p.nm+"起义军", fac:"REBEL", pid:pid, gen:null, chest:60, grain:40,
        units:[{u:"levy_spear", n:6, aux:0}] });
      G.log("✹ " + p.nm + " 爆发起义！脱离 " + DATA.factions[fac].nm + " 统治。", "war");
    }
  });
};
G.culMatch = function(fac, cul){
  var map = { ROMA:["latin","sabellic","etrus"], CARTHAGO:["phoen","carth"], NUMIDIA:["numid"],
    MACEDON:["mace","greek"], SELEUKID:["eastern","greek"], PTOLEMY:["ptol","greek"],
    PONTUS:["eastern"], GALATIA:["galat"], PERGAMON:["greek"], ACHAEA:["greek"], RHODES:["greek"], EPIRUS:["greek"], CAPPADOCIA:["eastern"] };
  return (map[fac]||[]).indexOf(cul)>=0;
};

/* ---------- 外交：反霸权快速反转 ---------- */
G.facPower = function(fac){
  var provs = G.facProvinces(fac).length;
  var mil = 0;
  G.facLegions(fac).forEach(function(l){ mil += G.legionStr(l); });
  return provs*10 + mil*0.1;
};
G.facProvinces = function(fac){ return Object.keys(G.state.provs).filter(function(pid){ return G.owner(pid)===fac; }); };
G.diplomacyTick = function(){
  var facs = Object.keys(DATA.factions).filter(function(f){ return f!=="REBEL"; });
  var powers = {}; facs.forEach(function(f){ powers[f] = G.facPower(f); });
  facs.forEach(function(f){
    facs.forEach(function(t){
      if(f===t) return;
      var feud = G.state.feud.some(function(x){ return (x[0]===f&&x[1]===t)||(x[0]===t&&x[1]===f); });
      var r = G.state.rel[f][t];
      var target = 0;
      if(powers[t] > powers[f]*1.5) target = -40;
      if(powers[t] < powers[f]*0.6 && !G.atWar(f,t)) target = 10;
      var nr = r + (target - r)*0.15;
      if(feud) nr = Math.max(nr, -60);
      if(G.atWar(f,t)) nr = Math.min(nr, -70);
      G.state.rel[f][t] = Math.round(nr);
      if(nr < -75 && !G.atWar(f,t) && !feud && G.rand()<0.15 && G.bordering(f,t)) G.setWar(f,t,true);
    });
  });
};
G.bordering = function(fa, fb){
  return DATA.adj.some(function(e){
    var oa = G.owner(e[0]), ob = G.owner(e[1]);
    return (oa===fa&&ob===fb)||(oa===fb&&ob===fa);
  });
};

/* ---------- AI ---------- */
G.aiTick = function(){
  Object.keys(DATA.factions).forEach(function(f){
    if(f==="REBEL" || f===G.state.player) return;
    var enemies = G.state.wars.map(function(w){ return w.split("|"); })
      .filter(function(p){ return p[0]===f || p[1]===f; }).map(function(p){ return p[0]===f? p[1] : p[0]; });
    G.facProvinces(f).forEach(function(pid){
      var st = G.state.provs[pid];
      if(st.chest > 150 && st.owner===f){
        var pool = Object.keys(DATA.units).filter(function(uid){ return G.canRecruit(pid, uid)===true && DATA.units[uid].cost < st.chest*0.3; });
        if(pool.length) G.recruit(pid, pool[Math.floor(G.rand()*pool.length)], 1);
      }
    });
    G.facLegions(f).forEach(function(l){
      var opts = G.neighbors(l.pid).filter(function(n){ return enemies.indexOf(G.owner(n.p))>=0 || G.owner(n.p)==="REBEL"; });
      if(!opts.length) return;
      var myStr = G.legionStr(l);
      opts.forEach(function(o){
        if(myStr < 0) return;
        var defs = G.legionsAt(o.p).filter(function(d){ return d.fac !== f; });
        var dStr = defs.reduce(function(s,d){ return s + G.legionStr(d); }, 20);
        if(myStr > dStr*1.2){
          G.quickBattle(l, o.p, defs.length? defs : [{no:"守备民兵", fac:G.owner(o.p), pid:o.p, gen:null, units:[{u:"levy_spear",n:3,aux:0}]}]);
          myStr = -1;
        }
      });
    });
  });
};

/* ---------- 回合结算 ---------- */
G.endTurn = function(){
  G.economyTick();
  G.aiTick();
  G.loyaltyTick();
  G.diplomacyTick();
  Object.keys(G.state.provs).forEach(function(pid){
    var st = G.state.provs[pid];
    if(st.bqueue.length){
      st.bqueue[0].t--;
      if(st.bqueue[0].t<=0){ st.bld.push(st.bqueue[0].b); G.log(DATA.provinces[pid].nm + " 的 " + DATA.buildings[st.bqueue[0].b].nm + " 建成。", "good"); st.bqueue.shift(); }
    }
  });
  G.state.turn++;
  G.state.season++;
  if(G.state.season>3){ G.state.season = 0; G.state.year++; }
};

/* ---------- 兵种克制测试（战略快算） ---------- */
G.unitTests = function(){
  var mk = function(arr, gen){ return { gen: gen||null, units: arr.map(function(x){ return {u:x[0], n:x[1], aux:0}; }) }; };
  var results = [];
  function run(name, a, b){
    var r = G.battle(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), {});
    results.push("【" + name + "】" + r.lines.join("\n"));
  }
  run("测试1：40队征召枪兵 vs 12军团+4青年兵+2骑士",
    mk([["levy_spear",40]]), mk([["roman_legion",12],["velites",4],["roman_equites",2]]));
  run("测试2：24征召枪兵 vs 10罗得岛投石手",
    mk([["levy_spear",24]]), mk([["rhodian_slinger",10]]));
  run("测试3：马其顿方阵被骑兵包抄",
    mk([["companion_cav",4],["roman_legion",10],["velites",2]]), mk([["macedonian_phalanx",12],["peltast",3]]));
  run("测试4：战象无远程掩护 vs 克里特弓手",
    mk([["north_african_elephant",4],["levy_spear",8]]), mk([["cretan_archer",6],["velites",4]]));
  run("测试5：大西庇阿轻步兵流 vs 汉尼拔混编",
    mk([["velites",6],["roman_legion",8],["roman_equites",2]], "scipio"),
    mk([["iberian_scutarius",4],["libyan_spear",4],["numidian_cav",3],["balearic_slinger",2]], "hannibal"));
  return results.join("\n\n");
};
