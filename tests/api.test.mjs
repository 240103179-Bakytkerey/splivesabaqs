// «API арқылы» режимінің сынағы: runner.js → juzapi.js → жадыдағы жасанды api.juz40-edu.kz.
// Нақты juz40-edu.kz-ке сұрау жіберілмейді: fetch жасанды сервермен ауыстырылады.
//   node --test tests/api.test.mjs
// Уақыт белдеуі Алматыға бекітіледі (UTC+5), сонда жергілікті ↔ UTC түрлендіру тексеріледі.
process.env.TZ = 'Asia/Almaty';
import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

// The browser files set globals (LiveModel, LiveRunner, LiveCourses); the package is ESM, so they are loaded for that.
const require = createRequire(import.meta.url);
require('../extension/model.js'); require('../web/js/runner.js'); require('../web/js/courses.js');
const M = globalThis.LiveModel, {Runner} = globalThis.LiveRunner, {courses} = globalThis.LiveCourses;

const API = 'https://api.juz40-edu.kz';
const LINK = 'https://meet.google.com/abc-defg-hij';
let db, calls, seq, token;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
// The real server answers with UTC time and no zone designator.
const naive = iso => new Date(iso).toISOString().replace('Z', '').replace(/\.\d+$/, '');

function reset() {
  seq = 0; calls = []; token = 'test-token';
  const infoMat = courses.find(c => c.stream === 'aug' && c.subject === 'math' && c.direction === 'ИНФО-МАТ');
  const fizMat = courses.find(c => c.stream === 'aug' && c.subject === 'math' && c.direction === 'ФИЗ-МАТ');
  db = {infoMat, fizMat, courses: {[infoMat.id]: {id: infoMat.id, name: infoMat.name}, [fizMat.id]: {id: fizMat.id, name: fizMat.name}},
    groups: {[infoMat.id]: [{id: 'g1', groupName: 'A'}, {id: 'g2', groupName: 'B'}], [fizMat.id]: [{id: 'g3', groupName: 'C'}]},
    themes: [], lessons: {}, meetings: {}};
  // Each week already has some theme, otherwise the plan treats month/week as wrong.
  for (const c of [infoMat, fizMat]) db.themes.push({id: uuid(), name: '4-АЙ 3-АПТА | ҮЙ ЖҰМЫСЫ', month: 4, week: 3, courseId: c.id});
}
const json = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const lessonView = l => ({...l, meetings: l.meetingIds.map(id => db.meetings[id])});

