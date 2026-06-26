const CACHE="pga-tour-18-v17";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./icon.svg"];
const CHARACTER_IDS=["balance","power","technique"];
const BASE_CHARACTER_ASSETS=CHARACTER_IDS.flatMap(id=>["icon","bust","full"].map(kind=>`assets/characters/${id}/${kind}.png`));
const SWING_FRAME_ASSETS=CHARACTER_IDS.flatMap(id=>["swing_01_address","swing_02_backswing","swing_03_top","swing_04_impact","swing_05_follow"].map(frame=>`assets/characters/${id}/swing/${frame}.png`));
const PUTT_FRAME_ASSETS=CHARACTER_IDS.flatMap(id=>["putt_01_address","putt_02_stroke","putt_03_impact","putt_04_follow"].map(frame=>`assets/characters/${id}/putt/${frame}.png`));
const OPTIONAL_CHARACTER_ASSETS=[...BASE_CHARACTER_ASSETS,...SWING_FRAME_ASSETS,...PUTT_FRAME_ASSETS];

self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(async cache=>{
  await cache.addAll(ASSETS);
  await Promise.all(OPTIONAL_CHARACTER_ASSETS.map(async asset=>{try{const response=await fetch(asset);if(response.ok)await cache.put(asset,response)}catch{}}));
})));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener("fetch",event=>event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request))));
