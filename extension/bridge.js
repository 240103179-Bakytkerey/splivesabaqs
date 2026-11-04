// JUZ40 LIVE сайтының беттерінде іске қосылады (manifest.json → content_scripts).
// Сайт window.postMessage арқылы команда жібереді, ал бұл скрипт оны кеңейтімнің фондық бөлігіне жеткізеді.
(() => {
  'use strict';
  if (window.__juz40LiveBridge) return;
  window.__juz40LiveBridge = true;
  const IN = 'juz40-live-site', OUT = 'juz40-live-ext';
  const manifest = chrome.runtime.getManifest();
  const version = manifest.version_name || manifest.version;
  const pending = new Set();
  let port = null;
  const post = message => window.postMessage({channel: OUT, ...message}, location.origin);

  function connect() {
    if (port) return port;
    port = chrome.runtime.connect({name: 'juz40-live-site'});
    port.onMessage.addListener(m => {
      if (m.event) { post({event: m.event, data: m.data}); return; }
      if (!pending.has(m.id)) return;
      pending.delete(m.id);
      post({id: m.id, ok: m.ok, data: m.data, error: m.error, safe: m.safe});
    });
    port.onDisconnect.addListener(() => {
      port = null;
      // A request that was sent but never answered may have changed the site: it is not "safe".
      for (const id of pending) post({id, ok: false, error: 'Кеңейтіммен байланыс үзілді. Әрекет нәтижесін ашық беттен тексеріңіз.', safe: false});
      pending.clear();
    });
    return port;
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const m = event.data;
    if (!m || m.channel !== IN) return;
    if (m.method === 'hello') { post({event: 'hello', data: {version}}); return; }
    try {
      const p = connect();
      pending.add(m.id);
      p.postMessage({id: m.id, method: m.method, params: m.params});
    } catch {
      pending.delete(m.id);
      post({id: m.id, ok: false, error: 'Кеңейтім жаңартылды немесе өшірілді. Бетті қайта жүктеңіз.', safe: true});
    }
  });

  // Chrome stops an idle service worker after 30 seconds. While a step is running the worker is kept awake.
  setInterval(() => { if (port && pending.size) { try { port.postMessage({id: 'keepalive', method: 'ping'}); } catch {} } }, 20000);

  post({event: 'hello', data: {version}});
})();
