/* ===== 战术层：六边形兵棋 =====
   复用 honeycomb-grid v4（MIT）负责网格数学：距离/邻接/像素换算。
   规则自研：布阵 → 选战术（自动接近/就地防御）→ 回合自动推演。
   远程射程 2 格；越过己方近战开火 → 误伤友军（火力遮蔽）。 */
var TAC = {};

TAC.COLS = 15; TAC.ROWS = 11;
TAC.HEX = { width: 58, height: 50 };
TAC.MARGIN = 16;

TAC.TERR = {
  plain: { nm:"平原", def:1.0, fill:"#ece3cd" },
  forest:{ nm:"森林", def:1.25, fill:"#c0dd97" },
  hill:  { nm:"丘陵", def:1.3,  fill:"#d9c9a3" }
};
TAC.GLYPH = { LR:"远", LI:"轻", HI:"重", LC:"轻骑", HC:"重骑", EL:"象", LV:"征" };

/* ---------- 建战场 ---------- */
TAC.newBattle = function(atkArmy, defArmy, seed, sideTactics){
  seed = seed || 42;
  var s = seed;
  var rnd = function(){ s = (s*1103515245 + 12345) & 0x7fffffff; return s/0x7fffffff; };
  var Hex = Honeycomb.defineHex({ dimensions: TAC.HEX, origin: {x:0,y:0}, orientation: "pointy" });
  var grid = new Honeycomb.Grid(Hex, Honeycomb.rectangle({ width: TAC.COLS, height: TAC.ROWS }));
  var terrain = {};
  grid.forEach(function(h){
    var v = rnd();
    terrain[h.toString()] = v < 0.16 ? "forest" : (v < 0.28 ? "hill" : "plain");
  });
  var bt = { grid: grid, Hex: Hex, terrain: terrain, round: 0, log: [], over: false, winner: null,
    tactics: sideTactics || { A:"advance", B:"hold" } };
  bt.units = [];
  TAC._deploy(bt, atkArmy, "A", defArmy, "B");
  bt.log.push("布阵阶段：攻方下方 3 行 / 守方上方 3 行。可直接点击己方单位再点同侧空格调整位置。");
  return bt;
};

TAC._mkUnits = function(bt, army, side){
  var out = [];
  army.units.forEach(function(u, i){
    var d = DATA.units[u.u];
    for(var k=0; k<u.n; k++){
      out.push({ seq: out.length, uid: u.u, aux: !!u.aux, side: side,
        nm: d.nm + (u.aux?"(辅)":""), cls: d.cls,
        atk: d.atk, def: d.def, mis: d.mis, chg: d.chg,
        mor: d.mor*(u.aux?0.8:1), armor: d.armor, spd: d.spd,
        n: 1, n0: 1, col: -1, row: -1, moved: 0, alive: true });
    }
  });
  return out;
};

TAC._deploy = function(bt, atkArmy, sideA, defArmy, sideB){
  function place(units, side){
    var rows = side==="A" ? [TAC.ROWS-3, TAC.ROWS-2, TAC.ROWS-1] : [2,1,0];
    /* 分桶：前排近战、两翼骑兵、后排远程 */
    var buckets = { front:[], cavL:[], cavR:[], back:[] };
    units.forEach(function(u){
      if(u.cls==="LR") buckets.back.push(u);
      else if(u.cls==="LC" || u.cls==="HC") (buckets.cavL.length <= buckets.cavR.length ? buckets.cavL : buckets.cavR).push(u);
      else buckets.front.push(u);
    });
    var occupied = {};
    bt.units.forEach(function(x){ occupied[x.col+","+x.row] = 1; });
    function freeCell(row, preferCol, spread){
      var order = [], c, d;
      for(d=0; d<TAC.COLS; d++){
        c = preferCol + (d%2? -Math.ceil(d/2) : Math.ceil(d/2))*spread;
        if(c>=0 && c<TAC.COLS && !occupied[c+","+row]) order.push(c);
      }
      return order.length? order[0] : null;
    }
    var mid = Math.floor(TAC.COLS/2);
    buckets.front.forEach(function(u, i){
      var row = rows[1], col = freeCell(row, mid, 1);
      if(col===null){ row = rows[0]; col = freeCell(row, mid, 1); }
      if(col!==null){ u.col=col; u.row=row; occupied[col+","+row]=1; bt.units.push(u); }
    });
    buckets.cavL.forEach(function(u, i){ var col = freeCell(rows[1], 1, 1); if(col!==null){ u.col=col; u.row=rows[1]; occupied[col+","+rows[1]]=1; bt.units.push(u);} });
    buckets.cavR.forEach(function(u, i){ var col = freeCell(rows[1], TAC.COLS-2, 1); if(col!==null){ u.col=col; u.row=rows[1]; occupied[col+","+rows[1]]=1; bt.units.push(u);} });
    buckets.back.forEach(function(u, i){ var col = freeCell(rows[2], mid, 1); if(col!==null){ u.col=col; u.row=rows[2]; occupied[col+","+rows[2]]=1; bt.units.push(u);} });
  }
  place(TAC._mkUnits(bt, atkArmy, sideA), sideA);
  place(TAC._mkUnits(bt, defArmy, sideB), sideB);
  bt.units.forEach(function(u){ u.n0 = 1; });
};

