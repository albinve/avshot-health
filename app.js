/* AV·SHOT Health */
const STORE_KEY = "avshot-health";
const IDB_NAME = "avshot-health";
const IDB_STORE = "kv";
const mem = {};
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return mem[k] ?? null; } },
  set(k,v){ try{ localStorage.setItem(k,v); mem[k]=v; }catch(e){ mem[k]=v; } }
};

function keyOf(d){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function parseKey(k){ const [y,m,da]=k.split("-").map(Number); return new Date(y, m-1, da, 12, 0, 0); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function todayKey(){ return keyOf(new Date()); }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }
function $(s, r){ return (r||document).querySelector(s); }
function fmtKg(n){ return Number(n).toFixed(1).replace(".", ","); }
function fmtN(n){ return String(n).replace(".", ","); }
function parseDec(s){ const v=parseFloat(String(s||"").replace(",", ".")); return Number.isFinite(v) ? v : NaN; }
function sanitizeNumInput(s){ return String(s||"").replace(/[^0-9.,\-]/g,"").slice(0,10); }
function isDateKey(s){ return /^\d{4}-\d{2}-\d{2}$/.test(String(s||"")); }
function isoWeek(d){
  const x=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day=x.getUTCDay()||7; x.setUTCDate(x.getUTCDate()+4-day);
  const y0=new Date(Date.UTC(x.getUTCFullYear(),0,1));
  return x.getUTCFullYear()+"-W"+String(Math.ceil((((x-y0)/864e5)+1)/7)).padStart(2,"0");
}
function weeksBetween(a,b){
  const ms = parseKey(b) - parseKey(a);
  return Math.max(0, Math.floor(ms / (7*864e5)));
}

function blankState(){
  return {
    app: "avshot-health",
    v: 2,
    savedAt: 0,
    firstUse: null,
    days: {},
    weights: [],
    lifts: {},
    shop: { week: "", checks: {} },
    posture: [],
    photos: [],
    profile: Object.assign({}, DEFAULTS)
  };
}

function cloneJson(x){
  try { return JSON.parse(JSON.stringify(x)); } catch(e){ return null; }
}

function migrate(raw){
  const clean = cloneJson(raw);
  if (!clean || typeof clean !== "object" || Array.isArray(clean)) return blankState();
  if (clean.app && clean.app !== "avshot-health") return blankState();
  if (clean.v >= 2) {
    const S0 = blankState();
    S0.savedAt = Number(clean.savedAt)||0;
    S0.firstUse = isDateKey(clean.firstUse) ? clean.firstUse : null;
    S0.days = (clean.days && typeof clean.days === "object" && !Array.isArray(clean.days)) ? clean.days : {};
    S0.weights = Array.isArray(clean.weights)
      ? clean.weights.filter(w=>w && isDateKey(w.date) && Number.isFinite(+w.kg)).map(w=>({ date:w.date, kg:+w.kg }))
      : [];
    S0.lifts = (clean.lifts && typeof clean.lifts === "object") ? clean.lifts : {};
    S0.shop = clean.shop && typeof clean.shop === "object" ? clean.shop : { week:"", checks:{} };
    S0.posture = Array.isArray(clean.posture) ? clean.posture : [];
    S0.photos = Array.isArray(clean.photos) ? clean.photos.filter(isDateKey) : [];
    S0.profile = Object.assign({}, DEFAULTS, clean.profile||{});
    return S0;
  }
  const days = {};
  Object.entries(clean.days||{}).forEach(([k,v])=>{
    if (!isDateKey(k)) return;
    if (v && v.checks) { days[k]=v; return; }
    const checks = {};
    Object.entries(v||{}).forEach(([id,val])=>{ if (typeof val === "boolean") checks[id]=val; });
    days[k] = { checks, water: checks.wasser ? 2500 : 0, swaps: {}, ritual: {}, gymLog: null };
  });
  const S0 = blankState();
  S0.days = days;
  S0.weights = Array.isArray(clean.weights) ? clean.weights.filter(w=>w && isDateKey(w.date) && Number.isFinite(+w.kg)) : [];
  S0.firstUse = isDateKey(clean.firstUse) ? clean.firstUse : null;
  S0.profile.onboarded = !!(S0.weights.length || Object.keys(days).length);
  if (S0.weights.length && S0.profile.startKg == null) S0.profile.startKg = S0.weights[0].kg;
  return S0;
}

function readLocal(){
  try {
    const raw = store.get(STORE_KEY);
    if (!raw || raw.length > 2e6) return null;
    return migrate(JSON.parse(raw));
  } catch(e){ return null; }
}

function idbOpen(){
  return new Promise((resolve, reject) => {
    if (!window.indexedDB){ reject(new Error("no-idb")); return; }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const r = tx.objectStore(IDB_STORE).get(STORE_KEY);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(value){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, STORE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let persistAsked = false;
function requestPersist(){
  if (persistAsked) return;
  persistAsked = true;
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  } catch(e){}
}

let S = readLocal() || blankState();
if (!S.firstUse) S.firstUse = todayKey();
if (!S.profile.phaseStart) S.profile.phaseStart = S.firstUse;
if (S.profile.startKg == null && S.weights.length) S.profile.startKg = S.weights[0].kg;

function save(){
  S.app = "avshot-health";
  S.savedAt = Date.now();
  const json = JSON.stringify(S);
  if (json.length > 2e6) return;
  store.set(STORE_KEY, json);
  idbSet(cloneJson(S)).catch(()=>{});
}

async function hydrateFromDisk(){
  let idb = null;
  try { idb = await idbGet(); } catch(e){}
  const fromIdb = idb ? migrate(idb) : null;
  const fromLs = readLocal();
  const a = fromIdb && (fromIdb.savedAt||0);
  const b = fromLs && (fromLs.savedAt||0);
  if (fromIdb && (!fromLs || a > b)) S = fromIdb;
  else if (fromLs) S = fromLs;
  if (!S.firstUse) S.firstUse = todayKey();
  if (!S.profile.phaseStart) S.profile.phaseStart = S.firstUse;
  save();
}

function dayObj(k){
  if (!S.days[k]) S.days[k] = { checks:{}, water:0, swaps:{}, ritual:{}, gymLog:null, walk:false };
  const d = S.days[k];
  d.checks = d.checks || {};
  d.swaps = d.swaps || {};
  d.ritual = d.ritual || {};
  d.water = d.water || 0;
  return d;
}

/* ───────── figures ───────── */
function fig(id, big){
  const D = 3.4;
  const A = (name,vals,dur)=>`<animate attributeName="${name}" values="${vals}" dur="${dur||D}s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1"/>`;
  const svgs = {
  brust: `<svg viewBox="0 0 120 120">
    <line class="env" x1="96" y1="8" x2="96" y2="112"/><line class="env" x1="96" y1="8" x2="78" y2="8"/>
    <polyline class="fg" points="48,78 52,38">${A("points","48,78 52,38;51,78 61,35;48,78 52,38")}</polyline>
    <polyline class="fg" points="48,78 58,95 60,112">${A("points","48,78 58,95 60,112;51,78 62,95 63,112;48,78 58,95 60,112")}</polyline>
    <polyline class="fg" points="48,78 38,96 34,112">${A("points","48,78 38,96 34,112;51,78 40,96 36,112;48,78 38,96 34,112")}</polyline>
    <polyline class="fg" points="52,38 73,42 92,30">${A("points","52,38 73,42 92,30;61,35 78,40 92,30;52,38 73,42 92,30")}</polyline>
    <polyline class="fg" points="52,38 46,62">${A("points","52,38 46,62;61,35 55,60;52,38 46,62")}</polyline>
    <circle class="hd" r="8" cx="49" cy="25">${A("cx","49;58;49")}${A("cy","25;23;25")}</circle>
  </svg>`,
  huefte: `<svg viewBox="0 0 120 120">
    <line class="env" x1="8" y1="111" x2="112" y2="111"/>
    <polyline class="fg" points="20,109 40,107"></polyline>
    <polyline class="fg" points="40,107 52,74">${A("points","40,107 52,74;40,107 61,74;40,107 52,74")}</polyline>
    <polyline class="fg" points="52,74 73,88 79,109">${A("points","52,74 73,88 79,109;61,74 79,84 79,109;52,74 73,88 79,109")}</polyline>
    <polyline class="fg" points="52,74 51,38">${A("points","52,74 51,38;61,74 60,38;52,74 51,38")}</polyline>
    <polyline class="fg" points="51,38 60,60 70,74">${A("points","51,38 60,60 70,74;60,38 68,58 77,70;51,38 60,60 70,74")}</polyline>
    <circle class="hd" r="8" cx="50" cy="26">${A("cx","50;59;50")}</circle>
  </svg>`,
  chin: `<svg viewBox="0 0 120 120">
    <line class="env" x1="24" y1="86" x2="86" y2="86"/>
    <polyline class="fg" points="30,110 34,86 76,86 82,110"/>
    <polyline class="fg" points="55,86 60,56">${A("points","55,86 60,56;55,86 51,54;55,86 60,56")}</polyline>
    <circle class="hd" r="13" cx="63" cy="42">${A("cx","63;51;63")}${A("cy","42;40;42")}</circle>
  </svg>`,
  engel: `<svg viewBox="0 0 120 120">
    <line class="env" x1="14" y1="10" x2="14" y2="112"/>
    <line class="fg" x1="60" y1="52" x2="60" y2="86"/>
    <polyline class="fg" points="60,86 50,112"/><polyline class="fg" points="60,86 70,112"/>
    <polyline class="fg" points="47,54 73,54"/>
    <polyline class="fg" points="47,54 37,68 30,50">${A("points","47,54 37,68 30,50;47,54 39,38 32,20;47,54 37,68 30,50")}</polyline>
    <polyline class="fg" points="73,54 83,68 90,50">${A("points","73,54 83,68 90,50;73,54 81,38 88,20;73,54 83,68 90,50")}</polyline>
    <circle class="hd" r="9" cx="60" cy="36"/>
  </svg>`,
  bridge: `<svg viewBox="0 0 120 120">
    <line class="env" x1="6" y1="102" x2="114" y2="102"/>
    <circle class="hd" r="8" cx="20" cy="93"/>
    <polyline class="fg" points="32,97 58,93">${A("points","32,97 58,93;32,97 56,72;32,97 58,93")}</polyline>
    <polyline class="fg" points="58,93 77,70">${A("points","58,93 77,70;56,72 77,64;58,93 77,70")}</polyline>
    <polyline class="fg" points="77,70 84,100">${A("points","77,70 84,100;77,64 84,100;77,70 84,100")}</polyline>
    <polyline class="fg" points="36,99 58,99"/>
  </svg>`};
  return `<div class="${big?"gex":"exfig"}">${svgs[id]||""}</div>`;
}

/* ───────── sound / haptics / wake ───────── */
let actx=null, wakeLock=null;
function beep(f=880,ms=140){
  if (!S.profile.sound) return;
  try{
    actx=actx||new (window.AudioContext||window.webkitAudioContext)();
    if (actx.state==="suspended") actx.resume();
    const o=actx.createOscillator(), g=actx.createGain();
    o.type="sine"; o.frequency.value=f; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(.16,actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,actx.currentTime+ms/1000);
    o.start(); o.stop(actx.currentTime+ms/1000);
  }catch(e){}
}
function buzz(p){ if (!S.profile.haptic) return; try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} }
async function requestWake(){
  try{ if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen"); }catch(e){}
}
function releaseWake(){ try{ wakeLock && wakeLock.release(); }catch(e){} wakeLock=null; }

let toastT=null;
function toast(msg){
  const el=$("#toast"); if (!el) return;
  el.textContent=msg; el.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove("show"), 2200);
}

/* ───────── domain ───────── */
function isGymDay(dow){
  const days = (S.profile && Array.isArray(S.profile.gymDays) && S.profile.gymDays.length)
    ? S.profile.gymDays : GYM_DAYS;
  return days.includes(dow);
}
function wantsPosture(){
  const g = S.profile.goal || "both";
  return g === "both" || g === "posture";
}
function applyComputed(p){
  const c = computePlan(p);
  Object.assign(p, {
    kcal: c.kcal, protein: c.protein, kcalFloor: c.kcalFloor,
    kcalMaintain: c.kcalMaintain, kcalDeficit: c.kcalDeficit,
    goalLow: c.goalLow, goalHigh: c.goalHigh, bmr: c.bmr, tdee: c.tdee,
    phase: p.phase && ["break","reverse"].includes(p.phase) ? p.phase : c.phase
  });
  return c;
}
function sessionFor(dow){ return SESSIONS[dow] || null; }

function dayScore(k){
  const now = parseKey(k);
  const dow = now.getDay();
  const gym = isGymDay(dow);
  const d = S.days[k] || { checks:{}, water:0 };
  const checks = d.checks || {};
  const need = ["fruehstueck","mittag","snack","abend","supps"];
  if (wantsPosture()) need.push("haltung");
  if (gym) need.push("gym");
  const hit = need.filter(id => checks[id]).length;
  const waterOk = (d.water||0) >= S.profile.waterMl * 0.8;
  const walk = !gym && checks.walk;
  const total = need.length + 1;
  const got = hit + (waterOk ? 1 : 0);
  return { got, total, pct: got/total, solid: got/total >= 0.8, gym, need, checks, waterOk, walk };
}

function streakCount(){
  let n=0;
  for (let i=0;i<400;i++){
    const d=addDays(new Date(), -i);
    const sc=dayScore(keyOf(d));
    if (sc.solid) n++;
    else { if (i===0) continue; break; }
  }
  return n;
}

function weekSolid(){
  let n=0;
  for (let i=0;i<7;i++){
    const d=addDays(new Date(), -i);
    if (dayScore(keyOf(d)).solid) n++;
  }
  return n;
}

function macrosToday(k, dow){
  const d = dayObj(k);
  const M = mealsFor(dow, d.swaps);
  let kcal=0, prot=0;
  M.forEach(m=>{
    if (d.checks[m.id]) {
      const r = RECIPES[m.rid];
      kcal += r.kcal; prot += r.prot;
    }
  });
  return { kcal, prot, meals: M };
}

function lastLift(id){
  const arr = S.lifts[id] || [];
  return arr.length ? arr[arr.length-1] : null;
}

function weekRatio(){
  let pull=0, push=0;
  const now=new Date();
  const day = now.getDay();
  const monday = addDays(now, day===0 ? -6 : 1-day);
  for (let i=0;i<7;i++){
    const k = keyOf(addDays(monday, i));
    const log = (S.days[k]||{}).gymLog;
    if (!log || !log.sets) continue;
    const sess = Object.values(SESSIONS).find(s=>s.id===log.sessionId);
    if (!sess) continue;
    sess.exercises.forEach(ex=>{
      const rows = log.sets[ex.id] || [];
      const done = rows.filter(s=>s.ok).length;
      if (ex.kind==="pull") pull += done;
      if (ex.kind==="push") push += done;
    });
  }
  return { pull, push };
}

function weightTrend(){
  const ws = S.weights;
  if (ws.length < 2) return null;
  const last = ws.slice(-8);
  if (last.length < 2) return null;
  const a = last[0], b = last[last.length-1];
  const days = Math.max(1, (parseKey(b.date)-parseKey(a.date))/864e5);
  const perWeek = (b.kg - a.kg) / days * 7;
  const recent = ws.filter(w => (parseKey(todayKey())-parseKey(w.date))/864e5 <= 21);
  const half = Math.floor(recent.length/2);
  let plateau = false;
  if (recent.length >= 4 && half >= 2) {
    const m1 = recent.slice(0,half).reduce((s,w)=>s+w.kg,0)/half;
    const m2 = recent.slice(-half).reduce((s,w)=>s+w.kg,0)/half;
    plateau = Math.abs(m1-m2) < 0.35 && S.profile.phase==="deficit" && weeksBetween(S.profile.phaseStart, todayKey()) >= 3;
  }
  const cur = ws[ws.length-1].kg;
  const goal = (S.profile.goalLow + S.profile.goalHigh)/2;
  let eta = null;
  if (perWeek < -0.1 && cur > goal) {
    const weeks = (cur-goal)/Math.abs(perWeek);
    eta = addDays(new Date(), Math.round(weeks*7));
  }
  return { perWeek, plateau, cur, start: S.profile.startKg ?? ws[0].kg, total: cur - (S.profile.startKg ?? ws[0].kg), eta, goal };
}

function photoDue(){
  const weeksIn = weeksBetween(S.firstUse, todayKey());
  return weeksIn>0 && weeksIn % 4 === 0;
}

function phaseWeeks(){ return weeksBetween(S.profile.phaseStart, todayKey()); }

function breakDue(){
  return S.profile.phase==="deficit" && phaseWeeks() >= 8;
}

function coachLine(now, dow, gym, d, macros, sc){
  const hour = now.getHours();
  const tr = weightTrend();
  const sess = sessionFor(dow);
  if (S.profile.phase==="break") return "Diätpause. Essen auf Erhaltung, Training bleibt. Das schützt, was du schon gebaut hast.";
  if (S.profile.phase==="reverse") return "Reverse Diet: kleine Kalorienschritte hoch. Gewicht darf leicht steigen — das ist geplant.";
  if (tr && tr.plateau) return "Der Trend steht seit etwa 3 Wochen. 150 kcal weniger ist erlaubt — nie unter 1.900.";
  if (breakDue()) return "Du bist "+phaseWeeks()+" Wochen im Defizit. Eine 1–2-wöchige Pause auf 2.650 kcal wäre jetzt der clevere Zug.";
  if (dow===0 && photoDue()) return "Foto-Woche. Drei Posen, gleiches Licht, gleicher Abstand wie am Tag 1.";
  if (dow===0 && hour<12) return "Sonntag. Nüchtern auf die Waage, dann Spiegel: liegt das Ohr über der Schulter?";
  if (hour>=20 && !d.checks.haltung) return "Noch 10 Minuten für den Nacken. Die Routine zählt mehr als ein heroischer Satz Bankdrücken.";
  if (macros.prot < 120 && hour>=15 && hour<21) return "Protein ist der Hebel. Snack jetzt, dann sitzt das Abendessen entspannter.";
  if (gym && sess && !d.checks.gym && hour>=9 && hour<21) return sess.hook;
  if (dow===3) return REST_DAY[3].hook;
  if (dow===0) return REST_DAY[0].hook;
  if (sc.solid) return "Tag steht. Nicht nachlegen, nicht verhandeln — so sieht 80 % über Monate aus.";
  if (hour<11) return "Ruhig starten. Frühstück, Wasser, Haltung. Der Tag wird nicht in der ersten Stunde gewonnen.";
  return "Ein gehaltener Plan schlägt ein perfekter. Nimm den nächsten Haken, nicht alle.";
}

function ringSVG(pct, color){
  const p = Math.max(0, Math.min(1, pct));
  const c = 2*Math.PI*26;
  const off = (c*(1-p)).toFixed(1);
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="26" stroke="var(--line)" stroke-width="6" fill="none"/>
    <circle cx="32" cy="32" r="26" stroke="${color}" stroke-width="6" fill="none"
      stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off}"/>
  </svg>`;
}

function shoppingList(){
  const map = new Map();
  for (let i=0;i<7;i++){
    const d = addDays(new Date(), i);
    const meals = mealsFor(d.getDay(), (S.days[keyOf(d)]||{}).swaps);
    meals.forEach(m=>{
      const r = RECIPES[m.rid];
      (r.items||[]).forEach(([q,n])=>{
        if (!n) return;
        const key = n.toLowerCase();
        if (!map.has(key)) map.set(key, { q: q||"", n, count: 0 });
        map.get(key).count++;
      });
    });
  }
  return [...map.values()];
}

/* ───────── app state ───────── */
let tab = "heute";
let openMeal = null;
let deferredPrompt = null;
let guide = null;
let onbStep = 0;
let draft = null;
const UNLOCK_KEY = "avshot-unlocked";

function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}
function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isUnlocked(){
  if (!S.profile.pinHash) return true;
  try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch(e){ return false; }
}
function setUnlocked(on){
  try { if (on) sessionStorage.setItem(UNLOCK_KEY,"1"); else sessionStorage.removeItem(UNLOCK_KEY); } catch(e){}
}
function bufToB64(buf){
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i=0;i<bytes.length;i++) out += String.fromCharCode(bytes[i]);
  return btoa(out);
}
function b64ToBuf(b64){
  const raw = atob(b64);
  const u = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) u[i] = raw.charCodeAt(i);
  return u;
}
async function hashPin(pin, saltB64){
  const enc = new TextEncoder();
  const salt = saltB64 ? b64ToBuf(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt, iterations:120000 }, key, 256);
  return { hash: bufToB64(bits), salt: bufToB64(salt) };
}

window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault();
  deferredPrompt = e;
  render();
});
window.addEventListener("appinstalled", ()=>{
  deferredPrompt = null;
  S.profile.hideInstall = true;
  save();
  toast("App liegt auf dem Startbildschirm");
  render();
});

const TABS = [
  { id:"heute", l:"Heute", svg:'<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4M16 4v4M4 10h16"/></svg>' },
  { id:"gym", l:"Gym", svg:'<svg viewBox="0 0 24 24"><path d="M4 10v4M8 7v10M16 7v10M20 10v4M8 12h8"/></svg>' },
  { id:"haltung", l:"Haltung", svg:'<svg viewBox="0 0 24 24"><path d="M12 4c1.2 2.5 2 6 2 8s-.8 5.5-2 8c-1.2-2.5-2-6-2-8s.8-5.5 2-8z"/><circle cx="12" cy="4" r="1.4"/></svg>' },
  { id:"koerper", l:"Körper", svg:'<svg viewBox="0 0 24 24"><path d="M4 16l5-5 4 3 7-8"/><path d="M15 6h5v5"/></svg>' },
  { id:"plan", l:"Plan", svg:'<svg viewBox="0 0 24 24"><path d="M8 7h11M8 12h11M8 17h8"/><path d="M5 7h.01M5 12h.01M5 17h.01"/></svg>' }
];

/* ───────── actions ───────── */
function setTab(t){ tab=t; openMeal=null; render(); window.scrollTo(0,0); }

function toggle(id){
  const d = dayObj(todayKey());
  d.checks[id] = !d.checks[id];
  save(); buzz(18); render();
}

function setWater(ml){
  const d = dayObj(todayKey());
  d.water = Math.max(0, Math.min(4000, ml));
  if (d.water >= S.profile.waterMl * 0.8) d.checks.wasser = true;
  save(); buzz(12); render();
}

function swapMeal(slot, rid){
  const d = dayObj(todayKey());
  d.swaps[slot] = rid;
  save(); render();
}

function toggleRitual(id, val){
  const d = dayObj(todayKey());
  if (val === undefined) d.ritual[id] = !d.ritual[id];
  else d.ritual[id] = val;
  if (id==="weighed" && d.ritual.weighed) setTab("koerper");
  save(); render();
}

function addWeight(){
  const v = parseDec($("#win") && $("#win").value);
  if (!v || v<40 || v>250){ buzz([50,40,50]); toast("Gewicht prüfen (40–250 kg)"); return; }
  const k = todayKey();
  S.weights = [...S.weights.filter(w=>w.date!==k), { date:k, kg:v }].sort((a,b)=>a.date.localeCompare(b.date));
  if (S.profile.startKg == null) S.profile.startKg = v;
  const d = dayObj(k); d.ritual.weighed = true;
  save(); requestPersist(); buzz(28); render(); toast("Gewicht gespeichert auf diesem Gerät");
}

function delWeight(date){
  S.weights = S.weights.filter(w=>w.date!==date);
  save(); render();
}

function saveMirror(){
  const answers = {};
  MIRROR.forEach(m=>{
    const sel = document.querySelector(`input[name="m-${m.id}"]:checked`);
    answers[m.id] = sel ? sel.value : null;
  });
  if (Object.values(answers).some(v=>!v)){ toast("Bitte alle drei Fragen"); return; }
  const score = Object.values(answers).reduce((a,v)=>a+(v==="yes"?2:v==="almost"?1:0),0);
  S.posture = [...S.posture.filter(p=>p.date!==todayKey()), { date:todayKey(), answers, score }];
  const d = dayObj(todayKey()); d.ritual.mirror = true;
  save(); buzz(24); render(); toast("Spiegeltest gespeichert");
}

function logPhoto(){
  if (!S.photos.includes(todayKey())) S.photos.push(todayKey());
  dayObj(todayKey()).ritual.photos = true;
  save(); render(); toast("Foto-Woche markiert");
}

function ensureGymLog(sess){
  const d = dayObj(todayKey());
  if (!d.gymLog || d.gymLog.sessionId !== sess.id){
    const sets = {};
    sess.exercises.forEach(ex=>{
      const last = lastLift(ex.id);
      sets[ex.id] = Array.from({length: ex.sets}, ()=>({
        kg: last && last.kg != null ? last.kg : "",
        reps: last && last.reps != null ? last.reps : "",
        ok: false
      }));
    });
    d.gymLog = { sessionId: sess.id, sets };
    save();
  }
  return d.gymLog;
}

function patchSet(exId, i, field, val){
  const d = dayObj(todayKey());
  if (!d.gymLog || !d.gymLog.sets[exId]) return;
  d.gymLog.sets[exId][i][field] = sanitizeNumInput(val);
  save();
}

function toggleSet(exId, i){
  const d = dayObj(todayKey());
  const row = d.gymLog && d.gymLog.sets[exId] && d.gymLog.sets[exId][i];
  if (!row) return;
  row.ok = !row.ok;
  save(); buzz(14); render();
}

function stepKg(exId, i, dir){
  const d = dayObj(todayKey());
  const row = d.gymLog.sets[exId][i];
  let kg = parseDec(row.kg);
  if (!Number.isFinite(kg)) kg = lastLift(exId)?.kg || 20;
  kg = Math.max(0, +(kg + dir*2.5).toFixed(1));
  row.kg = kg;
  save(); render();
}

function finishGym(){
  const d = dayObj(todayKey());
  const log = d.gymLog;
  if (!log) return;
  const sess = Object.values(SESSIONS).find(s=>s.id===log.sessionId);
  sess.exercises.forEach(ex=>{
    const done = (log.sets[ex.id]||[]).filter(s=>s.ok && parseDec(s.kg)>=0);
    if (!done.length) return;
    const last = done[done.length-1];
    const kg = parseDec(last.kg), reps = parseDec(last.reps);
    if (!Number.isFinite(kg)) return;
    S.lifts[ex.id] = [...(S.lifts[ex.id]||[]).filter(x=>x.date!==todayKey()), { date:todayKey(), kg, reps: Number.isFinite(reps)?reps:last.reps }];
  });
  d.checks.gym = true;
  save(); beep(880,160); buzz([80,40,80]); toast("Training gespeichert — Last halten zählt"); render();
}

function applyCut(){
  const next = Math.max(S.profile.kcalFloor, S.profile.kcal - 150);
  S.profile.kcalDeficit = next;
  S.profile.kcal = next;
  save(); toast("Ziel jetzt "+next+" kcal"); render();
}

function startBreak(){
  S.profile.kcalDeficit = S.profile.kcal;
  S.profile.phase = "break";
  S.profile.phaseStart = todayKey();
  S.profile.kcal = S.profile.kcalMaintain;
  save(); toast("Diätpause — Erhaltung"); render();
}

function endBreak(){
  S.profile.phase = "deficit";
  S.profile.phaseStart = todayKey();
  S.profile.kcal = S.profile.kcalDeficit || 2150;
  save(); toast("Zurück ins Defizit"); render();
}

function startReverse(){
  S.profile.phase = "reverse";
  S.profile.phaseStart = todayKey();
  S.profile.kcal = S.profile.kcalMaintain;
  save(); toast("Reverse Diet gestartet"); render();
}

function reverseStep(){
  S.profile.kcal = S.profile.kcal + 150;
  save(); toast("+"+150+" kcal — jetzt "+S.profile.kcal); render();
}

function saveSettings(){
  const kcal = parseDec($("#set-kcal").value);
  const prot = parseDec($("#set-prot").value);
  const water = parseDec($("#set-water").value);
  const height = parseDec($("#set-height").value);
  if (kcal>=S.profile.kcalFloor && kcal<=4000) S.profile.kcal = kcal;
  if (prot>=80 && prot<=250) S.profile.protein = prot;
  if (water>=1000 && water<=5000) S.profile.waterMl = water;
  if (Number.isFinite(height) && height>=140 && height<=220) S.profile.heightCm = height;
  S.profile.sound = $("#set-sound").checked;
  S.profile.haptic = $("#set-haptic").checked;
  save(); toast("Einstellungen gespeichert"); render();
}

function toggleShop(i){
  const w = isoWeek(new Date());
  if (S.shop.week !== w){ S.shop = { week:w, checks:{} }; }
  const item = shoppingList()[i];
  if (!item) return;
  const key = item.n.toLowerCase();
  S.shop.checks[key] = !S.shop.checks[key];
  save(); render();
}

function togglePrep(i){
  const d = dayObj(todayKey());
  d.ritual.prep = d.ritual.prep || {};
  d.ritual.prep[i] = !d.ritual.prep[i];
  const list = PREP[new Date().getDay()];
  if (list && Object.values(d.ritual.prep).filter(Boolean).length >= list.items.length) d.ritual.mealPrep = true;
  save(); render();
}

function finishOnboard(){ onbNext(); }

function exportData(){
  const blob = new Blob([JSON.stringify(S,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "avshot-health-"+todayKey()+".json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 500);
}

function importData(file){
  if (!file) return;
  if (file.size > 2e6){ toast("Datei zu groß"); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try{
      if (String(reader.result).length > 2e6) throw new Error("big");
      const parsed = JSON.parse(reader.result);
      const next = migrate(parsed);
      if (!next || next.app !== "avshot-health") throw new Error("app");
      S = next;
      save();
      setUnlocked(false);
      toast("Daten importiert — PIN eingeben");
      render();
    }catch(e){ toast("Datei ungültig"); }
  };
  reader.readAsText(file);
}

async function installApp(){
  if (deferredPrompt){
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    render();
    return;
  }
  setTab("plan");
  toast(isIOS() ? "Unten: Safari → Teilen → Home-Bildschirm" : "Im Browser-Menü: App installieren");
}

function hideInstall(){
  S.profile.hideInstall = true;
  save();
  render();
}

function installBanner(){
  if (isStandalone() || S.profile.hideInstall) return "";
  if (deferredPrompt){
    return `<div class="banner">
      <div style="font-weight:700;margin-bottom:4px">Aufs Handy legen</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:10px">Eigene App auf dem Startbildschirm. Offline, ohne Account, Daten bleiben hier.</div>
      <button class="btn" data-act="install">Jetzt installieren</button>
    </div>`;
  }
  if (isIOS()){
    return `<div class="banner">
      <div style="font-weight:700;margin-bottom:4px">Als App aufs iPhone</div>
      <div style="font-size:13px;color:var(--muted)">In <b style="color:var(--text)">Safari</b> öffnen — nicht in Instagram oder Chrome.</div>
      <ol class="steps">
        <li><b>1</b><span>Unten auf <b style="color:var(--text)">Teilen</b> tippen (Quadrat mit Pfeil nach oben).</span></li>
        <li><b>2</b><span>Nach unten scrollen → <b style="color:var(--text)">Zum Home-Bildschirm</b>.</span></li>
        <li><b>3</b><span>Hinzufügen. Danach AV Health wie jede andere App öffnen.</span></li>
      </ol>
      <button class="btn ghost sm" style="margin-top:10px" data-act="hide-install">Später</button>
    </div>`;
  }
  return `<div class="banner">
    <div style="font-weight:700;margin-bottom:4px">Als App installieren</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Chrome oder Edge: Menü <b style="color:var(--text)">⋮</b> oben rechts → <b style="color:var(--text)">App installieren</b> bzw. <b style="color:var(--text)">Zum Startbildschirm</b>.
    </div>
    <button class="btn ghost sm" data-act="hide-install">Später</button>
  </div>`;
}

/* ───────── guided routine ───────── */
function activeQueue(){ return guide && guide.mode==="desk" ? QUEUE_DESK : QUEUE_FULL; }

function startGuide(mode){
  const q = mode==="desk" ? QUEUE_DESK : QUEUE_FULL;
  guide = { idx:0, mode: mode||"full", endsAt: Date.now()+q[0].dur*1000, paused:false, pausedLeft:0 };
  if (actx && actx.state==="suspended") actx.resume();
  beep(660); buzz([120,60,120]);
  requestWake();
  document.body.classList.add("guide-on");
  renderGuide(true);
  guide.timer = setInterval(tickGuide, 200);
}

function remainingGuide(){
  if (!guide) return 0;
  if (guide.paused) return Math.max(0, Math.ceil(guide.pausedLeft/1000));
  return Math.max(0, Math.ceil((guide.endsAt - Date.now())/1000));
}

function tickGuide(){
  if (!guide || guide.paused) return;
  const left = remainingGuide();
  const step = activeQueue()[guide.idx];
  if (left<=3 && left>0 && step && step.type!=="rest") beep(520,80);
  if (left<=0) nextGuide();
  else updateGuideNums();
}

function nextGuide(){
  const q = activeQueue();
  guide.idx++;
  if (guide.idx>=q.length){ finishGuide(); return; }
  guide.endsAt = Date.now()+q[guide.idx].dur*1000;
  const st = q[guide.idx];
  if (st.type==="work"){ beep(880,160); buzz([160,70,160]); }
  else { beep(440,90); buzz(30); }
  renderGuide(true);
}

function skipGuide(){ nextGuide(); }
function pauseGuide(){
  if (!guide) return;
  if (!guide.paused){
    guide.pausedLeft = Math.max(0, guide.endsAt - Date.now());
    guide.paused = true;
  } else {
    guide.endsAt = Date.now()+guide.pausedLeft;
    guide.paused = false;
  }
  renderGuide(false);
}
function stopGuide(){
  if (guide){ clearInterval(guide.timer); guide=null; }
  releaseWake();
  const g=$("#guide"); if (g) g.remove();
  document.body.classList.remove("guide-on");
  render();
}
function finishGuide(){
  clearInterval(guide.timer);
  const mode = guide.mode;
  guide=null; releaseWake();
  const d = dayObj(todayKey());
  d.checks.haltung = true;
  save();
  beep(880,140); setTimeout(()=>beep(1100,140),170); setTimeout(()=>beep(1320,220),360);
  buzz([200,80,200,80,360]);
  const g=$("#guide");
  if (g) g.innerHTML = `<div style="flex:1"></div>
    <div style="font-size:48px;color:var(--gold)">◆</div>
    <div style="font-size:22px;font-weight:700;margin:10px 0 6px">${mode==="desk"?"Reset erledigt":"Routine komplett"}</div>
    <div style="font-size:14px;color:var(--muted);text-align:center;line-height:1.6;max-width:320px">
      Haltungsarbeit für heute abgehakt.<br>Dein Nacken merkt das nicht morgen — er merkt das in acht Wochen.</div>
    <div style="flex:1"></div>
    <button class="btn big" data-act="guide-stop">Fertig</button>`;
}

function updateGuideNums(){
  const n=$("#gnum"), r=$("#gring"), cue=$("#gcue");
  const q = activeQueue(); const step=q[guide.idx]; if (!step) return;
  const left = remainingGuide();
  if (n) n.textContent = left;
  if (r){
    const c=408;
    r.setAttribute("stroke-dashoffset", (c*(1-left/step.dur)).toFixed(1));
  }
  if (cue && step.type==="work" && !guide.paused){
    const e = EX[step.ex];
    const phase = Math.floor((step.dur-left)/4)%2;
    cue.textContent = phase===1 ? e.breath : e.cue;
  }
}

function renderGuide(rebuild){
  let g=$("#guide");
  if (!g){ g=document.createElement("div"); g.id="guide"; g.className="guide"; document.body.appendChild(g); }
  const q = activeQueue();
  const step=q[guide.idx], e=EX[step.ex];
  const elapsed = q.slice(0,guide.idx).reduce((a,s)=>a+s.dur,0) + (step.dur-remainingGuide());
  const total = q.reduce((a,s)=>a+s.dur,0);
  const left = remainingGuide();
  const c=408;
  let title="", sub="", cue="";
  if (step.type==="ready"){ title="Bereit"; sub=step.label; cue="Position einnehmen. Nächster Block startet gleich."; }
  else if (step.type==="rest"){ title="Pause"; sub=step.next?("Als Nächstes: "+step.next):"Atmen"; cue="Locker, nicht das Handy. Nächster Block kommt."; }
  else {
    title=e.name;
    sub=`Satz ${step.set}/${step.sets}${step.side?` · ${step.side}`:""}`;
    cue=e.cue;
  }
  if (!rebuild && $("#gnum")){
    $("#gnum").textContent = left;
    const head = g.querySelector("[data-ghead]");
    if (head) head.textContent = `Block ${guide.idx+1}/${q.length} · ~${Math.max(0,Math.round((total-elapsed)/60))} Min übrig`;
    const pauseBtn = g.querySelector("[data-pause]");
    if (pauseBtn) pauseBtn.textContent = guide.paused ? "▶ Weiter" : "❚❚ Pause";
    const cueEl = $("#gcue");
    if (cueEl) { cueEl.textContent = guide.paused ? "Pausiert" : cue; cueEl.className = guide.paused?"":"pulse"; }
    return;
  }
  g.innerHTML = `
    <div style="width:100%;display:flex;justify-content:space-between;align-items:center">
      <button class="btn ghost sm" data-act="guide-stop">✕ Beenden</button>
      <div data-ghead style="font-size:12px;color:var(--muted)">Block ${guide.idx+1}/${q.length} · ~${Math.max(0,Math.round((total-elapsed)/60))} Min übrig</div>
    </div>
    <div style="flex:0.4"></div>
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)">${esc(sub)}</div>
    <div style="font-size:21px;font-weight:700;text-align:center;margin:4px 0 2px">${esc(title)}</div>
    <div class="gex">${step.type==="work" || step.type==="ready" ? fig(e.id,true).replace('class="gex"','') : ""}</div>
    <div class="ring">
      <svg width="150" height="150"><circle cx="75" cy="75" r="65" stroke="var(--line)" stroke-width="7" fill="none"/>
      <circle id="gring" cx="75" cy="75" r="65" stroke="var(--gold)" stroke-width="7" fill="none"
        stroke-linecap="round" stroke-dasharray="408" stroke-dashoffset="${(c*(1-left/step.dur)).toFixed(1)}"
        style="transition:stroke-dashoffset .2s linear"/></svg>
      <div class="num" id="gnum">${left}</div>
    </div>
    <div id="gcue" style="font-size:13.5px;color:var(--muted);text-align:center;line-height:1.55;max-width:330px" class="${guide.paused?"":"pulse"}">${esc(guide.paused?"Pausiert":cue)}</div>
    <div style="flex:1"></div>
    <div style="display:flex;gap:10px;width:100%;max-width:360px">
      <button class="btn ghost" data-pause style="flex:1;padding:14px" data-act="guide-pause">${guide.paused?"▶ Weiter":"❚❚ Pause"}</button>
      <button class="btn ghost" style="flex:1;padding:14px" data-act="guide-skip">Weiter ›</button>
    </div>`;
}

document.addEventListener("visibilitychange", ()=>{
  if (document.visibilityState==="visible" && guide && !guide.paused) updateGuideNums();
  if (document.visibilityState==="visible" && guide) requestWake();
});

/* ───────── render ───────── */
function header(now, dow, gym, streak){
  const phase = PHASES[S.profile.phase] || PHASES.deficit;
  const label = gym ? "Trainingstag" : (dow===0 ? "Flexibler Tag" : "Ruhetag + Meal Prep");
  return `<div class="head">
      <div class="brand">AV·SHOT&nbsp;HEALTH</div>
      <div style="display:flex;gap:8px;align-items:center">
        ${streak>0?`<div style="font-size:12px;color:var(--gold)">◆ ${streak} in Serie</div>`:""}
        <span class="pill">${esc(phase.label)}</span>
      </div>
    </div>
    <h1>${WD[dow]}</h1>
    <div class="sub">${now.toLocaleDateString("de-DE",{day:"numeric",month:"long"})} · ${label}${S.profile.name?` · ${esc(S.profile.name)}`:""}</div>
    ${S.savedAt?`<div class="sub" style="margin-top:-10px">Gespeichert ${new Date(S.savedAt).toLocaleString("de-DE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})} · nur dieses Gerät</div>`:""}`;
}

function weekStrip(now){
  let frames="", labels="";
  for (let i=6;i>=0;i--){
    const d=addDays(now,-i);
    const sc=dayScore(keyOf(d));
    const cls = sc.solid?"on": sc.pct>=0.4?"part":"";
    const today = keyOf(d)===todayKey() ? " today":"";
    frames += `<div class="frame ${cls}${today}"></div>`;
    labels += `<span class="${today?"today":""}">${WD_SHORT[d.getDay()]}</span>`;
  }
  return `<div class="strip">${frames}</div><div class="wdrow">${labels}</div>`;
}

function renderHeute(now, dow, gym, d, sc){
  const macros = macrosToday(todayKey(), dow);
  const kcalT = S.profile.kcal;
  const protT = dow===0 ? 150 : S.profile.protein;
  const waterT = S.profile.waterMl;
  const cups = 10;
  const cupMl = Math.round(waterT/cups);
  const filled = Math.round(d.water / cupMl);
  let html = "";
  html += installBanner();
  html += `<div class="coach">${esc(coachLine(now,dow,gym,d,macros,sc))}</div>`;
  html += `<div class="card">
    <div class="head" style="margin-bottom:8px;font-size:12px;color:var(--muted)">
      <span>Letzte 7 Tage</span>
      <span style="color:${sc.solid?"var(--green)":"var(--text)"}">${sc.got}/${sc.total} heute · ${weekSolid()}/7 solide</span>
    </div>
    ${weekStrip(now)}
    ${sc.solid?`<div style="margin-top:10px;font-size:13px;color:var(--green)">Tag steht — sauber gedreht.</div>`:""}
  </div>`;

  html += `<div class="rings">
    <div class="ringstat">${ringSVG(macros.kcal/kcalT, "var(--gold)")}<div class="rv">${macros.kcal} / ${kcalT}</div><div class="rk">kcal</div></div>
    <div class="ringstat">${ringSVG(macros.prot/protT, macros.prot>=protT?"var(--green)":"var(--gold)")}<div class="rv">${macros.prot} / ${protT} g</div><div class="rk">Protein</div></div>
    <div class="ringstat">${ringSVG(d.water/waterT, d.water>=waterT*0.8?"var(--green)":"var(--gold)")}<div class="rv">${(d.water/1000).toFixed(1).replace(".",",")} / ${(waterT/1000).toFixed(1).replace(".",",")} L</div><div class="rk">Wasser</div></div>
  </div>`;

  html += `<div class="card"><div class="k" style="font-size:11px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase">Wasser · keine Kalorien trinken</div>
    <div class="water">`;
  for (let i=0;i<cups;i++){
    html += `<button class="cup ${i<filled?"on":""}" data-act="water-cup" data-i="${i}" aria-label="${(i+1)*cupMl} ml"></button>`;
  }
  html += `</div>
    <div class="row">
      <button class="btn ghost sm" style="flex:1" data-act="water-add" data-ml="250">+250 ml</button>
      <button class="btn ghost sm" style="flex:1" data-act="water-add" data-ml="500">+500 ml</button>
      <button class="btn ghost sm" style="flex:1" data-act="water-reset">Reset</button>
    </div></div>`;

  if (dow===0){
    html += `<div class="banner"><div class="gold" style="font-weight:700;margin-bottom:8px">Sonntags-Check</div>
      <button class="task ${d.ritual.weighed?"done":""}" data-act="tab" data-id="koerper">
        <div class="chk">${d.ritual.weighed?"✓":""}</div>
        <div><div class="l1">Nüchtern wiegen</div><div class="l2">Trend, nicht die einzelne Zahl</div></div></button>
      <button class="task ${d.ritual.mirror?"done":""}" data-act="tab" data-id="haltung">
        <div class="chk">${d.ritual.mirror?"✓":""}</div>
        <div><div class="l1">Spiegeltest</div><div class="l2">Ohr über Schulter? Rippen unten? Knöchel unsichtbar?</div></div></button>
      <button class="task ${d.ritual.mealPrep?"done":""}" data-act="tab" data-id="plan">
        <div class="chk">${d.ritual.mealPrep?"✓":""}</div>
        <div><div class="l1">Meal Prep Mo–Di</div><div class="l2">Bowls kochen, Snacks legen</div></div></button>
      ${photoDue()?`<button class="task ${d.ritual.photos?"done":""}" data-act="photo">
        <div class="chk">${d.ritual.photos?"✓":""}</div>
        <div><div class="l1">Fortschrittsfotos</div><div class="l2">3 Posen, gleiches Licht wie am Start</div></div></button>`:""}
    </div>`;
  }

  html += `<div class="sect">Mahlzeiten</div>`;
  macros.meals.forEach(m=>{
    const r = RECIPES[m.rid];
    const open = openMeal===m.id;
    html += `<div class="task ${d.checks[m.id]?"done":""}">
      <button class="chk" data-act="toggle" data-id="${m.id}">${d.checks[m.id]?"✓":""}</button>
      <button style="flex:1;min-width:0;background:none;border:none;color:inherit;text-align:left;padding:0" data-act="meal" data-id="${m.id}">
        <div class="l1">${esc(m.label)}</div>
        <div class="l2">${esc(r.name)}</div>
      </button>
      <div class="meta">${r.kcal} kcal · ${r.prot} g P</div></div>`;
    if (open){
      html += `<div class="recipe"><div>${esc(r.how)}</div><ul>`;
      r.items.forEach(([q,n])=> html += `<li>${q?esc(q)+" ":""}${esc(n)}</li>`);
      html += `</ul>`;
      if (SWAPS[m.id]){
        html += `<div class="swaps">`;
        SWAPS[m.id].forEach(([rid,lab])=>{
          html += `<button class="chip ${m.rid===rid?"on":""}" data-act="swap" data-slot="${m.id}" data-rid="${rid}">${esc(lab)}</button>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    }
  });

  html += `<div class="sect">Training &amp; Routine</div>`;
  html += `<button class="task ${d.checks.haltung?"done":""}" data-act="tab" data-id="haltung">
    <div class="chk">${d.checks.haltung?"✓":""}</div>
    <div style="flex:1"><div class="l1">10 Min Haltungsroutine</div><div class="l2">Geführt mit Timer, Pausen und Atem-Cues</div></div></button>`;
  if (gym){
    const sess = sessionFor(dow);
    html += `<button class="task ${d.checks.gym?"done":""}" data-act="tab" data-id="gym">
      <div class="chk">${d.checks.gym?"✓":""}</div>
      <div style="flex:1"><div class="l1">${esc(sess.name)} · ~${sess.minutes} Min</div><div class="l2">${esc(sess.focus)} · 2 Sätze Zug pro 1 Satz Druck</div></div></button>`;
  } else {
    html += `<button class="task ${d.checks.walk?"done":""}" data-act="toggle" data-id="walk">
      <div class="chk">${d.checks.walk?"✓":""}</div>
      <div style="flex:1"><div class="l1">30 Min spazieren</div><div class="l2">Hüfte öffnen, Defizit füttern, ohne die Gelenke zu plündern</div></div></button>`;
  }
  html += `<button class="task ${d.checks.supps?"done":""}" data-act="toggle" data-id="supps">
    <div class="chk">${d.checks.supps?"✓":""}</div>
    <div style="flex:1"><div class="l1">Kreatin 5 g + Vitamin D3</div><div class="l2">Zeitpunkt egal — Hauptsache täglich</div></div></button>`;

  if (now.getHours()>=20 && !sc.solid){
    html += `<div class="card" style="margin-top:8px;font-size:13px;color:var(--muted);line-height:1.5">
      Der Tag muss nicht perfekt sein. ${sc.got}/${sc.total} ist der Stand — 80 % reicht, um in 8 Monaten woanders zu stehen.
    </div>`;
  }
  return html;
}

