// Нақты Chromium-дағы сынақ: сайт + орнатылған кеңейтім + жасанды juz40-edu.kz беті.
// Нақты juz40-edu.kz сайтына ешқандай сұрау жіберілмейді: ол мекенжай Playwright route арқылы жасанды бетпен ауыстырылады.
//   npm test
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from '../scripts/build.mjs';
import {serve} from '../scripts/serve.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const COURSE = 'https://juz40-edu.kz/methodist/course/93daca7b-8700-4040-8411-44317a28d3fc';
const fakeCourse = `<!doctype html><html><head><meta charset="utf-8"><title>SMART-PRO | ИНФО-МАТ | ТАМЫЗ</title></head><body><h1>Жасанды курс беті</h1></body></html>`;

let server, context, site, juz, tmp, errors = [], juzRequests = [];

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'juz40-e2e-'));
  build({url: 'http://localhost/'});
  execFileSync('unzip', ['-q', join('dist', 'downloads', 'juz40-live-extension.zip'), '-d', tmp], {cwd: new URL('..', import.meta.url).pathname});
  const ext = join(tmp, 'juz40-live-extension');
  server = await serve(0);
  context = await chromium.launchPersistentContext(join(tmp, 'profile'), {channel: 'chromium', headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]});
  await context.route('https://juz40-edu.kz/**', route => { juzRequests.push(route.request().url()); route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: fakeCourse}); });
  // The extension opens the site on install; wait for that and close it so the test controls its own pages.
  juz = await context.newPage();
  await juz.goto(COURSE);
  site = await context.newPage();
  site.on('pageerror', e => errors.push(e.message));
  site.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text()); });
  await site.goto(`http://localhost:${server.address().port}/`);
});

after(async () => { await context?.close(); server?.close(); rmSync(tmp, {recursive: true, force: true}); });

test('сайт кеңейтімді табады', async () => {
  await site.waitForSelector('#ext-status[data-state=connected]', {timeout: 10000});
  assert.match(await site.textContent('#ext-status-text'), /1\.3\.0/);
  assert.equal(await site.isHidden('#ext-banner'), true);
});

test('ашық JUZ40 беті тізімде таңдалады', async () => {
  await site.click('#refresh');
  await site.waitForFunction(() => document.querySelector('#browser-tab').value !== '');
  assert.match(await site.$eval('#browser-tab', s => s.selectedOptions[0].textContent), /SMART-PRO/);
});

test('«Бетті тексеру» JUZ40 бетінен нәтиже қайтарады', async () => {
  await site.click('#diagnose');
  await site.waitForSelector('#diagnose-dialog[open] #diagnose-list li');
  assert.match(await site.textContent('#diagnose-summary'), /тексерудің/);
  assert.match(await site.inputValue('#diagnose-text'), /juz40-edu\.kz\/methodist\/course/);
  await site.click('#diagnose-dialog [data-close]');
});

test('мәтіннен енгізу кестеге жол қосады', async () => {
  await site.click('#open-import');
  await site.fill('#import-text', '22.10 | SP-1\nИНФО-МАТ\nПӘН: ИНФО\nМҰҒАЛІМ: НҰРЛАНОВ ЭДУАРД\nПОТОК: 1\nУАҚЫТЫ: 16:40-18:10');
  await site.click('#parse-import');
  await site.waitForSelector('#schedule-body tr');
  assert.equal(await site.textContent('#row-count'), '1');
  assert.match(await site.textContent('#schedule-body'), /Информатика/);
});

test('«Тексеру» кеңейтім арқылы жұмыс терезесін ашып, нәтижесін сайтқа қайтарады', async () => {
  const pagesBefore = context.pages().length;
  await site.click('#scan');
  await site.waitForSelector('#review-list article.job .badge.error', {timeout: 90000});
  // The fake page is not a real course page, so the scan stops with the page script's own message.
  const detail = await site.textContent('#review-list .job-detail');
  assert.ok(detail.trim().length > 0, 'қате мәтіні келуі керек');
  assert.ok(context.pages().length > pagesBefore, 'жұмыс терезесі ашылуы керек');
  assert.ok(juzRequests.some(u => u.startsWith(COURSE)), 'курс беті ашылуы керек');
  assert.equal(await site.isHidden('#progress-section'), true);
});

test('API режимі: «Бетті тексеру» api.juz40-edu.kz-тен оқиды, ештеңе өзгертпейді', async () => {
  const apiRequests = [];
  await context.route('https://api.juz40-edu.kz/**', route => {
    const r = route.request();
    apiRequests.push({method: r.method(), url: r.url(), auth: r.headers().authorization});
    const path = new URL(r.url()).pathname;
    const body = path.startsWith('/v1/courses/') ? {id: path.split('/').at(-1), name: 'SMART-PRO | ИНФО-МАТ | ИНФО | ТАМЫЗ'}
      : path.endsWith('/rating-task-types') ? ['HOMEWORK', 'LIVE_SABAK'] : [];
    route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
  });
  await juz.evaluate(() => localStorage.setItem('token', 'e2e-token'));
  await site.selectOption('#engine', 'api');
  await site.click('#diagnose');
  await site.waitForSelector('#diagnose-dialog[open] #diagnose-list li');
  const text = await site.inputValue('#diagnose-text');
  assert.match(text, /✓ JUZ40 сессиясы/);
  assert.match(text, /✓ «Live сабақ» тапсырма тегі/);
  assert.ok(apiRequests.length > 0, 'API-ге сұрау жіберілуі керек');
  assert.ok(apiRequests.every(r => r.method === 'GET' && r.auth === 'Bearer e2e-token'));
  await site.click('#diagnose-dialog [data-close]');
  await site.selectOption('#engine', 'page');
});

test('консольде қате жоқ', () => { assert.deepEqual(errors, []); });
