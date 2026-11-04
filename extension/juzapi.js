// JUZ40 LIVE 1.2.0 — juz40-edu.kz сайтының өз API-і арқылы жұмыс (сынақ режимі).
// Бетті басқарудың орнына (content.js + ui.js) сол әрекеттер https://api.juz40-edu.kz сұрауларымен орындалады.
// Эндпоинттер мен сұрау денелері juz40-edu.kz Angular бумасынан алынды (04.11.2026):
//   GET    /v2/themes?courseId&month&week               тақырыптар (апта бойынша)
//   POST   /v1/themes                                    {name,month,week,courseId,startTime}
//   GET    /v2/headteacher/themes/{id}/lessons           тақырып сабақтары (әдіскерде /v2/methodist/…)
//   POST   /v1/lessons                                   {lessonType:'PRACTICAL',themeId,name}
//   GET    /v1/lessons/{id}                              сабақ + meetings[]
//   PUT    /v1/lessons/practics/{id}                     сабақты сақтау (атауы, нұсқаулық, балл, тег, рейтинг)
//   POST   /v1/lessons/practics/meetings                 Meet құру {lessonId,name,startDate,endDate,groupIds,…}
//   PUT    /v1/lessons/practics/meetings/{id}            Meet өрістерін түзету
//   POST   /v1/lessons/practics/meetings/{id}/links      бар Meet-ті басқа сабаққа байланыстыру
//   PATCH  /v1/lessons/practics/meeting-links/{id}       байланыстың топтары/дедлайны
//   PATCH  /v1/lessons/{id}/publish?publish=true|false   жариялау
//   GET    /v1/lessons/practics/meeting-organizer-emails, /v1/lessons/rating-task-types,
//          /v1/headteacher/courses/{id}/groups, /v1/courses/{id}
// Токен JUZ40 бетінің localStorage-ынан («token») оқылады және тек api.juz40-edu.kz-ке жіберіледі; сайтқа берілмейді.
(function(root) {
  'use strict';
  const API = 'https://api.juz40-edu.kz';
  const JUZ = 'https://juz40-edu.kz';
  const M = root.LiveModel;
  const {clean, norm} = M;
  const LIVE_TAG = 'Live сабақ';
  const REQUEST_LIMIT = 45000;
  const safeError = message => Object.assign(Error(message), {safe: true});
  const uncertainError = message => Object.assign(Error(message), {safe: false});

  // ---------- Authorisation ----------
  // The token is read from the person's own JUZ40 tab each time, so a logout or a new login is noticed at once.
  async function session(tabId) {
    let result;
    try {
      [result] = await chrome.scripting.executeScript({target: {tabId}, func: () => ({token: localStorage.getItem('token'), role: localStorage.getItem('role')})});
    } catch { throw safeError('JUZ40 бетінен сессия оқылмады. Бетті қайта жүктеп, қайталап көріңіз.'); }
    const {token, role} = result?.result || {};
    if (!token) throw safeError('JUZ40 аккаунтына кіріңіз (таңдалған бетте сессия жоқ).');
    return {token, role: String(role || '').replace(/"/g, '')};
  }

  // GET is always safe to repeat. A mutating request that got no answer may still have changed the site, so only a
  // definite 4xx rejection from the server is reported as safe; 5xx, timeouts and network errors stay «uncertain».
  async function request(s, method, path, {query, body} = {}) {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const mutating = method !== 'GET';
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), REQUEST_LIMIT);
    let response;
    try {
      response = await fetch(url, {method, signal: controller.signal, credentials: 'omit', headers: {Authorization: 'Bearer ' + s.token, Accept: 'application/json', ...(body !== undefined ? {'Content-Type': 'application/json'} : {})}, body: body !== undefined ? JSON.stringify(body) : undefined});
    } catch (e) {
      const message = e?.name === 'AbortError' ? 'JUZ40 API жауап бермеді.' : 'JUZ40 API-мен байланыс үзілді.';
      throw mutating ? uncertainError(message + ' Әрекет нәтижесін сайттан тексеріңіз.') : safeError(message);
    } finally { clearTimeout(timer); }
    const text = await response.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (response.ok) return data;
    const detail = typeof data === 'object' && data ? clean(data.message || data.error || data.detail || data.title || JSON.stringify(data)).slice(0, 300) : clean(text).slice(0, 300);
    if (response.status === 401) throw safeError('JUZ40 сессиясы аяқталған. Аккаунтқа қайта кіріп, бетті жаңартыңыз.');
    if (response.status === 403) throw safeError('Аккаунтта бұл әрекетке рұқсат жоқ (' + method + ' ' + path + ').');
    if (response.status >= 400 && response.status < 500) throw safeError(`JUZ40 сұрауды қабылдамады (${response.status}${detail ? ': ' + detail : ''}).`);
    const message = `JUZ40 API қатесі (${response.status}${detail ? ': ' + detail : ''}).`;
    throw mutating ? uncertainError(message + ' Әрекет нәтижесін сайттан тексеріңіз.') : safeError(message);
  }
  const get = (s, path, query) => request(s, 'GET', path, {query});

  // ---------- Dates ----------
  // The site sends local date + time as an ISO UTC string (dateHelper.timeAndDateToOneValue) and receives the same
  // moment back without a zone designator, which it treats as UTC (convertUTCToLocal). Both forms are accepted here.
  const toServer = (date, time) => new Date(`${date}T${time}:00`).toISOString();
  const serverDate = value => new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : value + 'Z');
  // A moment read from the server is sent back in the site's own form (ISO with «Z»), never as the zone-less text.
  const backToServer = value => { if (!value) return value ?? ''; const d = serverDate(value); return Number.isNaN(d.getTime()) ? value : d.toISOString(); };
  function fromServer(value) {
    if (!value) return {date: '', time: ''};
    const d = serverDate(value);
    if (Number.isNaN(d.getTime())) return {date: '', time: ''};
    const p = n => String(n).padStart(2, '0');
    return {date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}`};
  }

  // ---------- Addresses ----------
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function place(url) {
    let u;
    try { u = new URL(url); } catch { throw safeError('Сабақ мекенжайы белгісіз.'); }
    if (u.origin !== JUZ) throw safeError('Курс сілтемесі дұрыс емес.');
    const head = u.pathname.match(/^\/headTeacher\/subjects\/([^/]+)\/([^/]+)(?:\/methodologist-mode\/([^/]+)(?:\/([^/]+))?)?/);
    if (head) return {courseId: head[2], subjectId: head[1], lessonId: UUID.test(head[4] || '') ? head[4] : null, base: `${JUZ}/headTeacher/subjects/${head[1]}/${head[2]}`};
    const methodist = u.pathname.match(/^\/methodist\/course\/([^/]+)(?:\/([^/]+))?/);
    if (methodist) return {courseId: methodist[1], subjectId: null, lessonId: UUID.test(methodist[2] || '') ? methodist[2] : null, base: `${JUZ}/methodist/course/${methodist[1]}`};
    throw safeError('Курс немесе сабақ беті танылмады.');
  }
  const lessonUrl = (p, lessonId) => p.subjectId ? `${p.base}/methodologist-mode/${p.courseId}/${lessonId}` : `${p.base}/${lessonId}`;

  // ---------- Small helpers ----------
  const list = data => Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
  const unique = (items, label) => { if (items.length !== 1) throw Error(items.length ? `${label} бірнешеу табылды.` : `${label} табылмады.`); return items[0]; };
  const nameOf = x => clean(x?.name ?? x?.title ?? '');
  const linkOf = meeting => M.validLink(meeting?.meetingUrl) ? meeting.meetingUrl : '';
  const isLinked = meeting => !!(meeting?.sourceMeetingId || meeting?.sourceLesson);
  const escapeHtml = s => s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
  const instructionHtml = value => value.split('\n').filter(line => clean(line)).map(p => '<p><strong>' + escapeHtml(p) + '</strong></p>').join('');
  // Same reading as ui.js editorText: one line per paragraph, whitespace collapsed.
  function htmlText(html) {
    const blocks = [...String(html || '').matchAll(/<(p|li|h[1-4]|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => m[2]);
    const decode = s => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    return clean(blocks.length ? blocks.map(decode).join('\n') : decode(String(html || '')));
  }
  function htmlBold(html) {
    const blocks = [...String(html || '').matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => m[2]).filter(b => htmlText(b));
    return blocks.length > 0 && blocks.every(b => clean([...b.matchAll(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => htmlText(m[2])).join('')) === htmlText(b));
  }

  // ---------- Reference data ----------
  // The site itself loads the groups of a course only for the head-teacher role.
  async function groups(s, courseId) {
    const items = list(await get(s, `/v1/headteacher/courses/${courseId}/groups`));
    return items.map(g => ({id: g.id, name: clean(g.groupName || g.name || g.id)})).filter(g => g.id);
  }
  // rating-task-types is a list of tags; its exact shape is not documented, so the «Live сабақ» entry is found by
  // any of its text fields and sent back with the value the server gave it.
  const tagTexts = item => typeof item === 'string' ? [item] : Object.values(item || {}).filter(v => typeof v === 'string');
  const isLiveTag = item => tagTexts(item).some(t => norm(t) === norm(LIVE_TAG) || norm(t).replace(/[_\s-]/g, '') === 'LIVE');
  const tagValue = item => typeof item === 'string' ? item : item.value ?? item.code ?? item.key ?? item.type ?? item.id ?? item.name;
  const tagTypes = s => get(s, '/v1/lessons/rating-task-types').then(list);
  async function liveTag(s) { return tagValue(unique((await tagTypes(s)).filter(isLiveTag), `«${LIVE_TAG}» тапсырма тегі`)); }
  // The tag is reported by its label, as the page shows it, so model.diff compares it with «Live сабақ».
  async function tagLabel(s, value) {
    if (value === null || value === undefined || value === '') return '';
    const item = (await tagTypes(s)).find(i => tagValue(i) === value || (typeof value === 'object' && value && tagValue(value) === tagValue(i)));
    if (!item) return typeof value === 'object' ? clean(value.name || JSON.stringify(value)) : String(value);
    return isLiveTag(item) ? LIVE_TAG : clean(typeof item === 'string' ? item : item.nameKz || item.name || item.title || tagValue(item));
  }

  async function checkCourse(s, p, t) {
    const course = await get(s, `/v1/courses/${p.courseId}`);
    const name = nameOf(course);
    if (name && t.streamName && !norm(name).includes(norm(t.streamName))) throw safeError(`Курс ағымға сәйкес емес: «${name}».`);
    if (name && t.courseName && norm(name) !== norm(t.courseName)) throw safeError(`Курс атауы сәйкес емес: сайтта «${name}», кестеде «${t.courseName}».`);
    return course;
  }

  // ---------- Lesson lookup (same rules as content.js) ----------
  function lessonCandidates(t, lessons) {
    const exact = lessons.filter(l => norm(nameOf(l)) === norm(t.existingTitle || t.title));
    if (exact.length) return exact;
    const teacher = norm(t.teacher).split(' ').sort().join(' ');
    return lessons.filter(l => {
      const parts = nameOf(l).split('|');
      return parts.length === 3 && /LIVE\s*САБАҚ\s*№/i.test(parts[0]) && norm(parts[1]).split(' ').sort().join(' ') === teacher && norm(parts[2]) === norm(`${t.cohort}-АҒЫМ`) && new RegExp('№\\s*' + t.number + '(?:\\s|$)').test(parts[0]);
    });
  }
  const lessonsOf = (s, themeId) => get(s, /methodist/i.test(s.role) ? `/v2/methodist/themes/${themeId}/lessons` : `/v2/headteacher/themes/${themeId}/lessons`).then(list);

  async function open(s, t) {
    const p = place(t.at);
    await checkCourse(s, p, t);
    const themes = list(await get(s, '/v2/themes', {courseId: p.courseId, month: t.month, week: t.week}));
    // A week without a single theme is treated as a wrong month/week (see content.js, 22.10.2026).
    if (!themes.length) {
      if (!t.allowCreate) return {exists: false, missing: 'week', seen: []};
      throw safeError(`«${t.month}-АЙ ${t.week}-АПТА» аптасында сайтта бірде-бір тақырып жоқ. Ай мен апта дұрыс па? Тақырып пен сабақ құрылмады.`);
    }
    let theme = themes.filter(x => norm(nameOf(x)) === norm(t.theme));
    if (theme.length > 1) throw safeError('Бірдей LIVE тақырыбы бірнешеу. Қажетті тақырыпты қолмен тексеріңіз.');
    if (!theme.length) {
      if (!t.allowCreate) return {exists: false, missing: 'theme', seen: [...new Set(themes.map(nameOf).filter(n => /live/i.test(n)))].slice(0, 12)};
      const created = await request(s, 'POST', '/v1/themes', {body: {name: t.theme, month: t.month, week: t.week, courseId: p.courseId, startTime: toServer(t.date, '00:00')}});
      theme = created?.id ? [created] : list(await get(s, '/v2/themes', {courseId: p.courseId, month: t.month, week: t.week})).filter(x => norm(nameOf(x)) === norm(t.theme));
      if (theme.length !== 1) throw uncertainError('Тақырып құрылды ма — анықталмады. Сайттан тексеріңіз.');
    }
    const themeId = theme[0].id;
    const lessons = await lessonsOf(s, themeId);
    const candidates = lessonCandidates(t, lessons);
    if (candidates.length > 1) throw safeError('Бірнеше сәйкес сабақ бар. Қайталануды қолмен тексеріңіз.');
    if (candidates.length) return {exists: true, created: false, lessonUrl: lessonUrl(p, candidates[0].id)};
    if (!t.allowCreate) return {exists: false, missing: 'lesson', seen: [...new Set(lessons.map(nameOf).filter(n => /live\s*сабақ\s*№/i.test(n)))].slice(0, 12)};
    const created = await request(s, 'POST', '/v1/lessons', {body: {lessonType: 'PRACTICAL', themeId, name: t.title}});
    let id = created?.id;
    if (!id) { const again = lessonCandidates(t, await lessonsOf(s, themeId)); if (again.length !== 1) throw uncertainError('Сабақ құрылды ма — анықталмады. Сайттан тексеріңіз.'); id = again[0].id; }
    return {exists: true, created: true, lessonUrl: lessonUrl(p, id)};
  }

  // ---------- Reading a lesson ----------
  async function lessonFor(s, t) {
    const p = place(t.at);
    if (!p.lessonId) throw safeError('Сабақ әлі ашылмаған.');
    const lesson = await get(s, `/v1/lessons/${p.lessonId}`);
    if (!lesson || lesson.id && lesson.id !== p.lessonId) throw safeError('Сабақ оқылмады.');
    if (lesson.lessonType && lesson.lessonType !== 'PRACTICAL') throw safeError('Бұл сабақ Live сабақ (PRACTICAL) емес.');
    return {p, lesson, meetings: Array.isArray(lesson.meetings) ? lesson.meetings : []};
  }
  function meetingFor(t, meetings) {
    if (t.connectionLink) { const found = meetings.filter(m => linkOf(m) === t.connectionLink); if (found.length) return unique(found, 'Meet қосылымы'); }
    const match = meetings.filter(m => { const a = fromServer(m.startDate), b = fromServer(m.endDate); return a.date === t.date && a.time === t.start && b.time === t.end; });
    if (match.length) return unique(match, 'Күн/уақыты сәйкес қосылым');
    if (meetings.length === 1) return meetings[0];
    if (!meetings.length) return null;
    throw safeError('Қосылым бірмәнді анықталмады. Бұл сабақтағы қосылымды қолмен таңдаңыз.');
  }
  // Same fields and the same meaning as content.js snapshot(), so model.diff and runner.js work unchanged.
  async function readLesson(s, t, loaded) {
    const {p, lesson, meetings} = loaded || await lessonFor(s, t);
    const meeting = meetingFor(t, meetings);
    const all = await groups(s, p.courseId);
    const linked = isLinked(meeting);
    const start = fromServer(meeting?.startDate), end = fromServer(meeting?.endDate), deadline = fromServer(meeting?.deadline);
    const data = {
      title: nameOf(lesson), studentTitle: clean(meeting?.name ?? meeting?.sourceLesson?.name ?? ''),
      date: start.date, start: start.time, end: end.time, deadline: deadline.date, deadlineTime: deadline.time,
      attendance: meeting?.meetingMaxScore ?? '', percent: meeting?.minAttendancePercent ?? '', email: meeting?.organizerEmail || '',
      points: lesson.maxScore ?? '', tag: await tagLabel(s, lesson.ratingTaskType), rating: lesson.rating === true,
      instruction: htmlText(lesson.description), instructionBold: htmlBold(lesson.description),
      link: linkOf(meeting), linked, published: lesson.published === true, lessonUrl: lessonUrl(p, lesson.id || p.lessonId), connectionCount: meetings.length,
      editable: {}, inherited: {}
    };
    // In a connection linked to another lesson the meeting's own fields belong to the source lesson.
    for (const key of ['studentTitle', 'date', 'start', 'end', 'attendance', 'percent', 'email']) if (linked) { data.editable[key] = false; if (data[key] === '' || data[key] === null) data.inherited[key] = true; }
    if (meeting?.id && !linked) data.editable.email = false;
    const ids = new Set(meeting?.groupIds || []);
    data.groups = all.length > 0 && all.every(g => ids.has(g.id));
    data.groupNames = all.filter(g => ids.has(g.id)).map(g => g.name);
    return {data, meeting, lesson, p, groups: all};
  }
  const snapshot = async (s, t) => (await readLesson(s, t)).data;

  // ---------- Writing ----------
  function meetingRequest(t, all, {deadline = true} = {}) {
    if (!all.length) throw safeError('Курста топ жоқ.');
    return {name: clean(t.studentTitle), startDate: toServer(t.date, t.start), endDate: toServer(t.date, t.end), groupIds: all.map(g => g.id), minAttendancePercent: Number(t.percent), meetingMaxScore: Number(t.attendance), organizerEmail: t.email, ...(deadline ? {deadline: toServer(t.deadline, t.deadlineTime)} : {})};
  }
  async function checkOrganizer(s, email) {
    const emails = list(await get(s, '/v1/lessons/practics/meeting-organizer-emails')).map(e => String(typeof e === 'string' ? e : e?.email || e?.value || '').toLowerCase());
    if (!emails.includes(String(email).toLowerCase())) throw safeError(`Ұйымдастырушы email-і сайттың тізімінде жоқ: ${email}.`);
  }
  async function waitLink(s, t) {
    const until = Date.now() + 60000;
    while (Date.now() < until) {
      const {meetings} = await lessonFor(s, t);
      const fresh = meetings.filter(linkOf);
      if (fresh.length === 1) return linkOf(fresh[0]);
      if (fresh.length > 1) throw uncertainError('Бірнеше жаңа Meet пайда болды. Сайттан тексеріңіз.');
      await new Promise(r => setTimeout(r, 3000));
    }
    throw uncertainError('Meet сұрауы жіберілді, бірақ сілтеме 60 секундта пайда болмады. Сайттан тексеріңіз.');
  }
  async function createMeet(s, t) {
    const loaded = await lessonFor(s, t);
    const links = [...new Set(loaded.meetings.map(linkOf).filter(Boolean))];
    if (links.length) return {link: unique(links, 'Meet'), lessonUrl: lessonUrl(loaded.p, loaded.p.lessonId)};
    await checkCourse(s, loaded.p, t);
    const all = await groups(s, loaded.p.courseId);
    await checkOrganizer(s, t.email);
    const body = meetingRequest(t, all);
    // A connection without a link (left by an interrupted attempt) is reused instead of adding a second one.
    const blank = loaded.meetings.filter(m => !linkOf(m) && !isLinked(m));
    if (blank.length > 1) throw safeError('Сабақта бірнеше бос қосылым бар. Артығын сайтта өшіріңіз.');
    const response = blank.length
      ? await request(s, 'PUT', `/v1/lessons/practics/meetings/${blank[0].id}`, {body})
      : await request(s, 'POST', '/v1/lessons/practics/meetings', {body: {...body, lessonId: loaded.p.lessonId}});
    // No meeting of this lesson had a link before, so the one that has a link now is the new Meet.
    const answered = (Array.isArray(response?.meetings) ? response.meetings : []).filter(linkOf);
    const link = answered.length === 1 ? linkOf(answered[0]) : await waitLink(s, t);
    return {link, lessonUrl: lessonUrl(loaded.p, loaded.p.lessonId)};
  }
  async function attach(s, t) {
    if (!t.reuse?.published || !M.validLink(t.reuse.link)) throw safeError('Бастапқы жарияланған Meet расталмаған.');
    const loaded = await lessonFor(s, t);
    if (loaded.meetings.some(m => linkOf(m) === t.reuse.link)) return {link: t.reuse.link, lessonUrl: lessonUrl(loaded.p, loaded.p.lessonId)};
    if (loaded.meetings.some(linkOf)) throw safeError('Сабақта басқа Meet бар. Сілтеме автоматты ауыстырылмайды.');
    if (loaded.meetings.length) throw safeError('Сабақта бос қосылым бар. Оны сайтта өшіріп, қайта тексеріңіз.');
    const source = await lessonFor(s, {...t, at: t.reuse.lessonUrl, connectionLink: t.reuse.link});
    const original = unique(source.meetings.filter(m => linkOf(m) === t.reuse.link), 'Бастапқы кездесу');
    const meetingId = original.sourceMeetingId || original.id;
    const all = await groups(s, loaded.p.courseId);
    if (!all.length) throw safeError('Курста топ жоқ.');
    await request(s, 'POST', `/v1/lessons/practics/meetings/${meetingId}/links`, {body: {lessonId: loaded.p.lessonId, groupIds: all.map(g => g.id), deadline: toServer(t.deadline, t.deadlineTime)}});
    const after = await lessonFor(s, t);
    if (!after.meetings.some(m => linkOf(m) === t.reuse.link)) throw uncertainError('Байланыс сұрауы жіберілді, бірақ сабақта Meet көрінбейді. Сайттан тексеріңіз.');
    return {link: t.reuse.link, lessonUrl: lessonUrl(loaded.p, loaded.p.lessonId)};
  }
  // The body the site's own «Сақтау» sends: the lesson as read, with the changed fields and every meeting mapped back.
  function practicalBody(lesson, patch) {
    const meetings = (lesson.meetings || []).map(m => ({id: m.id ?? '', sourceMeetingId: m.sourceMeetingId ?? null, sourceLesson: m.sourceLesson ?? null, meetingUrl: m.meetingUrl ?? null, meetingStatus: m.meetingStatus ?? 'SCHEDULED', recordingUrl: m.recordingUrl ?? null, startDate: backToServer(m.startDate), endDate: backToServer(m.endDate), groupIds: m.groupIds || [], meetingMaxScore: m.meetingMaxScore, minAttendancePercent: m.minAttendancePercent, organizerEmail: m.organizerEmail}));
    return {...lesson, ...patch, meetings};
  }
  async function lessonPatch(s, t, keys) {
    const patch = {};
    if (keys.includes('title')) patch.name = t.title;
    if (keys.includes('points')) patch.maxScore = Number(t.points);
    if (keys.includes('rating') || keys.includes('tag')) { patch.rating = true; patch.ratingTaskType = await liveTag(s); }
    if (keys.includes('instruction')) patch.description = instructionHtml(t.instruction);
    return patch;
  }
  async function fillNotes(s, t) {
    const loaded = await lessonFor(s, t);
    if (loaded.lesson.published) throw safeError('Жарияланған сабақ өзгертілмейді.');
    const patch = await lessonPatch(s, t, ['title', 'rating', 'tag', 'points', 'instruction']);
    await request(s, 'PUT', `/v1/lessons/practics/${loaded.p.lessonId}`, {body: practicalBody(loaded.lesson, patch)});
    return {lessonUrl: lessonUrl(loaded.p, loaded.p.lessonId)};
  }
  const meetingKeys = ['studentTitle', 'date', 'start', 'end', 'deadline', 'deadlineTime', 'attendance', 'percent', 'groups', 'email'];
  async function patch(s, t) {
    const current = await readLesson(s, t);
    const changed = t.changes || [];
    if (!changed.length) return current.data;
    for (const key of changed) {
      if (!Object.hasOwn(M.fieldLabels, key) || key === 'link') throw safeError('Түзетуге болмайтын өріс: ' + key);
      if (clean(current.data[key]) !== clean(t.baseline?.[key])) throw safeError('Сабақ тексеруден кейін өзгерген. Қайта тексеріңіз: ' + M.fieldLabels[key]);
    }
    if (current.data.published) throw safeError('Түзету үшін сабақтың жариялануын уақытша өшіру керек.');
    const meetingChanges = changed.filter(k => meetingKeys.includes(k)), lessonChanges = changed.filter(k => !meetingKeys.includes(k));
    if (meetingChanges.length) {
      const m = current.meeting;
      if (!m?.id) throw safeError('Қосылым табылмады.');
      if (meetingChanges.includes('email')) throw safeError('Құрылған Meet-тің ұйымдастырушы email-і сайтта өзгертілмейді.');
      if (isLinked(m)) {
        const allowed = ['groups', 'deadline', 'deadlineTime'];
        const other = meetingChanges.filter(k => !allowed.includes(k));
        if (other.length) throw safeError('Бұл өріс бастапқы кездесуде түзетіледі: ' + other.map(k => M.fieldLabels[k]).join(', '));
        await request(s, 'PATCH', `/v1/lessons/practics/meeting-links/${m.id}`, {body: {groupIds: current.groups.map(g => g.id), deadline: toServer(t.deadline, t.deadlineTime)}});
      } else {
        const keepDeadline = meetingChanges.includes('deadline') || meetingChanges.includes('deadlineTime');
        const body = meetingRequest({...t, email: m.organizerEmail || t.email}, current.groups, {deadline: keepDeadline});
        if (!meetingChanges.includes('groups')) body.groupIds = m.groupIds || [];
        // Only the selected fields change; the rest keep what the site has now.
        const keep = {studentTitle: ['name', clean(m.name)], attendance: ['meetingMaxScore', m.meetingMaxScore], percent: ['minAttendancePercent', m.minAttendancePercent]};
        for (const [key, [prop, value]] of Object.entries(keep)) if (!meetingChanges.includes(key)) body[prop] = value;
        if (!['date', 'start', 'end'].some(k => meetingChanges.includes(k))) { body.startDate = backToServer(m.startDate); body.endDate = backToServer(m.endDate); }
        await request(s, 'PUT', `/v1/lessons/practics/meetings/${m.id}`, {body});
      }
    }
    if (lessonChanges.length) {
      const fresh = await lessonFor(s, t);
      await request(s, 'PUT', `/v1/lessons/practics/${fresh.p.lessonId}`, {body: practicalBody(fresh.lesson, await lessonPatch(s, t, lessonChanges))});
    }
    return {link: current.data.link, lessonUrl: current.data.lessonUrl};
  }
  // With the API every step above is already saved on the server; «Сақтау» only confirms the state before publishing.
  async function save(s, t) {
    const {data} = await readLesson(s, t);
    if (data.published) throw safeError('Жарияланған сабақ өзгертілмейді.');
    if (!M.validLink(data.link)) throw safeError('Meet сілтемесі жоқ.');
    return {link: data.link, lessonUrl: data.lessonUrl};
  }
  async function setPublished(s, t, value) {
    const loaded = await lessonFor(s, t);
    if (loaded.lesson.published === value) return {lessonUrl: lessonUrl(loaded.p, loaded.p.lessonId)};
    if (!value && t.approvedUnpublish !== true) throw safeError('Жарияланған сабақты түзету таңдалмаған.');
    if (value && !loaded.meetings.some(linkOf)) throw safeError('Meet сілтемесі жоқ.');
    const r = await request(s, 'PATCH', `/v1/lessons/${loaded.p.lessonId}/publish`, {query: {publish: value}, body: {}});
    if (r && typeof r.published === 'boolean' && r.published !== value) throw uncertainError('Жариялау күйі өзгермеді. Сайттан тексеріңіз.');
    return {lessonUrl: lessonUrl(loaded.p, loaded.p.lessonId)};
  }

  // ---------- Read-only check ----------
  async function diagnose(s, at) {
    const checks = [], add = (label, ok, detail = '') => checks.push({label, ok: !!ok, detail: String(detail || '')});
    const probe = async (label, fn, describe = () => 'жауап келді') => { try { const v = await fn(); add(label, true, describe(v)); return v; } catch (e) { add(label, false, e.message); return null; } };
    add('JUZ40 сессиясы', true, 'токен бар' + (s.role ? ' · рөлі ' + s.role : ''));
    let p = null;
    try { p = place(at); } catch (e) { add('Бет түрі', false, e.message); }
    if (p) {
      const course = await probe('Курс', () => get(s, `/v1/courses/${p.courseId}`), c => nameOf(c) || p.courseId);
      if (course) add('Курс пәні', true, nameOf(course));
      await probe('Курс топтары', () => groups(s, p.courseId), g => g.length + ' топ');
      await probe('Ұйымдастырушы email-дері', () => get(s, '/v1/lessons/practics/meeting-organizer-emails').then(list), e => e.length + ' email');
      await probe(`«${LIVE_TAG}» тапсырма тегі`, () => liveTag(s), v => 'мәні ' + JSON.stringify(v));
      await probe('Тақырыптар (API)', () => get(s, '/v2/themes', {courseId: p.courseId}).then(list), l => l.length + ' тақырып');
      if (p.lessonId) {
        const lesson = await probe('Сабақ', () => get(s, `/v1/lessons/${p.lessonId}`), l => nameOf(l) + ' · ' + (l.lessonType || '?'));
        if (lesson) {
          const meetings = lesson.meetings || [];
          add('Google Meet қосылымдары', true, meetings.length + ' қосылым');
          meetings.forEach((m, i) => add(`${i + 1}-қосылым`, true, [clean(m.name), fromServer(m.startDate).date, fromServer(m.startDate).time + '–' + fromServer(m.endDate).time, linkOf(m) || 'сілтеме жоқ', isLinked(m) ? 'байланысқан' : ''].filter(Boolean).join(' · ')));
          add('Жариялау', true, lesson.published ? 'жарияланған' : 'жарияланбаған');
        }
      }
    }
    return {url: at ? new URL(at).origin + new URL(at).pathname : '', page: p?.lessonId ? 'lesson' : p ? 'course' : 'unknown', checks, structure: {formControls: [], buttons: [], switches: [], dialogs: 0, api: API}};
  }

  const actions = {open, snapshot, createMeet, attach, fillNotes, patch, save, publish: (s, t) => setPublished(s, t, true), unpublish: (s, t) => setPublished(s, t, false)};
  async function call(tabId, action, payload) {
    if (!Object.hasOwn(actions, action)) throw safeError('Белгісіз әрекет: ' + action);
    const s = await session(tabId);
    return actions[action](s, payload || {});
  }
  root.JuzApi = {call, diagnose: async (tabId, at) => diagnose(await session(tabId), at), toServer, fromServer, place, htmlText, htmlBold, instructionHtml, lessonCandidates, meetingFor, practicalBody, API};
})(globalThis);