function renderGym(now, dow, gym, d){
  const ratio = weekRatio();
  const targetPush = ratio.push;
  const targetPull = targetPush * 2;
  const okRatio = ratio.push===0 ? ratio.pull>0 : (ratio.pull >= ratio.push*1.6);
  let html = `<div class="card">
    <div class="head"><div style="font-weight:700">Zug : Druck diese Woche</div>
      <div class="${okRatio?"green":"gold"}">${ratio.pull} : ${ratio.push}</div></div>
    <div class="bar" title="Ziel 2:1"><i class="pull" style="width:${Math.max(8, 100*ratio.pull/Math.max(1,ratio.pull+ratio.push))}%"></i>
      <i class="push" style="width:${Math.max(8, 100*ratio.push/Math.max(1,ratio.pull+ratio.push))}%"></i></div>
    <div class="sub" style="margin:8px 0 0">Ziel ~2:1. Face Pulls und Rudern sind keine Beilage — sie sind der Plan.</div>
  </div>`;

  html += `<div class="sect">Woche</div>`;
  [1,2,3,4,5,6,0].forEach(day=>{
    const sess = SESSIONS[day];
    const rest = REST_DAY[day];
    const cur = day===dow;
    const name = sess ? sess.name : rest.name;
    html += `<div class="task" style="cursor:default;${cur?"border-color:var(--gold-dim);background:var(--surface2)":""}">
      <span style="width:28px;color:${cur?"var(--gold)":"var(--muted)"};font-size:13px;font-weight:600">${WD_SHORT[day]}</span>
      <span style="font-size:13.5px;color:${cur?"var(--text)":"var(--muted)"}">${esc(name)}</span>
      ${sess?`<span class="meta">${sess.minutes} Min</span>`:""}
    </div>`;
  });

  if (!gym){
    const rest = REST_DAY[dow];
    html += `<div class="coach" style="margin-top:8px">${esc(rest.hook)}</div>
      <button class="task ${d.checks.walk?"done":""}" data-act="toggle" data-id="walk">
        <div class="chk">${d.checks.walk?"✓":""}</div>
        <div><div class="l1">30 Min spazieren</div><div class="l2">Heute kein Eisen. Haltung und Prep zählen voll.</div></div></button>`;
    return html;
  }

  const sess = sessionFor(dow);
  const log = ensureGymLog(sess);
  html += `<div class="sect">${esc(sess.name)}</div>
    <div class="card" style="border-color:var(--gold-dim)">
      <div style="font-size:13px;color:var(--muted);line-height:1.5">${esc(sess.hook)}
      ${S.profile.phase==="deficit"?`<br><span class="gold">Im Defizit: Last halten. Wenn die Kilos stehen bleiben, gewinnst du.</span>`:""}</div>
    </div>`;

  sess.exercises.forEach(ex=>{
    const last = lastLift(ex.id);
    const rows = log.sets[ex.id];
    const held = last && rows.some(r=>r.ok && parseDec(r.kg)>=last.kg);
    html += `<div class="card" style="padding:12px 14px">
      <div class="head">
        <div><span class="kind ${ex.kind}">${KIND_LABEL[ex.kind]}</span>
          <div style="font-weight:700;margin-top:2px">${esc(ex.name)}</div></div>
        <div style="text-align:right;font-size:12px;color:var(--muted)">${ex.sets} × ${esc(ex.reps)}
          ${last?`<div class="${held?"green":""}">zuletzt ${fmtKg(last.kg)} kg</div>`:`<div>erster Eintrag</div>`}
        </div>
      </div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.4">${esc(ex.cue)}</div>`;
    rows.forEach((row,i)=>{
      html += `<div class="setrow">
        <div class="n">${i+1}</div>
        <button class="step" data-act="step-kg" data-ex="${ex.id}" data-i="${i}" data-dir="-1">−</button>
        <input type="text" inputmode="decimal" value="${row.kg===""?"":esc(String(row.kg)).replace(".",",")}"
          data-act="patch-set" data-ex="${ex.id}" data-i="${i}" data-field="kg" placeholder="kg">
        <button class="step" data-act="step-kg" data-ex="${ex.id}" data-i="${i}" data-dir="1">+</button>
        <input type="text" inputmode="numeric" value="${esc(String(row.reps))}"
          data-act="patch-set" data-ex="${ex.id}" data-i="${i}" data-field="reps" placeholder="Wdh">
        <button class="chk ${row.ok?"done":""}" data-act="set-ok" data-ex="${ex.id}" data-i="${i}">${row.ok?"✓":""}</button>
      </div>`;
    });
    html += `</div>`;
  });

  html += `<button class="btn big" data-act="gym-finish">Training abschließen</button>
    <div class="sub" style="text-align:center;margin-top:10px">Hakt Gym für heute ab und merkt sich die Lasten.</div>`;
  return html;
}