TAC.unitAt = function(bt, col, row){
  return bt.units.filter(function(u){ return u.alive && u.col===col && u.row===row; })[0] || null;
};
TAC.occMap = function(bt){
  var m = {};
  bt.units.forEach(function(u){ if(u.alive) m[u.col+","+u.row] = u; });
  return m;
};
TAC.gh = function(bt, col, row){ /* offset(col,row) 查找：必须传对象，元组会被当作 axial */
  return bt.grid.getHex({col:col, row:row});
};
TAC.dist = function(bt, a, b){ return bt.grid.distance(TAC.gh(bt,a.col,a.row), TAC.gh(bt,b.col,b.row)); };
TAC.neighborsOf = function(bt, u){
  var hex = TAC.gh(bt, u.col, u.row);
  if(!hex) return [];
  return [Honeycomb.Direction.NE, Honeycomb.Direction.N, Honeycomb.Direction.NW,
          Honeycomb.Direction.SW, Honeycomb.Direction.S, Honeycomb.Direction.SE]
    .map(function(d){ return bt.grid.neighborOf(hex, d, {allowOutside:false}); })
    .filter(Boolean)
    .map(function(h){ return { col: h.col, row: h.row }; });
};
TAC.terr = function(bt, u){ return TAC.TERR[bt.terrain[u.col+","+u.row]] || TAC.TERR.plain; };
TAC.enemies = function(bt, u){ return bt.units.filter(function(x){ return x.alive && x.side!==u.side; }); };
TAC.friends = function(bt, u){ return bt.units.filter(function(x){ return x.alive && x.side===u.side && x!==u; }); };
TAC.adjEnemies = function(bt, u){ return TAC.enemies(bt,u).filter(function(e){ return TAC.dist(bt,u,e)===1; }); };
TAC.mpFor = function(u){ return u.spd>=8? 3 : (u.spd>=6? 2 : 1); };

/* ---------- 移动：贪心逼近 ---------- */
TAC.stepToward = function(bt, u, target){
  var occ = TAC.occMap(bt);
  var opts = TAC.neighborsOf(bt, u).filter(function(c){ return !occ[c.col+","+c.row]; });
  if(!opts.length) return null;
  opts.sort(function(a,b){
    var da = bt.grid.distance(TAC.gh(bt,a.col,a.row), TAC.gh(bt,target.col,target.row));
    var db = bt.grid.distance(TAC.gh(bt,b.col,b.row), TAC.gh(bt,target.col,target.row));
    return da - db;
  });
  return opts[0];
};

