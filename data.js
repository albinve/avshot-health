/* AV·SHOT Health — Albins Plan. Alles hier ist auf ihn zugeschnitten. */
const WD = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const WD_SHORT = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const GYM_DAYS = [1, 2, 4, 5, 6];

const DEFAULTS = {
  name: "Albin",
  startKg: null,
  heightCm: null,
  kcal: 2150,
  protein: 175,
  waterMl: 2500,
  goalLow: 87,
  goalHigh: 89,
  kcalFloor: 1900,
  kcalMaintain: 2650,
  kcalDeficit: 2150,
  phase: "deficit", /* deficit | break | reverse */
  phaseStart: null,
  sound: true,
  haptic: true,
  onboarded: false
};

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

function breakfastId(dow, swap) {
  if (swap) return swap;
  return dow % 2 === 1 ? "skyr" : "eggs";
}

function lunchId(swap) {
  return swap || "bowl-chicken";
}

function snackId(swap) {
  return swap || "whey";
}

function mealsFor(dow, swaps) {
  swaps = swaps || {};
  const b = breakfastId(dow, swaps.fruehstueck);
  const l = lunchId(swaps.mittag);
  const s = snackId(swaps.snack);
  const d = DINNER_RID[dow];
  return [
    { id: "fruehstueck", label: "Frühstück", rid: b, alt: b === "skyr" ? "eggs" : "skyr" },
    { id: "mittag", label: "Mittagessen", rid: l, alt: l === "bowl-chicken" ? "bowl-beef" : "bowl-chicken" },
    { id: "snack", label: "Snack", rid: s, alt: s === "whey" ? "quark" : "whey" },
    { id: "abend", label: "Abendessen", rid: d, alt: null }
  ];
}

const SWAPS = {
  fruehstueck: [["skyr", "Skyr-Bowl"], ["eggs", "Rührei + Brot"]],
  mittag: [["bowl-chicken", "Hähnchen-Bowl"], ["bowl-beef", "Hack & Linsen"]],
  snack: [["whey", "Whey + Banane"], ["quark", "Quark + Zimt"]]
};

const PHASES = {
  deficit: { label: "Defizit", hint: "Fettabbau. Gewichte halten, nicht Jagd auf PRs." },
  break: { label: "Diätpause", hint: "1–2 Wochen Erhaltung. Training bleibt, Hunger darf runter." },
  reverse: { label: "Reverse Diet", hint: "Am Ziel: in +150-kcal-Schritten über 4–6 Wochen hoch." }
};

const RULES = [
  { t: "Wiegen", s: "1× pro Woche, morgens nüchtern. Der Wochentrend zählt, nicht der Einzelwert." },
  { t: "Anpassen statt hungern", s: "2–3 Wochen kein Fortschritt → 150 kcal runter. Nie unter 1.900 kcal." },
  { t: "Diätpausen", s: "Alle 8–10 Wochen 1–2 Wochen auf ~2.650 kcal Erhaltung." },
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
    cue: "Unterarm an den Rahmen, Ellbogen auf Schulterhöhe. Körper langsam vordrehen, bis du Zug in der Brust spürst — dort atmen und halten.",
    why: "Macht Platz für die Schulter, die du am Schreibtisch nach vorn gezogen hast.",
    breath: "Langsam ausatmen und 2 cm tiefer drehen. Nicht federn.",
    dur: 45, sides: true, sets: 2, amt: "2 × 45 Sek. pro Seite"
  },
  {
    id: "huefte", name: "Hüftbeuger-Dehnung",
    cue: "Hinteres Knie am Boden. Gesäß fest anspannen und Becken nach vorn schieben — Oberkörper bleibt aufrecht. Deine wichtigste Übung.",
    why: "Enge Hüftbeuger kippen das Becken und ziehen den unteren Rücken ins Hohlkreuz.",
    breath: "Gesäß an, Rippen unten. Jeder Atemzug schiebt das Becken einen Hauch nach vorn.",
    dur: 60, sides: true, sets: 2, amt: "2 × 60 Sek. pro Seite"
  },
  {
    id: "chin", name: "Chin Tucks",
    cue: "Kinn waagerecht nach hinten schieben (Doppelkinn machen), 3 Sekunden halten, locker lösen. Ruhig im eigenen Tempo wiederholen.",
    why: "Dein Spiegeltest: Ohr über der Schulter. Das hier ist die Gegenbewegung zum Handy-Nacken.",
    breath: "3 Sekunden halten, lösen, wieder. Nicht nach oben schauen — gerade zurück.",
    dur: 30, sides: false, sets: 3, amt: "3 × ~10 Wdh."
  },
  {
    id: "engel", name: "Wand-Engel",
    cue: "Rücken und Lendenwirbelsäule an die Wand. Arme im W langsam nach oben führen und zurück — Kontakt zur Wand halten.",
    why: "Obere Rückenmuskeln, die das Zusammensinken der Brust rückgängig machen.",
    breath: "Rippen an der Wand lassen. Wenn die Lendenwirbel abheben: kleinerer Weg.",
    dur: 40, sides: false, sets: 2, amt: "2 × 10 Wdh."
  },
  {
    id: "bridge", name: "Glute Bridge",
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
