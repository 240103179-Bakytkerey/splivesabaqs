// 1.3.0: ауызша/жазбаша пәндер — мәтіннен оқу, email, оқу айы, сілтемелер мәтіні, курстарды JUZ40-тан жүктеу.
//   node --test tests/subjects.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
require('../extension/model.js'); require('../web/js/courses.js');
const M = globalThis.LiveModel, C = globalThis.LiveCourses;
const settings = M.defaults();

test('мәтіннен ауызша/жазбаша пәндер танылады, email және оқу айы пәнге қарай қойылады', () => {
  const text = `🎙 05.11 | SP-2 АУЫЗША/ЖАЗБАША ПӘН LIVE САБАҚ СІЛТЕМЕЛЕРІ

ГЕО-БИО, ГЕО-ДЖТ
🌍 ПӘН: ГЕОГРАФИЯ
МҰҒАЛІМ: АСАНОВА АЙГЕРІМ
ПОТОК: 1
УАҚЫТЫ: 17:00-18:30

ӘДЕБ-ТІЛ
📜 ПӘН: ҚАЗАҚСТАН ТАРИХЫ
МҰҒАЛІМ: СЕРІК НҰРЛАН
ПОТОК: 2
УАҚЫТЫ: 19:00-20:30

РУС-ЛИТ
ПӘН: РУС
МҰҒАЛІМ: ИВАНОВА АННА
ПОТОК: 1
УАҚЫТЫ: 15:00-16:30
СІЛТЕМЕ: https://meet.google.com/abc-defg-hij
ЖАУАПТЫ: @someone`;
  const {rows, warnings} = M.parse(text, settings);
  assert.deepEqual(warnings, []);
  assert.deepEqual(rows.map(r => r.subject), ['geo', 'hist', 'rus']);
  assert.ok(rows.every(r => r.stream === 'sep' && r.date === `${settings.year}-11-05`));
  assert.ok(rows.every(r => r.email === 'smartpro_auyzsha@juz40onl.com'));
  assert.deepEqual(rows[0].directions, ['ГЕОБИО', 'ГЕОДЖТ']);
  // ҚЫРКҮЙЕК = 3-ай; Қазақстан тарихы МС сияқты бір ай артта.
  assert.deepEqual(rows.map(r => r.month), [3, 2, 3]);
});

test('пәндердің барлық жазылуы танылады', () => {
  const cases = {ГЕО:'geo', ДЖТ:'wh', 'ДҮНИЕЖҮЗІ ТАРИХЫ':'wh', БИО:'bio', ӘДЕБ:'kazlit', 'ҚАЗАҚ ӘДЕБИЕТІ':'kazlit', ТІЛ:'kaz', 'ҚАЗАҚ ТІЛІ':'kaz', ТАРИХ:'hist', РУС:'rus', 'РУССКИЙ ЯЗЫК':'rus', ЛИТ:'ruslit', 'РУССКАЯ ЛИТЕРАТУРА':'ruslit', ҚҰҚЫҚ:'law', 'ҚҰҚЫҚ НЕГІЗДЕРІ':'law', МАТ:'math', ГЕОМ:'geometry', ИНФО:'info'};
  for (const [written, subject] of Object.entries(cases)) assert.equal(M.subjectAliases[M.norm(written)], subject, written);
});

test('есеп пәндері өзгерген жоқ: email, бас жол', () => {
  const row = M.makeRow(settings, {subject: 'math'});
  assert.equal(row.email, 'smartpro_esep@juz40onl.com');
  assert.equal(M.category('ms'), 'esep');
  assert.equal(M.category('law'), 'auyzsha');
});

