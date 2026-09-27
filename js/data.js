/* ===== 罗马战略 · 数据层 =====
   兵种七类：LR 轻装远程 | LI 轻装近战 | HI 重装步兵 | LC 轻骑兵 | HC 重骑兵 | EL 战象 | LV 征召
   坐标：经度 -11..42，纬度 24..47.5 */
var DATA = {};

DATA.MAP = { lonMin:-11, lonMax:42, latMin:24, latMax:47.5, w:1000, h:640 };

/* 陆地多边形（简化海岸线，经纬度） */
DATA.land = [
  /* 伊比利亚+高卢+意大利 */
  [[-5.5,36],[-6.2,37.2],[-8.9,37.1],[-9.4,38.7],[-8.8,41.1],[-7.5,43.7],[-4.5,43.5],[-1.8,43.4],[-1.3,45.6],[-2.5,47.2],[-1,47.5],[14,47.5],[13.9,45.8],[12.5,45.5],[13.5,43.6],[14.3,42.4],[15.9,41.9],[16.9,41.1],[17.2,40.5],[16.5,39.5],[16.1,37.9],[15.6,39.0],[15.6,40.1],[14.9,40.3],[14.2,40.8],[13.5,41.2],[12,41.9],[11,42.6],[10,43.7],[8.9,44.4],[7.5,43.75],[6,43.2],[4.8,43.3],[3.5,43.3],[3.2,42.4],[2.2,41.4],[0.2,40],[0,38.7],[-0.5,38.2],[-1,37.6],[-0.3,36.7],[-2.1,36.7],[-4.4,36.7],[-5.5,36]],
  /* 巴尔干+希腊 */
  [[13.8,45.7],[15.2,44.9],[15.2,44.1],[16.4,43.5],[18.5,42.5],[19.4,41.3],[19.5,40.2],[20.7,39.2],[21.1,38.4],[21.7,36.8],[22.5,36.4],[23.1,36.4],[23.7,37.9],[23.3,38.8],[22.6,39.6],[23.3,40.2],[23.9,40.3],[24.4,40.6],[25.8,40.8],[26.8,41.3],[28,41.1],[29.1,41.2],[29,41.6],[28.3,43.4],[28,45.2],[28.8,46.5],[29.5,47.5],[14,47.5]],
  /* 小亚细亚 */
  [[29.1,41.2],[31.4,41.3],[33,42],[35.2,42.1],[37,41.2],[39.5,41],[41.5,41.3],[42,41.5],[42,36.6],[36.6,36.2],[35,36.6],[32.8,36.1],[30.5,36.8],[29,36.8],[27.7,36.9],[27.2,37.9],[26.8,38.4],[26.5,39.3],[26.2,40.1],[26.8,40.4],[28.5,40.7],[29.1,41.2]],
  /* 阿非利加+黎凡特 */
  [[-5.6,35.9],[-6,33.5],[-8.5,31.5],[-10,28.5],[-11,27],[-11,24],[42,24],[42,36.2],[36.6,36.2],[35.8,35.5],[35.5,34.6],[34.9,32.9],[34.2,31.3],[32.3,31.1],[31,31.4],[29.9,31.1],[27.5,31.1],[25.2,31.8],[23.5,32.4],[22.3,32.8],[20.9,32.5],[19.8,30.9],[19.2,30.3],[17.5,31],[15.7,31.4],[13.5,32.8],[11.1,33.6],[10.3,34],[10.2,35.5],[9.8,36.9],[10.9,37.1],[10,37.3],[8,36.9],[5.5,36.9],[3.2,36.8],[1,35.9],[-1,35.4],[-3,35.2],[-5.6,35.9]],
  /* 西西里 */ [[12.4,37.8],[13.4,38.2],[15.6,38.3],[15.1,37.3],[15.1,36.7],[12.5,37.6]],
  /* 撒丁 */ [[8.2,41.1],[9.6,41.2],[9.8,39.2],[8.4,38.9]],
  /* 科西嘉 */ [[8.6,42.7],[9.4,42.9],[9.5,41.9],[8.75,41.6]],
  /* 克里特 */ [[23.5,35.6],[25.5,35.5],[26.3,35.2],[24.8,34.95],[23.6,35.2]],
  /* 塞浦路斯 */ [[32.3,35.6],[33.8,35.7],[34.6,35.6],[33.4,34.9],[32.4,34.7]]
];

