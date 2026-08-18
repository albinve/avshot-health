const CACHE = "avshot-health-v7";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./app.js",
  "./manifest.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./robots.txt"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isAppAsset(url){
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  if (/\.(html|css|js|json|webmanifest|png|svg|ico)$/i.test(p)) return true;
  if (p.endsWith("/") || /\/avshot-health\/?$/.test(p)) return true;
  return false;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch(err){ return; }
  if (!isAppAsset(url)) return;

  const isPage =
    req.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");

  const put = res => {
    if (res && res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
    }
    return res;
  };

  if (isPage) {
    e.respondWith(
      fetch(req).then(put).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      const fetched = fetch(req).then(put).catch(() => cached);
      return cached || fetched;
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (let i = 0; i < list.length; i++){
        if (list[i].url && "focus" in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

const NOTE = {
  haltung: { title: "10 Min Haltung", body: "Nacken und Hüfte. Kurzer Block, dann ist der Tag rund." },
  gym: { title: "Trainingstag", body: "Zug führt. Last halten zählt mehr als ein neuer PR." },
  water: { title: "Wasser", body: "Kein Saft. Ein paar Becher, dann weiter." },
  weigh: { title: "Waage, nüchtern", body: "Eine Zahl. Der Trend entscheidet, nicht das Drama." },
  shop: { title: "Einkauf für nächste Woche", body: "Liste steht unter Plan. Boxen für Mo–Di sparen den Mittwoch." }
};

function todayKeySw(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function hmMin(hm){
  const m = String(hm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function idbLoad(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("avshot-health", 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")){ resolve(null); return; }
      const tx = db.transaction("kv", "readonly");
      const r = tx.objectStore("kv").get("avshot-health");
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    };
  });
}

function idbSave(value){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("avshot-health", 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, "avshot-health");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function fireFromSw(){
  const S = await idbLoad();
  if (!S || !S.profile || !S.profile.reminders || !S.profile.reminders.on) return;
  const r = S.profile.reminders;
  r.lastFired = r.lastFired || {};
  const now = new Date();
  const key = todayKeySw();
  const dow = now.getDay();
  const nowM = now.getHours() * 60 + now.getMinutes();
  const day = (S.days && S.days[key]) || { checks: {}, water: 0, ritual: {} };
  const gymDays = (S.profile.gymDays || [1, 2, 4, 5, 6]);
  const ids = ["haltung", "gym", "water", "weigh", "shop"];
  let n = 0;
  for (let i = 0; i < ids.length; i++){
    const id = ids[i];
    if (r.enabled && r.enabled[id] === false) continue;
    if (r.lastFired[id] === key) continue;
    const t = hmMin((r.times || {})[id]);
    if (t == null || nowM < t) continue;
    let due = false;
    if (id === "gym") due = gymDays.indexOf(dow) >= 0 && !(day.checks && day.checks.gym);
    else if (id === "haltung") due = !(day.checks && day.checks.haltung);
    else if (id === "water") due = (day.water || 0) < (S.profile.waterMl || 2500) * 0.5;
    else if (id === "weigh") due = dow === 0 && !(day.ritual && day.ritual.weighed);
    else if (id === "shop") due = dow === 0 && !(day.ritual && day.ritual.mealPrep);
    if (!due) continue;
    const copy = NOTE[id];
    await self.registration.showNotification(copy.title, {
      body: copy.body,
      tag: "avshot-" + id,
      lang: "de",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: { url: "./" }
    });
    r.lastFired[id] = key;
    n++;
  }
  if (n){
    S.savedAt = Date.now();
    await idbSave(S);
  }
}

self.addEventListener("periodicsync", e => {
  if (e.tag === "avshot-remind") e.waitUntil(fireFromSw().catch(()=>{}));
});