function renderHaltung(d){
  const totalMin = Math.round(QUEUE_FULL.reduce((a,s)=>a+s.dur,0)/60);
  let html = `<div class="card" style="border-color:var(--gold-dim)">
    <div style="font-size:15px;font-weight:700;margin-bottom:4px">Geführte Haltungsroutine</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:12px">
      ${QUEUE_FULL.filter(s=>s.type==="work").length} Arbeitsblöcke · ~${totalMin} Minuten inklusive kurzer Pausen.
      Bildschirm bleibt an. Hüftbeuger ist die wichtigste Übung — nicht skippen.
    </div>
    <button class="btn big" data-act="guide" data-mode="full">Routine starten</button>
    <button class="btn ghost big" style="margin-top:8px" data-act="guide" data-mode="desk">2-Minuten-Schreibtisch-Reset</button>
  </div>`;

  html += `<div class="sect">Die 5 Übungen</div>`;
  EX.forEach(e=>{
    html += `<div class="card excard">${fig(e.id)}
      <div><div class="en">${esc(e.name)}</div>
      <div class="ed">${esc(e.cue)}</div>
      <div class="ea">${esc(e.amt)} · ${esc(e.why)}</div></div></div>`;
  });

  html += `<div class="sect">Spiegeltest</div>
    <div class="card"><div style="font-size:13px;color:var(--muted);margin-bottom:10px;line-height:1.45">
      Einmal die Woche, am besten Sonntag. Ehrlich schlagen — die App wertet dich nicht aus, dein Nacken schon.</div>`;
  const last = S.posture.slice().reverse()[0];
  MIRROR.forEach(m=>{
    html += `<div style="margin-bottom:14px">
      <div style="font-size:14px;font-weight:600">${esc(m.q)}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:2px">${esc(m.hint)}</div>
      <div class="mirror-btns">`;
    [["yes","Ja"],["almost","Fast"],["no","Nein"]].forEach(([v,l])=>{
      html += `<label class="chip" style="flex:1;text-align:center"><input type="radio" name="m-${m.id}" value="${v}" style="margin-right:6px">${l}</label>`;
    });
    html += `</div></div>`;
  });
  html += `<button class="btn" data-act="mirror">Test speichern</button>`;
  if (last){
    html += `<div class="sub" style="margin:10px 0 0">Zuletzt ${parseKey(last.date).toLocaleDateString("de-DE")} · ${last.score}/6 Punkte
      (6 = Ohr über Schulter, Rippen unten, Knöchel unsichtbar).</div>`;
  }
  html += `</div>`;

  if (S.posture.length){
    html += `<div class="sect">Verlauf</div>`;
    [...S.posture].reverse().slice(0,8).forEach(p=>{
      html += `<div class="task" style="cursor:default">
        <div class="l1" style="text-decoration:none">${p.score}/6</div>
        <div class="meta">${parseKey(p.date).toLocaleDateString("de-DE",{day:"numeric",month:"short"})}</div>
      </div>`;
    });
  }
  return html;
}

