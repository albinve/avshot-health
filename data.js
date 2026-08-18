/* AV·SHOT Health — Albins Plan. Alles hier ist auf ihn zugeschnitten. */
const WD = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const WD_SHORT = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const GYM_DAYS = [1, 2, 4, 5, 6];

const DEFAULTS = {
  name: "Albin",
  sex: "m",
  age: null,
  startKg: null,
  heightCm: null,
  targetKg: 88,
  goal: "both",
  gymDays: [1, 2, 4, 5, 6],
  halal: true,
  allergies: [],
  dislikes: [],
  dislikeNote: "",
  kcal: 2150,
  protein: 175,
  waterMl: 2500,
  goalLow: 87,
  goalHigh: 89,
  kcalFloor: 1900,
  kcalMaintain: 2650,
  kcalDeficit: 2150,
  bmr: null,
  tdee: null,
  fatPct: null,
  scaleBmr: null,
  useScaleBmr: false,
  phase: "deficit",
  phaseStart: null,
  pinHash: null,
  pinSalt: null,
  sound: true,
  haptic: true,
  onboarded: false,
  reminders: null,
  aiOn: false,
  aiKey: "",
  aiProxy: "",
  aiLastAt: null,
  aiCoach: "",
  aiNotes: "",
  aiForbidden: [],
  aiGymNote: ""
};

function defaultReminders(){
  return {
    on: false,
    times: { haltung: "20:00", gym: "17:00", water: "13:00", weigh: "09:00", shop: "16:00" },
    enabled: { haltung: true, gym: true, water: true, weigh: true, shop: true },
    lastFired: {}
  };
}

const REMINDER_DEFS = [
  { id: "haltung", label: "10 Min Haltung", hint: "Abends, Nacken und Hüfte.", time: "20:00" },
  { id: "gym", label: "Gym an Trainingstagen", hint: "Nur an deinen Gym-Tagen.", time: "17:00" },
  { id: "water", label: "Wasser, mittags", hint: "Kein Saft. Nur wenn du noch unter der Hälfte bist.", time: "13:00" },
  { id: "weigh", label: "Waage, nüchtern", hint: "Sonntagmorgen.", time: "09:00" },
  { id: "shop", label: "Einkauf für nächste Woche", hint: "Sonntag · Liste unter Plan.", time: "16:00" }
];

const NOTE_COPY = {
  haltung: { title: "10 Min Haltung", body: "Nacken und Hüfte. Kurzer Block, dann ist der Tag rund." },
  gym: { title: "Trainingstag", body: "Zug führt. Last halten zählt mehr als ein neuer PR." },
  water: { title: "Wasser", body: "Kein Saft. Ein paar Becher, dann weiter." },
  weigh: { title: "Waage, nüchtern", body: "Eine Zahl. Der Trend entscheidet, nicht das Drama." },
  shop: { title: "Einkauf für nächste Woche", body: "Liste steht unter Plan. Boxen für Mo–Di sparen den Mittwoch." }
};

const ALLERGY_OPTS = [
  ["nuts", "Nüsse"],
  ["lactose", "Laktose"],
  ["gluten", "Gluten"],
  ["shellfish", "Schalentiere"],
  ["egg", "Ei"],
  ["fish", "Fisch"],
  ["soy", "Soja"]
];

const DISLIKE_CHIPS = ["Skyr", "Quark", "Whey", "Lachs", "Köfte", "Curry", "Eier", "Hafer", "Kokos", "Linsen", "Hack"];

const GOAL_OPTS = [
  ["both", "Fettabbau + Haltung"],
  ["fat", "Fettabbau"],
  ["posture", "Haltung"],
  ["maintain", "Gewicht halten"],
  ["muscle", "Muskeln aufbauen"]
];

function normSex(s){
  const x = String(s == null ? "" : s).toLowerCase().trim();
  if (x === "f" || x === "female" || x === "frau" || x === "w" || x === "woman") return "f";
  return "m";
}

function activityFactor(n){
  if (n >= 5) return 1.55;
  if (n >= 3) return 1.45;
  if (n >= 1) return 1.375;
  return 1.2;
}

function bmiOf(kg, cm){
  const k = Number(kg), h = Number(cm);
  if (!k || !h || h < 100) return null;
  return +(k / ((h / 100) * (h / 100))).toFixed(1);
}