async function fakeFetch(input, init = {}) {
  const url = new URL(input), method = init.method || 'GET', body = init.body ? JSON.parse(init.body) : undefined, path = url.pathname;
  calls.push({method, path, query: Object.fromEntries(url.searchParams), body});
  assert.equal(url.origin, API);
  if (init.headers?.Authorization !== 'Bearer ' + token) return json(401, {message: 'Unauthorized'});
  let m;
  if (method === 'GET' && (m = path.match(/^\/v1\/courses\/([^/]+)$/))) return json(200, db.courses[m[1]]);
  if (method === 'GET' && (m = path.match(/^\/v1\/headteacher\/courses\/([^/]+)\/groups$/))) return json(200, db.groups[m[1]] || []);
  if (method === 'GET' && path === '/v1/lessons/rating-task-types') return json(200, ['HOMEWORK', 'PS_KONSPEKT', 'LIVE_SABAK']);
  if (method === 'GET' && path === '/v1/lessons/practics/meeting-organizer-emails') return json(200, ['smartpro_esep@juz40onl.com']);
  if (method === 'GET' && path === '/v2/themes') return json(200, db.themes.filter(t => t.courseId === url.searchParams.get('courseId') && (!url.searchParams.get('month') || String(t.month) === url.searchParams.get('month')) && (!url.searchParams.get('week') || String(t.week) === url.searchParams.get('week'))));
  if (method === 'POST' && path === '/v1/themes') { const t = {id: uuid(), ...body}; db.themes.push(t); return json(200, t); }
  if (method === 'GET' && (m = path.match(/^\/v2\/headteacher\/themes\/([^/]+)\/lessons$/))) return json(200, Object.values(db.lessons).filter(l => l.themeId === m[1]).map(l => ({id: l.id, name: l.name, published: l.published})));
  if (method === 'POST' && path === '/v1/lessons') { const l = {id: uuid(), name: body.name, themeId: body.themeId, lessonType: body.lessonType, published: false, rating: false, ratingTaskType: null, maxScore: null, description: '', meetingIds: []}; db.lessons[l.id] = l; return json(200, {id: l.id, name: l.name}); }
  if (method === 'GET' && (m = path.match(/^\/v1\/lessons\/([^/]+)$/))) return db.lessons[m[1]] ? json(200, lessonView(db.lessons[m[1]])) : json(404, {message: 'not found'});
  if (method === 'PUT' && (m = path.match(/^\/v1\/lessons\/practics\/([^/]+)$/)) && db.lessons[m[1]]) {
    const l = db.lessons[m[1]];
    for (const k of ['name', 'description', 'rating', 'ratingTaskType', 'maxScore']) l[k] = body[k];
    assert.equal(body.meetings.length, l.meetingIds.length, 'сақтау денесінде барлық қосылым болуы керек');
    return json(200, lessonView(l));
  }
  if (method === 'POST' && path === '/v1/lessons/practics/meetings') {
    const l = db.lessons[body.lessonId];
    for (const k of ['name', 'startDate', 'endDate', 'groupIds', 'organizerEmail', 'deadline']) assert.ok(body[k] !== undefined && body[k] !== '', 'Meet өрісі бос: ' + k);
    const meeting = {id: uuid(), name: body.name, startDate: naive(body.startDate), endDate: naive(body.endDate), deadline: naive(body.deadline), groupIds: body.groupIds, meetingMaxScore: body.meetingMaxScore, minAttendancePercent: body.minAttendancePercent, organizerEmail: body.organizerEmail, meetingUrl: LINK, meetingStatus: 'SCHEDULED', recordingUrl: null, sourceMeetingId: null, sourceLesson: null};
    db.meetings[meeting.id] = meeting; l.meetingIds.push(meeting.id);
    return json(200, lessonView(l));
  }
  if (method === 'PUT' && (m = path.match(/^\/v1\/lessons\/practics\/meetings\/([^/]+)$/))) { const x = db.meetings[m[1]]; Object.assign(x, {...body, startDate: naive(body.startDate), endDate: naive(body.endDate), ...(body.deadline ? {deadline: naive(body.deadline)} : {})}); return json(200, {}); }
  if (method === 'POST' && (m = path.match(/^\/v1\/lessons\/practics\/meetings\/([^/]+)\/links$/))) {
    const src = db.meetings[m[1]], l = db.lessons[body.lessonId], srcLesson = Object.values(db.lessons).find(x => x.meetingIds.includes(src.id));
    // As on the real server (05.11.2026): a linked meeting is named after the source lesson.
    const link = {...src, name: srcLesson.name, id: uuid(), sourceMeetingId: src.id, sourceLesson: {id: srcLesson.id, name: srcLesson.name}, groupIds: body.groupIds, deadline: naive(body.deadline)};
    db.meetings[link.id] = link; l.meetingIds.push(link.id);
    return json(200, lessonView(l));
  }
  if (method === 'PATCH' && (m = path.match(/^\/v1\/lessons\/([^/]+)\/publish$/))) { const l = db.lessons[m[1]]; l.published = url.searchParams.get('publish') === 'true'; return json(200, {published: l.published}); }
  return json(404, {message: 'no route ' + method + ' ' + path});
}

globalThis.fetch = fakeFetch;
globalThis.chrome = {scripting: {executeScript: async () => [{result: {token, role: 'HEAD_TEACHER'}}]}};
require('../extension/juzapi.js');
const J = globalThis.JuzApi;

// The same adapter as web/js/app.js → apiAdapter, with the extension call made directly.
function apiAdapter() {
  let at = null;
  return {navigate: async url => { at = url; }, call: async (action, payload) => { const r = await J.call(1, action, {...payload, at}); if (r?.lessonUrl) at = r.lessonUrl; return r; }};
}
function setup() {
  const settings = M.defaults();
  const row = M.makeRow(settings, {stream: 'aug', subject: 'math', teacher: 'Нұрланов Эдуард', date: '2026-11-10', start: '16:40', end: '18:10', directions: ['ИНФОМАТ', 'ФИЗМАТ'], courseIds: [db.infoMat.id, db.fizMat.id], month: 4, week: 3});
  const state = {settings, rows: [row], catalog: courses, jobs: {}};
  const runner = new Runner({adapter: apiAdapter(), state, persist: async () => {}});
  const {jobs, errors} = M.plan(state.rows, settings, courses);
  assert.deepEqual(errors, []);
  return {state, runner, jobs};
}

beforeEach(reset);

test('уақыт: жергілікті ↔ сервер (UTC, белдеусіз)', () => {
  assert.equal(J.toServer('2026-11-10', '16:40'), '2026-11-10T11:40:00.000Z');
  assert.deepEqual(J.fromServer('2026-11-10T11:40:00'), {date: '2026-11-10', time: '16:40'});
  assert.deepEqual(J.fromServer('2026-11-10T11:40:00Z'), {date: '2026-11-10', time: '16:40'});
});

test('нұсқаулық HTML ↔ мәтін және жуан қаріп', () => {
  const text = 'Сәлем!\n\n1. Камера & чат <ереже>';
  const html = J.instructionHtml(text);
  assert.equal(J.htmlText(html), M.clean(text));
  assert.equal(J.htmlBold(html), true);
  assert.equal(J.htmlBold('<p>жай</p>'), false);
});