DATA.seaLabels = [
  { t:"MARE NOSTRUM · 地中海", lon:16.5, lat:34.2 },
  { t:"ADRIATICUM 亚得里亚海", lon:15.6, lat:42.3 },
  { t:"PONTUS EUXINUS", lon:33.5, lat:44.3 }
];

/* 特产稀缺度：越稀有贸易价值越高（这就是"种田不如贸易"的根源） */
DATA.scarcity = { grain:1.0, olive:1.5, wine:1.5, timber:1.6, metal:2.0, silver:3.0, horses:2.0, mercs_li:1.8, mercs_cav:2.0, mercs_lr:2.2, elephants:2.5, silphium:4.0, trade:1.6, papyrus:2.2, wool:1.2 };
DATA.specName = { grain:"谷物", olive:"橄榄油", wine:"葡萄酒", timber:"木材", metal:"金属", silver:"银矿", horses:"马匹", mercs_li:"轻步兵佣兵源", mercs_cav:"骑兵佣兵源", mercs_lr:"远程佣兵源", elephants:"战象", silphium:"Silphium 生药", trade:"商栈", papyrus:"纸草", wool:"羊毛" };

/* ===== 行省：218 BC 布匿战争开局 =====
   tax 税基 / mp 每回合人力 / grain 谷物 / spec 特产 / port 海港(海运+海上招募) / cap 势力首都 */