function computePlan(p){
  p = p || {};
  const sex = normSex(p.sex);
  const kg = Number(p.currentKg) || Number(p.startKg) || 80;
  const cm = Number(p.heightCm) || (sex === "f" ? 165 : 178);
  const age = Number(p.age) || 30;
  const gymN = Array.isArray(p.gymDays) ? p.gymDays.length : 5;
  const mifflin = sex === "f"
    ? 10 * kg + 6.25 * cm - 5 * age - 161
    : 10 * kg + 6.25 * cm - 5 * age + 5;
  const scaleBmr = Number(p.scaleBmr);
  const useScale = !!(p.useScaleBmr && Number.isFinite(scaleBmr) && scaleBmr >= 800 && scaleBmr <= 3500);
  const bmr = useScale ? scaleBmr : mifflin;
  const factor = activityFactor(gymN);
  const tdee = bmr * factor;
  const floor = sex === "f" ? 1500 : 1900;
  const lossMinKg = +(kg * 0.005).toFixed(2);
  const lossMaxKg = +(kg * 0.01).toFixed(2);
  let deficitWant = Math.round((kg * 0.007 * 7700) / 7);
  deficitWant = Math.max(300, Math.min(500, deficitWant));
  const goal = p.goal || "both";
  let kcal, phase;
  if (goal === "maintain" || goal === "posture") { kcal = tdee; phase = "maintain"; }
  else if (goal === "muscle") { kcal = tdee + 200; phase = "surplus"; }
  else { kcal = Math.max(floor, tdee - deficitWant); phase = "deficit"; }
  kcal = Math.round(kcal / 10) * 10;
  const fatPct = Number(p.fatPct);
  const hasFat = Number.isFinite(fatPct) && fatPct >= 3 && fatPct <= 60;
  const lbm = hasFat ? kg * (1 - fatPct / 100) : null;
  let protein;
  if (lbm){
    const gPer = goal === "muscle" ? 2.0 : (sex === "f" ? 1.8 : 1.9);
    protein = Math.round((Math.max(1.6, Math.min(2.2, gPer)) * lbm) / 5) * 5;
  } else {
    const protKg = sex === "f" ? 1.7 : 1.8;
    protein = Math.round(protKg * kg / 5) * 5;
  }
  protein = Math.max(80, Math.min(220, protein));
  const target = Number(p.targetKg);
  const goalLow = Number.isFinite(target) ? Math.round(target - 1) : (Number(p.goalLow) || 87);
  const goalHigh = Number.isFinite(target) ? Math.round(target + 1) : (Number(p.goalHigh) || 89);
  const maintain = Math.round(tdee / 10) * 10;
  const deficit = Math.max(0, maintain - kcal);
  return {
    bmr: Math.round(bmr),
    mifflin: Math.round(mifflin),
    tdee: Math.round(tdee),
    kcal,
    protein,
    kcalFloor: floor,
    kcalMaintain: maintain,
    kcalDeficit: Math.max(floor, Math.round((tdee - deficitWant) / 10) * 10),
    deficit,
    deficitWant,
    activity: factor,
    gymN,
    goalLow,
    goalHigh,
    phase,
    lossMinKg,
    lossMaxKg,
    bmi: bmiOf(kg, cm),
    lbm: lbm ? +lbm.toFixed(1) : null,
    fatPct: hasFat ? fatPct : null,
    usedScaleBmr: useScale,
    kg, cm, age, sex
  };
}

