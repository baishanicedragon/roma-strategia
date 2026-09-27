/* ===== 罗马战略 · UI层（军团版） ===== */
var UI = { sel:null, moveMode:false, tac:null };

UI.proj = function(lon, lat){
  var m = DATA.MAP;
  return { x: (lon - m.lonMin)/(m.lonMax - m.lonMin)*m.w, y: (m.latMax - lat)/(m.latMax - m.latMin)*m.h };
};

UI.drawMap = function(){
  var cv = document.getElementById("map"), ctx = cv.getContext("2d");
  ctx.clearRect(0,0,DATA.MAP.w,DATA.MAP.h);
  ctx.fillStyle = "#b8d2e4"; ctx.fillRect(0,0,DATA.MAP.w,DATA.MAP.h);
  ctx.fillStyle = "#ece3cd"; ctx.strokeStyle = "#8f8464"; ctx.lineWidth = 1;
  DATA.land.forEach(function(poly){
    ctx.beginPath();
    poly.forEach(function(pt,i){ var q = UI.proj(pt[0],pt[1]); i? ctx.lineTo(q.x,q.y) : ctx.moveTo(q.x,q.y); });
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle = "#5a7d99"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
  DATA.seaLabels.forEach(function(s){ var q = UI.proj(s.lon,s.lat); ctx.fillText(s.t, q.x, q.y); });
  var selLeg = UI.sel && UI.sel.type==="legion" ? G.legion(UI.sel.id) : null;
  if(selLeg){
    G.neighbors(selLeg.pid).forEach(function(n){
      var a = UI.pq(selLeg.pid), b = UI.pq(n.p);
      ctx.strokeStyle = n.s? "#4a7fa5" : "#9a9480";
      ctx.setLineDash(n.s? [6,4] : [3,3]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  Object.keys(DATA.provinces).forEach(function(pid){
    var p = DATA.provinces[pid], q = UI.proj(p.lon, p.lat), st = G.state.provs[pid];
    ctx.beginPath(); ctx.arc(q.x, q.y, 6.5, 0, 7);
    ctx.fillStyle = G.facColor(st.owner); ctx.fill();
    ctx.lineWidth = (UI.sel && UI.sel.type==="prov" && UI.sel.id===pid)? 3 : 1.2;
    ctx.strokeStyle = "#2c2c2a"; ctx.stroke();
    ctx.fillStyle = "#2c2c2a"; ctx.font = "11px sans-serif";
    ctx.fillText(p.nm, q.x, q.y + 17);
    if(DATA.factions[st.owner] && DATA.factions[st.owner].cap === pid) ctx.fillText("★", q.x, q.y - 10);
  });
  G.state.legions.forEach(function(l){
    var p = DATA.provinces[l.pid], q = UI.proj(p.lon, p.lat);
    var sameIdx = G.legionsAt(l.pid).filter(function(x){ return x.fac===l.fac; }).indexOf(l);
    var bx = q.x + 14, by = q.y - 8 + sameIdx*18;
    var isSel = UI.sel && UI.sel.type==="legion" && UI.sel.id===l.id;
    ctx.fillStyle = "#faf7ee"; ctx.strokeStyle = G.facColor(l.fac);
    ctx.lineWidth = isSel? 3 : 1.5;
    if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(bx, by, 40, 15, 3); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(bx,by,40,15); ctx.strokeRect(bx,by,40,15); }
    ctx.fillStyle = "#2c2c2a"; ctx.font = "9px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(l.no.slice(0,6), bx+2, by+11);
    ctx.textAlign = "center";
    l._marker = {x: bx+20, y: by+7};
  });
};
UI.pq = function(pid){ var p = DATA.provinces[pid]; return UI.proj(p.lon, p.lat); };

UI.onMapClick = function(ev){
  var cv = document.getElementById("map"), r = cv.getBoundingClientRect();
  var mx = (ev.clientX - r.left) * (cv.width/r.width), my = (ev.clientY - r.top) * (cv.height/r.height);
  var hitL = null, hd = 15*15;
  G.state.legions.forEach(function(l){
    if(!l._marker) return;
    var d = (l._marker.x-mx)*(l._marker.x-mx) + (l._marker.y-my)*(l._marker.y-my);
    if(d < hd){ hd = d; hitL = l; }
  });
  var selLeg = UI.sel && UI.sel.type==="legion" ? G.legion(UI.sel.id) : null;
  if(UI.moveMode && selLeg){
    var best = UI.nearestProv(mx, my);
    if(best && best !== selLeg.pid){
      UI.moveMode = false;
      UI.doLegionMove(selLeg, best);
      return;
    }
    if(best === selLeg.pid){ UI.moveMode = false; UI.refresh(); UI.drawMap(); return; }
  }
  if(hitL){ UI.sel = {type:"legion", id:hitL.id}; UI.refresh(); UI.drawMap(); return; }
  var best = UI.nearestProv(mx, my);
  if(best){ UI.sel = {type:"prov", id:best}; UI.refresh(); UI.drawMap(); }
};
UI.nearestProv = function(mx, my){
  var best = null, bd = 1e9;
  Object.keys(DATA.provinces).forEach(function(pid){
    var q = UI.pq(pid), d = (q.x-mx)*(q.x-mx)+(q.y-my)*(q.y-my);
    if(d < bd){ bd = d; best = pid; }
  });
  return bd <= 26*26? best : null;
};
UI.doLegionMove = function(l, to){
  var res = G.moveLegion(l.id, to);
  if(typeof res === "string"){ UI.modal(res); }
  else if(res && res.battle){
    UI.openTac(res);
  }
  UI.sel = {type:"legion", id:l.id};
  UI.refresh(); UI.drawMap();
};

/* ---------- 侧栏 ---------- */
UI.renderPanel = function(){
  var el = document.getElementById("panel");
  if(!UI.sel){ el.innerHTML = "<h3>选择行省或军团</h3><div class='dim'>盾牌=军团（点选后可移动/进攻）。<br>每个行省有自己的钱库和粮库；军团自带钱粮随军，敌境行军只能吃自带的，断粮会减员。</div>"; return; }
  if(UI.sel.type === "legion"){
    var l = G.legion(UI.sel.id);
    if(!l){ UI.sel = null; el.innerHTML = "<div class='dim'>该军团已不存在。</div>"; return; }
    var p = DATA.provinces[l.pid];
    var kd = DATA.LEGION_KIND[l.kind || "border"];
    var fd = DATA.factions[l.fac];
    var capDist = fd && fd.cap ? G.pathDistTo(l.pid, fd.cap) : 99;
    var h = "<h3>⚑ " + l.no + "</h3>";
    h += "<div class='prow'>" + fd.nm + " · 驻 <b>" + p.nm + "</b> · 距首都 " + capDist + " 格</div>";
    h += "<div class='prow'>身份：<b>" + kd.nm + "</b> <span class='dim'>" + kd.desc + "</span></div>";
    if(l.gen) h += "<div class='prow'>将领：<b>" + DATA.generals[l.gen].nm + "</b> <span class='dim'>" + DATA.generals[l.gen].desc + "</span></div>";
    var supply = G.state.provs[l.pid].owner === l.fac ? "就地/中央补给中" : "敌境：吃随军粮+战利品充饷";
    h += "<div class='prow'>随军战利品 <b>" + Math.floor(l.chest) + "</b> 金 / 随军粮 <b>" + Math.floor(l.grain) + "</b>（上限 " + DATA.CHEST_CAP + "/" + DATA.GRAIN_CAP + "）· " + supply;
    h += "<span class='dim'>（军饷由全国省库摊派）</span></div>";
    if(l.starve > 0) h += " · <span style='color:#a32d2d'>断粮减员中！</span>";
    if(l.owe > 0) h += " · <span style='color:#854f0b'>欠饷</span>";
    h += "</div>";
    h += "<div class='prow dim'>战力 " + Math.round(G.legionStr(l)) + " · 编成 " + l.units.length + "/" + DATA.LEGION_MAX + " 队</div>";
    h += "<div class='armyrow'>" + (l.units.map(function(u){
      return DATA.units[u.u].nm + (u.aux?"(辅)":"") + "×" + Math.round(u.n);
    }).join("，") || "（空）") + "</div>";
    h += "<div class='btnlist'>";
    if(l.fac === G.state.player){
      h += UI.moveMode
        ? "<span class='movehint'>移动模式：点击相邻行省（虚线=陆地，蓝虚线=海运，冬季封航）。</span><button onclick=\"UI.cancelMove()\">取消</button>"
        : "<button onclick=\"UI.startMove()\">▶ 移动 / 进攻</button>";
      h += "<button onclick=\"UI.askRename('" + l.id + "')\">更名</button>";
    }
    h += "</div><div class='prow dim'>战斗采用六边形战术地图（布阵→选战术→自动推演），AI 互战自动结算。</div>";
    el.innerHTML = h;
    return;
  }
  var pid = UI.sel.id, p = DATA.provinces[pid], st = G.state.provs[pid];
  var fd = DATA.factions[st.owner];
  var h = "<h3>" + p.nm + "</h3>";
  h += "<div class='prow'><b>" + (fd? fd.nm : st.owner) + "</b> · " + p.ter + (p.port? " · 海港":"") + " · 文化 " + p.cul + "</div>";
  h += "<div class='prow'>本省金库 <b>" + Math.floor(st.chest) + "</b> 金 · 粮库 <b>" + Math.floor(st.granary) + "</b> 粮</div>";
  h += "<div class='prow dim'>税基 " + G.provTax(pid).toFixed(1) + " · 贸易 " + G.provTrade(pid).toFixed(1) + " · 忠诚 " + Math.round(st.loyalty) + "/100 · 人力 " + Math.round(st.mpPool) + "</div>";
  var specTxt = Object.keys(p.spec).map(function(r){ return DATA.specName[r] + "×" + p.spec[r] + "(价值" + (p.spec[r]*G.scarcityVal(r)).toFixed(1) + ")"; }).join("，");
  h += "<div class='prow dim'>特产：" + (specTxt || "无") + "</div>";
  var bl = st.bld.map(function(b){ return DATA.buildings[b].nm; }).join("、") || "无";
  h += "<div class='prow'>建筑：" + bl + (st.bqueue.length? "（建造中：" + DATA.buildings[st.bqueue[0].b].nm + " 余" + st.bqueue[0].t + "回合）" : "") + "</div>";
  var legs = G.legionsAt(pid);
  if(legs.length){
    h += "<div class='prow'><b>驻军：</b>" + legs.map(function(l){
      return "<span style='cursor:pointer' onclick=\"UI.sel={type:'legion',id:'" + l.id + "'};UI.refresh();UI.drawMap()\">⚑" + l.no + "(" + Math.round(G.legionStr(l)) + ")</span>";
    }).join(" ") + "</div>";
  } else if(st.owner !== "REBEL"){
    h += "<div class='prow dim'>无驻军（敌军可直接占领并掳掠一半钱粮）</div>";
  }
    if(st.owner === G.state.player){
      if(st.remote) h += "<div class='prow' style='color:#854f0b'>边远/低忠诚：不上缴，全额留省（适合养边军）</div>";
      else h += "<div class='prow dim'>上缴 " + Math.round(DATA.TRANSIT.taxRate*100) + "%：在途 " + Math.floor(st.transitGold||0) + " 金/季（距首都 " + (st.transitDist||0) + " 格，损耗 " + Math.round((st.transitLoss||0)*100) + "%，下季到国库）</div>";
      h += "<div class='prow'><b>招募</b>（本省金库付款；中央军：公民兵×1.0/佣兵×1.5；边军：公民兵×1.8/佣兵×0.8；当地辅兵士气-20%）</div><div class='btnlist'>";
    Object.keys(DATA.units).forEach(function(uid){
      var u = DATA.units[uid], ok = G.canRecruit(pid, uid);
      h += "<button title='" + u.nm + " " + u.cost + "金\\n" + u.desc + "' " + (ok===true? "":"disabled") + " onclick=\"UI.doRecruit('" + pid + "','" + uid + "')\">" + u.nm + (u.cls==="LR"?"[远]":u.cls==="LI"?"[轻]":u.cls==="HI"?"[重]":u.cls==="LC"?"[轻骑]":u.cls==="HC"?"[重骑]":u.cls==="EL"?"[象]":"[征]") + "</button>";
    });
    h += "</div><div class='prow'><b>建造</b></div><div class='btnlist'>";
    Object.keys(DATA.buildings).forEach(function(bid){
      var b = DATA.buildings[bid], built = st.bld.indexOf(bid)>=0;
      h += "<button " + (built||st.bqueue.length? "disabled":"") + " title='" + b.desc + "' onclick=\"UI.doBuild('" + pid + "','" + bid + "')\">" + b.nm + (built?"✓":"") + "</button>";
    });
    h += "</div>";
  }
  el.innerHTML = h;
};
UI.doRecruit = function(pid, uid){
  var r = G.recruit(pid, uid, 1);
  if(r!==true) UI.modal("招募失败：" + r);
  UI.refresh();
};
UI.doBuild = function(pid, bid){
  var r = G.startBuild(pid, bid);
  if(r!==true) UI.modal("建造失败：" + r);
  UI.refresh();
};
UI.askRename = function(lid){
  var l = G.legion(lid);
  var no = window.prompt ? window.prompt("新番号（≤12字）：", l.no) : null;
  if(no) G.renameLegion(lid, no.trim());
  UI.refresh(); UI.drawMap();
};
UI.startMove = function(){ UI.moveMode = true; UI.refresh(); UI.drawMap(); };
UI.cancelMove = function(){ UI.moveMode = false; UI.refresh(); UI.drawMap(); };

/* ---------- 战术弹窗 ---------- */
UI.openTac = function(info){
  var atkL = info.atkLegion;
  var defUnits = [];
  info.defenders.forEach(function(d){ defUnits = defUnits.concat(d.units); });
  var defGens = info.defenders.filter(function(d){ return d.gen; });
  var defArmy = { gen: defGens.length? defGens[0].gen : null, units: defUnits };
  var atkArmy = { gen: atkL.gen, units: atkL.units };
  var playerIsAtk = atkL.fac === G.state.player;
  UI.tac = { info: info, bt: TAC.newBattle(atkArmy, defArmy, 218 + G.state.turn, {A:"advance", B:"hold"}),
    playerSide: playerIsAtk? "A" : "B", selUnit: null, timer: null, phase: "deploy",
    view: {ox:0, oy:0, scale:1}, drag: null, _logIdx: 0 };
  document.getElementById("tac-title").textContent =
    DATA.provinces[info.to].nm + " 会战：" + atkL.no + " vs " + info.defenders.map(function(d){return d.no;}).join("+");
  document.getElementById("tac-close").classList.add("hidden");
  document.getElementById("tac-start").classList.remove("hidden");
  document.getElementById("tac-auto").classList.remove("hidden");
  document.getElementById("tac-start").disabled = false;
  document.getElementById("tac-auto").disabled = false;
  UI.tacLogClear();
  UI.tac.bt.log.forEach(function(l){ UI.tacLog(l); });
  UI.tacCtrl();
  document.getElementById("tac").classList.remove("hidden");
  UI.drawTac();
};
UI.tacLog = function(t){
  var el = document.getElementById("tac-log");
  var d = document.createElement("div");
  d.textContent = t;
  el.appendChild(d); el.scrollTop = el.scrollHeight;
};
UI.tacLogClear = function(){ document.getElementById("tac-log").innerHTML = ""; };
UI.tacCtrl = function(){
  var el = document.getElementById("tac-ctrl");
  if(!UI.tac){ el.innerHTML = ""; return; }
  if(UI.tac.phase === "deploy"){
    el.innerHTML = "<div class='prow'><b>布阵</b>：点击己方单位 → 点击己方 3 行内的空格调整。</div>" +
      "<div class='prow'>战术：<label><input type='radio' name='tactic' value='advance' " + (UI.tac.bt.tactics[UI.tac.playerSide]==="advance"?"checked":"") + " onchange=\"UI.setTactic('advance')\"> 自动接近</label> " +
      "<label><input type='radio' name='tactic' value='hold' " + (UI.tac.bt.tactics[UI.tac.playerSide]==="hold"?"checked":"") + " onchange=\"UI.setTactic('hold')\"> 就地防御</label></div>" +
      "<div class='prow dim'>布阵可直接<b>拖动单位</b>；滚轮缩放，拖空白处平移地图。</div>" +
      "<div class='prow dim'>远程射程 " + DATA.LR_RANGE + " 格；越过己方近战开火有 " + Math.round(DATA.FF_CHANCE*100) + "% 概率误伤友军。骑兵/战象移动后接敌触发冲击加成。</div>";
  } else if(UI.tac.phase === "running"){
    el.innerHTML = "<div class='prow'>第 " + UI.tac.bt.round + " 轮推演中…</div>";
  } else {
    el.innerHTML = "<div class='prow'><b>战斗结束：" + (UI.tac.bt.winner==="A"?"攻方胜":UI.tac.bt.winner==="B"?"守方胜":"不分胜负") + "</b></div>" +
      "<div class='prow dim'>伤亡已按比例写回军团。</div>";
  }
};
UI.setTactic = function(t){ if(UI.tac) UI.tac.bt.tactics[UI.tac.playerSide] = t; };
UI.tacPos = function(ev){
  var cv = document.getElementById("tacmap"), r = cv.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (cv.width/r.width), y: (ev.clientY - r.top) * (cv.height/r.height) };
};
UI.tacCell = function(pt){
  var hex = TAC.hexAtPx(UI.tac.bt, pt.x, pt.y, UI.tac.view);
  return hex ? {col:hex.col, row:hex.row} : null;
};
UI.tacZone = function(){
  return UI.tac.playerSide==="A" ? [TAC.ROWS-3, TAC.ROWS-2, TAC.ROWS-1] : [0,1,2];
};
UI.tacTryPlace = function(u, cell){
  if(!u || !cell) return false;
  if(UI.tacZone().indexOf(cell.row) < 0) return false;
  var occ = TAC.unitAt(UI.tac.bt, cell.col, cell.row);
  if(occ && occ !== u) return false; /* 已被占用（含友军），不换位 */
  u.col = cell.col; u.row = cell.row;
  return true;
};
UI.drawTac = function(){
  if(!UI.tac) return;
  var cv = document.getElementById("tacmap");
  var dragging = UI.tac.drag && UI.tac.drag.type==="unit";
  TAC.draw(UI.tac.bt, cv, {
    view: UI.tac.view,
    deployZone: UI.tac.phase === "deploy",
    sel: UI.tac.selUnit? {col: UI.tac.selUnit.col, row: UI.tac.selUnit.row} : null,
    ghost: (dragging && UI.tac.drag.ghost)? UI.tac.drag.ghost : null,
    atkFac: G.facColor(UI.tac.info.atkLegion.fac),
    defFac: G.facColor(UI.tac.info.defenders[0].fac)
  });
};
/* --- 拖拽：按住己方单位拖动布阵；按住空白拖动平移地图；滚轮缩放 --- */
UI.onTacDown = function(ev){
  if(!UI.tac || ev.button !== 0) return;
  var pt = UI.tacPos(ev);
  var cell = UI.tacCell(pt);
  var hit = cell ? TAC.unitAt(UI.tac.bt, cell.col, cell.row) : null;
  if(UI.tac.phase === "deploy" && hit && hit.side === UI.tac.playerSide){
    UI.tac.selUnit = hit;
    UI.tac.drag = { type:"unit", unit: hit, sx:pt.x, sy:pt.y, moved:false, ghost:null };
  } else {
    UI.tac.drag = { type:"pan", sx:pt.x, sy:pt.y, ox0:UI.tac.view.ox, oy0:UI.tac.view.oy, moved:false };
  }
  ev.preventDefault();
};
UI.onTacMove = function(ev){
  if(!UI.tac || !UI.tac.drag) return;
  var pt = UI.tacPos(ev), d = UI.tac.drag;
  if(d.type === "pan"){
    if(Math.abs(pt.x-d.sx) + Math.abs(pt.y-d.sy) > 4) d.moved = true;
    if(d.moved){ UI.tac.view.ox = d.ox0 + (pt.x-d.sx); UI.tac.view.oy = d.oy0 + (pt.y-d.sy); UI.drawTac(); }
  } else {
    if(Math.abs(pt.x-d.sx) + Math.abs(pt.y-d.sy) > 4) d.moved = true;
    d.ghost = UI.tacCell(pt);
    UI.drawTac();
  }
};
UI.onTacUp = function(ev){
  if(!UI.tac || !UI.tac.drag) return;
  var d = UI.tac.drag;
  UI.tac.drag = null;
  var pt = UI.tacPos(ev);
  if(d.type === "pan"){
    if(!d.moved) UI.onTacClick(ev); /* 未拖动 = 点击 */
    else UI.drawTac();
    return;
  }
  if(d.moved){
    UI.tacTryPlace(d.unit, UI.tacCell(pt));
    UI.tac.selUnit = null;
  }
  UI.drawTac();
};
UI.onTacWheel = function(ev){
  if(!UI.tac) return;
  ev.preventDefault();
  var v = UI.tac.view, pt = UI.tacPos(ev);
  var ns = Math.max(0.55, Math.min(1.8, v.scale * (ev.deltaY < 0 ? 1.12 : 0.89)));
  if(ns === v.scale) return;
  v.ox = pt.x - (pt.x - v.ox) * ns / v.scale;
  v.oy = pt.y - (pt.y - v.oy) * ns / v.scale;
  v.scale = ns;
  UI.drawTac();
};
UI.onTacClick = function(ev){
  if(!UI.tac || UI.tac.phase !== "deploy") return;
  var cell = UI.tacCell(UI.tacPos(ev));
  if(!cell){ UI.tac.selUnit = null; UI.drawTac(); return; }
  var u = TAC.unitAt(UI.tac.bt, cell.col, cell.row);
  if(UI.tac.selUnit && !u){
    if(UI.tacTryPlace(UI.tac.selUnit, cell)) UI.tac.selUnit = null;
  } else if(u && u.side === UI.tac.playerSide){
    UI.tac.selUnit = (UI.tac.selUnit === u) ? null : u;
  } else {
    UI.tac.selUnit = null;
  }
  UI.drawTac();
};
UI.tacStart = function(){
  if(!UI.tac || UI.tac.phase !== "deploy") return;
  UI.tac.phase = "running";
  UI.tac.selUnit = null;
  UI.tac._logIdx = UI.tac.bt.log.length;
  UI.tacCtrl();
  document.getElementById("tac-start").disabled = true;
  document.getElementById("tac-auto").disabled = true;
  UI.tac.timer = setInterval(function(){
    if(!UI.tac){ clearInterval(UI.tac.timer); return; }
    try{
      TAC.step(UI.tac.bt);
      /* 双保险：推演超限强制终止，绝不让计时器空转 */
      if(!UI.tac.bt.over && UI.tac.bt.round >= 12){
        UI.tac.bt.over = true; UI.tac.bt.winner = null;
        UI.tac.bt.log.push("推演超时，强制终止。");
      }
    }catch(e){
      UI.tac.bt.over = true; UI.tac.bt.winner = UI.tac.bt.winner || null;
      UI.tac.bt.log.push("推演异常终止：" + e.message);
    }
    for(var i=UI.tac._logIdx; i<UI.tac.bt.log.length; i++) UI.tacLog(UI.tac.bt.log[i]);
    UI.tac._logIdx = UI.tac.bt.log.length;
    UI.tacCtrl();
    UI.drawTac();
    if(UI.tac.bt.over){
      clearInterval(UI.tac.timer); UI.tac.timer = null;
      /* 先亮出关闭按钮再结算，结算出错也不会把玩家锁死在弹窗里 */
      document.getElementById("tac-close").classList.remove("hidden");
      try{ UI.tacFinish(); }catch(e){ UI.tacLog("结算异常：" + e.message); UI.tac.phase = "done"; UI.tacCtrl(); }
    }
  }, 900);
};
UI.tacAuto = function(){
  if(!UI.tac || UI.tac.phase !== "deploy") return;
  UI.tac.phase = "running";
  UI.tacCtrl();
  document.getElementById("tac-start").disabled = true;
  document.getElementById("tac-auto").disabled = true;
  var info = UI.tac.info;
  UI.tacLog("—— 自动结算（战略快算）——");
  var res = G.quickBattle(info.atkLegion, info.to, info.defenders);
  res.lines.forEach(function(l){ UI.tacLog(l); });
  UI.tac.phase = "done";
  UI.tacCtrl();
  document.getElementById("tac-close").classList.remove("hidden");
  UI.drawMap();
};
UI.tacFinish = function(){
  var bt = UI.tac.bt, info = UI.tac.info;
  var surA = TAC.survivors(bt, "A"), surB = TAC.survivors(bt, "B");
  try{
    if(bt.winner === null){
      info.atkLegion.units = surA;
      var byUid = {};
      surB.forEach(function(u){ var k=u.u+(u.aux?"|a":""); byUid[k]=(byUid[k]||0)+u.n; });
      var total0 = info.defenders.reduce(function(s,d){ return s + Math.max(0.0001, G.legionCount(d)); },0);
      info.defenders.forEach(function(d){
        var share = Math.max(0.0001, G.legionCount(d)/total0);
        d.units = Object.keys(byUid).map(function(k){
          var p = k.split("|");
          return {u:p[0], n:Math.round(byUid[k]*share), aux:p[1]?1:0};
        }).filter(function(x){ return x.n>0; });
      });
      G.log("⚔ " + DATA.provinces[info.to].nm + " 会战不分胜负，攻方退兵。", "war");
    } else {
      G.applyBattle(info.atkLegion, info.to, info.defenders, bt.winner === "A", surA, surB);
    }
  }catch(e){
    G.log("战斗结算异常：" + e.message, "war");
  }
  UI.tac.phase = "done";
  UI.tacCtrl();
  document.getElementById("tac-close").classList.remove("hidden");
  UI.drawMap();
};
UI.tacClose = function(){
  if(UI.tac && UI.tac.timer){
    clearInterval(UI.tac.timer); UI.tac.timer = null;
    /* 推演中直接关闭 = 立即打完剩余轮次并结算，战斗结果不会凭空消失 */
    if(UI.tac.phase === "running" && !UI.tac.bt.over){
      try{
        TAC.runAuto(UI.tac.bt, 12);
        for(var i=UI.tac._logIdx||0; i<UI.tac.bt.log.length; i++) UI.tacLog(UI.tac.bt.log[i]);
        UI.tacFinish();
      }catch(e){ G.log("战斗结算异常：" + e.message, "war"); }
    }
  }
  UI.tac = null;
  document.getElementById("tac").classList.add("hidden");
  UI.refresh(); UI.drawMap();
};

/* ---------- 日志 / 刷新 ---------- */
G.log = function(msg, cls){
  if(!G.state) return;
  G.state.log.push({t:msg, c:cls||""});
  var el = document.getElementById("log");
  var d = document.createElement("div");
  if(cls) d.className = cls;
  d.textContent = msg;
  el.appendChild(d); el.scrollTop = el.scrollHeight;
};
UI.modal = function(text){
  document.getElementById("modal-text").textContent = text;
  document.getElementById("modal").classList.remove("hidden");
};
UI.refresh = function(){
  document.getElementById("tb-date").textContent = "公元前 " + Math.abs(G.state.year) + " 年 · " + G.SEASONS[G.state.season];
  document.getElementById("tb-treasury").textContent = "行省 " + G.facProvinces(G.state.player).length + " · 军团 " + G.facLegions(G.state.player).length;
  document.getElementById("tb-mp").textContent = "国库 " + Math.floor(G.state.aerarium[G.state.player]||0) + " 金";
  document.getElementById("tb-grain").textContent = "中央粮储 " + Math.floor(G.state.granaryCentral[G.state.player]||0) + " 粮";
  UI.renderPanel();
  UI.drawMap();
};