DATA.provinces = {
  mauretania:{ nm:"毛里塔尼亚", lon:-7, lat:33.5, ter:"山地", tax:8,  mp:2, grain:3, spec:{horses:3}, cul:"numid", port:0 },
  numidia:{    nm:"努米底亚",   lon:6.6, lat:36.2, ter:"草原", tax:12, mp:3, grain:4, spec:{horses:4,mercs_cav:3}, cul:"numid", port:0 },
  carthago:{   nm:"迦太基",     lon:10.3, lat:36.6, ter:"平原", tax:25, mp:3, grain:8, spec:{trade:6,mercs_li:2}, cul:"phoen", port:1 },
  hispu:{      nm:"外西班牙",   lon:-4.5, lat:37.9, ter:"平原", tax:18, mp:4, grain:5, spec:{silver:4,olive:4}, cul:"iber", port:0 },
  hispc:{      nm:"近西班牙",   lon:-0.8, lat:37.7, ter:"丘陵", tax:16, mp:5, grain:3, spec:{silver:5,mercs_li:4}, cul:"iber", port:1 },
  sardinia:{   nm:"撒丁",       lon:9, lat:40,    ter:"丘陵", tax:10, mp:2, grain:6, spec:{grain:2}, cul:"carth", port:1 },
  corsica:{    nm:"科西嘉",     lon:9, lat:42.2,  ter:"山地", tax:6,  mp:2, grain:2, spec:{timber:2}, cul:"etrus", port:1 },
  liguria:{    nm:"利古里亚",   lon:8.5, lat:44.3, ter:"山地", tax:8,  mp:4, grain:2, spec:{mercs_li:3,timber:2}, cul:"gallic", port:1 },
  gallia_cis:{ nm:"内高卢",     lon:10.5, lat:45.1, ter:"平原", tax:18, mp:6, grain:8, spec:{grain:3}, cul:"gallic", port:0 },
  etruria:{    nm:"伊特鲁里亚", lon:11.5, lat:43,  ter:"丘陵", tax:14, mp:3, grain:4, spec:{wine:4,metal:2}, cul:"etrus", port:1 },
  latium:{     nm:"拉丁姆",     lon:12.6, lat:41.9, ter:"平原", tax:20, mp:5, grain:4, spec:{trade:3}, cul:"latin", port:1 },
  campania:{   nm:"坎帕尼亚",   lon:14.3, lat:41,  ter:"平原", tax:16, mp:4, grain:5, spec:{wine:3,horses:2}, cul:"latin", port:1 },
  samnium:{    nm:"萨莫奈",     lon:14.6, lat:41.7, ter:"山地", tax:10, mp:6, grain:3, spec:{mercs_li:2}, cul:"sabellic", port:0 },
  apulia:{     nm:"阿普利亚",   lon:16.2, lat:41.2, ter:"平原", tax:10, mp:3, grain:5, spec:{horses:2,wool:2}, cul:"sabellic", port:1 },
  bruttium:{   nm:"大希腊",     lon:16, lat:39,    ter:"丘陵", tax:12, mp:3, grain:3, spec:{trade:2}, cul:"greek", port:1 },
  sicilia:{    nm:"西西里",     lon:14.3, lat:37.3, ter:"平原", tax:20, mp:4, grain:9, spec:{grain:4}, cul:"greek", port:1 },
  illyria:{    nm:"伊利里亚",   lon:16.8, lat:43.9, ter:"山地", tax:8,  mp:5, grain:2, spec:{mercs_li:4,timber:3}, cul:"illyr", port:1 },
  epirus:{     nm:"伊庇鲁斯",   lon:20.6, lat:39.4, ter:"山地", tax:8,  mp:3, grain:2, spec:{mercs_li:2}, cul:"greek", port:0 },
  macedonia:{  nm:"马其顿",     lon:22.3, lat:40.6, ter:"丘陵", tax:14, mp:5, grain:3, spec:{timber:4}, cul:"mace", port:1 },
  thracia:{    nm:"色雷斯",     lon:25, lat:41.8,  ter:"平原", tax:10, mp:4, grain:3, spec:{mercs_li:3,horses:2}, cul:"thrac", port:1 },
  achaea:{     nm:"亚该亚",     lon:22, lat:37.6,  ter:"丘陵", tax:14, mp:3, grain:2, spec:{trade:4,olive:3}, cul:"greek", port:1 },
  crete:{      nm:"克里特",     lon:24.9, lat:35.2, ter:"山地", tax:8,  mp:2, grain:2, spec:{mercs_lr:5}, cul:"greek", port:1 },
  asia:{       nm:"帕加马",     lon:27.5, lat:39,  ter:"丘陵", tax:18, mp:3, grain:3, spec:{trade:5,olive:3}, cul:"greek", port:1 },
  galatia:{    nm:"加拉太",     lon:33.5, lat:39.5, ter:"高原", tax:10, mp:4, grain:2, spec:{mercs_li:5}, cul:"galat", port:0 },
  pontus:{     nm:"本都",       lon:36.5, lat:41,  ter:"山地", tax:12, mp:3, grain:3, spec:{timber:4}, cul:"eastern", port:1 },
  cappadocia:{ nm:"卡帕多细亚", lon:35.5, lat:38.5, ter:"高原", tax:10, mp:3, grain:2, spec:{horses:3}, cul:"eastern", port:0 },
  cilicia:{    nm:"西里西亚",   lon:34.5, lat:37.2, ter:"平原", tax:14, mp:3, grain:3, spec:{timber:3,silver:2,mercs_li:2}, cul:"eastern", port:1 },
  syria:{      nm:"叙利亚",     lon:36.5, lat:35.5, ter:"平原", tax:24, mp:6, grain:6, spec:{trade:5,elephants:3}, cul:"eastern", port:1 },
  aegyptus:{   nm:"埃及",       lon:30.5, lat:29.8, ter:"河谷", tax:28, mp:5, grain:10, spec:{grain:5,trade:4,papyrus:3,elephants:2}, cul:"ptol", port:1 },
  cyrenaica:{  nm:"昔兰尼加",   lon:21.5, lat:31.5, ter:"平原", tax:10, mp:2, grain:3, spec:{silphium:5,horses:2}, cul:"greek", port:1 }
};

/* 邻接（s:1 = 跨海航线，冬季封锁） */
DATA.adj = [
  ["mauretania","numidia"],["numidia","carthago"],["carthago","cyrenaica",1],["carthago","hispu",1],
  ["carthago","sicilia",1],["carthago","sardinia",1],["hispu","hispc"],["hispc","liguria"],
  ["liguria","gallia_cis"],["liguria","etruria"],["gallia_cis","etruria"],["etruria","latium"],
  ["latium","campania"],["latium","samnium"],["samnium","campania"],["samnium","apulia"],
  ["campania","bruttium"],["apulia","bruttium"],["bruttium","sicilia",1],["etruria","corsica",1],
  ["corsica","sardinia",1],["sardinia","carthago",1],
  ["illyria","epirus"],["illyria","macedonia"],["illyria","gallia_cis"],["epirus","achaea"],
  ["epirus","macedonia"],["achaea","macedonia"],["macedonia","thracia"],["thracia","asia",1],
  ["achaea","crete",1],["crete","aegyptus",1],["asia","galatia"],["asia","cappadocia"],
  ["asia","cilicia"],["galatia","pontus"],["galatia","cappadocia"],["pontus","cappadocia"],
  ["cappadocia","cilicia"],["cilicia","syria"],["syria","aegyptus"],["aegyptus","cyrenaica"]
];