function weightChart(){
  const ws=S.weights;
  if (ws.length===0) return "";
  if (ws.length===1) return `<div class="card" style="font-size:13px;color:var(--muted)">Startwert: <b style="color:var(--text)">${fmtKg(ws[0].kg)} kg</b>. Ab dem zweiten Eintrag erscheint die Kurve — plus Zielzone 87–89 kg.</div>`;
  const W=440,H=220,P={l:38,r:14,t:18,b:28};
  const kgs=ws.map(w=>w.kg), min=Math.min(...kgs,S.profile.goalLow)-1, max=Math.max(...kgs)+1;
  const x=i=>P.l+(i/(ws.length-1))*(W-P.l-P.r), y=v=>P.t+(1-(v-min)/(max-min))*(H-P.t-P.b);
  const path=ws.map((w,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(w.kg).toFixed(1)}`).join(" ");
  let avgPath="";
  if (ws.length>=3){
    const avg=ws.map((_,i)=>{
      const slice=ws.slice(Math.max(0,i-2), i+1);
      return slice.reduce((s,w)=>s+w.kg,0)/slice.length;
    });
    avgPath = avg.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  }
  let grid="";
  for (let i=0;i<4;i++){
    const v=min+((max-min)/3)*i;
    grid+=`<line x1="${P.l}" x2="${W-P.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/>
      <text x="${P.l-6}" y="${y(v)+3.5}" fill="var(--muted)" font-size="10" text-anchor="end">${v.toFixed(0)}</text>`;
  }
  const lo=S.profile.goalLow, hi=S.profile.goalHigh;
  const zone = `<rect x="${P.l}" y="${y(Math.min(hi,max))}" width="${W-P.l-P.r}" height="${Math.max(0,y(Math.max(lo,min))-y(Math.min(hi,max)))}" fill="var(--green)" opacity="0.10"/>
    <text x="${W-P.r-4}" y="${y((lo+hi)/2)+4}" fill="var(--green)" font-size="10" text-anchor="end" opacity=".85">Ziel ${lo}–${hi} kg</text>`;
  return `<div class="card" style="padding:14px 8px 8px">
    <div class="head" style="padding:0 10px 6px;font-size:12px;color:var(--muted)">
      <span>Verlauf · gold = Waage, gedimmt = 3-Punkte-Schnitt</span></div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${zone}${grid}
      ${avgPath?`<path d="${avgPath}" fill="none" stroke="var(--gold-dim)" stroke-width="1.6" stroke-dasharray="4 4"/>`:""}
      <path d="${path}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${ws.map((w,i)=>`<circle cx="${x(i)}" cy="${y(w.kg)}" r="3.5" fill="var(--bg)" stroke="var(--gold)" stroke-width="2"/>`).join("")}
    </svg></div>`;
}

function renderKoerper(){
  const tr = weightTrend();
  let html = `<div class="card"><div style="font-size:13px;color:var(--muted);margin-bottom:10px">Neuer Eintrag · morgens, nüchtern, nach dem Klo, vor dem Essen</div>
    <div class="row"><input type="text" id="win" inputmode="decimal" placeholder="${S.profile.startKg?fmtKg(S.profile.startKg):"z. B. 98,4"}" enterkeyhint="done">
    <button class="btn" data-act="weight-add">Speichern</button></div>
    <div class="sub" style="margin:8px 0 0">Sonntag reicht. Wer täglich wiegt, darf — der Trend entscheidet trotzdem.</div></div>`;

  if (tr){
    const rateCol = tr.perWeek<=0 ? "var(--green)" : "var(--red)";
    html += `<div class="row" style="margin-bottom:12px">
      <div class="stat ${tr.perWeek<=-0.2?"hit":""}"><div class="k">Trend / Woche</div><div class="v" style="color:${rateCol}">${tr.perWeek>0?"+":""}${fmtN(tr.perWeek.toFixed(2))} <span>kg</span></div></div>
      <div class="stat"><div class="k">seit Start</div><div class="v" style="color:${tr.total<=0?"var(--green)":"var(--red)"}">${tr.total>0?"+":""}${fmtKg(tr.total)} <span>kg</span></div></div>
    </div>`;
    html += `<div class="card eta">Ziel ${S.profile.goalLow}–${S.profile.goalHigh} kg.
      ${tr.eta?`Bei diesem Tempo bist du um den <b style="color:var(--text)">${tr.eta.toLocaleDateString("de-DE",{day:"numeric",month:"long"})}</b> in der Zone. Gesund sind etwa ${fmtN(computePlan(S.profile).lossMinKg)}–${fmtN(computePlan(S.profile).lossMaxKg)} kg/Woche (0,5–1 % des Gewichts) — nicht 1,5.`:
        (tr.cur<=S.profile.goalHigh?`Du bist in oder an der Zone. Reverse Diet steht im Plan.`:`Noch ${fmtKg(tr.cur-tr.goal)} kg bis zur Mitte der Zone. Mehr Daten → klareres Tempo.`)}
      ${tr.plateau?`<div class="gold" style="margin-top:8px">Plateau-Hinweis: 150 kcal streichen liegt im Plan. Button dafür unter Plan.</div>`:""}
    </div>`;
  }

  html += weightChart();

  html += `<div class="sect">Fotos</div>
    <div class="card" style="font-size:13px;color:var(--muted);line-height:1.5">
      Alle 4 Wochen, gleiche 3 Posen, gleiches Licht. Die App speichert kein Bild — nur das Datum, damit du es nicht „nächste Woche“ machst.
      ${photoDue()?`<div class="gold" style="margin-top:8px">Diese Woche ist Foto-Woche.</div>
        <button class="btn sm" style="margin-top:10px" data-act="photo">Heute fotografiert</button>`:""}
      ${S.photos.length?`<div style="margin-top:8px">Markiert: ${S.photos.map(d=>parseKey(d).toLocaleDateString("de-DE")).join(" · ")}</div>`:`<div style="margin-top:8px">Noch kein Fototermin markiert.</div>`}
    </div>`;

  if (S.weights.length){
    html += `<div class="sect">Einträge</div>`;
    [...S.weights].reverse().forEach((w,i,arr)=>{
      const prev=arr[i+1]; const diff=prev?(w.kg-prev.kg):null;
      html += `<div class="task" style="cursor:default">
        <div style="flex:1"><div class="l1" style="text-decoration:none">${fmtKg(w.kg)} kg</div>
        <div class="l2">${parseKey(w.date).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}</div></div>
        ${diff!==null?`<span style="font-size:13px;color:${diff<=0?"var(--green)":"var(--red)"}">${diff<=0?"▼":"▲"} ${fmtKg(Math.abs(diff))}</span>`:""}
        <button data-act="weight-del" data-date="${w.date}" style="background:none;border:none;color:var(--muted);font-size:16px;padding:4px 2px 4px 10px">✕</button></div>`;
    });
  } else {
    html += `<div class="card" style="text-align:center;color:var(--muted)">Noch kein Eintrag. Startgewicht rein — ab dann wächst die Kurve Richtung ${S.profile.goalLow}–${S.profile.goalHigh} kg.</div>`;
  }
  return html;
}

function renderPlan(dow){
  let html = "";
  html += installBanner();

  const ph = PHASES[S.profile.phase];
  html += `<div class="card" style="border-color:var(--gold-dim)">
    <div class="head"><div style="font-weight:700">${esc(ph.label)}</div><span class="pill">Woche ${phaseWeeks()+1}</span></div>
    <div class="sub" style="margin:8px 0 12px">${esc(ph.hint)} Aktuell ${S.profile.kcal} kcal · ${S.profile.protein} g Protein.</div>
    <div class="row" style="flex-wrap:wrap">
      ${S.profile.phase==="deficit"?`<button class="btn sm" data-act="cut">−150 kcal</button>
        <button class="btn ghost sm" data-act="break-start">Diätpause starten</button>
        <button class="btn ghost sm" data-act="reverse">Am Ziel: Reverse</button>`:""}
      ${S.profile.phase==="break"?`<button class="btn sm" data-act="break-end">Pause beenden</button>`:""}
      ${S.profile.phase==="reverse"?`<button class="btn sm" data-act="reverse-step">+150 kcal Schritt</button>
        <button class="btn ghost sm" data-act="break-end">Zurück ins Defizit</button>`:""}
    </div>
  </div>`;

  html += `<div class="sect">Abendessen-Rhythmus</div>`;
  [1,2,3,4,5,6,0].forEach(d=>{
    const cur=d===dow; const r=RECIPES[DINNER_RID[d]];
    html += `<div class="task" style="cursor:default;${cur?"border-color:var(--gold-dim);background:var(--surface2)":""}">
      <span style="width:28px;color:${cur?"var(--gold)":"var(--muted)"};font-size:13px;font-weight:600">${WD_SHORT[d]}</span>
      <span style="font-size:13.5px;color:${cur?"var(--text)":"var(--muted)"}">${esc(r.name)}</span></div>`;
  });

  const prep = PREP[dow];
  if (prep){
    const d = dayObj(todayKey());
    const checks = d.ritual.prep || {};
    html += `<div class="sect">${esc(prep.title)}</div><div class="card">`;
    prep.items.forEach((item,i)=>{
      html += `<button class="listrow" style="width:100%;background:none;border:none;color:inherit;text-align:left" data-act="prep" data-i="${i}">
        <span class="checkx ${checks[i]?"on":""}">${checks[i]?"✓":""}</span><span>${esc(item)}</span></button>`;
    });
    html += `</div>`;
  }

  const week = isoWeek(new Date());
  if (S.shop.week !== week) S.shop = { week, checks: S.shop.week?{}: (S.shop.checks||{}) };
  const shop = shoppingList();
  html += `<div class="sect">Einkauf · 7 Tage</div><div class="card">`;
  shop.forEach((it, i)=>{
    const key = it.n.toLowerCase();
    const on = !!(S.shop.checks||{})[key];
    html += `<button class="listrow" style="width:100%;background:none;border:none;color:inherit;text-align:left" data-act="shop" data-i="${i}">
      <span class="checkx ${on?"on":""}">${on?"✓":""}</span>
      <span>${it.count>1?`<span class="muted">${it.count}× </span>`:""}${it.q?`<span class="muted">${esc(it.q)}</span> `:""}${esc(it.n)}</span></button>`;
  });
  html += `</div>`;

  html += `<div class="sect">Anti-Jojo</div>`;
  RULES.forEach(r=>{
    html += `<div class="card" style="padding:12px 14px;margin-bottom:8px"><div style="font-size:14px;font-weight:600;margin-bottom:3px">${esc(r.t)}</div>
      <div style="font-size:13px;color:var(--muted);line-height:1.5">${esc(r.s)}</div></div>`;
  });

  html += `<div class="sect">Einstellungen</div><div class="card">
    <div class="field"><label>Kalorienziel</label><input id="set-kcal" type="text" inputmode="numeric" value="${S.profile.kcal}"></div>
    <div class="field"><label>Proteinziel (g)</label><input id="set-prot" type="text" inputmode="numeric" value="${S.profile.protein}"></div>
    <div class="field"><label>Wasser (ml)</label><input id="set-water" type="text" inputmode="numeric" value="${S.profile.waterMl}"></div>
    <div class="field"><label>Größe (cm, optional)</label><input id="set-height" type="text" inputmode="numeric" value="${S.profile.heightCm||""}" placeholder="z. B. 178"></div>
    <label class="listrow"><span>Ton</span><input id="set-sound" type="checkbox" ${S.profile.sound?"checked":""}></label>
    <label class="listrow"><span>Vibration</span><input id="set-haptic" type="checkbox" ${S.profile.haptic?"checked":""}></label>
    <button class="btn" style="margin-top:8px" data-act="settings">Speichern</button>
  </div>`;

  html += `<div class="sect">Daten</div><div class="card">
    <div class="row">
      <button class="btn ghost sm" style="flex:1" data-act="export">Export</button>
      <label class="btn ghost sm" style="flex:1;text-align:center">Import
        <input type="file" accept="application/json" style="display:none" data-act="import">
      </label>
    </div>
    <div class="sub" style="margin:10px 0 0">Kein Account, keine Cloud. Gewicht und Training liegen nur auf diesem Handy — doppelt gesichert (Gerät + lokale Datenbank). Export ist dein Backup, falls du das Handy wechselst.</div>
  </div>
  <div style="font-size:13px;color:var(--muted);line-height:1.6;padding:6px 2px 18px">
    80 % Konsequenz über 8 Monate schlägt 100 % Perfektion über 3 Wochen. Der Sonntag ist bewusst flexibel — der Plan passt in dein Leben, nicht umgekehrt. Das ist ein persönlicher Begleiter, kein medizinischer Rat.
  </div>`;
  return html;
}

function ensureDraft(){
  if (draft) return draft;
  draft = Object.assign({}, DEFAULTS, S.profile||{}, {
    name: (S.profile && S.profile.name) || "Albin",
    sex: (S.profile && S.profile.sex) || "m",
    goal: (S.profile && S.profile.goal) || "both",
    gymDays: (S.profile && S.profile.gymDays && S.profile.gymDays.slice()) || [1,2,4,5,6],
    halal: S.profile && S.profile.halal !== false,
    targetKg: (S.profile && S.profile.targetKg) || 88
  });
  return draft;
}

function captureOnboardFields(){
  const d = ensureDraft();
  const val = id => { const el = document.getElementById(id); return el ? el.value : ""; };
  if (onbStep === 0){
    const n = val("ob-name").trim();
    if (n) d.name = n.slice(0,40);
    const sex = document.querySelector("[data-sex].on");
    if (sex) d.sex = sex.getAttribute("data-sex");
  }
  if (onbStep === 1){
    const age = parseDec(val("ob-age"));
    const cm = parseDec(val("ob-cm"));
    const kg = parseDec(val("ob-kg"));
    const tgt = parseDec(val("ob-tgt"));
    if (Number.isFinite(age) && age>=14 && age<=80) d.age = age;
    if (Number.isFinite(cm) && cm>=140 && cm<=220) d.heightCm = cm;
    if (Number.isFinite(kg) && kg>=40 && kg<=250) d.startKg = kg;
    if (Number.isFinite(tgt) && tgt>=40 && tgt<=250) d.targetKg = tgt;
  }
}

function onbBack(){
  captureOnboardFields();
  onbStep = Math.max(0, onbStep-1);
  render();
}

function onbNext(){
  captureOnboardFields();
  const d = ensureDraft();
  if (onbStep === 0){
    if (!d.name){ toast("Name eintragen"); return; }
    onbStep = 1; render(); return;
  }
  if (onbStep === 1){
    if (!d.startKg || !d.heightCm){ toast("Gewicht und Größe braucht der Plan"); return; }
    onbStep = 2; render(); return;
  }
  if (onbStep === 2){
    onbStep = 3; render(); return;
  }
  if (onbStep === 3){
    onbStep = 4; render(); return;
  }
}

function onbGoal(g){ ensureDraft().goal = g; render(); }
function onbSex(sx){ ensureDraft().sex = sx; render(); }
function onbHalal(){ const d=ensureDraft(); d.halal = !d.halal; render(); }
function onbGymDay(day){
  const d = ensureDraft();
  d.gymDays = d.gymDays || [];
  const n = +day;
  d.gymDays = d.gymDays.includes(n) ? d.gymDays.filter(x=>x!==n) : d.gymDays.concat(n).sort();
  render();
}

async function onbSetPin(){
  captureOnboardFields();
  const a = ($("#ob-pin")||{}).value || "";
  const b = ($("#ob-pin2")||{}).value || "";
  if (!/^\d{4,8}$/.test(a)){ toast("PIN: 4–8 Ziffern"); return; }
  if (a !== b){ toast("PIN stimmt nicht überein"); return; }
  try{
    const { hash, salt } = await hashPin(a);
    commitProfile(hash, salt);
  }catch(e){ toast("PIN nicht speicherbar — HTTPS oder localhost"); }
}

async function unlockPin(){
  const pin = ($("#lock-pin")||{}).value || "";
  if (!pin){ toast("PIN eingeben"); return; }
  try{
    const { hash } = await hashPin(pin, S.profile.pinSalt);
    if (hash !== S.profile.pinHash){ toast("Falsche PIN"); buzz([40,40,40]); return; }
    setUnlocked(true);
    requestPersist();
    render();
  }catch(e){ toast("Entsperren fehlgeschlagen"); }
}

function commitProfile(pinHash, pinSalt){
  const d = ensureDraft();
  const computed = applyComputed(d);
  Object.assign(S.profile, d, computed, { onboarded: true, pinHash, pinSalt, phaseStart: S.profile.phaseStart || todayKey() });
  const k = todayKey();
  S.weights = [...S.weights.filter(w=>w.date!==k), { date:k, kg:d.startKg }].sort((a,b)=>a.date.localeCompare(b.date));
  dayObj(k).ritual.weighed = true;
  save();
  requestPersist();
  setUnlocked(true);
  draft = null; onbStep = 0;
  buzz(30);
  toast("Profil gespeichert auf diesem Gerät");
  render();
}

function renderLock(){
  document.body.classList.add("onboard-on");
  $("#tabbar").innerHTML = "";
  $("#app").innerHTML = `<div class="onb fadein">
    <div class="brand">AV·SHOT HEALTH</div>
    <h1>Nur für dich.</h1>
    <div class="sub">Persönliche Daten bleiben auf diesem Gerät. PIN eingeben, um Gewicht, Mahlzeiten und Training zu sehen.</div>
    <div class="card">
      <div class="field"><label>PIN</label>
        <input id="lock-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></div>
      <button class="btn big" data-act="unlock">Entsperren</button>
    </div>
  </div>`;
}

function renderOnboard(){
  document.body.classList.add("onboard-on");
  document.body.classList.remove("guide-on");
  $("#tabbar").innerHTML = "";
  const d = ensureDraft();
  const step = S.profile.onboarded && !S.profile.pinHash ? 4 : onbStep;
  if (S.profile.onboarded && !S.profile.pinHash) onbStep = 4;
  let body = "";
  if (step === 0){
    body = `<h1>Profil.</h1>
      <div class="sub">Nur auf diesem Handy. Kein Account, keine Cloud, nicht öffentlich auffindbar.</div>
      <div class="card">
        <div class="field"><label>Name</label><input id="ob-name" type="text" value="${esc(d.name||"Albin")}"></div>
        <div class="field"><label>Geschlecht — für Kalorien und Protein</label>
          <div class="row">
            <button class="chip ${d.sex!=="f"?"on":""}" data-act="ob-sex" data-sex="m">Mann</button>
            <button class="chip ${d.sex==="f"?"on":""}" data-act="ob-sex" data-sex="f">Frau</button>
          </div></div>
        <button class="btn big" data-act="onb-next">Weiter</button>
      </div>`;
  }
  if (step === 1){
    body = `<h1>Körper.</h1>
      <div class="sub">Nüchternes Gewicht, Größe, optional Alter. Zielgewicht Vorschlag 88 kg — du kannst ihn ändern.</div>
      <div class="card">
        <div class="field"><label>Aktuelles Gewicht, nüchtern (kg)</label>
          <input id="ob-kg" type="text" inputmode="decimal" value="${d.startKg||""}" placeholder="z. B. 98,4"></div>
        <div class="field"><label>Größe (cm)</label>
          <input id="ob-cm" type="text" inputmode="numeric" value="${d.heightCm||""}" placeholder="z. B. 178"></div>
        <div class="field"><label>Alter (optional)</label>
          <input id="ob-age" type="text" inputmode="numeric" value="${d.age||""}" placeholder="z. B. 32"></div>
        <div class="field"><label>Zielgewicht (kg)</label>
          <input id="ob-tgt" type="text" inputmode="decimal" value="${d.targetKg||88}" placeholder="88"></div>
        <div class="row"><button class="btn ghost" style="flex:1" data-act="onb-back">Zurück</button>
          <button class="btn" style="flex:1" data-act="onb-next">Weiter</button></div>
      </div>`;
  }
  if (step === 2){
    const days = d.gymDays || [];
    body = `<h1>Ziel.</h1>
      <div class="sub">Fettabbau plus Haltung ist der Standard. Kein Crash, kein Detox, kein 1200-kcal-Unsinn.</div>
      <div class="card">
        <div class="field"><label>Was willst du?</label>
          <div class="swaps" style="padding:0">${GOAL_OPTS.map(([id,l])=>`<button class="chip ${d.goal===id?"on":""}" data-act="ob-goal" data-goal="${id}">${l}</button>`).join("")}</div></div>
        <div class="field"><label>Gym-Tage</label>
          <div class="row" style="flex-wrap:wrap">${[1,2,3,4,5,6,0].map(n=>`<button class="chip ${days.includes(n)?"on":""}" data-act="ob-gym" data-day="${n}">${WD_SHORT[n]}</button>`).join("")}</div></div>
        <button class="chip ${d.halal?"on":""}" data-act="ob-halal">Halal · ${d.halal?"an":"aus"}</button>
        <div class="row" style="margin-top:14px"><button class="btn ghost" style="flex:1" data-act="onb-back">Zurück</button>
          <button class="btn" style="flex:1" data-act="onb-next">Weiter</button></div>
      </div>`;
  }
  if (step === 3){
    const c = computePlan(d);
    const goalLab = (GOAL_OPTS.find(x=>x[0]===d.goal)||[])[1] || d.goal;
    body = `<h1>Dein Plan.</h1>
      <div class="sub">Mifflin-St Jeor × Aktivität, dann höchstens ~400 kcal Defizit. Boden ${c.kcalFloor} kcal. Protein ${d.sex==="f"?"1,7":"1,8"} g/kg.</div>
      <div class="card">
        <div class="stat" style="margin-bottom:10px"><div class="k">Ziel</div><div class="v" style="font-size:18px">${esc(goalLab)}</div></div>
        <div class="row" style="margin-bottom:10px">
          <div class="stat"><div class="k">kcal / Tag</div><div class="v">${c.kcal}</div></div>
          <div class="stat"><div class="k">Protein</div><div class="v">${c.protein} <span>g</span></div></div>
        </div>
        <div style="font-size:13px;color:var(--muted);line-height:1.55">
          Grundumsatz ~${c.bmr} · Verbrauch ~${c.tdee} kcal.<br>
          Zielzone ${c.goalLow}–${c.goalHigh} kg.<br>
          Gesundes Tempo ${fmtN(c.lossMinKg)}–${fmtN(c.lossMaxKg)} kg/Woche.
          Haltung bleibt im Plan${d.goal==="fat"?" (optional, nicht Pflicht für den Tag)":""}.
        </div>
        <div class="row" style="margin-top:14px"><button class="btn ghost" style="flex:1" data-act="onb-back">Zurück</button>
          <button class="btn" style="flex:1" data-act="onb-next">PIN setzen</button></div>
      </div>`;
  }
  if (step === 4){
    body = `<h1>PIN.</h1>
      <div class="sub">4–8 Ziffern, nur auf diesem Gerät, gehasht gespeichert. Ohne PIN sieht niemand Mahlzeiten, Gewicht oder Gym.</div>
      <div class="card">
        <div class="field"><label>PIN</label><input id="ob-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div>
        <div class="field"><label>PIN wiederholen</label><input id="ob-pin2" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"></div>
        ${!S.profile.onboarded?`<button class="btn ghost" data-act="onb-back">Zurück</button>`:""}
        <button class="btn big" style="margin-top:10px" data-act="onb-pin">Profil sperren &amp; starten</button>
      </div>`;
  }
  $("#app").innerHTML = `<div class="onb fadein">
    <div class="brand">AV·SHOT HEALTH</div>
    ${body}
  </div>`;
}

function render(){
  if (guide) return;
  if (!S.profile.onboarded || !S.profile.pinHash){ renderOnboard(); return; }
  if (!isUnlocked()){ renderLock(); return; }
  document.body.classList.remove("onboard-on");
  const now = new Date(), dow = now.getDay(), gym = isGymDay(dow);
  const d = dayObj(todayKey());
  const sc = dayScore(todayKey());

  let html = header(now, dow, gym, streakCount());
  if (tab==="heute") html += renderHeute(now, dow, gym, d, sc);
  if (tab==="gym") html += renderGym(now, dow, gym, d);
  if (tab==="haltung") html += renderHaltung(d);
  if (tab==="koerper") html += renderKoerper();
  if (tab==="plan") html += renderPlan(dow);

  $("#app").innerHTML = `<div class="fadein">${html}</div>`;
  $("#tabbar").innerHTML = TABS.map(t=>`<button class="${tab===t.id?"on":""}" data-act="tab" data-id="${t.id}">${t.svg}${t.l}</button>`).join("");
}

function waterCup(i){
  const cups=10, cupMl=Math.round(S.profile.waterMl/cups);
  const d=dayObj(todayKey());
  const filled=Math.round(d.water/cupMl);
  if (i+1===filled) setWater(i*cupMl);
  else setWater((i+1)*cupMl);
}

function toggleMeal(id){ openMeal = openMeal===id ? null : id; render(); }

function handleClick(e){
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.getAttribute("data-act");
  const d = el.dataset;
  const map = {
    tab: () => setTab(d.id),
    toggle: () => toggle(d.id),
    "water-cup": () => waterCup(+d.i),
    "water-add": () => setWater((dayObj(todayKey()).water||0) + (+d.ml)),
    "water-reset": () => setWater(0),
    meal: () => toggleMeal(d.id),
    swap: () => swapMeal(d.slot, d.rid),
    guide: () => startGuide(d.mode),
    "guide-stop": () => stopGuide(),
    "guide-pause": () => pauseGuide(),
    "guide-skip": () => skipGuide(),
    install: () => installApp(),
    "hide-install": () => hideInstall(),
    photo: () => logPhoto(),
    "weight-add": () => addWeight(),
    "weight-del": () => { if (isDateKey(d.date)) delWeight(d.date); },
    mirror: () => saveMirror(),
    "gym-finish": () => finishGym(),
    "set-ok": () => toggleSet(d.ex, +d.i),
    "step-kg": () => stepKg(d.ex, +d.i, +d.dir),
    cut: () => applyCut(),
    "break-start": () => startBreak(),
    "break-end": () => endBreak(),
    reverse: () => startReverse(),
    "reverse-step": () => reverseStep(),
    settings: () => saveSettings(),
    export: () => exportData(),
    shop: () => toggleShop(+d.i),
    prep: () => togglePrep(+d.i),
    onboard: () => onbNext(),
    "onb-next": () => onbNext(),
    "onb-back": () => onbBack(),
    "onb-sex": () => onbSex(d.sex),
    "onb-goal": () => onbGoal(d.goal),
    "onb-gym": () => onbGymDay(d.day),
    "onb-halal": () => onbHalal(),
    "onb-pin": () => onbSetPin(),
    unlock: () => unlockPin()
  };
  if (map[a]) map[a]();
}

function handleInput(e){
  const el = e.target;
  if (!el || el.dataset.act !== "patch-set") return;
  patchSet(el.dataset.ex, +el.dataset.i, el.dataset.field, el.value);
}

function handleChange(e){
  const el = e.target;
  if (el && el.dataset.act === "import" && el.files && el.files[0]) importData(el.files[0]);
}

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("keydown", e=>{
  if (e.key !== "Enter") return;
  if (e.target && e.target.id === "win") addWeight();
  if (e.target && e.target.id === "lock-pin") unlockPin();
  if (e.target && (e.target.id === "ob-pin2" || e.target.id === "ob-pin")) onbSetPin();
});

if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(()=>{});
}

hydrateFromDisk().then(() => { render(); }).catch(() => { render(); });