/* ---------- 攻击 / 射击 ---------- */
TAC.meleeAttack = function(bt, u, t, charged, lines){
  var matx = DATA.MATX[u.cls][t.cls];
  var pw = u.atk * matx * u.n;
  if(charged && (u.cls==="HC"||u.cls==="LC"||u.cls==="EL")) pw += u.chg * u.n * 0.5;
  var lost = Math.max(0.03*t.n, Math.min(0.45*t.n, pw / (t.def * TAC.terr(bt,t).def * 2.0)));
  t.n = Math.max(0, t.n - lost);
  lines.push("  " + u.nm + " 突击 " + t.nm + "（" + u.cls + "→" + t.cls + " ×" + matx.toFixed(1) + "，" + TAC.terr(bt,t).nm + "）造成 " + lost.toFixed(2) + " 队伤亡");
  /* 反击 */
  if(t.n > 0.05){
    var cw = t.atk * DATA.MATX[t.cls][u.cls] * t.n * 0.5;
    var clost = Math.max(0.02*u.n, Math.min(0.3*u.n, cw / (u.def * TAC.terr(bt,u).def * 2.0)));
    u.n = Math.max(0, u.n - clost);
    if(clost > 0.02) lines.push("    ↳ " + t.nm + " 反击，" + u.nm + " 损失 " + clost.toFixed(2));
  }
  if(t.n <= 0.05){ t.alive = false; lines.push("    ✝ " + t.nm + " 全灭"); }
  if(u.n <= 0.05){ u.alive = false; }
};
TAC.rangedFire = function(bt, u, lines){
  var range = DATA.LR_RANGE;
  var targets = TAC.enemies(bt, u).filter(function(e){ return TAC.dist(bt,u,e) <= range; });
  if(!targets.length) return;
  targets.sort(function(a,b){
    var ea = a.cls==="EL"? -1 : TAC.dist(bt,u,a), eb = b.cls==="EL"? -1 : TAC.dist(bt,u,b);
    return ea - eb || b.n - a.n;
  });
  var t = targets[0];
  var dmg = u.mis * u.n * DATA.MATX[u.cls][t.cls] * (16/(8+t.armor));
  /* 火力遮蔽：目标旁有己方近战 → 概率误伤 */
  var screens = TAC.friends(bt, u).filter(function(f){ return f.cls!=="LR" && TAC.dist(bt,f,t)===1; });
  if(screens.length && G.rand() < DATA.FF_CHANCE){
    var f = screens[Math.floor(G.rand()*screens.length)];
    var flost = Math.max(0.02, Math.min(0.3*f.n, dmg / (f.def*2.0)));
    f.n = Math.max(0, f.n - flost);
    if(f.n <= 0.05) f.alive = false;
    lines.push("  ☠ 误伤！" + u.nm + " 越过己方战线射击 " + t.nm + "，命中友军 " + f.nm + "（-" + flost.toFixed(2) + "）");
  } else {
    var lost = Math.max(0.02, Math.min(0.35*t.n, dmg / (t.def * TAC.terr(bt,t).def * 2.2)));
    t.n = Math.max(0, t.n - lost);
    if(t.n <= 0.05){ t.alive = false; lines.push("  ✝ " + t.nm + " 被远程射溃"); }
    else lines.push("  " + u.nm + " 射击 " + t.nm + "（射程" + range + "内，距离" + TAC.dist(bt,u,t) + "）-" + lost.toFixed(2));
  }
};