/* ===== 兵种库 =====
   atk 近战 / def 防御 / mis 远程 / chg 冲击(首轮) / mor 士气 / spd 速度 / cost 建军 / up 每回合军费 / armor 护甲
   req: 招募条件 {bld 建筑需 | cul 文化需 | spec 特产需 | merc 佣兵(吃金不吃人力)} */
DATA.units = {
  levy_spear:{ nm:"征召枪兵", cls:"LV", atk:4, def:5, mis:0, chg:1, mor:3, spd:4, cost:12, up:2, armor:2, front:1, req:{}, desc:"最便宜的炮灰。战线外全是活靶。" },
  libyan_levy:{ nm:"利比亚征召兵", cls:"LV", atk:4, def:5, mis:0, chg:1, mor:3, spd:4, cost:12, up:2, armor:2, front:1, req:{cul:"phoen"}, desc:"迦太基属民兵源。" },
  velites:{ nm:"青年兵(轻盾手)", cls:"LR", atk:5, def:4, mis:6, chg:0, mor:4, spd:5, cost:26, up:5, armor:3, front:1, req:{cul:"latin"}, desc:"罗马轻盾兵，骚扰+反战象。" },
  balearic_slinger:{ nm:"巴利阿里投石手", cls:"LR", atk:4, def:3, mis:9, chg:0, mor:5, spd:5, cost:40, up:8, armor:2, front:1, req:{merc:1,spec:"mercs_li"}, desc:"地中海最佳投石手，无甲单位克星。" },
  cretan_archer:{ nm:"克里特弓箭手", cls:"LR", atk:4, def:3, mis:8, chg:0, mor:5, spd:5, cost:40, up:8, armor:2, front:1, req:{merc:1,spec:"mercs_lr"}, desc:"希腊化世界最抢手的弓手。" },
  rhodian_slinger:{ nm:"罗得岛投石手", cls:"LR", atk:4, def:3, mis:10, chg:0, mor:5, spd:5, cost:48, up:10, armor:2, front:1, req:{merc:1,spec:"mercs_lr"}, desc:"射程最远的投石手，重甲也扛不住铅弹。" },
  thracian:{ nm:"色雷斯轻步兵", cls:"LI", atk:8, def:5, mis:0, chg:3, mor:5, spd:6, cost:35, up:7, armor:3, front:1, req:{merc:1,spec:"mercs_li"}, desc:"弯刀山民，侧袭好手。" },
  peltast:{ nm:"培尔塔斯特轻盾兵", cls:"LI", atk:7, def:5, mis:5, chg:2, mor:5, spd:6, cost:38, up:8, armor:3, front:1, req:{merc:1,spec:"mercs_li"}, desc:"标枪+短剑，轻步兵全能。" },
  galatian:{ nm:"加拉太战士", cls:"LI", atk:10, def:6, mis:0, chg:4, mor:5, spd:5, cost:45, up:9, armor:4, front:1, req:{merc:1,spec:"mercs_li"}, desc:"凯尔特迁入小亚的狂战士。" },
  iberian_caetratus:{ nm:"伊比利亚轻步兵", cls:"LI", atk:7, def:5, mis:3, chg:2, mor:4, spd:6, cost:32, up:7, armor:3, front:1, req:{merc:1,spec:"mercs_li"}, desc:"圆盾轻步，西班牙山地游击。" },
  roman_legion:{ nm:"罗马军团(波利比乌斯体制)", cls:"HI", atk:12, def:13, mis:0, chg:4, mor:9, spd:3, cost:90, up:18, armor:10, front:1, req:{bld:"barracks",cul:"latin"}, flag:"legion", desc:"三线轮换：战線延展性，侧翼被包前几乎不崩。" },
  socii_ala:{ nm:"同盟军翼兵", cls:"HI", atk:10, def:11, mis:2, chg:3, mor:7, spd:3, cost:65, up:13, armor:9, front:1, req:{bld:"barracks",cul:"latin"}, desc:"意大利同盟重步，军团一半的厚度。" },
  libyan_spear:{ nm:"利比亚长枪兵", cls:"HI", atk:10, def:12, mis:0, chg:2, mor:6, spd:3, cost:60, up:12, armor:9, front:1, req:{bld:"barracks",cul:"phoen"}, desc:"迦太基职业非洲步兵。" },
  sacred_band:{ nm:"圣团", cls:"HI", atk:12, def:13, mis:0, chg:3, mor:9, spd:3, cost:85, up:17, armor:10, front:1, req:{bld:"barracks",cul:"phoen"}, desc:"迦太基精锐重步。" },
  iberian_scutarius:{ nm:"伊比利亚重步兵", cls:"HI", atk:11, def:9, mis:0, chg:4, mor:5, spd:4, cost:55, up:11, armor:8, front:1, req:{merc:1,spec:"mercs_li"}, desc:"弯刀重佣兵，攻强守弱。" },
  greek_hoplite:{ nm:"希腊重装步兵", cls:"HI", atk:11, def:14, mis:0, chg:2, mor:7, spd:2, cost:70, up:14, armor:12, front:1, req:{bld:"barracks",cul:"greek"}, desc:"古典重甲，慢但硬。" },
  macedonian_phalanx:{ nm:"马其顿方阵", cls:"HI", atk:11, def:14, mis:0, chg:2, mor:7, spd:2, cost:75, up:15, armor:10, front:1, req:{bld:"barracks",cul:"mace"}, flag:"phalanx", desc:"正面几乎不可破(防+35%)，侧翼被骑兵包则崩(防-40%)。" },
  guard_legion:{ nm:"禁卫军团", cls:"HI", atk:13, def:14, mis:0, chg:4, mor:10, spd:3, cost:110, up:22, armor:11, front:1, req:{bld:"barracks",capital:1}, flag:"legion", desc:"仅首都可募的精锐；损耗后只能回京补充，务必保持员额。" },
  numidian_cav:{ nm:"努米底亚轻骑兵", cls:"LC", atk:6, def:4, mis:4, chg:2, mor:5, spd:9, cost:40, up:9, armor:3, front:1, req:{merc:1,spec:"mercs_cav"}, desc:"无鞍骑手，全地中海最佳轻骑。" },
  tarentine_cav:{ nm:"塔兰托轻骑", cls:"LC", atk:6, def:5, mis:3, chg:2, mor:5, spd:8, cost:42, up:9, armor:4, front:1, req:{bld:"stables"}, desc:"希腊式投枪轻骑。" },
  roman_equites:{ nm:"罗马骑士", cls:"HC", atk:11, def:9, mis:0, chg:11, mor:6, spd:7, cost:95, up:19, armor:8, front:1, req:{bld:"stables",cul:"latin"}, desc:"贵族重骑，冲击力强但数量少。" },
  campanian_cav:{ nm:"坎帕尼亚重骑", cls:"HC", atk:11, def:9, mis:0, chg:10, mor:6, spd:7, cost:80, up:16, armor:8, front:1, req:{bld:"stables"}, desc:"意大利最佳重骑。" },
  companion_cav:{ nm:"伙友骑兵", cls:"HC", atk:13, def:10, mis:0, chg:13, mor:8, spd:8, cost:120, up:24, armor:8, front:1, req:{bld:"stables",cul:"mace"}, desc:"亚历山大的遗产，决定性冲击。" },
  gallic_noble_cav:{ nm:"高卢贵族骑", cls:"HC", atk:11, def:7, mis:0, chg:9, mor:5, spd:7, cost:60, up:12, armor:6, front:1, req:{merc:1,spec:"mercs_cav"}, desc:"佣兵重骑，性价比高。" },
  forest_elephant:{ nm:"非洲森林象", cls:"EL", atk:10, def:6, mis:0, chg:12, mor:5, spd:6, cost:110, up:22, armor:6, front:2, req:{bld:"elephant_yard"}, desc:"体型较小，惊弓之象会反踩己方。" },
  north_african_elephant:{ nm:"北非战象", cls:"EL", atk:11, def:7, mis:0, chg:12, mor:5, spd:6, cost:120, up:24, armor:6, front:2, req:{bld:"elephant_yard"}, desc:"迦太基象兵。" },
  indian_elephant:{ nm:"印度战象", cls:"EL", atk:12, def:8, mis:0, chg:13, mor:6, spd:6, cost:140, up:28, armor:7, front:2, req:{bld:"elephant_yard"}, desc:"塞琉古塔楼象，最强的象。" }
};

