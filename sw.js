const CACHE = "avshot-health-v13";
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
  if (url.origin === self.location.origin && /\/avshot-health$/.test(url.pathname)) {
    e.respondWith(Response.redirect(url.origin + "/avshot-health/", 301));
    return;
  }
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