test('сілтемелер мәтіні: ЕСЕП ПӘН мен АУЫЗША/ЖАЗБАША ПӘН бөлек блок', () => {
  const rec = (subject, start, link, direction) => {
    const row = M.makeRow(settings, {stream: 'oct', subject, teacher: 'Мұғалім ' + subject, date: '2026-11-05', start, end: '23:00', cohort: 1});
    return {task: M.task(row, settings), course: {direction}, verified: true, published: true, link};
  };
  const out = M.report([rec('hist', '19:00', 'https://meet.google.com/aaa-bbbb-ccc', 'ӘДЕБ-ТІЛ'), rec('math', '15:00', 'https://meet.google.com/ddd-eeee-fff', 'ФИЗ-МАТ'), rec('geo', '17:00', 'https://meet.google.com/ggg-hhhh-iii', 'ГЕО-БИО')]);
  const lines = out.split('\n');
  assert.equal(lines[0], '🖥 05.11 | SP-3 ЕСЕП ПӘН LIVE САБАҚ СІЛТЕМЕЛЕРІ');
  const second = lines.indexOf('🎙 05.11 | SP-3 АУЫЗША/ЖАЗБАША ПӘН LIVE САБАҚ СІЛТЕМЕЛЕРІ');
  assert.ok(second > 0, out);
  assert.ok(out.indexOf('ГЕОГРАФИЯ') > second && out.indexOf('ҚАЗАҚСТАН ТАРИХЫ') > out.indexOf('ГЕОГРАФИЯ'), 'уақыт бойынша реттеледі');
  assert.match(out, /🌍 ПӘН: ГЕОГРАФИЯ/);
  assert.match(out, /📜 ПӘН: ҚАЗАҚСТАН ТАРИХЫ/);
  // The report it produces is read back by «Мәтіннен енгізу».
  const back = M.parse(out, settings);
  assert.deepEqual(back.warnings, []);
  assert.deepEqual(back.rows.map(r => r.subject).sort(), ['geo', 'hist', 'math']);
});

test('курстарды JUZ40-тан жүктеу: атауынан ағым, бағыт, пән; қайталанатыны қосылмайды', () => {
  const sid = '11111111-1111-4111-8111-111111111111';
  const item = (id, name) => ({id, name, url: `https://juz40-edu.kz/headTeacher/subjects/${sid}/${id}`});
  const existing = C.courses.find(c => c.stream === 'oct' && c.subject === 'math' && c.direction === 'ФИЗ-МАТ');
  const r = C.fromJuz([
    item('aaaaaaaa-0000-4000-8000-000000000001', 'SMART-PRO | ГЕО-БИО | ГЕО | ҚАЗАН'),
    item('aaaaaaaa-0000-4000-8000-000000000002', 'SMART-PRO | ӘДЕБ-ТІЛ | ТАРИХ | ҚЫРКҮЙЕК'),
    item('aaaaaaaa-0000-4000-8000-000000000003', 'SMART-PRO | ДЖТ-ҚҰҚЫҚ | ҚҰҚЫҚ | ТАМЫЗ'),
    item('aaaaaaaa-0000-4000-8000-000000000004', 'SMART-PRO | ФИЗ-МАТ | МАТ | ҚАЗАН'),
    item('aaaaaaaa-0000-4000-8000-000000000005', 'Ескі курс | 2024'),
    item(existing.id, existing.name)
  ], settings, C.courses, M);
  assert.deepEqual(r.added.map(c => [c.stream, c.direction, c.subjects.join('+')]), [['oct', 'ГЕО-БИО', 'geo'], ['sep', 'ӘДЕБ-ТІЛ', 'hist'], ['aug', 'ДЖТ-ҚҰҚЫҚ', 'law']]);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].clash, existing.name);
  assert.deepEqual(r.unknown, ['Ескі курс | 2024']);
  // A row for those directions now finds its course.
  const row = M.makeRow(settings, {stream: 'oct', subject: 'geo', directions: M.directions('ГЕО-БИО')});
  assert.deepEqual(M.matches(row, [...C.courses, ...r.added]).map(c => c.name), ['SMART-PRO | ГЕО-БИО | ГЕО | ҚАЗАН']);
});