/* 兵种克制矩阵 [攻击方][防御方] 伤害倍率 */
DATA.MATX = {
  LR:{ LR:.8, LI:1.0, HI:1.6, LC:.6, HC:.5, EL:2.8, LV:1.6 },
  LI:{ LR:.9, LI:1.0, HI:.9, LC:1.2, HC:.8, EL:1.6, LV:1.3 },
  HI:{ LR:.9, LI:1.6, HI:1.0, LC:.4, HC:.5, EL:.8, LV:1.8 },
  LC:{ LR:1.8, LI:1.6, HI:.5, LC:.9, HC:1.0, EL:.5, LV:1.8 },
  HC:{ LR:2.2, LI:2.0, HI:.7, LC:1.3, HC:1.1, EL:.4, LV:2.2 },
  EL:{ LR:2.4, LI:2.2, HI:1.5, LC:2.2, HC:1.8, EL:.5, LV:2.5 },
  LV:{ LR:.6, LI:.9, HI:.5, LC:.3, HC:.3, EL:.4, LV:1.0 }
};

/* ===== 建筑 ===== */
DATA.buildings = {
  granary:{ nm:"谷仓", cost:60, turns:2, desc:"谷物+2" },
  barracks:{ nm:"兵营", cost:80, turns:2, desc:"解锁重装步兵招募" },
  market:{ nm:"市场", cost:70, turns:2, desc:"贸易收入+25%，解锁远程佣兵" },
  workshop:{ nm:"手工作坊", cost:80, turns:2, desc:"税基+30%" },
  port_b:{ nm:"港口", cost:100, turns:3, desc:"贸易收入+30%" },
  walls:{ nm:"城墙", cost:90, turns:3, desc:"防御战守方+15%" },
  stables:{ nm:"马厩", cost:70, turns:2, desc:"解锁骑兵招募" },
  elephant_yard:{ nm:"象栏", cost:120, turns:3, desc:"解锁战象（需战象特产）", reqSpec:"elephants" }
};

