// JUZ40 LIVE 1.2.0 — фондық бөлік.
// Жоспарлаушы енді сайтта тұрады. Сайттағы bridge.js осы жұмысшыға port арқылы қосылып, команда жібереді,
// ал бұл жерде тек juz40-edu.kz бетімен жұмыс істейтін қадамдар орындалады (1.0.5 жоспарлаушысындағы adapter).
// 1.2.0: «API арқылы» режимінде сол әрекеттер бетсіз, juz40-edu.kz API-і арқылы орындалады (juzapi.js).
importScripts('config.js', 'model.js', 'juzapi.js');
const SITE = self.JUZ40_SITE;
const JUZ = 'https://juz40-edu.kz';
const PAGE_FILES = ['model.js', 'ui.js', 'content.js'];
const ACTIONS = new Set(['open', 'snapshot', 'createMeet', 'attach', 'fillNotes', 'patch', 'save', 'publish', 'unpublish']);
// Each limit is longer than the waits inside the page step, so a slow but successful step is not reported as uncertain.
const callLimits = {open: 240000, createMeet: 240000, attach: 240000, fillNotes: 150000, patch: 180000, save: 120000, publish: 120000, unpublish: 120000, snapshot: 120000};
const ports = new Set();
let abortNavigation = null;

const safeError = message => Object.assign(Error(message), {safe: true});
const broadcast = (event, data) => { for (const port of ports) { try { port.postMessage({event, data}); } catch {} } };

// Only the site's own pages may drive the extension. localhost entries accept any port for local development.
function allowedOrigin(value) {
  try {
    const u = new URL(value);
    return SITE.origins.some(o => { const a = new URL(o); return a.protocol === u.protocol && a.hostname === u.hostname && (!a.port || a.port === u.port); });
  } catch { return false; }
}

async function storedWorkTab() {
  const {workTabId} = await chrome.storage.session.get('workTabId');
  if (!workTabId) return null;
  try { return await chrome.tabs.get(workTabId); } catch { await chrome.storage.session.remove('workTabId'); return null; }
}

async function sourceTab(tabId) {
  if (!tabId) throw safeError('JUZ40 бетін таңдаңыз.');
  let tab;
  try { tab = await chrome.tabs.get(Number(tabId)); } catch { throw safeError('Таңдалған JUZ40 беті жабылған. Беттер тізімін жаңартыңыз.'); }
  if (!tab.url || new URL(tab.url).origin !== JUZ) throw safeError('JUZ40 бетін таңдаңыз.');
  return tab;
}

// The work tab gets its own window. A tab hidden behind other tabs is throttled by Chrome (after 5 minutes its
// timers run once a minute), which makes every wait on the site time out; a separate window stays visible.
async function workTab(sourceTabId) {
  const existing = await storedWorkTab();
  if (existing) return existing;
  const source = await sourceTab(sourceTabId);
  const win = await chrome.windows.create({url: source.url, type: 'normal', focused: true, width: 1280, height: 900});
  const tab = win.tabs[0];
  await chrome.storage.session.set({workTabId: tab.id});
  broadcast('window-opened', {tabId: tab.id});
  return tab;
}