/* ---------- 一轮 ---------- */
TAC.step = function(bt){
  if(bt.over) return bt;
  bt.round++;
  var lines = ["—— 第 " + bt.round + " 轮 ——"];
  bt.units.forEach(function(u){ u.moved = 0; });
  var order = bt.units.filter(function(u){ return u.alive; });
  var rank = { HC:0, LC:1, EL:2, LI:3, HI:4, LV:5, LR:6 };
  order.sort(function(a,b){ return rank[a.cls] - rank[b.cls] || (a.side==="A"? -1 : 1); });
  order.forEach(function(u){
    if(!u.alive) return;
    var tactic = bt.tactics[u.side];
    if(u.cls==="LR"){ TAC.rangedFire(bt, u, lines); return; }
    var adj = TAC.adjEnemies(bt, u);
    if(adj.length){
      adj.sort(function(a,b){ return (b.n) - (a.n); });
      TAC.meleeAttack(bt, u, adj[0], u.moved>0, lines);
      return;
    }
    if(tactic === "hold") return; /* 就地防御：不主动接敌 */
    /* 自动接近 */
    var steps = TAC.mpFor(u);
    var enemies = TAC.enemies(bt, u);
    if(!enemies.length) return;
    for(var s=0; s<steps; s++){
      adj = TAC.adjEnemies(bt, u);
      if(adj.length) break;
      enemies = TAC.enemies(bt, u);
      enemies.sort(function(a,b){ return TAC.dist(bt,u,a) - TAC.dist(bt,u,b); });
      var next = TAC.stepToward(bt, u, enemies[0]);
      if(!next) break;
      u.col = next.col; u.row = next.row; u.moved++;
    }
    adj = TAC.adjEnemies(bt, u);
    if(adj.length){
      adj.sort(function(a,b){ return (b.n) - (a.n); });
      TAC.meleeAttack(bt, u, adj[0], u.moved>0, lines);
    }
  });
  /* 士气检查 */
  ["A","B"].forEach(function(side){
    var alive = bt.units.filter(function(u){ return u.alive && u.side===side; });
    if(!alive.length) return;
    var pool = alive.reduce(function(s,u){ return s + u.n*u.mor*(u.cls==="LV"?0.6:1); },0);
    var init = bt.units.filter(function(u){ return u.side===side; }).reduce(function(s,u){ return s + u.n0*u.mor*(u.cls==="LV"?0.6:1); },0);
    if(pool < init*0.38){
      bt.over = true;
      bt.winner = side==="A"? "B" : "A";
      lines.push("★ " + (side==="A"?"攻方":"守方") + "士气崩溃！战斗结束。");
    }
  });
  var aliveA = bt.units.some(function(u){ return u.alive && u.side==="A"; });
  var aliveB = bt.units.some(function(u){ return u.alive && u.side==="B"; });
  if(!aliveA && !aliveB){ bt.over = true; bt.winner = null; lines.push("两败俱伤！"); }
  else if(!aliveB){ bt.over = true; bt.winner = "A"; lines.push("守方全灭！"); }
  else if(!aliveA){ bt.over = true; bt.winner = "B"; lines.push("攻方全灭！"); }
  else if(bt.round >= 8){
    bt.over = true;
    var strA = bt.units.filter(function(u){return u.alive&&u.side==="A";}).reduce(function(s,u){ return s+u.n*(u.atk+u.def)/2; },0);
    var strB = bt.units.filter(function(u){return u.alive&&u.side==="B";}).reduce(function(s,u){ return s+u.n*(u.atk+u.def)/2; },0);
    bt.winner = strA > strB*1.1 ? "A" : (strB > strA*1.1 ? "B" : null);
    lines.push(bt.winner ? ("8 轮鏖战，" + (bt.winner==="A"?"攻方":"守方") + "占据战场。") : "8 轮鏖战，不分胜负，攻方退兵。");
  }
  bt.log = bt.log.concat(lines);
  return bt;
};
TAC.runAuto = function(bt, maxRounds){
  maxRounds = maxRounds || 8;
  while(!bt.over && bt.round < maxRounds) TAC.step(bt);
  if(!bt.over){ bt.over = true; bt.winner = null; bt.log.push("战斗超时，不分胜负。"); }
  return bt;
};
TAC.survivors = function(bt, side){
  var byKey = {};
  bt.units.forEach(function(u){
    if(u.side!==side || !u.alive || u.n<=0.05) return;
    var k = u.uid + (u.aux?"|a":"");
    byKey[k] = (byKey[k]||0) + u.n;
  });
  return Object.keys(byKey).map(function(k){
    var p = k.split("|");
    return { u:p[0], n:Math.round(byKey[k]), aux:p[1]?1:0 };
  }).filter(function(x){ return x.n>0; });
};