const RECIPES = {
  skyr: {
    name: "Skyr-Bowl",
    kcal: 450, prot: 40,
    items: [
      ["300 g", "Skyr oder Magerquark"],
      ["40 g", "Haferflocken"],
      ["100 g", "TK-Beeren"],
      ["15 g", "Nüsse"]
    ],
    how: "Hafer und Skyr verrühren, Beeren und Nüsse drauf. Kein extra Zucker."
  },
  eggs: {
    name: "Rührei + Vollkornbrot",
    kcal: 450, prot: 40,
    items: [
      ["3", "Eier + 100 g Eiklar"],
      ["2", "Scheiben Vollkornbrot"],
      ["", "Tomate / Gurke"],
      ["1 TL", "Öl"]
    ],
    how: "Eier mit Eiklar stocken lassen, Brot dazu, Gemüse roh. Öl reicht für die Pfanne."
  },
  "bowl-chicken": {
    name: "Meal-Prep Bowl · Hähnchen",
    kcal: 650, prot: 55,
    items: [
      ["200 g", "Hähnchenbrust (halal)"],
      ["80 g", "Reis (roh)"],
      ["200 g", "Gemüse"],
      ["1 EL", "Öl"]
    ],
    how: "Reis + Hähnchen + Gemüse in 3–4 Boxen. Mittags nur aufwärmen."
  },
  "bowl-beef": {
    name: "Meal-Prep Bowl · Hack & Linsen",
    kcal: 650, prot: 55,
    items: [
      ["150 g", "Rinderhack (halal)"],
      ["60 g", "Linsen (trocken)"],
      ["", "Tomaten, Zwiebeln"],
      ["200 g", "Kartoffeln"]
    ],
    how: "Hack anbraten, Linsen und Kartoffeln dazu. Würzen wie ein Eintopf — sättigt hart."
  },
  whey: {
    name: "Whey + Banane",
    kcal: 350, prot: 30,
    items: [
      ["1 Scoop", "Whey (halal)"],
      ["1", "Banane"],
      ["", "Wasser oder Milch"]
    ],
    how: "Shaken, Banane dazu. Kein Saft, keine Calorien-Drinks."
  },
  quark: {
    name: "Magerquark mit Zimt",
    kcal: 350, prot: 30,
    items: [
      ["250 g", "Magerquark"],
      ["1 TL", "Honig"],
      ["", "Zimt"]
    ],
    how: "Quark, Honig, Zimt. Gleicher Protein-Slot wie der Shake."
  },
  salmon: {
    name: "Ofenlachs · Kartoffeln · Salat",
    kcal: 700, prot: 50,
    items: [
      ["180 g", "Lachs"],
      ["300 g", "Kartoffeln"],
      ["", "Großer Salat"],
      ["1 EL", "Öl"]
    ],
    how: "Kartoffeln bei 200 °C ca. 30–35 Min. Lachs die letzten 12–15 Min. dazu. Salat frisch."
  },
  kofte: {
    name: "Köfte · Bulgur · Joghurt-Dip",
    kcal: 700, prot: 50,
    items: [
      ["180 g", "Rinderhack (halal)"],
      ["80 g", "Bulgur (roh)"],
      ["200 g", "Skyr/Joghurt · Gurke · Knoblauch"],
      ["", "Salat"]
    ],
    how: "Köfte braten oder backen. Bulgur quellen. Dip: Skyr, Gurke, Knoblauch, Salz."
  },
  curry: {
    name: "Hähnchen-Curry · Reis",
    kcal: 700, prot: 50,
    items: [
      ["200 g", "Hähnchen (halal)"],
      ["80 g", "Reis (roh)"],
      ["", "Zwiebel, Paprika, Spinat"],
      ["150 ml", "leichte Kokosmilch oder passierte Tomaten"]
    ],
    how: "Hähnchen anbraten, Gewürze, Flüssigkeit, Gemüse. Reis separat. Reste gehen in die Lunch-Box."
  },
  flex: {
    name: "Flexibel · proteinlastig",
    kcal: 700, prot: 50,
    items: [],
    how: "Reste, Omelett, Bowl, Grillteller. Über den Tag ~2.200 kcal und mindestens 150 g Protein. Halal — kein Saft, keine Kalorien trinken. Der Sonntag darf leben, er darf dich nicht aus der Woche werfen."
  }
};

const MEAL_SLOTS = [
  { id: "fruehstueck", label: "Frühstück" },
  { id: "mittag", label: "Mittagessen" },
  { id: "snack", label: "Snack" },
  { id: "abend", label: "Abendessen" }
];

const DINNER_RID = { 1: "salmon", 2: "kofte", 3: "curry", 4: "salmon", 5: "kofte", 6: "curry", 0: "flex" };

const FOOD_FLAGS = {
  skyr: { allergens: [], keywords: ["skyr"] },
  eggs: { allergens: ["egg"], keywords: ["eier", "ruehrei"] },
  "bowl-chicken": { allergens: [], keywords: ["haehnchen", "huhn"] },
  "bowl-beef": { allergens: [], keywords: ["linsen", "hack"] },
  whey: { allergens: [], keywords: ["whey"] },
  quark: { allergens: [], keywords: ["quark"] },
  salmon: { allergens: ["fish"], keywords: ["lachs"] },
  kofte: { allergens: [], keywords: ["koefte", "kofte", "hack"] },
  curry: { allergens: [], keywords: ["curry"] },
  flex: { allergens: [], keywords: [] }
};

const SWAP_OPTS = {
  fruehstueck: [["skyr", "Skyr-Bowl"], ["eggs", "Rührei + Brot"]],
  mittag: [["bowl-chicken", "Hähnchen-Bowl"], ["bowl-beef", "Hack & Linsen"]],
  snack: [["whey", "Whey + Banane"], ["quark", "Quark + Zimt"]]
};