/* ===== 势力 ===== */
DATA.factions = {
  ROMA:      { nm:"罗马共和国", color:"#a32d2d", cap:"latium" },
  CARTHAGO:  { nm:"迦太基",     color:"#534ab7", cap:"carthago" },
  NUMIDIA:   { nm:"努米底亚",   color:"#854f0b", cap:"numidia" },
  MACEDON:   { nm:"马其顿王国", color:"#185fa5", cap:"macedonia" },
  SELEUKID:  { nm:"塞琉古帝国", color:"#0f6e56", cap:"syria" },
  PTOLEMY:   { nm:"托勒密埃及", color:"#993556", cap:"aegyptus" },
  PONTUS:    { nm:"本都王国",   color:"#3b6d11", cap:"pontus" },
  GALATIA:   { nm:"加拉太",     color:"#d85a30", cap:"galatia" },
  PERGAMON:  { nm:"帕加马",     color:"#0c447c", cap:"asia" },
  ACHAEA:    { nm:"亚该亚同盟", color:"#7f77dd", cap:"achaea" },
  RHODES:    { nm:"罗得岛",     color:"#1d9e75", cap:"crete" },
  EPIRUS:    { nm:"伊庇鲁斯",   color:"#ba7517", cap:"epirus" },
  CAPPADOCIA:{ nm:"卡帕多细亚", color:"#888780", cap:"cappadocia" },
  REBEL:     { nm:"叛军",       color:"#444441", cap:null }
};

/* ===== 将领：特质直接作用于对应兵种类别 =====
   mod: { LR:+0.25 } = 轻装远程战力+25%；skl 技能: ambush伏击 night夜战 defend守势 maneuver机动 */
