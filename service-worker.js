// Cache simples para o app funcionar offline. Não guarda nenhum dado do
// diário — isso vive só no IndexedDB do navegador.
//
// Estratégia: rede primeiro (pra sempre pegar a versão mais nova quando
// houver internet), cache como reserva só quando a rede falhar. Suba o
// número da versão abaixo a cada deploy para forçar a limpeza do cache
// antigo em quem já tinha instalado o app.

const CACHE_NAME = "diario-vital-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