const samePath = (actual, expected) => actual === expected || actual.startsWith(expected.replace(/\/$/, '') + '/');
function loadTab(tabId, pathname, start, limit = 45000) {
  return new Promise((resolve, reject) => {
    let done = false, timer;
    const finish = error => {
      if (done) return; done = true;
      chrome.tabs.onUpdated.removeListener(listener); clearTimeout(timer);
      if (abortNavigation === abort) abortNavigation = null;
      error ? reject(error) : resolve();
    };
    const abort = () => finish(Error('Тоқтатылды.'));
    abortNavigation = abort;
    const listener = (id, info, tab) => {
      if (id !== tabId) return;
      const current = tab?.url || info.url || '';
      if (current.includes('/auth/')) return finish(Error('JUZ40 аккаунтына кіріңіз.'));
      if (info.status === 'complete' && current && samePath(new URL(current).pathname, pathname)) finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    timer = setTimeout(() => finish(Error('Курс ашылмады. JUZ40 бетінде «Сайттан шығу керек пе?» терезесі ашық тұрса, оны жабыңыз; болмаса аккаунттың осы курсқа рұқсатын тексеріңіз.')), limit);
    Promise.resolve().then(start).then(result => { if (result === 'done') finish(); }).catch(finish);
  });
}

async function inject(tabId) { await chrome.scripting.executeScript({target: {tabId}, files: PAGE_FILES}); }

const methods = {
  ping: async () => 'pong',
  info: async () => ({version: chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version, siteUrl: SITE.url}),
  async listTabs() {
    const work = await storedWorkTab();
    const tabs = await chrome.tabs.query({url: JUZ + '/*'});
    return tabs.map(t => ({id: t.id, title: t.title || t.url, url: t.url, work: t.id === work?.id}));
  },
  async navigate({url, reload = false, sourceTabId}) {
    const original = await sourceTab(sourceTabId);
    const tab = await workTab(sourceTabId);
    const dest = new URL(url);
    if (dest.origin !== JUZ) throw Error('Курс сілтемесі дұрыс емес.');
    const methodist = dest.pathname.match(/^\/headTeacher\/subjects\/[^/]+\/([^/]+)$/);
    if (original.url.includes('/methodist/') && methodist) dest.pathname = '/methodist/course/' + methodist[1];
    // Wait for a load event that happens after this request. Polling tabs.get right after update/reload can still
    // see the previous document as "complete" and would let readback verify the old, unsaved form.
    if (tab.url === dest.href && !reload) {
      if (tab.status === 'complete') return {};
      await loadTab(tab.id, dest.pathname, async () => (await chrome.tabs.get(tab.id)).status === 'complete' ? 'done' : null);
      return {};
    }
    await loadTab(tab.id, dest.pathname, () => tab.url !== dest.href ? chrome.tabs.update(tab.id, {url: dest.href}) : chrome.tabs.reload(tab.id));
    return {};
  },
  async call({action, payload, sourceTabId}) {
    if (!ACTIONS.has(action)) throw safeError('Белгісіз әрекет: ' + action);
    const tab = await workTab(sourceTabId);
    await inject(tab.id);
    let timer;
    try {
      return await Promise.race([
        chrome.tabs.sendMessage(tab.id, {source: 'juz40-v1', action, payload}).then(r => {
          if (!r?.ok) throw Object.assign(Error(r?.error || 'Бетпен байланыс үзілді.'), {safe: r?.safe === true});
          return r.data;
        }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Жауап күту аяқталды. Әрекет нәтижесін ашық беттен тексеріңіз.')), callLimits[action] || 95000); })
      ]);
    } finally { clearTimeout(timer); }
  },
  // Read-only: lists the fields, buttons and switches the extension needs on the chosen page.
  async diagnose({tabId}) {
    const tab = await sourceTab(tabId);
    await inject(tab.id);
    const r = await chrome.tabs.sendMessage(tab.id, {source: 'juz40-v1', action: 'diagnose', payload: {}});
    if (!r?.ok) throw Error(r?.error || 'Бетпен байланыс үзілді.');
    return r.data;
  },
  // API mode: the same actions as `call`, done with juz40-edu.kz API requests. The chosen JUZ40 tab only lends its
  // login session; nothing is opened or clicked. `payload.at` is the course or lesson address the step works on.
  async api({action, payload, sourceTabId}) {
    if (!ACTIONS.has(action)) throw safeError('Белгісіз әрекет: ' + action);
    const tab = await sourceTab(sourceTabId);
    return JuzApi.call(tab.id, action, payload);
  },
  // Read-only: checks that the API answers for the course or lesson open in the chosen tab.
  async apiDiagnose({tabId}) {
    const tab = await sourceTab(tabId);
    return JuzApi.diagnose(tab.id, tab.url);
  },
  async stopNavigation() { abortNavigation?.(); return {}; },
  async forgetWorkTab() { await chrome.storage.session.remove('workTabId'); return {}; },
  async focusWorkTab() {
    const tab = await storedWorkTab();
    if (!tab) throw safeError('Жұмыс терезесі ашылмаған.');
    await chrome.tabs.update(tab.id, {active: true}); await chrome.windows.update(tab.windowId, {focused: true});
    return {};
  }
};

chrome.runtime.onConnect.addListener(port => {
  const sender = port.sender || {};
  if (port.name !== 'juz40-live-site' || sender.id !== chrome.runtime.id || !allowedOrigin(sender.origin || sender.url)) { port.disconnect(); return; }
  ports.add(port);
  port.onDisconnect.addListener(() => ports.delete(port));
  port.onMessage.addListener(async m => {
    if (!m || m.id === undefined) return;
    const reply = message => { try { port.postMessage({id: m.id, ...message}); } catch {} };
    const method = Object.hasOwn(methods, m.method) ? methods[m.method] : null;
    if (!method) { reply({ok: false, error: 'Белгісіз команда: ' + m.method, safe: true}); return; }
    try { reply({ok: true, data: await method(m.params || {})}); }
    catch (e) { reply({ok: false, error: e?.message || String(e), safe: e?.safe === true}); }
  });
});

// ui.js reports each small step on the page; it is passed on to the open site pages.
chrome.runtime.onMessage.addListener((m, sender) => {
  if (m?.source !== 'juz40-v1-progress' || !sender.tab) return;
  storedWorkTab().then(tab => { if (tab && tab.id === sender.tab.id) broadcast('progress', {jobId: m.jobId, detail: m.detail}); });
});

// The icon opens the site, or focuses a site page that is already connected.
chrome.action.onClicked.addListener(async () => {
  const tab = [...ports].map(p => p.sender?.tab).find(Boolean);
  if (tab) { await chrome.tabs.update(tab.id, {active: true}); await chrome.windows.update(tab.windowId, {focused: true}); return; }
  await chrome.tabs.create({url: SITE.url});
});

chrome.runtime.onInstalled.addListener(({reason}) => { if (reason === 'install') chrome.tabs.create({url: SITE.url}); });