DATA.generals = {
  hannibal:   { nm:"汉尼拔·巴卡", fac:"CARTHAGO", mod:{LC:.2,LI:.15,EL:.1}, skl:["ambush","night","maneuver"], desc:"战略机动+伏击大师" },
  scipio:     { nm:"大西庇阿", fac:"ROMA", mod:{LR:.25,LI:.25}, skl:["maneuver"], desc:"轻步兵大师（历史上用维里图斯与轻盾兵击溃迦太基）" },
  fabius:     { nm:"费边·马克西姆斯", fac:"ROMA", mod:{HI:.1}, skl:["defend"], desc:"拖延者：守势防御+25%" },
  hasdrubal:  { nm:"哈斯德鲁巴·巴卡", fac:"CARTHAGO", mod:{LC:.15,HC:.1}, skl:["maneuver"], desc:"西班牙的骑兵指挥官" },
  maharbal:   { nm:"马哈巴尔", fac:"CARTHAGO", mod:{LC:.25}, skl:["maneuver"], desc:"『汉尼拔懂如何赢，不懂如何用赢』" },
  philip_v:   { nm:"腓力五世", fac:"MACEDON", mod:{HI:.15}, skl:[], desc:"方阵复兴者" },
  antiochus3: { nm:"安条克三世", fac:"SELEUKID", mod:{HC:.2,EL:.15}, skl:["maneuver"], desc:"大帝：东方再征服" },
  philopoemen:{ nm:"菲洛波门", fac:"ACHAEA", mod:{HI:.1,LC:.1}, skl:[], desc:"希腊最后的将军" }
};