/* ---------- 渲染 ---------- */
/* highlight.view = {ox,oy,scale} 世界坐标→画布变换（拖拽平移/滚轮缩放） */
TAC.draw = function(bt, cv, highlight){
  var ctx = cv.getContext("2d");
  var M = TAC.MARGIN;
  var v = (highlight && highlight.view) || {ox:0, oy:0, scale:1};
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.fillStyle = "#b8d2e4"; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(v.scale,0,0,v.scale,v.ox,v.oy);
  bt.grid.forEach(function(h){
    var cx = h.x + M, cy = h.y + M;
    var t = TAC.TERR[bt.terrain[h.toString()]];
    ctx.beginPath();
    h.corners.forEach(function(c,i){ i? ctx.lineTo(cx+c.x, cy+c.y) : ctx.moveTo(cx+c.x, cy+c.y); });
    ctx.closePath();
    ctx.fillStyle = t.fill; ctx.fill();
    ctx.strokeStyle = "#9a917a"; ctx.lineWidth = 0.5; ctx.stroke();
  });
  /* 部署区提示 */
  if(highlight && highlight.deployZone){
    ctx.strokeStyle = "#0f6e56"; ctx.lineWidth = 1.5;
    [0,1,2,TAC.ROWS-3,TAC.ROWS-2,TAC.ROWS-1].forEach(function(r){
      var h = TAC.gh(bt, 7, r);
      if(h){ ctx.beginPath(); h.corners.forEach(function(c,i){ i? ctx.lineTo(h.x+M+c.x, h.y+M+c.y) : ctx.moveTo(h.x+M+c.x, h.y+M+c.y); }); ctx.closePath(); ctx.stroke(); }
    });
  }
  if(highlight && highlight.sel){
    var sh = TAC.gh(bt, highlight.sel.col, highlight.sel.row);
    if(sh){ ctx.strokeStyle = "#a32d2d"; ctx.lineWidth = 2.5;
      ctx.beginPath(); sh.corners.forEach(function(c,i){ i? ctx.lineTo(sh.x+M+c.x, sh.y+M+c.y) : ctx.moveTo(sh.x+M+c.x, sh.y+M+c.y); }); ctx.closePath(); ctx.stroke(); }
  }
  if(highlight && highlight.ghost){
    var gh = TAC.gh(bt, highlight.ghost.col, highlight.ghost.row);
    if(gh){ ctx.strokeStyle = "#0f6e56"; ctx.setLineDash([4,3]); ctx.lineWidth = 2;
      ctx.beginPath(); gh.corners.forEach(function(c,i){ i? ctx.lineTo(gh.x+M+c.x, gh.y+M+c.y) : ctx.moveTo(gh.x+M+c.x, gh.y+M+c.y); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); }
  }
  /* 单位棋子 */
  bt.units.forEach(function(u){
    if(!u.alive) return;
    var h = TAC.gh(bt, u.col, u.row);
    if(!h) return;
    var cx = h.x + M, cy = h.y + M;
    var fac = u.side==="A"? (highlight.atkFac||"#a32d2d") : (highlight.defFac||"#534ab7");
    ctx.beginPath(); ctx.arc(cx, cy, 17, 0, 7);
    ctx.fillStyle = "#faf7ee"; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = fac; ctx.stroke();
    ctx.fillStyle = fac; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(TAC.GLYPH[u.cls] || u.cls, cx, cy - 1);
    ctx.fillStyle = "#2c2c2a"; ctx.font = "9px sans-serif";
    ctx.fillText(u.nm.length>6? u.nm.slice(0,5)+"…" : u.nm, cx, cy + 11);
  });
  /* 战线中轴 */
  var midY = M + TAC.HEX.height*0.75*(TAC.ROWS-1)/2 + 10;
  ctx.strokeStyle = "rgba(80,19,19,0.35)"; ctx.setLineDash([5,4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-500, midY); ctx.lineTo(TAC.COLS*TAC.HEX.width + 500, midY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.setTransform(1,0,0,1,0,0);
};
TAC.hexAtPx = function(bt, mx, my, view){
  var v = view || {ox:0, oy:0, scale:1};
  var wx = (mx - v.ox)/v.scale, wy = (my - v.oy)/v.scale;
  var h = bt.grid.pointToHex({ x: wx - TAC.MARGIN, y: wy - TAC.MARGIN });
  if(!h) return null;
  var g = TAC.gh(bt, h.col, h.row); /* 网格外 getHex 返回 undefined */
  return g || null;
};