function foldUm(s){
  return String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

function profileAvoids(p){
  const allergies = new Set(Array.isArray(p && p.allergies) ? p.allergies : []);
  const dislikes = [];
  (p && p.dislikes || []).forEach(x => { const t = foldUm(x).trim(); if (t.length >= 2) dislikes.push(t); });
  String(p && p.dislikeNote || "").split(/[,;\n]/).forEach(x => {
    const t = foldUm(x).trim();
    if (t.length >= 2) dislikes.push(t);
  });
  (p && p.aiForbidden || []).forEach(x => {
    const t = foldUm(x).trim();
    if (t.length >= 2) dislikes.push(t);
  });
  return { allergies, dislikes };
}

function dislikeBlocks(rid, p){
  const { dislikes } = profileAvoids(p);
  if (!dislikes.length) return false;
  const flags = FOOD_FLAGS[rid] || { keywords: [] };
  const rec = RECIPES[rid];
  const blob = foldUm([rec && rec.name].concat(flags.keywords || []).join(" "));
  return dislikes.some(d => blob.indexOf(d) !== -1);
}

function recipeAllowed(rid, p){
  if (!RECIPES[rid]) return false;
  if (rid === "flex") return true;
  const { allergies } = profileAvoids(p);
  const flags = FOOD_FLAGS[rid] || { allergens: [] };
  if ((flags.allergens || []).some(a => allergies.has(a))) return false;
  if (dislikeBlocks(rid, p)) return false;
  return true;
}

function cloneRecipe(rid){
  const base = RECIPES[rid];
  if (!base) return { rid, name: "Mahlzeit", kcal: 0, prot: 0, items: [], how: "", note: "" };
  return {
    rid,
    name: base.name,
    kcal: base.kcal,
    prot: base.prot,
    items: (base.items || []).map(([q, n]) => [q, n]),
    how: base.how,
    note: ""
  };
}

function recipeFor(rid, p){
  p = p || {};
  const r = cloneRecipe(rid);
  const { allergies, dislikes } = profileAvoids(p);
  const wantsNoNuts = allergies.has("nuts") || dislikes.some(d => d.indexOf("nuss") !== -1 || d === "nuesse" || d === "nuts");
  const lf = allergies.has("lactose");
  const gf = allergies.has("gluten");
  const noCoconut = dislikes.some(d => d.indexOf("kokos") !== -1);
  const noDairyWord = dislikes.some(d => d === "skyr" || d === "quark" || d === "joghurt");

  if (rid === "skyr" && wantsNoNuts){
    r.items = r.items.filter(([, n]) => !/n(ü|u)sse/i.test(n));
    r.items.push(["", "extra Beeren statt Nüsse"]);
    r.name = "Skyr-Bowl ohne Nüsse";
    r.how = "Hafer und Skyr verrühren, Beeren drauf. Keine Nüsse.";
    r.kcal = 400;
    r.prot = 38;
    r.note = "Nüsse weggelassen";
  }
  if (lf){
    r.items = r.items.map(([q, n]) => {
      if (/wasser oder milch/i.test(n)) return [q, "Wasser (keine Milch)"];
      if (/skyr|quark|joghurt|milch/i.test(n) && !/laktosefrei/i.test(n)) return [q, n + " · laktosefrei"];
      return [q, n];
    });
    if (/skyr|quark|joghurt|whey|milch/i.test(r.name + " " + r.how)) {
      r.note = (r.note ? r.note + " · " : "") + "laktosefrei wählen";
    }
  }
  if (rid === "kofte" && (lf || noDairyWord)){
    r.items = r.items.map(([q, n]) =>
      /skyr|joghurt/i.test(n) ? [q, lf ? "laktosefreier Dip · Gurke · Knoblauch" : "Gurke · Knoblauch · Kräuter (ohne Skyr)"] : [q, n]
    );
    r.name = noDairyWord ? "Köfte · Bulgur · Kräuter-Dip" : r.name;
  }
  if (gf){
    r.items = r.items.map(([q, n]) => {
      if (/vollkornbrot/i.test(n) || /scheiben vollkorn/i.test(n)) return [q, "glutenfreies Brot"];
      if (/haferflocken/i.test(n)) return [q, "glutenfreie Haferflocken"];
      if (/bulgur/i.test(n)) return [q, "Reis (statt Bulgur)"];
      return [q, n];
    });
  }
  if (rid === "curry" && noCoconut){
    r.items = r.items.map(([q, n]) => /kokos/i.test(n) ? ["150 ml", "passierte Tomaten (kein Kokos)"] : [q, n]);
  }
  if (rid === "flex"){
    const kcal = p.kcal || 2150;
    const prot = p.protein || 175;
    r.how = "Reste, Omelett, Bowl, Grillteller. Über den Tag ~" + kcal + " kcal und mindestens " + Math.min(150, prot) + " g Protein. Halal — kein Saft, keine Kalorien trinken. Der Sonntag darf leben, er darf dich nicht aus der Woche werfen.";
  }
  if (p.halal !== false && /hähnchen|hack|whey/i.test(r.name + r.how) && !/halal/i.test(r.how)) {
    /* default catalog is already halal */
  }
  return r;
}

function poolFor(slot){
  if (slot === "fruehstueck") return ["skyr", "eggs"];
  if (slot === "mittag") return ["bowl-chicken", "bowl-beef"];
  if (slot === "snack") return ["whey", "quark"];
  if (slot === "abend") return ["salmon", "kofte", "curry", "flex"];
  return [];
}

function pickMeal(slot, preferred, swaps, p){
  const swap = swaps && swaps[slot];
  const pool = poolFor(slot);
  if (swap && recipeAllowed(swap, p)) return swap;
  if (preferred && recipeAllowed(preferred, p)) return preferred;
  return pool.find(id => recipeAllowed(id, p)) || preferred || pool[0] || "flex";
}

function mealsFor(dow, swaps, p){
  swaps = swaps || {};
  p = p || {};
  const bPref = dow % 2 === 1 ? "skyr" : "eggs";
  const b = pickMeal("fruehstueck", bPref, swaps, p);
  const l = pickMeal("mittag", "bowl-chicken", swaps, p);
  const s = pickMeal("snack", "whey", swaps, p);
  const d = pickMeal("abend", DINNER_RID[dow], swaps, p);
  const alt = (slot, cur) => (poolFor(slot).find(id => id !== cur && recipeAllowed(id, p)) || null);
  return [
    { id: "fruehstueck", label: "Frühstück", rid: b, alt: alt("fruehstueck", b) },
    { id: "mittag", label: "Mittagessen", rid: l, alt: alt("mittag", l) },
    { id: "snack", label: "Snack", rid: s, alt: alt("snack", s) },
    { id: "abend", label: "Abendessen", rid: d, alt: alt("abend", d) }
  ];
}

function swapsFor(slot, p){
  return (SWAP_OPTS[slot] || []).filter(([rid]) => recipeAllowed(rid, p));
}

function personalPlan(p){
  const c = computePlan(p);
  const allowed = {
    fruehstueck: poolFor("fruehstueck").filter(id => recipeAllowed(id, p)),
    mittag: poolFor("mittag").filter(id => recipeAllowed(id, p)),
    snack: poolFor("snack").filter(id => recipeAllowed(id, p)),
    abend: poolFor("abend").filter(id => recipeAllowed(id, p))
  };
  const hints = [];
  const all = (p && p.allergies) || [];
  if (all.indexOf("nuts") !== -1) hints.push("Nüsse sind raus — Skyr-Bowl ohne Nüsse oder Rührei.");
  if (all.indexOf("lactose") !== -1) hints.push("Laktose: Skyr, Quark und Whey laktosefrei, Shake mit Wasser.");
  if (all.indexOf("gluten") !== -1) hints.push("Gluten: Brot und Hafer glutenfrei, Bulgur wird Reis.");
  if (all.indexOf("fish") !== -1) hints.push("Kein Lachs — Curry oder Köfte an den Fischtagen.");
  if (all.indexOf("egg") !== -1) hints.push("Kein Rührei — Frühstück über Skyr oder Shake.");
  if (all.indexOf("shellfish") !== -1) hints.push("Keine Schalentiere im Plan.");
  if (all.indexOf("soy") !== -1) hints.push("Kein Soja. Whey ist Milchprotein.");
  if (((p && p.dislikes) || []).length || String(p && p.dislikeNote || "").trim()) {
    hints.push("Unlieblinge werden getauscht, auch auf der Einkaufsliste.");
  }
  const g = (p && p.goal) || "both";
  if (g === "both" || g === "posture") hints.push("Haltung: 10-Min-Routine bleibt. Zug:Druck etwa 2:1.");
  if (g === "fat") hints.push("Fettabbau führt. Krafttraining bleibt, Haltung ist optional.");
  c.allowed = allowed;
  c.hints = hints;
  c.engine = c.usedScaleBmr ? "Waagen-BMR × Aktivität" : "Mifflin-St Jeor × Gym-Tage";
  return c;
}

const PHASES = {
  deficit: { label: "Defizit", hint: "Moderates Defizit (~400 kcal unter TDEE). Gewichte halten, nicht Jagd auf PRs." },
  break: { label: "Diätpause", hint: "1–2 Wochen Erhaltung. Training bleibt, Hunger darf runter." },
  reverse: { label: "Reverse Diet", hint: "Am Ziel: in +150-kcal-Schritten über 4–6 Wochen hoch." },
  maintain: { label: "Erhaltung", hint: "Kalorien auf TDEE. Gewicht halten, Haltung und Kraft voran." },
  surplus: { label: "Leichter Aufbau", hint: "Kleiner Überschuss (~200 kcal). Kein Dirty Bulk." }
};

const RULES = [
  { t: "Wiegen", s: "1× pro Woche, morgens nüchtern. Der Wochentrend zählt, nicht der Einzelwert." },
  { t: "Anpassen statt hungern", s: "2–3 Wochen kein Fortschritt → 150 kcal runter. Nie unter deinem Kalorienboden (Mann ~1.900, Frau ~1.500)." },
  { t: "Diätpausen", s: "Alle 8–10 Wochen 1–2 Wochen auf Erhaltung (dein TDEE)." },
  { t: "Reverse Diet am Ziel", s: "Über 4–6 Wochen in +150-kcal-Schritten hochfahren. Gewicht darf leicht steigen." },
  { t: "Krafttraining nie streichen", s: "Im Defizit Last halten. Ein gehaltenes Gewicht ist ein Gewinn." },
  { t: "80 % über 8 Monate", s: "Schlägt 100 % Perfektion über 3 Wochen. Der Sonntag ist bewusst flexibel." }
];

const PREP = {
  0: {
    title: "Sonntag · Meal Prep Mo–Di",
    items: [
      "Hähnchen oder Hack für 2 Lunch-Bowls braten",
      "Reis oder Linsen kochen, Gemüse schneiden, 2 Boxen portionieren",
      "Skyr, Beeren, Hafer und Whey für Mo–Di bereitlegen",
      "Lachs und Kartoffeln für Montag Abend einkaufen / vorbereiten"
    ]
  },
  3: {
    title: "Mittwoch · Meal Prep Do–Sa",
    items: [
      "3 Lunch-Bowls (Do–Sa) kochen und portionieren",
      "Köfte-Masse für Freitag vorbereiten oder einfrieren",
      "Curry-Reste vom Abend können Samstag-Lunch werden",
      "Obst, Whey, Eier checken — Snack-Slot darf nicht leer laufen"
    ]
  }
};

const EX = [
  {
    id: "brust", name: "Brust-Dehnung am Türrahmen",
    setup: "Unterarm am Türrahmen, Ellbogen auf Schulterhöhe. Oberkörper dreht in die Dehnung.",
    cue: "Unterarm an den Rahmen, Ellbogen auf Schulterhöhe. Körper langsam vordrehen, bis du Zug in der Brust spürst — dort atmen und halten.",
    why: "Macht Platz für die Schulter, die du am Schreibtisch nach vorn gezogen hast.",
    breath: "Langsam ausatmen und 2 cm tiefer drehen. Nicht federn.",
    dur: 45, sides: true, sets: 2, amt: "2 × 45 Sek. pro Seite"
  },
  {
    id: "huefte", name: "Hüftbeuger-Dehnung",
    setup: "Ausfallschritt kniend. Becken schiebt nach vorn, Oberkörper bleibt hoch, Gesäß an.",
    cue: "Hinteres Knie am Boden. Gesäß fest anspannen und Becken nach vorn schieben — Oberkörper bleibt aufrecht. Deine wichtigste Übung.",
    why: "Enge Hüftbeuger kippen das Becken und ziehen den unteren Rücken ins Hohlkreuz.",
    breath: "Gesäß an, Rippen unten. Jeder Atemzug schiebt das Becken einen Hauch nach vorn.",
    dur: 60, sides: true, sets: 2, amt: "2 × 60 Sek. pro Seite"
  },
  {
    id: "chin", name: "Chin Tucks",
    setup: "Kopf schiebt waagerecht zurück — Doppelkinn. Nicht nicken.",
    cue: "Kinn waagerecht nach hinten schieben (Doppelkinn machen), 3 Sekunden halten, locker lösen. Ruhig im eigenen Tempo wiederholen.",
    why: "Dein Spiegeltest: Ohr über der Schulter. Das hier ist die Gegenbewegung zum Handy-Nacken.",
    breath: "3 Sekunden halten, lösen, wieder. Nicht nach oben schauen — gerade zurück.",
    dur: 30, sides: false, sets: 3, amt: "3 × ~10 Wdh."
  },
  {
    id: "engel", name: "Wand-Engel",
    setup: "Rücken an der Wand. Arme vom W ins Y, Rippen unten, Wandkontakt.",
    cue: "Rücken und Lendenwirbelsäule an die Wand. Arme im W langsam nach oben führen und zurück — Kontakt zur Wand halten.",
    why: "Obere Rückenmuskeln, die das Zusammensinken der Brust rückgängig machen.",
    breath: "Rippen an der Wand lassen. Wenn die Lendenwirbel abheben: kleinerer Weg.",
    dur: 40, sides: false, sets: 2, amt: "2 × 10 Wdh."
  },
  {
    id: "bridge", name: "Glute Bridge",
    setup: "Rückenlage, Füße fest. Hüfte hoch, oben klemmen, langsam ab.",
    cue: "Becken hochdrücken, oben 2 Sekunden das Gesäß maximal anspannen, langsam absenken.",
    why: "Ein waches Gesäß hält das Becken — ohne das übernehmen Hüftbeuger und unterer Rücken.",
    breath: "Oben 2 Sekunden fest, dann kontrolliert ab. Nicht ins Hohlkreuz ausweichen.",
    dur: 45, sides: false, sets: 2, amt: "2 × ~15 Wdh."
  }
];

const DESK_EX = [
  { id: "chin", dur: 30, sides: false, sets: 1, ready: 5 },
  { id: "brust", dur: 30, sides: true, sets: 1, ready: 5 }
];

function buildQueue(list, withRest) {
  const q = [];
  list.forEach((e, i) => {
    const ex = typeof e === "number" ? EX[e] : EX.find(x => x.id === e.id) || e;
    const sets = e.sets != null ? e.sets : ex.sets;
    const dur = e.dur != null ? e.dur : ex.dur;
    const sides = e.sides != null ? e.sides : ex.sides;
    const exIdx = EX.findIndex(x => x.id === ex.id);
    q.push({ type: "ready", ex: exIdx, dur: 8, label: ex.name });
    for (let s = 1; s <= sets; s++) {
      if (sides) {
        q.push({ type: "work", ex: exIdx, side: "links", set: s, dur, sets });
        if (withRest) q.push({ type: "rest", ex: exIdx, dur: 12, next: "rechts" });
        q.push({ type: "work", ex: exIdx, side: "rechts", set: s, dur, sets });
        if (withRest && s < sets) q.push({ type: "rest", ex: exIdx, dur: 18, next: "nächster Satz" });
      } else {
        q.push({ type: "work", ex: exIdx, side: null, set: s, dur, sets });
        if (withRest && s < sets) q.push({ type: "rest", ex: exIdx, dur: 15, next: "nächster Satz" });
      }
    }
    if (withRest && i < list.length - 1) {
      const nxt = list[i + 1];
      const nx = typeof nxt === "number" ? EX[nxt] : EX.find(x => x.id === nxt.id);
      q.push({ type: "rest", ex: exIdx, dur: 20, next: nx ? nx.name : "" });
    }
  });
  return q;
}

const QUEUE_FULL = buildQueue(EX, true);
const QUEUE_DESK = buildQueue(DESK_EX, true);

const MIRROR = [
  { id: "ear", q: "Liegt das Ohr senkrecht über der Schulter?", hint: "Seitlich im Spiegel oder Foto. Kinn nicht anheben, um es zu schummeln." },
  { id: "ribs", q: "Sind die Rippen unten, oder steht der Brustkorb nach vorn?", hint: "Hohlkreuz und vorgestreckte Rippen gehören oft zur engen Hüfte." },
  { id: "knuckles", q: "Siehst du von vorn die Knöchel der Hände?", hint: "Wenn ja, sind die Schultern einwärts rotiert — extra Face Pulls und Brustdehnung." }
];

const SESSIONS = {
  1: {
    id: "zug-a",
    name: "Zug A",
    minutes: 50,
    hook: "Zug-Tag. Jeder Satz Rudern und Face Pulls ist Haltungstraining mit Gewicht.",
    focus: "Latissimus, obere Rücken, hintere Schulter",
    exercises: [
      { id: "pullapart", name: "Band Pull-Aparts", sets: 2, reps: "20", kind: "pull", cue: "Arme lang, Schulterblätter nach hinten-unten. Aufwärmen, nicht ego." },
      { id: "latzug", name: "Latzug oder unterstützter Klimmzug", sets: 3, reps: "8–12", kind: "pull", cue: "Brust rauf, Ellbogen zur Hüfte. Nicht mit dem Schwung aus der Lendenwirbelsäule." },
      { id: "rudern", name: "Rudern sitzend / chest-supported", sets: 3, reps: "8–12", kind: "pull", cue: "Pause von 1 Sek. hinten. Brust bleibt offen." },
      { id: "facepull", name: "Face Pulls", sets: 3, reps: "15–20", kind: "pull", cue: "Seil zur Stirn, außen rotieren. Das ist Medizin für deine Schulter." },
      { id: "rdl", name: "Romanian Deadlift", sets: 3, reps: "8–10", kind: "legs", cue: "Hüfte zurück, Rücken lang. Im Defizit Last halten." },
      { id: "deadbug", name: "Dead Bug", sets: 2, reps: "8/Seite", kind: "core", cue: "Untere Rücken bleibt am Boden. Langsam." }
    ]
  },
  2: {
    id: "druck-a",
    name: "Druck A · extra Zug",
    minutes: 50,
    hook: "Druck ist erlaubt — Face Pulls und Rudern dürfen den Tag trotzdem gewinnen.",
    focus: "Schrägbank, Schulter, hintere Kette als Ausgleich",
    exercises: [
      { id: "facepull2", name: "Face Pulls", sets: 3, reps: "15", kind: "pull", cue: "Zuerst Zug. Schultergelenk vorbereiten." },
      { id: "incline", name: "Schrägbank Kurzhantel", sets: 3, reps: "8–12", kind: "push", cue: "Leichte Schräge. Schulterblätter setzen, nicht die Hantel werfen." },
      { id: "row-db", name: "Einarmiges DB-Rudern", sets: 3, reps: "10", kind: "pull", cue: "Rumpf still. Zug zur Hüfte, nicht zum Ohr." },
      { id: "ohp", name: "Schulterdrücken Kurzhantel", sets: 2, reps: "8–10", kind: "push", cue: "Nur 2 Sätze. Rippen unten, Gesäß an." },
      { id: "reardelt", name: "Reverse Fly", sets: 3, reps: "12–15", kind: "pull", cue: "Kleine Last, sauber. Hintere Schulter muss brennen, nicht der Trapez." },
      { id: "cheststretch", name: "Türrahmen-Dehnung", sets: 2, reps: "45 Sek./Seite", kind: "access", cue: "Nach dem Drücken sofort öffnen. Wie in der Haltungsroutine." }
    ]
  },
  4: {
    id: "beine",
    name: "Beine + Gesäß",
    minutes: 50,
    hook: "Heute gewinnt die Haltung unten: Gesäß an, Hüftbeuger lang.",
    focus: "Kniebeuge, hinge, Hüfte — Fundament gegen das Sitzen",
    exercises: [
      { id: "thrust", name: "Hip Thrust oder schwere Glute Bridge", sets: 3, reps: "8–12", kind: "legs", cue: "Oben 2 Sek. klemmen. Kinn nicht zum Himmel." },
      { id: "squat", name: "Kniebeuge (Goblet oder Stange)", sets: 3, reps: "8", kind: "legs", cue: "Knie in Spur, Brust offen. Tiefe vor Last." },
      { id: "rdl2", name: "RDL", sets: 3, reps: "8", kind: "legs", cue: "Gleiche Idee wie Montag. Last halten." },
      { id: "lunge", name: "Ausfallschritte", sets: 2, reps: "10/Seite", kind: "legs", cue: "Oberkörper lang. Hinteres Becken schiebt nicht ins Hohlkreuz." },
      { id: "calf", name: "Wadenheben", sets: 2, reps: "12–15", kind: "access", cue: "Pause unten, Pause oben." },
      { id: "hipflex", name: "Hüftbeuger-Dehnung", sets: 2, reps: "60 Sek./Seite", kind: "access", cue: "Deine wichtigste Übung. Nicht skippen, weil das Gym vorbei ist." }
    ]
  },
  5: {
    id: "zug-b",
    name: "Zug B",
    minutes: 45,
    hook: "Zweiter Zug-Tag. Wieder 2:1 — der Nacken merkt das in acht Wochen.",
    focus: "Einarmiges Rudern, enger Latzug, Tragen",
    exercises: [
      { id: "pullapart2", name: "Band Pull-Aparts", sets: 2, reps: "20", kind: "pull", cue: "Blut in den hinteren Schultern." },
      { id: "dbrow", name: "Einarmiges DB-Rudern", sets: 3, reps: "8–12", kind: "pull", cue: "Bank stützt. Kein Rotieren im Rumpf." },
      { id: "latclose", name: "Latzug enger Griff", sets: 3, reps: "8–12", kind: "pull", cue: "Ellbogen eng, Brust hoch." },
      { id: "facepull3", name: "Face Pulls", sets: 3, reps: "15–20", kind: "pull", cue: "Wieder Medizin. Qualität vor Kilo." },
      { id: "farmer", name: "Farmer Carry", sets: 3, reps: "30–40 Sek.", kind: "pull", cue: "Hoch stehen wie ein Mann, der nicht in sein Handy sackt." },
      { id: "hang", name: "Totes Hängen (optional)", sets: 2, reps: "20–30 Sek.", kind: "access", cue: "Schulter entspannt in die Pfanne. Nacken nicht hochziehen." }
    ]
  },
  6: {
    id: "mix",
    name: "Mix · 2:1",
    minutes: 45,
    hook: "Samstag: Zug führt, Druck folgt. Danach ist die Woche verdient.",
    focus: "Oberkörper-Mix mit Zug-Überhang, Arme als Beilage",
    exercises: [
      { id: "row-sat", name: "Rudern", sets: 3, reps: "10", kind: "pull", cue: "Arbeitsgewicht der Woche halten." },
      { id: "face-sat", name: "Face Pulls", sets: 3, reps: "15", kind: "pull", cue: "Außenrotieren am Endpunkt." },
      { id: "press-sat", name: "Schrägbank", sets: 3, reps: "8–12", kind: "push", cue: "Einziger echter Druck-Block heute." },
      { id: "lat-sat", name: "Latzug", sets: 3, reps: "10", kind: "pull", cue: "Noch ein Zug-Block — das Verhältnis muss stimmen." },
      { id: "raise", name: "Seitheben", sets: 2, reps: "12", kind: "push", cue: "Leicht. Schulter nicht hochziehen." },
      { id: "arms", name: "Bizeps + Trizeps", sets: 2, reps: "10–12", kind: "access", cue: "Beilage. Form vor Schwung." }
    ]
  }
};

const REST_DAY = {
  0: { name: "Flexibler Tag", hook: "Wiegen, Spiegel, kochen. Kein Drama um die Zahl auf der Waage." },
  3: { name: "Ruhetag + Meal Prep", hook: "Muskeln wachsen hier. 30 Min zu Fuß, Haltungsroutine, Boxen für Do–Sa." }
};

const KIND_LABEL = { pull: "Zug", push: "Druck", legs: "Beine", core: "Core", access: "Zusatz" };