/* ===== 剧本：公元前 218 年 · 第二次布匿战争 ===== */
DATA.scenario = {
  name:"SAGUNTUM 218 BC · 第二次布匿战争",
  startTurn:0, year:-218, season:1, /* 0春 1夏 2秋 3冬 */
  playerFac:"ROMA",
  owners:{ mauretania:"NUMIDIA", numidia:"NUMIDIA", carthago:"CARTHAGO", hispu:"CARTHAGO", hispc:"CARTHAGO",
    sardinia:"ROMA", corsica:"ROMA", liguria:"ROMA", gallia_cis:"ROMA", etruria:"ROMA", latium:"ROMA",
    campania:"ROMA", samnium:"ROMA", apulia:"ROMA", bruttium:"ROMA", sicilia:"ROMA",
    illyria:"MACEDON", epirus:"EPIRUS", macedonia:"MACEDON", thracia:"MACEDON", achaea:"ACHAEA",
    crete:"RHODES", asia:"PERGAMON", galatia:"GALATIA", pontus:"PONTUS", cappadocia:"CAPPADOCIA",
    cilicia:"SELEUKID", syria:"SELEUKID", aegyptus:"PTOLEMY", cyrenaica:"PTOLEMY" },
  /* 军团制：上限 20 队，自带钱粮随军；kind 由组建地锁定（central=首都组建，border=外地组建） */
  legions:[
    { id:"R1", no:"第一军团", fac:"ROMA", pid:"latium", gen:"scipio", kind:"central",
      units:[["roman_legion",2],["socii_ala",2],["velites",2],["roman_equites",1]] },
    { id:"R2", no:"第二军团", fac:"ROMA", pid:"sicilia", gen:null, kind:"border",
      units:[["roman_legion",2],["socii_ala",2],["velites",2],["roman_equites",1]] },
    { id:"R3", no:"第三军团", fac:"ROMA", pid:"campania", gen:null, kind:"border",
      units:[["socii_ala",1],["velites",1]] },
    { id:"C1", no:"巴卡远征军", fac:"CARTHAGO", pid:"hispc", gen:"hannibal", kind:"border",
      units:[["iberian_scutarius",2],["libyan_spear",2],["numidian_cav",3],["balearic_slinger",2],["north_african_elephant",2]] },
    { id:"C2", no:"非洲驻军", fac:"CARTHAGO", pid:"carthago", gen:null, kind:"central",
      units:[["libyan_spear",2],["libyan_levy",2],["numidian_cav",2],["balearic_slinger",2],["forest_elephant",1]] },
    { id:"N1", no:"努米底亚王军", fac:"NUMIDIA", pid:"numidia", gen:null, kind:"central",
      units:[["numidian_cav",2],["levy_spear",2]] },
    { id:"N2", no:"毛里塔尼亚卫队", fac:"NUMIDIA", pid:"mauretania", gen:null, kind:"border",
      units:[["numidian_cav",1],["levy_spear",1]] },
    { id:"M1", no:"马其顿王国军", fac:"MACEDON", pid:"macedonia", gen:"philip_v", kind:"central",
      units:[["macedonian_phalanx",3],["peltast",2],["companion_cav",1],["cretan_archer",1]] },
    { id:"S1", no:"塞琉古王家军队", fac:"SELEUKID", pid:"syria", gen:"antiochus3", kind:"central",
      units:[["macedonian_phalanx",3],["companion_cav",2],["indian_elephant",1],["greek_hoplite",1]] },
    { id:"P1", no:"埃及王国军", fac:"PTOLEMY", pid:"aegyptus", gen:null, kind:"central",
      units:[["macedonian_phalanx",2],["greek_hoplite",1],["forest_elephant",1],["tarentine_cav",1]] },
    { id:"G1", no:"加拉太部落军", fac:"GALATIA", pid:"galatia", gen:null, kind:"border",
      units:[["galatian",3]] },
    { id:"PO1", no:"本都军队", fac:"PONTUS", pid:"pontus", gen:null, kind:"central",
      units:[["peltast",1],["tarentine_cav",1]] },
    { id:"PE1", no:"帕加马守备军", fac:"PERGAMON", pid:"asia", gen:null, kind:"central",
      units:[["greek_hoplite",1],["tarentine_cav",1]] },
    { id:"A1", no:"亚该亚同盟军", fac:"ACHAEA", pid:"achaea", gen:"philopoemen", kind:"central",
      units:[["greek_hoplite",2],["tarentine_cav",1]] },
    { id:"RH1", no:"罗得岛驻队", fac:"RHODES", pid:"crete", gen:null, kind:"central",
      units:[["cretan_archer",2]] },
    { id:"E1", no:"伊庇鲁斯军队", fac:"EPIRUS", pid:"epirus", gen:null, kind:"central",
      units:[["greek_hoplite",1],["peltast",1]] },
    { id:"CA1", no:"卡帕多细亚民兵", fac:"CAPPADOCIA", pid:"cappadocia", gen:null, kind:"border",
      units:[["levy_spear",2]] }
  ],
  relations:{ "ROMA|CARTHAGO":-100, "ROMA|MACEDON":-20, "CARTHAGO|NUMIDIA":30, "SELEUKID|PTOLEMY":-60, "SELEUKID|PERGAMON":-40 },
  wars:[["ROMA","CARTHAGO"],["SELEUKID","PTOLEMY"]],
  feud:[["ROMA","CARTHAGO"]] /* 血仇：关系下限-60，快速反转规则对它失效 */
};

/* 军团与后勤参数 */
DATA.LEGION_MAX = 20;      /* 每军团最多 20 队 */
DATA.CHEST_CAP = 600;      /* 军团随军战利品上限 */
DATA.GRAIN_CAP = 120;      /* 军团随军粮上限 */
DATA.LR_RANGE = 2;         /* 远程射程（战术格） */
DATA.FF_CHANCE = 0.4;      /* 越过己方近战射击的误伤概率 */
/* 税赋转运：缴税省 60% 产出在途一季到中央国库，按到首都路径距离损耗；超限或低忠诚不上缴 */
DATA.TRANSIT = { taxRate:0.6, lossPerStep:0.04, remoteSteps:4, loyalMin:40 };
/* 军团身份由组建地点锁定：首都建=中央军（吃国库+中央粮储），外地建=边军（就地取饷取粮）
   中央军离核心圈(coreSteps)作战 → 军饷改从驻省省库就地征发（占用当地军饷） */
DATA.CORE_STEPS = 2;
DATA.LEGION_KIND = {
  central:{ nm:"中央军", desc:"军饷出中央国库、粮出中央粮储；核心圈内随军粮自动补满。远离首都作战时军饷就地征发驻省" },
  border:{ nm:"边军", desc:"军饷粮草就地取自驻省；敌境作战吃随军存粮+战利品充饷（以战养战）" }
};