test('API тексеруі ештеңе өзгертпейді және жаңа сабақты табады', async () => {
  const {state, runner, jobs} = setup();
  await runner.run(jobs, 'scan');
  for (const j of jobs) assert.equal(state.jobs[j.id].phase, 'new', state.jobs[j.id].detail);
  assert.ok(calls.every(c => c.method === 'GET'), 'тексеру тек GET жіберуі керек');
});

test('орындау: тақырып, сабақ, Meet, сақтау, жариялау; екінші курс сол Meet-ке байланысады', async () => {
  const {state, runner, jobs} = setup();
  await runner.run(jobs, 'scan');
  await runner.run(jobs, 'execute');
  for (const j of jobs) assert.equal(state.jobs[j.id].phase, 'done', state.jobs[j.id].detail + ' · ' + state.jobs[j.id].error);
  const lessons = Object.values(db.lessons);
  assert.equal(lessons.length, 2);
  for (const l of lessons) {
    assert.equal(l.published, true);
    assert.equal(l.name, 'LIVE САБАҚ №11 | НҰРЛАНОВ ЭДУАРД | 1-АҒЫМ');
    assert.equal(l.ratingTaskType, 'LIVE_SABAK');
    assert.equal(l.rating, true);
    assert.equal(l.maxScore, 25);
    assert.equal(J.htmlBold(l.description), true);
  }
  assert.equal(calls.filter(c => c.method === 'POST' && c.path === '/v1/lessons/practics/meetings').length, 1, 'Meet бір рет қана құрылады');
  assert.equal(calls.filter(c => c.path.endsWith('/links')).length, 1, 'екінші курс бар Meet-ке байланысады');
  const created = calls.find(c => c.path === '/v1/lessons/practics/meetings').body;
  assert.equal(created.startDate, '2026-11-10T11:40:00.000Z');
  assert.equal(created.deadline, '2026-11-11T18:59:00.000Z');
  assert.deepEqual(created.groupIds, ['g1', 'g2']);
  assert.equal(created.name, '4-АЙ 3-АПТА | LIVE САБАҚ | НҰРЛАНОВ ЭДУАРД');
  assert.equal(M.report(Object.values(state.jobs).map(s => s.record)).includes(LINK), true);
  // A second scan finds both lessons done and sends nothing that changes the site.
  calls = [];
  await runner.run(jobs, 'scan');
  for (const j of jobs) assert.equal(state.jobs[j.id].phase, 'done', state.jobs[j.id].detail);
  assert.ok(calls.every(c => c.method === 'GET'));
});

test('таңдалған өрісті түзету: жариялау уақытша өшіп, қайта қосылады', async () => {
  const {state, runner, jobs} = setup();
  await runner.run(jobs, 'scan');
  await runner.run(jobs, 'execute');
  const first = jobs[0], lesson = Object.values(db.lessons).find(l => l.meetingIds.some(id => !db.meetings[id].sourceMeetingId));
  db.meetings[lesson.meetingIds[0]].meetingMaxScore = 10;
  await runner.run([first], 'scan');
  assert.equal(state.jobs[first.id].phase, 'review');
  assert.deepEqual(state.jobs[first.id].differences.map(d => d.key), ['attendance']);
  state.jobs[first.id].selected = ['attendance'];
  await runner.run([first], 'execute');
  assert.equal(state.jobs[first.id].phase, 'done', state.jobs[first.id].error+' '+JSON.stringify(state.jobs[first.id].differences));
  assert.equal(db.meetings[lesson.meetingIds[0]].meetingMaxScore, 30);
  assert.equal(lesson.published, true);
  assert.deepEqual(calls.filter(c => c.path.endsWith('/publish')).slice(-2).map(c => c.query.publish), ['false', 'true']);
});

test('сессия жоқ немесе аяқталған: қате «қауіпсіз», ештеңе жіберілмейді', async () => {
  const {state, runner, jobs} = setup();
  token = null;
  globalThis.chrome.scripting.executeScript = async () => [{result: {token: null}}];
  await runner.run(jobs, 'scan');
  assert.equal(state.jobs[jobs[0].id].phase, 'error');
  assert.match(state.jobs[jobs[0].id].error, /аккаунтына кіріңіз/);
  assert.equal(calls.length, 0);
  globalThis.chrome.scripting.executeScript = async () => [{result: {token, role: 'HEAD_TEACHER'}}];
});

test('Meet сұрауына жауап келмесе — «Нәтиже белгісіз», қайта құрылмайды', async () => {
  const {state, runner, jobs} = setup();
  await runner.run(jobs, 'scan');
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => { if ((init?.method || 'GET') === 'POST' && new URL(input).pathname === '/v1/lessons/practics/meetings') throw new TypeError('Failed to fetch'); return original(input, init); };
  try { await runner.run(jobs, 'execute'); } finally { globalThis.fetch = original; }
  const s = state.jobs[jobs[0].id];
  assert.equal(s.phase, 'uncertain');
  assert.equal(s.uncertain, true);
  assert.equal(state.jobs[jobs[1].id].phase, 'new', 'кезек тоқтауы керек');
});
