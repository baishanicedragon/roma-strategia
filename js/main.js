/* ===== 罗马战略 · 入口 ===== */
G.newGame();
G.log(DATA.scenario.name + " 开局。萨贡托姆陷落，汉尼拔已在新迦太基集结大军。", "war");
G.log("你的目标：在马略改革（公元前107年）到来之前，决定共和国的命运。");
G.log("提示：钱粮分省储存，军团自带钱粮随军——敌境远征注意补给线！");
G.log("选中军团盾牌 → 移动/进攻 → 六边形战术地图：布阵、选战术（自动接近/就地防御）、推演。");

document.getElementById("map").addEventListener("click", UI.onMapClick);
document.getElementById("modal-close").addEventListener("click", function(){
  document.getElementById("modal").classList.add("hidden");
});
document.getElementById("btn-end").addEventListener("click", function(){
  G.endTurn();
  G.log("—— " + G.SEASONS[G.state.season] + "回合结算完毕 ——");
  UI.refresh();
});
document.getElementById("btn-test").addEventListener("click", function(){
  UI.modal(G.unitTests());
});
document.getElementById("tacmap").addEventListener("mousedown", UI.onTacDown);
window.addEventListener("mousemove", UI.onTacMove);
window.addEventListener("mouseup", UI.onTacUp);
document.getElementById("tacmap").addEventListener("wheel", UI.onTacWheel, { passive:false });
document.getElementById("tac-start").addEventListener("click", UI.tacStart);
document.getElementById("tac-auto").addEventListener("click", UI.tacAuto);
document.getElementById("tac-close").addEventListener("click", UI.tacClose);
window.addEventListener("keydown", function(ev){
  if(ev.key === "Escape" && UI.tac) UI.tacClose();
});
UI.refresh();
